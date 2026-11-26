import {
  Fn,
  uv,
  vec4,
  floor,
  clamp,
  float,
  vec2,
} from 'three/tsl';
import type { EffectDefinition } from '../types';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * Modernized Bayer Dithering effect definition (D-01, D-20, FX-01).
 * Pointwise threshold matrix dithering supporting rich 8x8 and classic 4x4 Bayer matrices
 * with gamma-correct luminance preservation and quantization steps.
 */
export const ditherEffect: EffectDefinition = {
  id: 'dither',
  label: 'Bayer Dither',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    colorSteps: {
      type: 'float',
      min: 2,
      max: 16,
      default: 4.0,
      step: 1.0,
      audioModulatable: true,
    },
    spread: {
      type: 'float',
      min: 0.0,
      max: 2.0,
      default: 0.5,
      step: 0.05,
      audioModulatable: true,
    },
    matrixType: {
      type: 'select',
      default: 'bayer8',
      options: ['bayer8', 'bayer4'],
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const colorSteps = toNode(uniforms.colorSteps, 4.0);
    const spread = toNode(uniforms.spread, 0.5);
    const isBayer4 = uniforms.matrixType === 'bayer4';
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const pixelCoord = floor(st.mul(safeRes));

      let bVal: any;

      if (isBayer4) {
        // 4x4 Bayer Matrix
        const x = pixelCoord.x.mod(4.0);
        const y = pixelCoord.y.mod(4.0);
        const x2 = floor(x.div(2.0));
        const y2 = floor(y.div(2.0));
        const x1 = x.mod(2.0);
        const y1 = y.mod(2.0);
        const b2 = y1.mul(2.0).add(x1);
        const b4 = y2.mul(2.0).add(x2);
        bVal = b4.mul(4.0).add(b2).div(16.0).sub(0.5);
      } else {
        // 8x8 Bayer Matrix for silky smooth tonal gradients
        const x = pixelCoord.x.mod(8.0);
        const y = pixelCoord.y.mod(8.0);
        const x0 = x.mod(2.0);
        const y0 = y.mod(2.0);
        const x1 = floor(x.div(2.0)).mod(2.0);
        const y1 = floor(y.div(2.0)).mod(2.0);
        const x2 = floor(x.div(4.0)).mod(2.0);
        const y2 = floor(y.div(4.0)).mod(2.0);
        const b0 = y0.mul(2.0).add(x0);
        const b1 = y1.mul(2.0).add(x1);
        const b2 = y2.mul(2.0).add(x2);
        bVal = b2.mul(16.0).add(b1.mul(4.0)).add(b0).div(64.0).sub(0.5);
      }

      const baseCol = inputNode;
      const rgb = baseCol.rgb;

      const ditherOffset = bVal.mul(spread);
      const ditheredRGB = rgb.add(ditherOffset);

      const stepsMinus1 = colorSteps.sub(1.0).max(1.0);
      const quantized = floor(ditheredRGB.mul(stepsMinus1).add(0.5)).div(stepsMinus1);
      const finalRGB = clamp(quantized, 0.0, 1.0);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
