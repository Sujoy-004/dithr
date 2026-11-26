import {
  Fn,
  vec3,
  vec4,
  floor,
  fract,
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
 * Modernized Topographic Contour Banding effect definition (D-01, D-05, D-20).
 * True stepped elevation plateau quantization with crisp vector isolines at boundaries.
 * Renders the media to its bone — zero continuous video underneath.
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
      max: 0.4,
      default: 0.12,
      step: 0.01,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms) => {
    const steps = toNode(uniforms.steps, 8.0).max(2.0);
    const lineWidth = toNode(uniforms.lineWidth, 0.12);

    return Fn(() => {
      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);

      // 1. Strict elevation plateau quantization (no continuous gradients)
      const stepIdx = floor(lum.mul(steps));
      const plateauNorm = stepIdx.div(steps.sub(1.0).max(1.0));
      const plateauCol = baseCol.rgb.mul(plateauNorm.mul(0.85).add(0.15));

      // 2. Crisp vector contour boundary lines
      const stepVal = fract(lum.mul(steps));
      const distToEdge = stepVal.min(float(1.0).sub(stepVal));
      const isBoundary = smoothstep(lineWidth, float(0.0), distToEdge);

      const contourLineColor = vec3(1.0);
      const finalRGB = mix(plateauCol, contourLineColor, isBoundary);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
