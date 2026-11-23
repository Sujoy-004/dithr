import {
  Fn,
  uv,
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
 * Regular Dot Matrix Screen effect definition (D-01, D-05, D-20).
 * Grid of circular dots sized by Rec. 601 perceived luminance.
 */
export const dotsEffect: EffectDefinition = {
  id: 'dots',
  label: 'Dot Matrix Screen',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    spacing: {
      type: 'float',
      min: 4.0,
      max: 32.0,
      default: 10.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    radius: {
      type: 'float',
      min: 0.2,
      max: 2.0,
      default: 1.0,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const spacing = toNode(uniforms.spacing, 10.0).max(4.0);
    const radius = toNode(uniforms.radius, 1.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const pixelCoord = st.mul(safeRes);
      const cell = fract(pixelCoord.div(spacing)).sub(0.5);
      const dist = cell.length();

      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);
      const dotR = lum.mul(radius).mul(0.5).min(0.5);
      const dotMask = dist.lessThanEqual(dotR).select(1.0, 0.0);

      return vec4(baseCol.rgb.mul(dotMask), baseCol.a ?? float(1.0));
    })();
  },
};
