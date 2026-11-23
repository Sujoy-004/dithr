import * as THREE from 'three/webgpu';
import {
  uniform,
  texture,
  vec2,
  vec4,
} from 'three/tsl';
import { StudioRenderer } from './Renderer';
import { TextureAtlas } from './TextureAtlas';
import { PassPool } from './graph/PassPool';
import {
  GraphCompiler,
  computeTopologyHash,
  type CompiledPipeline,
} from './graph/GraphCompiler';
import { evaluateTierBudget, type QualityTier } from './capabilities';
import type {
  ActiveEffectPass,
  EffectEnvironment,
} from './registry/types';
import type { ToneSettings, AsciiSettings, EffectMode } from '../types/studio';

export interface PipelineOptions {
  canvas: HTMLCanvasElement;
}

export type ColorGradingPreset = 'original' | 'green' | 'amber' | 'cyan';

/**
 * Shader Engine 2.0 Dynamic Composable Pipeline (D-01, D-06, D-21, D-22, D-23, D-24, FX-01).
 * Features hybrid pointwise pass fusion, pooled intermediate RenderTargets,
 * quality tier budget enforcement, and zero-recompile uniform updates.
 */
export class StudioPipeline {
  private studioRenderer: StudioRenderer;
  private renderer: THREE.WebGPURenderer | null = null;
  private textureAtlas: TextureAtlas;
  private passPool: PassPool;
  private graphCompiler: GraphCompiler;

  // Scene & Display Mesh
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private displayMesh: THREE.Mesh;
  private fallbackMaterial: THREE.MeshBasicNodeMaterial;

  // Dimensions
  private width = 800;
  private height = 600;

  // Input source texture
  private sourceTexture: THREE.Texture | null = null;
  private sourceTextureNode: any = null;

  // Shared Global Uniforms
  private resolutionUniform: any;
  private timeUniform: any;
  private seedUniform: any;

  // Active stack & pipeline cache (D-22)
  private currentStack: ActiveEffectPass[] = [];
  private currentTier: QualityTier = 'high';
  private pipelineCache = new Map<string, CompiledPipeline>();
  private currentPipeline: CompiledPipeline | null = null;
  private uniformsMap = new Map<string, any>();

  // Legacy single-effect state for backwards compatibility
  private activeEffect: EffectMode = 'ascii';
  private colorGrading: ColorGradingPreset = 'original';
  private legacyTone: ToneSettings = {
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    hueRotation: 0.0,
    gamma: 1.0,
    invert: false,
  };
  private legacyAscii: AsciiSettings = {
    cellScale: 8.0,
    charSpacing: 0.0,
    charAspect: 0.5,
    rampPreset: 'standard',
    customChars: '',
  };
  private legacyParams: Record<string, number> = {};

  private isDisposed = false;
  private unbindContextListeners: (() => void) | null = null;

  constructor(options: PipelineOptions) {
    this.studioRenderer = new StudioRenderer({ canvas: options.canvas });
    this.textureAtlas = new TextureAtlas();
    this.passPool = new PassPool();
    this.graphCompiler = new GraphCompiler();

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Initial uniform nodes
    this.resolutionUniform = uniform(vec2(1, 1));
    this.timeUniform = uniform(0.0);
    this.seedUniform = uniform(1.0);

    this.fallbackMaterial = new THREE.MeshBasicNodeMaterial();
    this.fallbackMaterial.colorNode = vec4(0.06, 0.06, 0.06, 1.0);

    const planeGeo = new THREE.PlaneGeometry(2, 2);
    this.displayMesh = new THREE.Mesh(planeGeo, this.fallbackMaterial);
    this.scene.add(this.displayMesh);

    // Attach GPU context lifecycle listeners (D-24)
    this.unbindContextListeners = this.passPool.attachContextListeners(
      options.canvas,
      () => this.handleContextRestored(),
      () => this.handleContextLost()
    );
  }

  async init(): Promise<void> {
    await this.studioRenderer.init();
    this.renderer = this.studioRenderer.getRenderer();
    this.textureAtlas.updateRamp('standard');
    this.syncLegacyStack();
  }

