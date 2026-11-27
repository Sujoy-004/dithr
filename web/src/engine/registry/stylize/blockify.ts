import {
  Fn,
  uv,
  vec2,
  vec4,
  floor,
  fract,
  abs,
  max,
  mix,
  smoothstep,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { toNode, sampleWithEnv } from '../tslHelpers';

/**
 * Blockify (Mosaic / Pixelation) effect definition (D-01, D-20).
 * 4-tap box-averaged cell color via env.sampleAt and symmetric tile border SDF grout.
 */
export const blockifyEffect: EffectDefinition = {
  id: 'blockify',
  label: 'Blockify (Mosaic)',
  category: 'stylize',
  requiresPass: false,
  spatial: true,
  costWeight: 1,
  parameters: {
    blockSize: {
      type: 'float',
      min: 2.0,
      max: 64.0,
      default: 12.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    gridLine: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.15,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const blockSize = toNode(uniforms.blockSize, 12.0);
    const gridLine = toNode(uniforms.gridLine, 0.15);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pixelCoord = st.mul(safeRes);
      const b = blockSize.max(2.0);
      const cellCoord = floor(pixelCoord.div(b));

      // 4-tap box average inside the block for clean downsampling
      const uv0 = cellCoord.add(vec2(0.25, 0.25)).mul(b).div(safeRes).clamp(0.001, 0.999);
      const uv1 = cellCoord.add(vec2(0.75, 0.25)).mul(b).div(safeRes).clamp(0.001, 0.999);
      const uv2 = cellCoord.add(vec2(0.25, 0.75)).mul(b).div(safeRes).clamp(0.001, 0.999);
      const uv3 = cellCoord.add(vec2(0.75, 0.75)).mul(b).div(safeRes).clamp(0.001, 0.999);

      const s0 = sampleWithEnv(inputNode, env, uv0);
      const s1 = sampleWithEnv(inputNode, env, uv1);
      const s2 = sampleWithEnv(inputNode, env, uv2);
      const s3 = sampleWithEnv(inputNode, env, uv3);
      const avgRgb = s0.rgb.add(s1.rgb).add(s2.rgb).add(s3.rgb).mul(0.25);

      // Symmetric tile border SDF with smooth grout darkening
      const cellFrac = fract(pixelCoord.div(b));
      const edgeDist = max(abs(cellFrac.x.sub(0.5)), abs(cellFrac.y.sub(0.5)));
      const borderWidth = b.reciprocal();
      const groutMask = smoothstep(
        float(0.5).sub(borderWidth.mul(1.5)),
        float(0.5).sub(borderWidth.mul(0.3)),
        edgeDist
      );

      const groutCol = avgRgb.mul(float(1.0).sub(gridLine.mul(0.75)));
      const finalRGB = mix(avgRgb, groutCol, groutMask);

      return vec4(finalRGB, s0.a ?? float(1.0));
    })();
  },
};
