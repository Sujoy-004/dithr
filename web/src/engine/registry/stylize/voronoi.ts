import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  sin,
  smoothstep,
  mix,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * Modernized Voronoi Cellular Mosaic effect definition (D-01, D-20).
 * True cellular Voronoi with 3x3 Worley distance partition, anti-aliased facet borders,
 * and facet color sampling.
 */
export const voronoiEffect: EffectDefinition = {
  id: 'voronoi',
  label: 'Voronoi Mosaic',
  category: 'stylize',
  requiresPass: false,
  costWeight: 2,
  parameters: {
    scale: {
      type: 'float',
      min: 4.0,
      max: 100.0,
      default: 24.0,
      step: 2.0,
      audioModulatable: true,
    },
    jitter: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.8,
      step: 0.05,
      audioModulatable: true,
    },
    borderWidth: {
      type: 'float',
      min: 0.0,
      max: 0.3,
      default: 0.08,
      step: 0.01,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const scale = toNode(uniforms.scale, 24.0).max(4.0);
    const jitter = toNode(uniforms.jitter, 0.8).clamp(0.0, 1.0);
    const borderWidth = toNode(uniforms.borderWidth, 0.08).clamp(0.0, 0.4);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const p = st.mul(safeRes).div(scale);
      const ip = floor(p);
      const fp = fract(p);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      // 2D pseudorandom hash
      const hash2 = (cell: any) => {
        const d1 = cell.x.mul(127.1).add(cell.y.mul(311.7));
        const d2 = cell.x.mul(269.5).add(cell.y.mul(183.3));
        return fract(vec2(sin(d1), sin(d2)).mul(43758.5453));
      };

      let minDist: any = float(8.0);
      let secondDist: any = float(8.0);
      let closestOffset: any = vec2(0.0, 0.0);

      // 3x3 grid search for true cellular Voronoi
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighbor = vec2(float(dx), float(dy));
          const rnd = hash2(ip.add(neighbor));
          const point = neighbor.add(rnd.mul(jitter));
          const diff = point.sub(fp);
          const d = diff.length();

          const isNewMin = d.lessThan(minDist);
          secondDist = isNewMin.select(minDist, d.lessThan(secondDist).select(d, secondDist));
          minDist = isNewMin.select(d, minDist);
          closestOffset = isNewMin.select(neighbor, closestOffset);
        }
      }

      // Sample facet color at cell feature point
      const facetUV = ip.add(closestOffset).add(0.5).mul(scale).div(safeRes).clamp(0.0, 1.0);
      const facetCol = sampleFn(facetUV);
      const baseCol = inputNode;

      // Anti-aliased facet border (F2 - F1 distance metric)
      const border = smoothstep(float(0.0), borderWidth.max(0.005), secondDist.sub(minDist));
      const borderColor = vec3(0.05, 0.05, 0.08); // Dark lead came border

      const facetRgb = facetCol?.rgb ? facetCol.rgb : baseCol.rgb;
      const finalRGB = mix(borderColor, facetRgb, border);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
