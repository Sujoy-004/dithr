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
import { getEffectDefinition } from './registry/index';
import type {
  ActiveEffectPass,
  EffectEnvironment,
} from './registry/types';
import type { ToneSettings, AsciiSettings } from '../types/studio';

export interface PipelineOptions {
  canvas: HTMLCanvasElement;
}

const PRE_TONE_ID = '__preTone__';

function isToneNeutral(settings: ToneSettings): boolean {
  return (
    settings.brightness === 1 &&
    settings.contrast === 1 &&
    settings.saturation === 1 &&
    settings.hueRotation === 0 &&
    settings.gamma === 1 &&
    !settings.invert
  );
}

/**
 * Shader Engine 2.0 Dynamic Composable Pipeline (D-01, D-06, D-21, D-22, D-23, D-24, FX-01).
 * Features hybrid pointwise pass fusion, pooled HalfFloatType intermediate RenderTargets,
 * quality tier budget enforcement, Stage-0 pre-tone, and zero-recompile uniform updates.
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
  private atlasPaddingUniform: any;

  // Stage-0 Pre-Tone state
  private preToneActive = false;
  private preToneUniforms: Record<string, any>;

  // Active stack & pipeline cache (D-22)
  private currentStack: ActiveEffectPass[] = [];
  private currentTier: QualityTier = 'high';
  private pipelineCache = new Map<string, CompiledPipeline>();
  private currentPipeline: CompiledPipeline | null = null;
  private currentCacheKey: string | null = null;
  private uniformsMap = new Map<string, any>();

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
    this.atlasPaddingUniform = uniform(vec2(0.06, 0.06));

    // Stage-0 pre-tone uniforms
    this.preToneUniforms = {
      brightness: uniform(1.0),
      contrast: uniform(1.0),
      saturation: uniform(1.0),
      hueRotation: uniform(0.0),
      gamma: uniform(1.0),
      invert: uniform(0.0),
    };
    for (const [k, u] of Object.entries(this.preToneUniforms)) {
      this.uniformsMap.set(`${PRE_TONE_ID}:${k}`, u);
    }

    this.fallbackMaterial = new THREE.MeshBasicNodeMaterial();
    // Linear-space match for #0c0d10 ink so standby canvas blends seamlessly with stage
    this.fallbackMaterial.colorNode = vec4(0.004, 0.0045, 0.006, 1.0);

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
    const pad = this.textureAtlas.getSlotPaddingRatio();
    this.atlasPaddingUniform.value.set(pad.padX, pad.padY);
    this.syncStack(this.currentStack, this.currentTier);
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
    const cacheKey = this.preToneActive ? `${newHash}::preTone` : newHash;

    // Keep glyph ramp lengths synced with the active atlas
    const charCount = this.textureAtlas.getCharCount();

    // If topology matches current pipeline, retain current compiled material and update uniforms
    if (this.currentPipeline && this.currentCacheKey === cacheKey) {
      for (const pass of allowedStack) {
        if (!pass.enabled) continue;
        for (const [k, v] of Object.entries(pass.parameters)) {
          this.updateUniform(pass.instanceId, k, v);
        }
        this.updateUniform(pass.instanceId, 'intensity', pass.intensity);
        if (pass.effectId === 'ascii' || pass.effectId === 'matrix' || pass.effectId === 'threeD') {
          this.updateUniform(pass.instanceId, 'rampLength', charCount);
        }
      }
      return;
    }

    // 3. Topology changed: retrieve cached pipeline or compile new one
    let pipeline = this.pipelineCache.get(cacheKey);
    if (!pipeline) {
      const stages = this.graphCompiler.planExecutionStages(allowedStack);
      const env: EffectEnvironment = {
        resolution: this.resolutionUniform,
        time: this.timeUniform,
        seed: this.seedUniform,
        textureAtlas: this.textureAtlas.getTexture(),
        atlasPadding: this.atlasPaddingUniform,
        preToneActive: this.preToneActive,
        preToneUniforms: this.preToneUniforms,
      };

      pipeline = this.graphCompiler.compileGraph(
        this.sourceTextureNode,
        stages,
        this.uniformsMap,
        env
      );
      this.pipelineCache.set(cacheKey, pipeline);
    }

    this.currentPipeline = pipeline;
    this.currentCacheKey = cacheKey;
    this.displayMesh.material = pipeline.finalMaterial;

    for (const pass of allowedStack) {
      if (!pass.enabled) continue;
      if (pass.effectId === 'ascii' || pass.effectId === 'matrix' || pass.effectId === 'threeD') {
        this.updateUniform(pass.instanceId, 'rampLength', charCount);
      }
    }
  }

  /**
   * Mutates an existing TSL UniformNode value in-place without triggering graph compilation (D-22).
   * Resolves 'select' string values to option indices and booleans to 0.0 / 1.0.
   */
  updateUniform(instanceId: string, paramKey: string, value: any): void {
    const pass = this.currentStack.find((p) => p.instanceId === instanceId);
    let resolvedValue = value;

    if (pass) {
      const def = getEffectDefinition(pass.effectId);
      const schema = def?.parameters?.[paramKey];
      if (schema?.type === 'select' && Array.isArray(schema.options)) {
        resolvedValue = Math.max(0, schema.options.indexOf(String(value)));
      } else if (typeof value === 'boolean') {
        resolvedValue = value ? 1.0 : 0.0;
      }

      if (pass.parameters) {
        pass.parameters[paramKey] = value;
      }
    } else if (typeof value === 'boolean') {
      resolvedValue = value ? 1.0 : 0.0;
    }

    const key = `${instanceId}:${paramKey}`;
    const u = this.uniformsMap.get(key);
    if (u && typeof u === 'object' && 'value' in u) {
      u.value = resolvedValue;
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

  /**
   * Updates implicit Stage-0 pre-tone uniforms without mutating activeStack.
   * Bypassed automatically when all tone settings are neutral.
   */
  updateTone(settings: ToneSettings): void {
    this.preToneUniforms.brightness.value = settings.brightness;
    this.preToneUniforms.contrast.value = settings.contrast;
    this.preToneUniforms.saturation.value = settings.saturation;
    this.preToneUniforms.hueRotation.value = settings.hueRotation;
    this.preToneUniforms.gamma.value = settings.gamma;
    this.preToneUniforms.invert.value = settings.invert ? 1.0 : 0.0;

    const nextActive = !isToneNeutral(settings);
    if (nextActive !== this.preToneActive) {
      this.preToneActive = nextActive;
      this.syncStack(this.currentStack, this.currentTier);
    }
  }

  /**
   * Updates the ASCII/Matrix/3D character texture atlas and propagates rampLength
   * across all active glyph-based passes in the stack.
   */
  updateAscii(settings: AsciiSettings): void {
    this.textureAtlas.updateRamp(settings.rampPreset, settings.customChars);
    const pad = this.textureAtlas.getSlotPaddingRatio();
    this.atlasPaddingUniform.value.set(pad.padX, pad.padY);

    const charCount = this.textureAtlas.getCharCount();
    for (const pass of this.currentStack) {
      if (pass.effectId === 'ascii' || pass.effectId === 'matrix' || pass.effectId === 'threeD') {
        this.updateUniform(pass.instanceId, 'rampLength', charCount);
      }
    }
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
   * Renders the execution graph. Intermediate stages execute into pooled HalfFloatType render targets
   * (with UnsignedByteType fallback), and the final stage renders onto the canvas display mesh (D-21, D-24).
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
      let target: THREE.RenderTarget;
      try {
        target = this.passPool.acquire(
          this.width,
          this.height,
          stageDesc.targetDescriptor
        );
        this.displayMesh.material = stageDesc.material;
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.scene, this.camera);
      } catch {
        target = this.passPool.acquire(this.width, this.height, {
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
        });
        this.displayMesh.material = stageDesc.material;
        this.renderer.setRenderTarget(target);
        this.renderer.render(this.scene, this.camera);
      }

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
    this.currentCacheKey = null;
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
