import * as THREE from 'three/webgpu';

export interface RenderTargetOptions {
  format?: THREE.PixelFormat;
  type?: THREE.TextureDataType;
  depthBuffer?: boolean;
  stencilBuffer?: boolean;
  minFilter?: THREE.MinificationTextureFilter;
  magFilter?: THREE.MagnificationTextureFilter;
  generateMipmaps?: boolean;
}

export type ContextLostCallback = () => void;
export type ContextRestoredCallback = () => void;

/**
 * Reusable offscreen render target caching and GPU context lifecycle manager (D-24).
 * Eliminates VRAM allocation thrashing by pooling RenderTarget instances keyed by resolution and format.
 */
export class PassPool {
  private idlePool = new Map<string, THREE.RenderTarget[]>();
  private inUseTargets = new Set<THREE.RenderTarget>();
  private targetToKey = new Map<THREE.RenderTarget, string>();

  private lostSubscribers = new Set<ContextLostCallback>();
  private restoredSubscribers = new Set<ContextRestoredCallback>();

  /**
   * Acquires a RenderTarget matching width, height, and format.
   * Reuses an idle cached target if available, or instantiates a new one.
   */
  acquire(
    width: number,
    height: number,
    optionsOrFormat?: THREE.PixelFormat | RenderTargetOptions
  ): THREE.RenderTarget {
    const options: RenderTargetOptions =
      typeof optionsOrFormat === 'number'
        ? { format: optionsOrFormat }
        : optionsOrFormat || {};

    const format = options.format ?? THREE.RGBAFormat;
    const type = options.type ?? THREE.UnsignedByteType;
    const depthBuffer = options.depthBuffer ?? false;
    const stencilBuffer = options.stencilBuffer ?? false;

    const key = `${width}:${height}:${format}:${type}`;

    const idleList = this.idlePool.get(key);
    if (idleList && idleList.length > 0) {
      const target = idleList.pop()!;
      this.inUseTargets.add(target);
      return target;
    }

    const target = new THREE.RenderTarget(width, height, {
      format,
      type,
      depthBuffer,
      stencilBuffer,
      minFilter: options.minFilter ?? THREE.LinearFilter,
      magFilter: options.magFilter ?? THREE.LinearFilter,
      generateMipmaps: options.generateMipmaps ?? false,
    });

    this.targetToKey.set(target, key);
    this.inUseTargets.add(target);
    return target;
  }

  /**
   * Releases an acquired target back into the idle pool for reuse in subsequent passes.
   */
  release(target: THREE.RenderTarget): void {
    if (!this.inUseTargets.has(target)) {
      return;
    }

    this.inUseTargets.delete(target);
    const key = this.targetToKey.get(target);
    if (!key) {
      target.dispose();
      return;
    }

    let idleList = this.idlePool.get(key);
    if (!idleList) {
      idleList = [];
      this.idlePool.set(key, idleList);
    }
    idleList.push(target);
  }

  /**
   * Called at the start or end of each frame to recycle any targets still marked in-use.
   */
  resetFrame(): void {
    for (const target of Array.from(this.inUseTargets)) {
      this.release(target);
    }
  }

  /**
   * Prunes idle targets if the idle count for any key exceeds maxIdleCount,
   * releasing unneeded GPU textures.
   */
  prune(maxIdleCount: number): void {
    for (const [key, idleList] of this.idlePool.entries()) {
      while (idleList.length > maxIdleCount) {
        const excess = idleList.pop();
        if (excess) {
          this.targetToKey.delete(excess);
          excess.dispose();
        }
      }
      if (idleList.length === 0) {
        this.idlePool.delete(key);
      }
    }
  }

  /**
   * Disposes all pooled and in-use render targets and purges internal tracking.
   */
  disposeAll(): void {
    for (const idleList of this.idlePool.values()) {
      for (const target of idleList) {
        target.dispose();
      }
    }
    this.idlePool.clear();

    for (const target of this.inUseTargets) {
      target.dispose();
    }
    this.inUseTargets.clear();
    this.targetToKey.clear();
  }

  /**
   * Registers subscriber for context lost event.
   */
  onContextLost(callback: ContextLostCallback): () => void {
    this.lostSubscribers.add(callback);
    return () => this.lostSubscribers.delete(callback);
  }

  /**
   * Registers subscriber for context restored event.
   */
  onContextRestored(callback: ContextRestoredCallback): () => void {
    this.restoredSubscribers.add(callback);
    return () => this.restoredSubscribers.delete(callback);
  }

  /**
   * Programmatic handler for context lost, disposing stale GPU resources and notifying subscribers.
   */
  handleContextLost(): void {
    this.disposeAll();
    for (const subscriber of this.lostSubscribers) {
      try {
        subscriber();
      } catch (err) {
        console.error('[PassPool] Error in context lost subscriber:', err);
      }
    }
  }

  /**
   * Programmatic handler for context restored, notifying subscribers for clean pipeline reconstruction.
   */
  handleContextRestored(): void {
    this.disposeAll();
    for (const subscriber of this.restoredSubscribers) {
      try {
        subscriber();
      } catch (err) {
        console.error('[PassPool] Error in context restored subscriber:', err);
      }
    }
  }

  /**
   * Attaches DOM event listeners to HTMLCanvasElement for WebGL2 context loss recovery.
   * Returns an unbind cleanup function.
   */
  attachContextListeners(
    canvas: HTMLCanvasElement,
    onRestored?: ContextRestoredCallback,
    onLost?: ContextLostCallback
  ): () => void {
    if (onLost) this.onContextLost(onLost);
    if (onRestored) this.onContextRestored(onRestored);

    const onWebGlContextLost = (e: Event) => {
      e.preventDefault();
      this.handleContextLost();
    };

    const onWebGlContextRestored = () => {
      this.handleContextRestored();
    };

    canvas.addEventListener('webglcontextlost', onWebGlContextLost as EventListener);
    canvas.addEventListener('webglcontextrestored', onWebGlContextRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', onWebGlContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onWebGlContextRestored);
    };
  }

  /**
   * Attaches WebGPU device.lost handler if available.
   */
  attachDevice(device: any): void {
    if (device && device.lost && typeof device.lost.then === 'function') {
      device.lost.then((info: any) => {
        console.warn('[PassPool] WebGPU device lost:', info);
        this.handleContextLost();
      });
    }
  }

  // Introspection helpers
  getTotalCount(): number {
    let idleCount = 0;
    for (const list of this.idlePool.values()) {
      idleCount += list.length;
    }
    return idleCount + this.inUseTargets.size;
  }

  getIdleCount(): number {
    let count = 0;
    for (const list of this.idlePool.values()) {
      count += list.length;
    }
    return count;
  }

  getInUseCount(): number {
    return this.inUseTargets.size;
  }
}