  /**
   * Sets or updates the active effect stack per D-01, D-21, D-22, D-23.
   * Rebuilds compiled materials ONLY when stack topology changes; otherwise mutates uniforms in-place.
   */
  syncStack(activeStack: ActiveEffectPass[], tier: QualityTier = this.currentTier): void {
    this.currentTier = tier;

    // 1. Enforce Quality Tier Budget (D-23, T-02-04)
    const { allowedStack } = evaluateTierBudget(activeStack, tier);
    this.currentStack = allowedStack;

    // 2. Compute topology hash on allowed enabled passes (D-22)
    const newHash = computeTopologyHash(allowedStack);

    // If topology matches current pipeline, retain current compiled material and update uniforms
    if (this.currentPipeline && this.currentPipeline.topologyHash === newHash) {
      for (const pass of allowedStack) {
        if (!pass.enabled) continue;
        for (const [k, v] of Object.entries(pass.parameters)) {
          this.updateUniform(pass.instanceId, k, v);
        }
        this.updateUniform(pass.instanceId, 'intensity', pass.intensity);
      }
      return;
    }

    // 3. Topology changed: retrieve cached pipeline or compile new one
    let pipeline = this.pipelineCache.get(newHash);
    if (!pipeline) {
      const stages = this.graphCompiler.planExecutionStages(allowedStack);
      const env: EffectEnvironment = {
        resolution: this.resolutionUniform,
        time: this.timeUniform,
        seed: this.seedUniform,
        textureAtlas: this.textureAtlas.getTexture(),
      };

      pipeline = this.graphCompiler.compileGraph(
        this.sourceTextureNode,
        stages,
        this.uniformsMap,
        env
      );
      this.pipelineCache.set(newHash, pipeline);
    }

    this.currentPipeline = pipeline;
    this.displayMesh.material = pipeline.finalMaterial;
  }

  /**
   * Mutates an existing TSL UniformNode value in-place without triggering graph compilation (D-22).
   */
  updateUniform(instanceId: string, paramKey: string, value: any): void {
    const key = `${instanceId}:${paramKey}`;
    const u = this.uniformsMap.get(key);
    if (u && typeof u === 'object' && 'value' in u) {
      u.value = value;
    }

    // Keep parameters state synchronized
    const pass = this.currentStack.find((p) => p.instanceId === instanceId);
    if (pass && pass.parameters) {
      pass.parameters[paramKey] = value;
    }
  }

  /**
   * Sets the global seed uniform value for deterministic snapshot testing (D-27).
   */
  setSeed(seed: number): void {
    if (this.seedUniform && typeof this.seedUniform === 'object' && 'value' in this.seedUniform) {
      this.seedUniform.value = seed;
    }
  }

  /**
   * Sets the global time uniform value for frozen/deterministic playback (D-27).
   */
  setTime(time: number): void {
    if (this.timeUniform && typeof this.timeUniform === 'object' && 'value' in this.timeUniform) {
      this.timeUniform.value = time;
    }
  }

  setSourceTexture(tex: THREE.Texture): void {
    this.sourceTexture = tex;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    this.sourceTextureNode = texture(tex);
    if (!this.sourceTextureNode.uv && typeof this.sourceTextureNode.sample === 'function') {
      this.sourceTextureNode.uv = (c: any) => this.sourceTextureNode.sample(c);
    }

    // Clear pipeline cache so new source texture node is bound
    this.disposePipelineCache();
    this.syncStack(this.currentStack);
  }

  clearSource(): void {
    if (this.sourceTexture) {
      this.sourceTexture.dispose();
      this.sourceTexture = null;
    }
    this.sourceTextureNode = null;
    this.disposePipelineCache();
    this.syncStack(this.currentStack);
  }

  // Backwards compatibility: updates pre-tone settings
  updateTone(settings: ToneSettings): void {
    this.legacyTone = { ...settings };
    this.updateUniform('legacy-tone', 'brightness', settings.brightness);
    this.updateUniform('legacy-tone', 'contrast', settings.contrast);
    this.updateUniform('legacy-tone', 'saturation', settings.saturation);
    this.updateUniform('legacy-tone', 'hueRotation', settings.hueRotation);
    this.updateUniform('legacy-tone', 'gamma', settings.gamma);
    this.updateUniform('legacy-tone', 'invert', settings.invert ? 1.0 : 0.0);
  }

  // Backwards compatibility: updates ASCII settings
  updateAscii(settings: AsciiSettings): void {
    this.legacyAscii = { ...settings };
    this.textureAtlas.updateRamp(settings.rampPreset, settings.customChars);

    this.updateUniform('legacy-ascii', 'cellScale', settings.cellScale);
    this.updateUniform('legacy-ascii', 'charSpacing', settings.charSpacing);
    this.updateUniform('legacy-ascii', 'charAspect', settings.charAspect);
    this.updateUniform('legacy-ascii', 'rampLength', this.textureAtlas.getCharCount());
  }

  // Backwards compatibility: updates generic parameter
  updateEffectParam(key: string, value: number): void {
    this.legacyParams[key] = value;
    this.updateUniform(`legacy-${this.activeEffect}`, key, value);
  }

  // Backwards compatibility: switches active single effect
  setEffect(effect: EffectMode): void {
    if (this.activeEffect !== effect) {
      this.activeEffect = effect;
      this.syncLegacyStack();
    }
  }

  // Backwards compatibility: sets color grading
  setColorGrading(preset: ColorGradingPreset): void {
    if (this.colorGrading !== preset) {
      this.colorGrading = preset;
      this.syncLegacyStack();
    }
  }

