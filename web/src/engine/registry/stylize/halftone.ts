import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  smoothstep,
  mix,
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
 * Modernized Halftone Screen effect definition (D-01, D-05, D-20).
 * Parametric rotating halftone dot screen with Rec. 601 luminance sizing on authentic paper.
 * Renders the media to its bone as real printed ink on paper — zero continuous video underneath.
 */
export const halftoneEffect: EffectDefinition = {
  id: 'halftone',
  label: 'Halftone Screen',
  category: 'stylize',
  requiresPass: false,
  requiresSpatialSampling: true,
  costWeight: 2,
  parameters: {
    frequency: {
      type: 'float',
      min: 5.0,
      max: 100.0,
      default: 35.0,
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
    paperTint: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.15,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const frequency = toNode(uniforms.frequency, 35.0).max(1.0);
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

      // Rotated grid cell
      const cellIdx: any = floor(rotatedUV.mul(frequency));
      const rotCellCenter: any = cellIdx.add(0.5).div(frequency);

      // Unrotate cell center to get UV in image space
      const unrotX: any = rotCellCenter.x.mul(cosA).add(rotCellCenter.y.mul(sinA));
      const unrotY: any = rotCellCenter.y.mul(cosA).sub(rotCellCenter.x.mul(sinA));
      const cellCenterUV: any = vec2(unrotX, unrotY).add(0.5).clamp(0.0, 1.0);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const cellCol = sampleFn(cellCenterUV);
      const lum = rec601Luminance(cellCol.rgb);

      const gridCoord = fract(rotatedUV.mul(frequency)).sub(0.5);
      const distToCenter = gridCoord.length();

      // Authentic newsprint / comic book paper
      const paperColor = vec3(0.96, 0.95, 0.91);
      // Pure black printing ink
      const inkColor = vec3(0.07, 0.06, 0.08);

      // Darker areas have larger ink dots (dot gain)
      const targetRadius = float(1.0).sub(lum).mul(dotRadius).mul(0.55).clamp(0.0, 0.7);
      const inker = smoothstep(targetRadius.add(0.03), targetRadius.sub(0.03), distToCenter);

      const finalRGB = mix(paperColor, inkColor, inker);
      return vec4(finalRGB, cellCol.a ?? float(1.0));
    })();
  },
};
