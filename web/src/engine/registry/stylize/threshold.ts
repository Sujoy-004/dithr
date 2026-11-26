import {
  Fn,
  vec3,
  vec4,
  float,
  mix,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601Luminance } from '../../color/luminance';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * High-Contrast Threshold binary effect definition (D-01, D-05, D-20).
 * Quantizes colors into binary 1-bit black and white based on Rec. 601 luminance.
 */
export const thresholdEffect: EffectDefinition = {
  id: 'threshold',
  label: 'Threshold',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    cutoff: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.5,
      step: 0.01,
      audioModulatable: true,
    },
    invert: {
      type: 'boolean',
      default: false,
    },
  },
  buildNode: (inputNode, uniforms) => {
    const cutoff = toNode(uniforms.cutoff, 0.5);
    const invert = toNode(uniforms.invert, 0.0);

    return Fn(() => {
      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);

      const isAbove = lum.greaterThanEqual(cutoff);
      const binColor = isAbove.select(vec3(1.0), vec3(0.0));
      const finalRGB = mix(binColor, vec3(1.0).sub(binColor), invert);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
