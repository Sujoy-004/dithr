import { Fn, vec3, vec4, float } from 'three/tsl';
import type {
  EffectDefinition,
  EffectCategory,
  BlendMode,
  ActiveEffectPass,
  EffectEnvironment,
} from './types';

// 16 Stylize effects
import { asciiEffect } from './stylize/ascii';
import { toneEffect } from './stylize/tone';
import { ditherEffect } from './stylize/dither';
import { halftoneEffect } from './stylize/halftone';
import { matrixEffect } from './stylize/matrix';
import { pixelSortEffect } from './stylize/pixelSort';
import { blockifyEffect } from './stylize/blockify';
import { thresholdEffect } from './stylize/threshold';
import { edgeDetectEffect } from './stylize/edgeDetect';
import { crosshatchEffect } from './stylize/crosshatch';
import { waveLinesEffect } from './stylize/waveLines';
import { noiseEffect } from './stylize/noise';
import { voronoiEffect } from './stylize/voronoi';
import { dotsEffect } from './stylize/dots';
import { contourEffect } from './stylize/contour';
import { threeDEffect } from './stylize/threeD';

// Modulate effects
import { grainEffect } from './modulate/grain';
import { rgbSplitEffect } from './modulate/rgbSplit';
import { masksEffect } from './modulate/masks';
import { crtVhsEffect } from './modulate/crtVhs';

export const ALL_EFFECT_DEFINITIONS: readonly EffectDefinition[] = [
  asciiEffect,
  toneEffect,
  ditherEffect,
  halftoneEffect,
  matrixEffect,
  pixelSortEffect,
  blockifyEffect,
  thresholdEffect,
  edgeDetectEffect,
  crosshatchEffect,
  waveLinesEffect,
  noiseEffect,
  voronoiEffect,
  dotsEffect,
  contourEffect,
  threeDEffect,
  grainEffect,
  rgbSplitEffect,
  masksEffect,
  crtVhsEffect,
] as const;

/**
 * Single-source-of-truth registry catalog for all visual effects (D-01, D-20, FX-01).
 * Registers all 20 shader definitions partitioned into stylize (16) and modulate (4),
 * and aliases 'vhs' to 'crtVhs' for seamless UI/stack interoperability.
 */
export class EffectRegistry {
  private effects = new Map<string, EffectDefinition>();

  constructor() {
    for (const def of ALL_EFFECT_DEFINITIONS) {
      this.register(def);
    }
  }

  register(def: EffectDefinition): void {
    this.effects.set(def.id, def);
  }

  get(id: string): EffectDefinition | undefined {
    if (id === 'vhs') {
      return this.effects.get('crtVhs');
    }
    return this.effects.get(id);
  }

  getAll(): EffectDefinition[] {
    return Array.from(this.effects.values());
  }

  getByCategory(cat: EffectCategory): EffectDefinition[] {
    return this.getAll().filter((e) => e.category === cat);
  }

  clear(): void {
    this.effects.clear();
  }
}

export const effectRegistry = new EffectRegistry();

export function getEffectDefinition(id: string): EffectDefinition | undefined {
  return effectRegistry.get(id);
}

export function getGroupedEffects(): Record<EffectCategory, EffectDefinition[]> {
  const all = effectRegistry.getAll();
  return {
    stylize: all.filter((e) => e.category === 'stylize'),
    modulate: all.filter((e) => e.category === 'modulate'),
  };
}

/**
 * Composites an effect output over upstream input in linear light (D-03, D-06).
 */
export function applyBlendMode(
  upstreamNode: any,
  effectNode: any,
  blendMode: BlendMode = 'normal',
  intensity: any = 1.0
): any {
  const intensityNode = typeof intensity === 'number' ? float(intensity) : intensity;

  return Fn(() => {
    const upstream = upstreamNode;
    const effectCol = effectNode;
    let resultRgb = effectCol.rgb;

    if (blendMode === 'multiply') {
      resultRgb = upstream.rgb.mul(effectCol.rgb);
    } else if (blendMode === 'screen') {
      resultRgb = vec3(1.0).sub(vec3(1.0).sub(upstream.rgb).mul(vec3(1.0).sub(effectCol.rgb)));
    } else if (blendMode === 'add') {
      resultRgb = upstream.rgb.add(effectCol.rgb).min(1.0);
    }

    const mixedRgb = upstream.rgb.mix(resultRgb, intensityNode);
    return vec4(mixedRgb, upstream.a ?? float(1.0));
  })();
}

/**
 * Compiles an active effect stack in linear working space:
 * passes execute sequentially with linear blending and optional env.sampleAt for TextureNodes.
 */
export function compileLinearEffectStack(
  sourceTextureNode: any,
  activeStack: ActiveEffectPass[],
  registry: EffectRegistry = effectRegistry,
  env?: EffectEnvironment
): any {
  let current = sourceTextureNode;
  const hasSampler = typeof sourceTextureNode?.sample === 'function';
  const passEnv: EffectEnvironment | undefined =
    hasSampler && !env?.sampleAt
      ? { ...env, sampleAt: (uvCoord: any) => sourceTextureNode.sample(uvCoord) }
      : env;

  for (const pass of activeStack) {
    if (!pass.enabled) continue;
    const def = registry.get(pass.effectId);
    if (!def) continue;

    const effectOutput = def.buildNode(current, pass.parameters, passEnv);
    current = applyBlendMode(current, effectOutput, pass.blendMode, pass.intensity);
  }

  return current;
}

export * from './types';
export {
  asciiEffect,
  toneEffect,
  ditherEffect,
  halftoneEffect,
  matrixEffect,
  pixelSortEffect,
  blockifyEffect,
  thresholdEffect,
  edgeDetectEffect,
  crosshatchEffect,
  waveLinesEffect,
  noiseEffect,
  voronoiEffect,
  dotsEffect,
  contourEffect,
  threeDEffect,
  grainEffect,
  rgbSplitEffect,
  masksEffect,
  crtVhsEffect,
};
