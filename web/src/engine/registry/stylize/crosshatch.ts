import {
  Fn,
  uv,
  vec3,
  vec4,
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
 * Modernized Crosshatch Engraving effect definition (D-01, D-05, D-20).
 * 4-tier progressive intaglio etching angles (45°, -45°, 90°, 0°) with pure ink on archival paper.
 * Renders the media to its bone — zero continuous video underneath.
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
      min: 0.05,
      max: 0.8,
      default: 0.25,
      step: 0.02,
      audioModulatable: true,
    },
    contrast: {
      type: 'float',
      min: 0.1,
      max: 1.0,
      default: 0.95,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const spacing = toNode(uniforms.spacing, 6.0).max(1.0);
    const density = toNode(uniforms.density, 0.25);
    const contrast = toNode(uniforms.contrast, 0.95).clamp(0.0, 1.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const pixelCoord = st.mul(safeRes);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const baseCol = sampleFn(st);
      const lum = rec601Luminance(baseCol.rgb);

      // 4 progressive hatching angles: 45°, -45°, 90°, 0°
      const coord1 = pixelCoord.x.add(pixelCoord.y);
      const coord2 = pixelCoord.x.sub(pixelCoord.y);
      const coord3 = pixelCoord.x;
      const coord4 = pixelCoord.y;

      const dist1 = fract(coord1.div(spacing)).sub(0.5).abs().mul(2.0);
      const dist2 = fract(coord2.div(spacing)).sub(0.5).abs().mul(2.0);
      const dist3 = fract(coord3.div(spacing)).sub(0.5).abs().mul(2.0);
      const dist4 = fract(coord4.div(spacing)).sub(0.5).abs().mul(2.0);

      const stroke1 = smoothstep(density, density.sub(0.1).max(0.01), dist1);
      const stroke2 = smoothstep(density, density.sub(0.1).max(0.01), dist2);
      const stroke3 = smoothstep(density, density.sub(0.1).max(0.01), dist3);
      const stroke4 = smoothstep(density, density.sub(0.1).max(0.01), dist4);

      // 4 progressive tiers triggered by Rec. 601 luminance
      const w1 = smoothstep(float(0.85), float(0.65), lum);
      const w2 = smoothstep(float(0.65), float(0.45), lum);
      const w3 = smoothstep(float(0.45), float(0.25), lum);
      const w4 = smoothstep(float(0.25), float(0.05), lum);

      const totalInk = stroke1.mul(w1)
        .add(stroke2.mul(w2))
        .add(stroke3.mul(w3))
        .add(stroke4.mul(w4))
        .clamp(0.0, 1.0);

      // Pure archival print paper (clean ivory)
      const paperColor = vec3(0.96, 0.94, 0.89);
      // Deep intaglio engraving ink
      const inkColor = vec3(0.05, 0.04, 0.06);

      const finalRGB = mix(paperColor, inkColor, totalInk.mul(contrast));
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
