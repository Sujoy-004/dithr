import {
  Fn,
  uv,
  vec3,
  vec4,
  floor,
  clamp,
  float,
  vec2,
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
 * Modernized Bayer Dithering effect definition (D-01, D-20, FX-01).
 * Chunky retro pixel quantization supporting rich 8x8 and classic 4x4 Bayer matrices
 * with authentic 1-bit monochrome, Game Boy olive, CGA, and quantized RGB palettes.
 * Renders the media to its bone — zero continuous video underneath.
 */
export const ditherEffect: EffectDefinition = {
  id: 'dither',
  label: 'Bayer Dither',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    pixelSize: {
      type: 'float',
      min: 1.0,
      max: 8.0,
      default: 3.0,
      step: 1.0,
      unit: 'px',
    },
    palette: {
      type: 'select',
      default: 'monochrome',
      options: ['monochrome', 'gameboy', 'cga', 'quantized'],
    },
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
    const pixelSize = toNode(uniforms.pixelSize, 3.0).max(1.0);
    const colorSteps = toNode(uniforms.colorSteps, 4.0);
    const spread = toNode(uniforms.spread, 0.5);
    const isBayer4 = uniforms.matrixType === 'bayer4';
    const palette = uniforms.palette ?? 'monochrome';
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const px = floor(st.mul(safeRes).div(pixelSize));
      const pixelCoord = px.mul(pixelSize);

      let bVal: any;

      if (isBayer4) {
        // 4x4 Bayer Matrix
        const x = px.x.mod(4.0);
        const y = px.y.mod(4.0);
        const x2 = floor(x.div(2.0));
        const y2 = floor(y.div(2.0));
        const x1 = x.mod(2.0);
        const y1 = y.mod(2.0);
        const b2 = y1.mul(2.0).add(x1);
        const b4 = y2.mul(2.0).add(x2);
        bVal = b4.mul(4.0).add(b2).div(16.0).sub(0.5);
      } else {
        // 8x8 Bayer Matrix for rich, smooth tonal gradients
        const x = px.x.mod(8.0);
        const y = px.y.mod(8.0);
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

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      // Sample at pixel block center for chunky retro pixels
      const sampleUV = pixelCoord.add(pixelSize.mul(0.5)).div(safeRes).clamp(0.0, 1.0);
      const baseCol = sampleFn(sampleUV);
      const rgb = baseCol.rgb;
      const lum = rec601Luminance(rgb);

      const ditherOffset = bVal.mul(spread);

      if (palette === 'gameboy') {
        // Authentic Game Boy 4-shade olive green LCD palette
        const ditheredLum = lum.add(ditherOffset);
        const step = floor(ditheredLum.mul(4.0)).clamp(0.0, 3.0);
        const c0 = vec3(0.06, 0.22, 0.06); // Darkest olive
        const c1 = vec3(0.19, 0.38, 0.19);
        const c2 = vec3(0.55, 0.67, 0.06);
        const c3 = vec3(0.61, 0.73, 0.06); // Lightest olive
        const gbColor = step.lessThan(1.0).select(
          c0,
          step.lessThan(2.0).select(c1, step.lessThan(3.0).select(c2, c3))
        );
        return vec4(gbColor, baseCol.a ?? float(1.0));
      } else if (palette === 'cga') {
        // 4-Color CGA: Black, Cyan, Magenta, White
        const ditheredLum = lum.add(ditherOffset);
        const step = floor(ditheredLum.mul(4.0)).clamp(0.0, 3.0);
        const c0 = vec3(0.0, 0.0, 0.0);
        const c1 = vec3(0.0, 0.85, 0.85); // Cyan
        const c2 = vec3(0.85, 0.0, 0.85); // Magenta
        const c3 = vec3(1.0, 1.0, 1.0);    // White
        const cgaColor = step.lessThan(1.0).select(
          c0,
          step.lessThan(2.0).select(c1, step.lessThan(3.0).select(c2, c3))
        );
        return vec4(cgaColor, baseCol.a ?? float(1.0));
      } else if (palette === 'quantized') {
        // Quantized RGB color channels
        const ditheredRGB = rgb.add(ditherOffset);
        const stepsMinus1 = colorSteps.sub(1.0).max(1.0);
        const quantized = floor(ditheredRGB.mul(stepsMinus1).add(0.5)).div(stepsMinus1);
        const finalRGB = clamp(quantized, 0.0, 1.0);
        return vec4(finalRGB, baseCol.a ?? float(1.0));
      } else {
        // 1-Bit B&W Monochrome (Macintosh 1984 / Obra Dinn) default
        const ditheredLum = lum.add(ditherOffset);
        const isWhite = ditheredLum.greaterThanEqual(0.5);
        const finalRGB = isWhite.select(vec3(1.0), vec3(0.0));
        return vec4(finalRGB, baseCol.a ?? float(1.0));
      }
    })();
  },
};
