import {
  Fn,
  uv,
  vec2,
  vec4,
  fract,
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
 * Halftone Screen effect definition (D-01, D-05, D-20).
 * Parametric halftone dot screen with rotating grid and Rec. 601 luminance sizing.
 */
export const halftoneEffect: EffectDefinition = {
  id: 'halftone',
  label: 'Halftone Screen',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    frequency: {
      type: 'float',
      min: 5.0,
      max: 100.0,
      default: 30.0,
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
  },
  buildNode: (inputNode, uniforms) => {
    const frequency = toNode(uniforms.frequency, 30.0).max(1.0);
    const angle = toNode(uniforms.angle, 45.0);
    const dotRadius = toNode(uniforms.dotRadius, 1.0);

    return Fn(() => {
      const st: any = uv();
      const rad: any = angle.mul(0.017453292519943295);
      const cosA: any = rad.cos();
      const sinA: any = rad.sin();

      const centeredUV: any = st.sub(0.5);
      const rotX: any = centeredUV.x.mul(cosA).sub(centeredUV.y.mul(sinA));
      const rotY: any = centeredUV.x.mul(sinA).add(centeredUV.y.mul(cosA));
      const rotatedUV: any = vec2(rotX, rotY);

      const gridCoord = fract(rotatedUV.mul(frequency)).sub(0.5);
      const distToCenter = gridCoord.length();

      const baseCol = inputNode;
      const rgb = baseCol.rgb;

      const lum = rec601Luminance(rgb);
      const targetRadius = lum.mul(dotRadius).mul(0.5).clamp(0.0, 0.7);

      const edge = distToCenter.lessThanEqual(targetRadius).select(float(1.0), float(0.0));
      const finalRGB = rgb.mul(edge);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
