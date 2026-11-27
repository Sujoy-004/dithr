import {
  Fn,
  vec3,
  vec4,
  float,
  mix,
  fwidth,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { toNode } from '../tslHelpers';

/**
 * High-Contrast Threshold binary effect definition (D-01, D-05, D-20).
 * Evaluates perceptual Rec. 601 luminance with adjustable softness and fwidth() AA.
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
      default: 0.45,
      step: 0.01,
      audioModulatable: true,
    },
    softness: {
      type: 'float',
      min: 0.0,
      max: 0.25,
      default: 0.02,
      step: 0.005,
      audioModulatable: true,
    },
    invert: {
      type: 'boolean',
      default: false,
    },
  },
  buildNode: (inputNode, uniforms) => {
    const cutoff = toNode(uniforms.cutoff, 0.45);
    const softness = toNode(uniforms.softness, 0.02);
    const invert = toNode(uniforms.invert, 0.0);

    return Fn(() => {
      const baseCol = inputNode;
      const lum = rec601PerceptualLuminance(baseCol.rgb);
      const aa = fwidth(lum).mul(0.5).max(0.002);
      const halfSpread = softness.add(aa);

      const t = smoothstep(cutoff.sub(halfSpread), cutoff.add(halfSpread), lum);
      const val = mix(t, float(1.0).sub(t), invert);

      const inkBg = vec3(0.003, 0.0035, 0.005); // #07080b linear
      const chalkFg = vec3(0.88, 0.90, 0.93); // #f0f2f6 linear
      const finalRGB = mix(inkBg, chalkFg, val);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
