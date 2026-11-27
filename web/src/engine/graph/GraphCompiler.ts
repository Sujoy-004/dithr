import * as THREE from 'three/webgpu';
import { uniform, texture, vec4, float } from 'three/tsl';
import { applyBlendMode, effectRegistry, EffectRegistry } from '../registry/index';
import type {
  ActiveEffectPass,
  EffectDefinition,
  EffectEnvironment,
} from '../registry/types';

export type StageType = 'fused_fragment' | 'intermediate_target';

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
 * Plans execution stages by fusing contiguous pointwise passes plus at most one spatial pass
 * (!def.requiresPass) into a fused_fragment stage, and splitting whenever a requiresPass or
 * a second spatial pass follows an existing pass in the current stage (D-21).
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
  let currentStageHasSpatial = false;

  for (let i = 0; i < activePasses.length; i++) {
    const pass = activePasses[i];
    const def = registry.get(pass.effectId);
    const requiresPass = def?.requiresPass ?? false;
    const isSpatial = def?.spatial ?? false;

    const shouldSplit =
      currentPasses.length > 0 &&
      (requiresPass || (isSpatial && currentStageHasSpatial));

    if (shouldSplit) {
      stages.push({
        id: `stage_${stages.length}`,
        type: currentStageHasIntermediate ? 'intermediate_target' : 'fused_fragment',
        passes: currentPasses,
        requiresTarget: true,
      });
      currentPasses = [pass];
      currentStageHasIntermediate = true;
      currentStageHasSpatial = isSpatial;
    } else {
      currentPasses.push(pass);
      if (requiresPass) {
        currentStageHasIntermediate = true;
      }
      if (isSpatial) {
        currentStageHasSpatial = true;
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

function resolveUniformValue(
  paramKey: string,
  paramValue: any,
  def: EffectDefinition
): any {
  const schema = def.parameters?.[paramKey];
  if (schema?.type === 'select' && Array.isArray(schema.options)) {
    const idx = Math.max(0, schema.options.indexOf(String(paramValue)));
    return uniform(idx);
  }
  if (typeof paramValue === 'number') {
    return uniform(paramValue);
  }
  if (typeof paramValue === 'boolean') {
    return uniform(paramValue ? 1.0 : 0.0);
  }
  return paramValue;
}

/**
 * Compiles a planned execution stage graph into TSL MeshBasicNodeMaterial pipelines (D-03, D-06, D-21).
 * Operates natively in Three.js Linear working color space (no double sRGB/Linear conversions),
 * wires env.sampleAt across TextureNodes, allocates HalfFloatType intermediate FBOs, and binds
 * live uniforms (including select option indices) for zero-recompile edits.
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
  dummyTexture.minFilter = THREE.LinearFilter;
  dummyTexture.magFilter = THREE.LinearFilter;
  dummyTexture.generateMipmaps = false;
  (dummyTexture as any).isRenderTargetTexture = true;

  const standbyColor = vec4(0.004, 0.0045, 0.006, 1.0);
  const preToneDef = env?.preToneActive && env?.preToneUniforms ? registry.get('tone') : undefined;

  // If no stages are active, compile a direct passthrough stage (with optional Stage-0 pre-tone)
  if (stages.length === 0) {
    const passthroughStage: ExecutionStage = {
      id: 'stage_0',
      type: 'fused_fragment',
      passes: [],
      requiresTarget: false,
    };

    let finalColor = sourceNode ? sourceNode : standbyColor;
    if (preToneDef && env?.preToneUniforms) {
      finalColor = preToneDef.buildNode(finalColor, env.preToneUniforms, env);
    }

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

  // Compile each stage in Linear working light
  for (let stageIdx = 0; stageIdx < stages.length; stageIdx++) {
    const stage = stages[stageIdx];
    let inputTextureNode: any = null;
    let rawSampleAt: ((uvCoord: any) => any) | undefined;
    let currentInput: any;

    if (stageIdx === 0) {
      currentInput = sourceNode ? sourceNode : standbyColor;
      if (sourceNode && typeof sourceNode.sample === 'function') {
        rawSampleAt = (uvCoord: any) => sourceNode.sample(uvCoord);
      }

      if (preToneDef && env?.preToneUniforms) {
        const preToneUniforms = env.preToneUniforms;
        currentInput = preToneDef.buildNode(currentInput, preToneUniforms, env);
        if (rawSampleAt) {
          const baseSampleFn = rawSampleAt;
          rawSampleAt = (uvCoord: any) =>
            preToneDef.buildNode(baseSampleFn(uvCoord), preToneUniforms, env);
        }
      }
    } else {
      inputTextureNode = texture(dummyTexture);
      currentInput = inputTextureNode;
      rawSampleAt = (uvCoord: any) => inputTextureNode.sample(uvCoord);
    }

    let current = currentInput;
    let seenSpatialInStage = false;
    const pointwisePrefix: Array<{
      def: EffectDefinition;
      passUniforms: Record<string, any>;
      intUniform: any;
      blendMode: ActiveEffectPass['blendMode'];
    }> = [];

    for (const pass of stage.passes) {
      const def = registry.get(pass.effectId);
      if (!def) continue;

      // Merge schema defaults with pass parameters so every schema parameter has a live uniform
      const mergedParams: Record<string, any> = {};
      for (const [k, s] of Object.entries(def.parameters)) {
        mergedParams[k] = s.default;
      }
      if (pass.parameters) {
        Object.assign(mergedParams, pass.parameters);
      }

      const passUniforms: Record<string, any> = {};
      for (const [paramKey, paramValue] of Object.entries(mergedParams)) {
        const uKey = `${pass.instanceId}:${paramKey}`;
        let u = uniformsMap.get(uKey);
        if (!u) {
          u = resolveUniformValue(paramKey, paramValue, def);
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

      // Build stage-scoped env.sampleAt for passes prior to or at the single spatial pass
      let passSampleAt: ((uvCoord: any) => any) | undefined;
      if (!seenSpatialInStage && rawSampleAt) {
        if (pointwisePrefix.length === 0) {
          passSampleAt = rawSampleAt;
        } else {
          const baseSampler = rawSampleAt;
          const prefixSnapshot = pointwisePrefix.slice();
          passSampleAt = (uvCoord: any) => {
            let c = baseSampler(uvCoord);
            for (const prev of prefixSnapshot) {
              const out = prev.def.buildNode(c, prev.passUniforms, {
                ...env,
                sampleAt: undefined,
              });
              c = applyBlendMode(c, out, prev.blendMode, prev.intUniform);
            }
            return c;
          };
        }
      }

      const passEnv: EffectEnvironment = {
        ...env,
        sampleAt: passSampleAt,
      };

      const effectOutput = def.buildNode(current, passUniforms, passEnv);
      current = applyBlendMode(current, effectOutput, pass.blendMode, intUniform);

      if (def.spatial || def.requiresPass) {
        seenSpatialInStage = true;
      } else if (!seenSpatialInStage) {
        pointwisePrefix.push({
          def,
          passUniforms,
          intUniform,
          blendMode: pass.blendMode,
        });
      }
    }

    const outputColorNode = vec4(current.rgb, current.a ?? float(1.0));
    const material = new THREE.MeshBasicNodeMaterial();
    material.colorNode = outputColorNode;
    material.needsUpdate = true;

    stageDescriptors.push({
      stage,
      material,
      colorNode: outputColorNode,
      inputTextureNode,
      targetDescriptor: stage.requiresTarget
        ? { format: THREE.RGBAFormat, type: THREE.HalfFloatType }
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
