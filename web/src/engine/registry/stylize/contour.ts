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
 * Generates stepped elevation posterization bands with anti-aliased vector isoline boundaries.
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
    fillBands: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.85,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms) => {
    const steps = toNode(uniforms.steps, 8.0).max(2.0);
    const lineWidth = toNode(uniforms.lineWidth, 0.12);
    const fillBands = toNode(uniforms.fillBands, 0.85).clamp(0.0, 1.0);

    return Fn(() => {
      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);

      // 1. Stepped elevation tonal banding (preserves scene composition)
      const stepIdx = floor(lum.mul(steps));
      const quantizedLum = stepIdx.div(steps.sub(1.0).max(1.0));
      const bandColor = baseCol.rgb.mul(quantizedLum.mul(0.7).add(0.3));
      const tonalBase = mix(baseCol.rgb, bandColor, fillBands);

      // 2. Anti-aliased isoline contour boundaries via smoothstep
      const stepVal = fract(lum.mul(steps));
      const distToEdge = stepVal.min(float(1.0).sub(stepVal));
      const lineMask = smoothstep(lineWidth, float(0.0), distToEdge);

      // 3. Composite crisp vector contour lines over elevation bands
      const lineColor = vec3(1.0);
      const finalRGB = mix(tonalBase, lineColor, lineMask);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
