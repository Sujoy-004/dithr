import * as THREE from 'three/webgpu';
import { uniform, texture, vec4, float } from 'three/tsl';
import { sRGBToLinear, linearTosRGB } from '../color/colorSpace';
import { applyBlendMode, effectRegistry, EffectRegistry } from '../registry/index';
import type {
  ActiveEffectPass,
  EffectEnvironment,
} from '../registry/types';

export type StageType = 'fused_fragment' | 'intermediate_target';

/**
 * Effects that require spatial/neighborhood coordinate sampling.
 * When preceded by active upstream passes in the same stage, the upstream passes
 * must be flushed into an intermediate target so spatial convolutions/offsets sample
 * the rasterized upstream result.
 */
export const SPATIAL_INTERMEDIATE_EFFECTS = new Set([
  'edgeDetect',
  'pixelSort',
  'rgbSplit',
]);

export interface ExecutionStage {
  id: string;
  type: StageType;
  passes: ActiveEffectPass[];
  requiresTarget: boolean;
}

export interface StageDescriptor {
  stage: ExecutionStage;
  material: THREE.MeshBasicNodeMaterial;
  colorNode: any;
  inputTextureNode?: any;
  targetDescriptor?: {
    format: THREE.PixelFormat;
    type?: THREE.TextureDataType;
  };
}

export interface CompiledPipeline {
  topologyHash: string;
  stages: ExecutionStage[];
  stageDescriptors: StageDescriptor[];
  finalMaterial: THREE.MeshBasicNodeMaterial;
  uniformsMap: Map<string, any>;
  intermediateTargetCount: number;
  dispose: () => void;
}

/**
 * Computes a stable hash string for an effect stack based on active enabled effect IDs,
 * order, and blend modes (D-22). Parameter edits (uniforms, intensity) do not alter the hash.
 */
export function computeTopologyHash(stack: ActiveEffectPass[]): string {
  const activePasses = stack.filter((p) => p.enabled);
  if (activePasses.length === 0) {
    return '__empty__';
  }

  const parts = activePasses.map((p, idx) => `${idx}:${p.effectId}:${p.blendMode}`);
  return parts.join('->');
}

/**
 * Plans execution stages by fusing contiguous pointwise passes (requiresPass === false)
 * into a single FusedFragmentStage, and splitting at passes requiring intermediate render targets (D-21).
 */
export function planExecutionStages(
  stack: ActiveEffectPass[],
  registry: EffectRegistry = effectRegistry
): ExecutionStage[] {
  const activePasses = stack.filter((p) => p.enabled);
  if (activePasses.length === 0) {
    return [];
  }

  const stages: ExecutionStage[] = [];
  let currentPasses: ActiveEffectPass[] = [];
  let currentStageHasIntermediate = false;

  for (let i = 0; i < activePasses.length; i++) {
    const pass = activePasses[i];
    const def = registry.get(pass.effectId);
    const requiresPass = def?.requiresPass ?? false;
    const isSpatialSampling =
      SPATIAL_INTERMEDIATE_EFFECTS.has(pass.effectId) ||
      (def as any)?.requiresSpatialSampling === true;
    const needsSplit = requiresPass || isSpatialSampling;

    if (needsSplit && currentPasses.length > 0) {
      stages.push({
        id: `stage_${stages.length}`,
        type: currentStageHasIntermediate ? 'intermediate_target' : 'fused_fragment',
        passes: currentPasses,
        requiresTarget: true,
      });
      currentPasses = [pass];
      currentStageHasIntermediate = true;
    } else {
      currentPasses.push(pass);
      if (requiresPass) {
        currentStageHasIntermediate = true;
      }
    }
  }

  if (currentPasses.length > 0) {
    stages.push({
      id: `stage_${stages.length}`,
      type: currentStageHasIntermediate ? 'intermediate_target' : 'fused_fragment',
      passes: currentPasses,
      requiresTarget: false,
    });
  }

  return stages;
}

/**
 * Compiles a planned execution stage graph into TSL MeshBasicNodeMaterial pipelines (D-03, D-06, D-21).
 * Fuses pointwise passes into unified fragment nodes, applies linear-light compositing and blend modes,
 * and attaches uniform references for zero-recompile slider edits.
 */
