import {
  Fn,
  uv,
  vec2,
  vec4,
  floor,
  fract,
  sin,
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
 * Pixel Sort directional glitch streak effect definition (D-01, D-20, D-27).
 * Smears and sorts high-luminance intervals along horizontal or vertical scanlines.
 */
export const pixelSortEffect: EffectDefinition = {
  id: 'pixelSort',
  label: 'Pixel Sort',
  category: 'stylize',
  requiresPass: false,
  costWeight: 2,
  parameters: {
    threshold: {
      type: 'float',
      min: 0.05,
      max: 0.95,
      default: 0.5,
      step: 0.01,
      audioModulatable: true,
    },
    sortSpan: {
      type: 'float',
      min: 2.0,
      max: 100.0,
      default: 20.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    direction: {
      type: 'select',
      default: 'horizontal',
      options: ['horizontal', 'vertical'],
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const threshold = toNode(uniforms.threshold, 0.5);
    const sortSpan = toNode(uniforms.sortSpan, 20.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(12.9898);

    const isVert = uniforms.direction === 'vertical';

    return Fn(() => {
      const st = uv();
      const px = st.mul(resolution);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const baseCol = sampleFn(st);
      const baseLum = rec601Luminance(baseCol.rgb);

      const dir = isVert ? vec2(0.0, 1.0) : vec2(1.0, 0.0);
      const scanAxis = isVert ? px.x : px.y;

      const rowSeed = floor(scanAxis);
      const rowNoise = fract(sin(rowSeed.mul(seed).add(time.mul(0.1))).mul(43758.5453));
      const effThresh = threshold.add(rowNoise.sub(0.5).mul(0.25)).clamp(0.05, 0.95);
      const effSpan = sortSpan.mul(rowNoise.mul(0.8).add(0.4));

      let hasSorted = baseLum.greaterThanEqual(effThresh);
      let bestCol = baseCol;
      let bestLum = baseLum;

      for (let i = 1; i <= 6; i++) {
        const stepOffset = effSpan.mul(float(i / 6.0));
        const samplePx = px.sub(dir.mul(stepOffset));
        const sampleUV = samplePx.div(resolution).clamp(0.0, 1.0);
        const sCol = sampleFn(sampleUV);
        const sLum = rec601Luminance(sCol.rgb);

        const isSampleAbove = sLum.greaterThanEqual(effThresh);
        hasSorted = hasSorted.or(isSampleAbove);

        const takeThis = sLum.greaterThan(bestLum).and(isSampleAbove);
        bestCol = takeThis.select(sCol, bestCol);
        bestLum = takeThis.select(sLum, bestLum);
      }

      const finalRGB = hasSorted.select(bestCol.rgb, baseCol.rgb);
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
