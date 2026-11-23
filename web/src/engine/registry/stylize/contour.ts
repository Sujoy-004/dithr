import {
  Fn,
  vec3,
  vec4,
  fract,
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
 * Topographic Contour Banding effect definition (D-01, D-05, D-20).
 * Generates isoline contour levels based on Rec. 601 perceived luminance.
 */
export const contourEffect: EffectDefinition = {
  id: 'contour',
  label: 'Topographic Contour',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    steps: {
      type: 'float',
      min: 2.0,
      max: 32.0,
      default: 8.0,
      step: 1.0,
      audioModulatable: true,
    },
    lineWidth: {
      type: 'float',
      min: 0.02,
      max: 0.5,
      default: 0.15,
      step: 0.01,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms) => {
    const steps = toNode(uniforms.steps, 8.0).max(1.0);
    const lineWidth = toNode(uniforms.lineWidth, 0.15);

    return Fn(() => {
      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);

      const stepVal = fract(lum.mul(steps));
      const lineMask = stepVal.lessThan(lineWidth).select(1.0, 0.0);
      const contourCol = vec3(lineMask).mul(baseCol.rgb);

      return vec4(contourCol, baseCol.a ?? float(1.0));
    })();
  },
};