  /**
   * Synthesizes and synchronizes a legacy single-effect stack for backwards compatibility.
   */
  private syncLegacyStack(): void {
    const stack: ActiveEffectPass[] = [];

    // 1. Tone pass
    stack.push({
      instanceId: 'legacy-tone',
      effectId: 'tone',
      enabled: true,
      intensity: 1.0,
      blendMode: 'normal',
      parameters: {
        brightness: this.legacyTone.brightness,
        contrast: this.legacyTone.contrast,
        saturation: this.legacyTone.saturation,
        hueRotation: this.legacyTone.hueRotation,
        gamma: this.legacyTone.gamma,
        invert: this.legacyTone.invert ? 1.0 : 0.0,
      },
    });

    // 2. Primary effect pass
    if (this.activeEffect === 'ascii') {
      stack.push({
        instanceId: 'legacy-ascii',
        effectId: 'ascii',
        enabled: true,
        intensity: 1.0,
        blendMode: 'normal',
        parameters: {
          cellScale: this.legacyAscii.cellScale,
          charSpacing: this.legacyAscii.charSpacing,
          charAspect: this.legacyAscii.charAspect,
          rampLength: this.textureAtlas.getCharCount(),
        },
      });
    } else if (this.activeEffect !== 'tone' && this.activeEffect !== 'vhs') {
      stack.push({
        instanceId: `legacy-${this.activeEffect}`,
        effectId: this.activeEffect,
        enabled: true,
        intensity: 1.0,
        blendMode: 'normal',
        parameters: { ...this.legacyParams },
      });
    }

    this.syncStack(stack);
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.resolutionUniform.value.set(width, height);
    this.studioRenderer.setSize(width, height);
    this.passPool.prune(2);
  }

  /**
   * Renders the execution graph. Intermediate stages execute into pooled render targets,
   * and the final stage renders onto the canvas display mesh (D-21, D-24).
   */
  render(timeSeconds: number = 0): void {
    if (this.isDisposed || !this.renderer) return;
    this.timeUniform.value = timeSeconds;

    if (this.sourceTexture instanceof THREE.VideoTexture) {
      const vid = this.sourceTexture.image as HTMLVideoElement | undefined;
      if (vid && vid.readyState >= 2) {
        this.sourceTexture.needsUpdate = true;
      }
    }

    this.passPool.resetFrame();

    if (!this.currentPipeline || this.currentPipeline.stages.length <= 1) {
      this.displayMesh.material = this.currentPipeline
        ? this.currentPipeline.finalMaterial
        : this.fallbackMaterial;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Multi-stage execution with PassPool intermediate targets (D-21, D-24)
    const stages = this.currentPipeline.stageDescriptors;
    const stageCount = stages.length;

    for (let i = 0; i < stageCount - 1; i++) {
      const stageDesc = stages[i];
      const target = this.passPool.acquire(
        this.width,
        this.height,
        stageDesc.targetDescriptor
      );

      this.displayMesh.material = stageDesc.material;
      this.renderer.setRenderTarget(target);
      this.renderer.render(this.scene, this.camera);

      // Pass target texture to next stage's input node
      const nextStage = stages[i + 1];
      if (nextStage.inputTextureNode) {
        nextStage.inputTextureNode.value = target.texture;
      }
    }

    // Final stage renders to canvas output
    this.displayMesh.material = this.currentPipeline.finalMaterial;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  private handleContextLost(): void {
    this.passPool.disposeAll();
    this.disposePipelineCache();
  }

  private handleContextRestored(): void {
    this.passPool.disposeAll();
    this.disposePipelineCache();
    this.syncStack(this.currentStack);
  }

  private disposePipelineCache(): void {
    for (const pipeline of this.pipelineCache.values()) {
      pipeline.dispose();
    }
    this.pipelineCache.clear();
    this.currentPipeline = null;
  }

  getRenderer(): StudioRenderer {
    return this.studioRenderer;
  }

  getPassPool(): PassPool {
    return this.passPool;
  }

  getCurrentPipeline(): CompiledPipeline | null {
    return this.currentPipeline;
  }

  getCurrentStack(): ActiveEffectPass[] {
    return this.currentStack;
  }

  getTopologyHash(): string {
    return this.currentPipeline?.topologyHash || '__empty__';
  }

  getUniformsMap(): Map<string, any> {
    return this.uniformsMap;
  }

  dispose(): void {
    this.isDisposed = true;
    if (this.unbindContextListeners) {
      this.unbindContextListeners();
      this.unbindContextListeners = null;
    }
    this.disposePipelineCache();
    this.passPool.disposeAll();
    this.textureAtlas.dispose();
    this.fallbackMaterial.dispose();
    this.displayMesh.geometry.dispose();
    this.studioRenderer.dispose();
  }
}
