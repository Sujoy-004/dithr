import {
  Fn,
  vec3,
  vec4,
  smoothstep,
  mix,
  float,
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
 * Modernized High-Contrast Threshold binary effect definition (D-01, D-05, D-20).
 * Quantizes colors into high-contrast print tones with smoothstep edge softening and invert.
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
    softness: {
      type: 'float',
      min: 0.0,
      max: 0.4,
      default: 0.05,
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
    const softness = toNode(uniforms.softness, 0.05).clamp(0.0, 0.4);
    const invert = toNode(uniforms.invert, 0.0);

    return Fn(() => {
      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);

      const halfSoft = softness.mul(0.5);
      const low = cutoff.sub(halfSoft).max(0.0);
      const high = cutoff.add(halfSoft).min(1.0).max(low.add(0.001));

      // Anti-aliased transition edge via smoothstep
      const factor = smoothstep(low, high, lum);
      const directedFactor = mix(factor, float(1.0).sub(factor), invert);

      const darkInk = vec3(0.02, 0.02, 0.02);
      const brightPaper = vec3(0.98, 0.98, 0.98);
      const finalRGB = mix(darkInk, brightPaper, directedFactor);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
