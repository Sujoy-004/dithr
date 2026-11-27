import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  fract,
  abs,
  max,
  mix,
  fwidth,
  smoothstep,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { toNode } from '../tslHelpers';

/**
 * Crosshatch engraving effect definition (D-01, D-05, D-20).
 * 4-angle progressive engraving layers (45°, -45°, 26.5°, -63.5°) with fwidth()
 * anti-aliased strokes over perceptual Rec. 601 luminance.
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
      min: 3.0,
      max: 24.0,
      default: 7.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    density: {
      type: 'float',
      min: 0.1,
      max: 1.0,
      default: 0.3,
      step: 0.05,
      audioModulatable: true,
    },
    invert: {
      type: 'boolean',
      default: false,
    },
    colorInk: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.0,
      step: 0.05,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const spacing = toNode(uniforms.spacing, 7.0);
    const density = toNode(uniforms.density, 0.3);
    const invert = toNode(uniforms.invert, 0.0);
    const colorInk = toNode(uniforms.colorInk, 0.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pixelCoord = st.mul(safeRes);
      const baseCol = inputNode;
      const lum = rec601PerceptualLuminance(baseCol.rgb);
      const toneVal = mix(lum, float(1.0).sub(lum), invert);

      const safeSpacing = spacing.max(3.0);
      const strokeHalfW = density.mul(safeSpacing).mul(0.32);

      const hatchLayer = (coordProj: any, lumThreshold: number) => {
        const phase = coordProj.div(safeSpacing);
        const dist = abs(fract(phase).sub(0.5)).mul(safeSpacing);
        const aa = fwidth(coordProj).max(0.6);
        const line = float(1.0).sub(
          smoothstep(strokeHalfW.sub(aa), strokeHalfW.add(aa), dist)
        );
        const lumGate = smoothstep(
          float(lumThreshold + 0.06),
          float(lumThreshold - 0.06),
          toneVal
        );
        return line.mul(lumGate);
      };

      // 4 classic engraving angles: 45°, -45°, 26.5°, -63.5°
      const p1 = pixelCoord.x.mul(0.7071).add(pixelCoord.y.mul(0.7071));
      const p2 = pixelCoord.x.mul(0.7071).sub(pixelCoord.y.mul(0.7071));
      const p3 = pixelCoord.x.mul(0.8944).add(pixelCoord.y.mul(0.4472));
      const p4 = pixelCoord.x.mul(0.4472).sub(pixelCoord.y.mul(0.8944));

      const h1 = hatchLayer(p1, 0.82);
      const h2 = hatchLayer(p2, 0.60);
      const h3 = hatchLayer(p3, 0.38);
      const h4 = hatchLayer(p4, 0.18);

      const inkMask = max(max(h1, h2), max(h3, h4));

      const paper = vec3(0.89, 0.87, 0.83); // archival warm paper #f2f0eb linear
      const darkInk = mix(vec3(0.005, 0.006, 0.008), baseCol.rgb.mul(0.55), colorInk);
      const normalOut = mix(paper, darkInk, inkMask);

      const obsidian = vec3(0.003, 0.0035, 0.005);
      const chalkInk = mix(vec3(0.84, 0.86, 0.90), baseCol.rgb, colorInk);
      const invertedOut = mix(obsidian, chalkInk, inkMask);

      return vec4(mix(normalOut, invertedOut, invert), baseCol.a ?? float(1.0));
    })();
  },
};
