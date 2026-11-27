import {
  Fn,
  uv,
  vec2,
  vec4,
  floor,
  sin,
  mix,
  clamp,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { hash12Node, rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, resolveSelectNode, sampleWithEnv } from '../tslHelpers';

const DIRECTIONS = ['horizontal', 'vertical'] as const;

/**
 * Pixel Sort directional glitch streak effect definition (D-01, D-20, D-27).
 * 12 directional taps via env.sampleAt along horizontal/vertical scan axis
 * with band-quantized smooth time modulation and distance-tapered streak interpolation.
 */
export const pixelSortEffect: EffectDefinition = {
  id: 'pixelSort',
  label: 'Pixel Sort',
  category: 'stylize',
  requiresPass: true,
  costWeight: 2,
  parameters: {
    threshold: {
      type: 'float',
      min: 0.05,
      max: 0.95,
      default: 0.45,
      step: 0.01,
      audioModulatable: true,
    },
    sortSpan: {
      type: 'float',
      min: 2.0,
      max: 120.0,
      default: 36.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    direction: {
      type: 'select',
      default: 'horizontal',
      options: [...DIRECTIONS],
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const threshold = toNode(uniforms.threshold, 0.45);
    const sortSpan = toNode(uniforms.sortSpan, 36.0);
    const dirIdx = resolveSelectNode(uniforms.direction, DIRECTIONS, 0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(12.9898);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const px = st.mul(safeRes);

      const baseCol = sampleWithEnv(inputNode, env, st);
      const baseLum = rec601PerceptualLuminance(baseCol.rgb);

      const dir = mix(vec2(1.0, 0.0), vec2(0.0, 1.0), dirIdx);
      const scanAxis = mix(px.y, px.x, dirIdx);

      // Band-quantized smooth wave modulation (eliminates random strobe noise)
      const bandCoord = floor(scanAxis.div(4.0));
      const bandRand = hash12Node(vec2(bandCoord, seed));
      const smoothWave = sin(time.mul(1.2).add(bandRand.mul(6.2831853)))
        .mul(0.5)
        .add(0.5);
      const bandMix = bandRand.mul(0.65).add(smoothWave.mul(0.35));

      const effThresh = threshold.add(bandMix.sub(0.5).mul(0.22)).clamp(0.05, 0.95);
      const effSpan = sortSpan.mul(bandMix.mul(0.75).add(0.5));

      let hasSorted = baseLum.greaterThanEqual(effThresh);
      let bestCol = baseCol;
      let bestLum = baseLum;
      let bestTaper: any = float(0.0);

      for (let i = 1; i <= 12; i++) {
        const frac = i / 12.0;
        const stepOffset = effSpan.mul(float(frac));
        const samplePx = px.sub(dir.mul(stepOffset));
        const sampleUV = samplePx.div(safeRes).clamp(0.001, 0.999);
        const sCol = sampleWithEnv(inputNode, env, sampleUV);
        const sLum = rec601PerceptualLuminance(sCol.rgb);

        const inSortBand = sLum.greaterThanEqual(effThresh).and(sLum.lessThanEqual(0.98));
        hasSorted = hasSorted.or(inSortBand);

        const takeThis = sLum.greaterThan(bestLum).and(inSortBand);
        const taper = float(1.0 - frac * 0.35);
        bestCol = takeThis.select(sCol, bestCol);
        bestLum = takeThis.select(sLum, bestLum);
        bestTaper = takeThis.select(taper, bestTaper);
      }

      const sortedRGB = mix(baseCol.rgb, bestCol.rgb, bestTaper.max(0.65));
      const finalRGB = hasSorted.select(sortedRGB, baseCol.rgb);
      return vec4(clamp(finalRGB, 0.0, 1.0), baseCol.a ?? float(1.0));
    })();
  },
};
