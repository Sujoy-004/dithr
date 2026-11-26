import {
  Fn,
  uv,
  vec3,
  vec4,
  floor,
  fract,
  smoothstep,
  mix,
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
 * Modernized Dot Matrix Screen effect definition (D-01, D-05, D-20).
 * Grid of discrete circular LED diodes sized by Rec. 601 luminance on a dark carbon chassis.
 * Renders the media to its bone — zero continuous video underneath.
 */
export const dotsEffect: EffectDefinition = {
  id: 'dots',
  label: 'Dot Matrix Screen',
  category: 'stylize',
  requiresPass: false,
  requiresSpatialSampling: true,
  costWeight: 2,
  parameters: {
    spacing: {
      type: 'float',
      min: 4.0,
      max: 32.0,
      default: 12.0,
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
    bezel: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.2,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const spacing = toNode(uniforms.spacing, 12.0).max(4.0);
    const radius = toNode(uniforms.radius, 1.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const pixelCoord = st.mul(safeRes);

      // Discrete LED cell grid
      const cellCoord = floor(pixelCoord.div(spacing));
      const cellCenterUV = cellCoord.mul(spacing).add(spacing.mul(0.5)).div(safeRes).clamp(0.0, 1.0);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      // Sample discrete color of this LED bulb
      const cellCol = sampleFn(cellCenterUV);
      const lum = rec601Luminance(cellCol.rgb);

      // Distance from pixel to center of its LED cell
      const cellFrac = fract(pixelCoord.div(spacing)).sub(0.5);
      const dist = cellFrac.length();

      // Bulb aperture: sized by luminance
      const maxRadius = float(0.48);
      const dotR = lum.mul(radius).mul(0.48).clamp(0.04, maxRadius);

      // Subpixel anti-aliasing
      const dotMask = smoothstep(dotR.add(0.02), dotR.sub(0.02), dist);

      // Chassis panel background (pure dark carbon matrix)
      const panelColor = vec3(0.02, 0.02, 0.03);
      // Discrete glowing LED bulb
      const bulbColor = cellCol.rgb.mul(1.3).add(vec3(0.02));

      const finalRGB = mix(panelColor, bulbColor, dotMask);
      return vec4(finalRGB, cellCol.a ?? float(1.0));
    })();
  },
};
