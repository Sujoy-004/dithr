import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  dot,
  float,
  mix,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { linearTosRGBChannel, sRGBToLinearChannel } from '../../color/colorSpace';
import { toNode, resolveSelectNode, sampleWithEnv } from '../tslHelpers';
import { PALETTE_OPTIONS } from '../../../store/palettes';
import { buildPaletteNode } from '../paletteNode';

const MATRIX_TYPES = ['bayer4', 'bayer8', 'bayer2', 'ign'] as const;

/**
 * Ordered Dithering effect definition (D-01, D-20, FX-01).
 * Pixel-size cell sampling via env.sampleAt, perceptual sRGB quantization,
 * and selectable Bayer 2x2 / 4x4 / 8x8 or Interleaved Gradient Noise (IGN) matrices.
 */
export const ditherEffect: EffectDefinition = {
  id: 'dither',
  label: 'Bayer Dither',
  category: 'stylize',
  requiresPass: false,
  spatial: false,
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
    pixelSize: {
      type: 'float',
      min: 1.0,
      max: 8.0,
      default: 2.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    matrixType: {
      type: 'select',
      default: 'bayer8',
      options: [...MATRIX_TYPES],
    },
    monochrome: {
      type: 'boolean',
      default: false,
    },
    palette: {
      type: 'select',
      default: 'none',
      options: [...PALETTE_OPTIONS],
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const colorSteps = toNode(uniforms.colorSteps, 4.0);
    const spread = toNode(uniforms.spread, 0.5);
    const pixelSize = toNode(uniforms.pixelSize, 2.0);
    const matrixIdx = resolveSelectNode(uniforms.matrixType, MATRIX_TYPES, 1);
    const monochrome = toNode(uniforms.monochrome, 0.0);
    const paletteIdx = resolveSelectNode(uniforms.palette, PALETTE_OPTIONS, 0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pxSize = pixelSize.max(1.0);
      const cellCoord = floor(st.mul(safeRes).div(pxSize));
      const cellCenterUV = cellCoord.add(0.5).mul(pxSize).div(safeRes).clamp(0.001, 0.999);

      const baseCol = sampleWithEnv(inputNode, env, cellCenterUV);

      // Quantize in perceptual sRGB space so shadow/midtone steps remain balanced
      const srgb = vec3(
        linearTosRGBChannel(baseCol.r),
        linearTosRGBChannel(baseCol.g),
        linearTosRGBChannel(baseCol.b)
      );
      const lum = srgb.r.mul(0.299).add(srgb.g.mul(0.587)).add(srgb.b.mul(0.114));
      const workRgb = mix(srgb, vec3(lum), monochrome);

      // Recursive Bayer matrices (2x2, 4x4, 8x8) + Interleaved Gradient Noise (IGN)
      const x = cellCoord.x.mod(8.0);
      const y = cellCoord.y.mod(8.0);

      const x0 = x.mod(2.0);
      const y0 = y.mod(2.0);
      const b0 = x0.mul(2.0).add(y0.mul(3.0)).mod(4.0);

      const x1 = floor(x.mod(4.0).div(2.0));
      const y1 = floor(y.mod(4.0).div(2.0));
      const b1 = x1.mul(2.0).add(y1.mul(3.0)).mod(4.0);

      const x2 = floor(x.div(4.0));
      const y2 = floor(y.div(4.0));
      const b2 = x2.mul(2.0).add(y2.mul(3.0)).mod(4.0);

      const bayer2 = b0.add(0.5).div(4.0);
      const bayer4 = b0.mul(4.0).add(b1).add(0.5).div(16.0);
      const bayer8 = b0.mul(16.0).add(b1.mul(4.0)).add(b2).add(0.5).div(64.0);
      const ign = fract(
        float(52.9829189).mul(fract(dot(cellCoord, vec2(0.06711056, 0.00583715))))
      );

      // 0: bayer4, 1: bayer8, 2: bayer2, 3: ign
      const threshold01 = matrixIdx
        .equal(float(1.0))
        .select(
          bayer8,
          matrixIdx
            .equal(float(2.0))
            .select(bayer2, matrixIdx.equal(float(3.0)).select(ign, bayer4))
        );
      const bVal = threshold01.sub(0.5);

      const stepsMinus1 = colorSteps.sub(1.0).max(1.0);
      const ditherOffset = bVal.mul(spread).div(stepsMinus1);
      const ditheredRGB = workRgb.add(ditherOffset);
      const quantizedSrgb = floor(ditheredRGB.mul(stepsMinus1).add(0.5))
        .div(stepsMinus1)
        .clamp(0.0, 1.0);

      const quantizedLinear = vec3(
        sRGBToLinearChannel(quantizedSrgb.r),
        sRGBToLinearChannel(quantizedSrgb.g),
        sRGBToLinearChannel(quantizedSrgb.b)
      );

      const quantizedLum = quantizedSrgb.r
        .mul(0.299)
        .add(quantizedSrgb.g.mul(0.587))
        .add(quantizedSrgb.b.mul(0.114));
      const finalRGB = buildPaletteNode(quantizedLinear, quantizedLum, paletteIdx);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
