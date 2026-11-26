import { Fn, vec3, vec4, float } from 'three/tsl';
import type {
  EffectDefinition,
  EffectCategory,
  BlendMode,
  ActiveEffectPass,
  EffectEnvironment,
} from './types';

// 15 Stylize effects
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

import { sRGBToLinear, linearTosRGB } from '../color/colorSpace';

const vhsEffect: EffectDefinition = {
  ...crtVhsEffect,
  id: 'vhs',
  label: 'VHS / CRT',
};

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
 * Registers all 16 Grainrad modes partitioned into stylize and modulate.
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
      return this.effects.get('vhs') ?? this.effects.get('crtVhs');
    }
    if (id === 'crtVhs') {
      return this.effects.get('crtVhs') ?? this.effects.get('vhs');
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
    } else if (blendMode === 'overlay') {
      const overlayChan = (u: any, e: any) => {
        const dark = float(2.0).mul(u).mul(e);
        const bright = float(1.0).sub(float(2.0).mul(float(1.0).sub(u)).mul(float(1.0).sub(e)));
        return e.lessThan(float(0.5)).select(dark, bright);
      };
      resultRgb = vec3(
        overlayChan(upstream.r, effectCol.r),
        overlayChan(upstream.g, effectCol.g),
        overlayChan(upstream.b, effectCol.b)
      );
    } else if (blendMode === 'softLight') {
      const u = upstream.rgb;
      const e = effectCol.rgb;
      const term1 = vec3(1.0).sub(float(2.0).mul(e)).mul(u).mul(u);
      const term2 = float(2.0).mul(e).mul(u);
      resultRgb = term1.add(term2);
    }

    const mixedRgb = upstream.rgb.mix(resultRgb, intensityNode);
    return vec4(mixedRgb, upstream.a ?? float(1.0));
  })();
}

/**
 * Compiles an active effect stack in linear light:
 * 1. Decode sRGB input texture -> Linear light
 * 2. Execute active passes sequentially with linear blending
 * 3. Encode final Linear light -> display sRGB
 */
export function compileLinearEffectStack(
  sourceTextureNode: any,
  activeStack: ActiveEffectPass[],
  registry: EffectRegistry = effectRegistry,
  env?: EffectEnvironment
): any {
  let current = sRGBToLinear(sourceTextureNode);

  for (const pass of activeStack) {
    if (!pass.enabled) continue;
    const def = registry.get(pass.effectId);
    if (!def) continue;

    const effectOutput = def.buildNode(current, pass.parameters, env);
    current = applyBlendMode(current, effectOutput, pass.blendMode, pass.intensity);
  }

  return linearTosRGB(current);
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
  vhsEffect,
};