export function compileGraph(
  sourceNode: any,
  stages: ExecutionStage[],
  uniformsMap: Map<string, any> = new Map(),
  env?: EffectEnvironment,
  registry: EffectRegistry = effectRegistry
): CompiledPipeline {
  const stageDescriptors: StageDescriptor[] = [];
  const dummyTexture = new THREE.Texture();

  // If no stages are active, compile a direct passthrough stage
  if (stages.length === 0) {
    const passthroughStage: ExecutionStage = {
      id: 'stage_0',
      type: 'fused_fragment',
      passes: [],
      requiresTarget: false,
    };
    const inputColor = sourceNode ? sRGBToLinear(sourceNode) : vec4(0.06, 0.06, 0.06, 1.0);
    const finalColor = linearTosRGB(inputColor);

    const mat = new THREE.MeshBasicNodeMaterial();
    mat.colorNode = finalColor;
    mat.needsUpdate = true;

    stageDescriptors.push({
      stage: passthroughStage,
      material: mat,
      colorNode: finalColor,
    });

    return {
      topologyHash: '__empty__',
      stages: [passthroughStage],
      stageDescriptors,
      finalMaterial: mat,
      uniformsMap,
      intermediateTargetCount: 0,
      dispose: () => mat.dispose(),
    };
  }

  // Compile each stage
  for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
    const stage = stages[stageIdx];
    const isFinalStage = stageIdx === stages.length - 1;
    let inputTextureNode: any = null;
    let currentInput: any;

    if (stageIdx === 0) {
      // Stage 0: takes sourceNode decoded to linear light
      currentInput = sourceNode ? sRGBToLinear(sourceNode) : vec4(0.06, 0.06, 0.06, 1.0);
      if (sourceNode && !sourceNode.uv && typeof sourceNode.sample === 'function') {
        sourceNode.uv = (c: any) => sourceNode.sample(c);
      }
    } else {
      // Subsequent stages: sample from intermediate target texture node
      inputTextureNode = texture(dummyTexture);
      if (!inputTextureNode.uv && typeof inputTextureNode.sample === 'function') {
        inputTextureNode.uv = (c: any) => inputTextureNode.sample(c);
      }
      currentInput = inputTextureNode;
    }

    // Construct stage-scoped EffectEnvironment with sampleAt capability
    const stageSampleAt = (uvCoord: any) => {
      if (stageIdx === 0) {
        if (sourceNode && typeof sourceNode.uv === 'function') {
          return sRGBToLinear(sourceNode.uv(uvCoord));
        }
        if (sourceNode && typeof sourceNode.sample === 'function') {
          return sRGBToLinear(sourceNode.sample(uvCoord));
        }
        if (sourceNode?.value instanceof THREE.Texture) {
          return sRGBToLinear(texture(sourceNode.value, uvCoord));
        }
        if (typeof env?.sampleAt === 'function') {
          return env.sampleAt(uvCoord);
        }
        return currentInput;
      } else {
        if (inputTextureNode && typeof inputTextureNode.uv === 'function') {
          return inputTextureNode.uv(uvCoord);
        }
        if (inputTextureNode && typeof inputTextureNode.sample === 'function') {
          return inputTextureNode.sample(uvCoord);
        }
        if (inputTextureNode?.value instanceof THREE.Texture) {
          return texture(inputTextureNode.value, uvCoord);
        }
        return currentInput;
      }
    };

    const stageEnv: EffectEnvironment = {
      ...env,
      sampleAt: stageSampleAt,
    };

    let current = currentInput;

    for (const pass of stage.passes) {
      const def = registry.get(pass.effectId);
      if (!def) continue;

      // Ensure uniforms are registered for this pass instance
      const passUniforms: Record<string, any> = {};
      const params = pass.parameters || {};

      for (const [paramKey, paramValue] of Object.entries(params)) {
        const uKey = `${pass.instanceId}:${paramKey}`;
        let u = uniformsMap.get(uKey);
        if (!u) {
          if (typeof paramValue === 'number') {
            u = uniform(paramValue);
          } else if (typeof paramValue === 'boolean') {
            u = uniform(paramValue ? 1.0 : 0.0);
          } else {
            u = paramValue;
          }
          uniformsMap.set(uKey, u);
        }
        passUniforms[paramKey] = u;
      }

      // Intensity uniform
      const intKey = `${pass.instanceId}:intensity`;
      let intUniform = uniformsMap.get(intKey);
      if (!intUniform) {
        intUniform = uniform(pass.intensity ?? 1.0);
        uniformsMap.set(intKey, intUniform);
      }

      // Build effect output in linear light
      const effectOutput = def.buildNode(current, passUniforms, stageEnv);

      // Apply row blend mode and intensity in linear light (D-03, D-06)
      current = applyBlendMode(current, effectOutput, pass.blendMode, intUniform);
    }

    // If final stage, encode Linear Light -> sRGB (D-06); otherwise output linear for next stage
    const outputColorNode = isFinalStage
      ? linearTosRGB(current)
      : vec4(current.rgb, current.a ?? float(1.0));

    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = outputColorNode;
    material.needsUpdate = true;

    stageDescriptors.push({
      stage,
      material,
      colorNode: outputColorNode,
      inputTextureNode,
      targetDescriptor: stage.requiresTarget
        ? { format: THREE.RGBAFormat, type: THREE.UnsignedByteType }
        : undefined,
    });
  }

  const finalMaterial = stageDescriptors[stageDescriptors.length - 1].material;
  const intermediateTargetCount = stages.filter((s) => s.requiresTarget).length;

  return {
    topologyHash: computeTopologyHash(stages.flatMap((s) => s.passes)),
    stages,
    stageDescriptors,
    finalMaterial,
    uniformsMap,
    intermediateTargetCount,
    dispose: () => {
      for (const desc of stageDescriptors) {
        desc.material.dispose();
      }
    },
  };
}

/**
 * Hybrid GraphCompiler class wrapping graph analysis, planning, and compilation (D-21, D-22).
 */
export class GraphCompiler {
  constructor(private registry: EffectRegistry = effectRegistry) {}

  computeTopologyHash(stack: ActiveEffectPass[]): string {
    return computeTopologyHash(stack);
  }

  planExecutionStages(stack: ActiveEffectPass[]): ExecutionStage[] {
    return planExecutionStages(stack, this.registry);
  }

  compileGraph(
    sourceNode: any,
    stages: ExecutionStage[],
    uniformsMap: Map<string, any> = new Map(),
    env?: EffectEnvironment
  ): CompiledPipeline {
    return compileGraph(sourceNode, stages, uniformsMap, env, this.registry);
  }
}
