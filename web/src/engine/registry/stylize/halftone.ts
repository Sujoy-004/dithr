import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  float,
  mix,
  max,
  fwidth,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { linearTosRGBChannel } from '../../color/colorSpace';
import { toNode, resolveSelectNode, sampleWithEnv } from '../tslHelpers';

const HALFTONE_MODES = ['color', 'monochrome', 'cmyk'] as const;

function evalRotatedScreen(
  st: any,
  safeRes: any,
  cellSize: any,
  angleDeg: any,
  inputNode: any,
  env: any
) {
  const rad = angleDeg.mul(0.017453292519943295);
  const cosA = rad.cos();
  const sinA = rad.sin();

  const centeredPx = st.sub(0.5).mul(safeRes);
  const rotP = vec2(
    centeredPx.x.mul(cosA).sub(centeredPx.y.mul(sinA)),
    centeredPx.x.mul(sinA).add(centeredPx.y.mul(cosA))
  );

  const cellIdx = floor(rotP.div(cellSize));
  const cellFrac = fract(rotP.div(cellSize)).sub(0.5);
  const cellCenterRot = cellIdx.add(0.5).mul(cellSize);

  const centerX: any = cellCenterRot.x.mul(cosA).add(cellCenterRot.y.mul(sinA));
  const centerY: any = cellCenterRot.x.mul(sinA).negate().add(cellCenterRot.y.mul(cosA));
  const centerPx = vec2(centerX, centerY);
  const centerUV = centerPx.div(safeRes).add(0.5).clamp(0.001, 0.999);
  const sampled = sampleWithEnv(inputNode, env, centerUV);
  const dist = cellFrac.length();

  return { sampled, dist };
}

/**
 * Halftone Screen effect definition (D-01, D-05, D-20).
 * Aspect-corrected pixel-space dot screen rotation, cell-center env.sampleAt,
 * area-proportional sqrt(lum) radius, fwidth() AA, and color/monochrome/CMYK modes.
 */
export const halftoneEffect: EffectDefinition = {
  id: 'halftone',
  label: 'Halftone Screen',
  category: 'stylize',
  requiresPass: false,
  spatial: true,
  costWeight: 1,
  parameters: {
    frequency: {
      type: 'float',
      min: 5.0,
      max: 120.0,
      default: 45.0,
      step: 1.0,
      audioModulatable: true,
    },
    angle: {
      type: 'float',
      min: 0.0,
      max: 90.0,
      default: 45.0,
      step: 1.0,
      unit: 'deg',
      audioModulatable: true,
    },
    dotRadius: {
      type: 'float',
      min: 0.1,
      max: 2.0,
      default: 1.0,
      step: 0.05,
      audioModulatable: true,
    },
    mode: {
      type: 'select',
      default: 'color',
      options: [...HALFTONE_MODES],
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const frequency = toNode(uniforms.frequency, 45.0);
    const angle = toNode(uniforms.angle, 45.0);
    const dotRadius = toNode(uniforms.dotRadius, 1.0);
    const modeIdx = resolveSelectNode(uniforms.mode, HALFTONE_MODES, 0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const cellSize = safeRes.y.div(frequency.max(5.0)).max(3.0);

      // Single-screen evaluation for color & monochrome
      const single = evalRotatedScreen(st, safeRes, cellSize, angle, inputNode, env);
      const singleLum = rec601PerceptualLuminance(single.sampled.rgb);
      const singleR = singleLum.max(0.0).sqrt().mul(0.5).mul(dotRadius).clamp(0.0, 0.72);
      const singleAA = fwidth(single.dist).max(0.02);
      const singleMask = float(1.0).sub(
        smoothstep(singleR.sub(singleAA), singleR.add(singleAA), single.dist)
      );

      const bgDark = vec3(0.002, 0.0024, 0.003);
      const colorOut = mix(bgDark, single.sampled.rgb, singleMask);
      const monoOut = mix(bgDark, vec3(0.86, 0.88, 0.92), singleMask);

      // 4-plate CMYK halftone (15, 75, 0, 45 deg) on archival paper
      const cPlate = evalRotatedScreen(st, safeRes, cellSize, float(15.0), inputNode, env);
      const mPlate = evalRotatedScreen(st, safeRes, cellSize, float(75.0), inputNode, env);
      const yPlate = evalRotatedScreen(st, safeRes, cellSize, float(0.0), inputNode, env);
      const kPlate = evalRotatedScreen(st, safeRes, cellSize, float(45.0), inputNode, env);

      const cSr = linearTosRGBChannel(cPlate.sampled.r);
      const mSg = linearTosRGBChannel(mPlate.sampled.g);
      const ySb = linearTosRGBChannel(yPlate.sampled.b);
      const kMax = max(
        linearTosRGBChannel(kPlate.sampled.r),
        max(linearTosRGBChannel(kPlate.sampled.g), linearTosRGBChannel(kPlate.sampled.b))
      );

      const cInk = float(1.0).sub(cSr).clamp(0.0, 1.0);
      const mInk = float(1.0).sub(mSg).clamp(0.0, 1.0);
      const yInk = float(1.0).sub(ySb).clamp(0.0, 1.0);
      const kInk = float(1.0).sub(kMax).mul(0.85).clamp(0.0, 1.0);

      const dotMaskFor = (ink: any, dist: any) => {
        const r = ink.sqrt().mul(0.46).mul(dotRadius).clamp(0.0, 0.72);
        const aa = fwidth(dist).max(0.02);
        return float(1.0).sub(smoothstep(r.sub(aa), r.add(aa), dist));
      };

      const cMask = dotMaskFor(cInk, cPlate.dist);
      const mMask = dotMaskFor(mInk, mPlate.dist);
      const yMask = dotMaskFor(yInk, yPlate.dist);
      const kMask = dotMaskFor(kInk, kPlate.dist);

      const paper = vec3(0.88, 0.87, 0.84);
      const cmykOut = paper
        .mul(vec3(1.0).sub(vec3(0.85, 0.12, 0.04).mul(cMask)))
        .mul(vec3(1.0).sub(vec3(0.10, 0.82, 0.12).mul(mMask)))
        .mul(vec3(1.0).sub(vec3(0.04, 0.08, 0.88).mul(yMask)))
        .mul(vec3(1.0).sub(vec3(0.85, 0.85, 0.85).mul(kMask)));

      const finalRGB = modeIdx
        .equal(float(1.0))
        .select(monoOut, modeIdx.equal(float(2.0)).select(cmykOut, colorOut));

      return vec4(finalRGB, single.sampled.a ?? float(1.0));
    })();
  },
};
