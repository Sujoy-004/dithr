import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  dot,
  mix,
  fwidth,
  smoothstep,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { hash22Node } from '../../color/luminance';
import { toNode, sampleWithEnv } from '../tslHelpers';

/**
 * Voronoi cellular mosaic effect definition (D-01, D-20).
 * Genuine 3x3 Worley neighbor search in pixel space with Dave Hoskins jittered seeds,
 * flat facet sampling at the winning cell seed via env.sampleAt, and fwidth() borders.
 */
export const voronoiEffect: EffectDefinition = {
  id: 'voronoi',
  label: 'Voronoi Mosaic',
  category: 'stylize',
  requiresPass: true,
  costWeight: 2,
  parameters: {
    scale: {
      type: 'float',
      min: 4.0,
      max: 100.0,
      default: 24.0,
      step: 2.0,
      unit: 'px',
      audioModulatable: true,
    },
    jitter: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.85,
      step: 0.05,
      audioModulatable: true,
    },
    borderWidth: {
      type: 'float',
      min: 0.0,
      max: 0.25,
      default: 0.05,
      step: 0.01,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const scale = toNode(uniforms.scale, 24.0);
    const jitter = toNode(uniforms.jitter, 0.85);
    const borderWidth = toNode(uniforms.borderWidth, 0.05);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const cellSize = scale.max(4.0);
      const p = st.mul(safeRes).div(cellSize);
      const n = floor(p);
      const f = fract(p);

      let d1: any = float(100.0);
      let d2: any = float(100.0);
      let bestSeedPos: any = n.add(0.5);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const offset = vec2(float(dx), float(dy));
          const cell = n.add(offset);
          const rnd = hash22Node(cell);
          const seedInCell = mix(vec2(0.5, 0.5), rnd, jitter);
          const pt = offset.add(seedInCell);
          const diff = pt.sub(f);
          const d = dot(diff, diff);

          const isCloser = d.lessThan(d1);
          const isSecond = isCloser.not().and(d.lessThan(d2));

          d2 = isCloser.select(d1, isSecond.select(d, d2));
          d1 = isCloser.select(d, d1);
          bestSeedPos = isCloser.select(cell.add(seedInCell), bestSeedPos);
        }
      }

      const bestUV = bestSeedPos.mul(cellSize).div(safeRes).clamp(0.001, 0.999);
      const facetCol = sampleWithEnv(inputNode, env, bestUV);

      const edgeDist = d2.max(0.0).sqrt().sub(d1.max(0.0).sqrt());
      const aa = fwidth(edgeDist).max(0.005);
      const borderMask = borderWidth
        .greaterThan(0.001)
        .select(
          float(1.0).sub(smoothstep(borderWidth.sub(aa), borderWidth.add(aa), edgeDist)),
          float(0.0)
        );

      const borderCol = vec3(0.004, 0.0045, 0.006);
      const finalRGB = mix(facetCol.rgb, borderCol, borderMask);

      return vec4(finalRGB, facetCol.a ?? float(1.0));
    })();
  },
};
