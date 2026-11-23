import {
  Fn,
  uv,
  vec3,
  vec4,
  fract,
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
 * Crosshatch engraving effect definition (D-01, D-05, D-20).
 * Multi-angle diagonal line hatching modulated by Rec. 601 perceived luminance.
 */
export const crosshatchEffect: EffectDefinition = {
  id: 'crosshatch',
  label: 'Crosshatch',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    spacing: {
      type: 'float',
      min: 2.0,
      max: 20.0,
      default: 6.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    density: {
      type: 'float',
      min: 0.1,
      max: 1.0,
      default: 0.2,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const spacing = toNode(uniforms.spacing, 6.0).max(1.0);
    const density = toNode(uniforms.density, 0.2);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const pixelCoord = st.mul(safeRes);
      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);

      const hatch1 = fract(pixelCoord.x.add(pixelCoord.y).div(spacing)).lessThan(density);
      const hatch2 = fract(pixelCoord.x.sub(pixelCoord.y).div(spacing)).lessThan(density);

      const lineVal = lum.lessThan(0.7).and(hatch1)
        .or(lum.lessThan(0.4).and(hatch2));

      const outCol = lineVal.select(vec3(0.0), vec3(1.0));
      return vec4(outCol, baseCol.a ?? float(1.0));
    })();
  },
};
