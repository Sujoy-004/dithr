import {
  Fn,
  uv,
  vec4,
  fract,
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
 * Voronoi cellular mosaic effect definition (D-01, D-20).
 * Cellular grid distance partition with configurable scale and jitter.
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
  },
  buildNode: (inputNode, uniforms, env) => {
    const scale = toNode(uniforms.scale, 24.0);
    const jitter = toNode(uniforms.jitter, 0.8);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const p = st.mul(resolution).div(scale.max(4.0));
      const f = fract(p).sub(0.5);
      const dist = f.mul(jitter.add(0.2)).length();

      const baseCol = inputNode;
      const finalRGB = baseCol.rgb.mul(dist.min(1.0));
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
