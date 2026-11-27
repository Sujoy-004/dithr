import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  float,
  mix,
  fwidth,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, sampleWithEnv } from '../tslHelpers';

/**
 * Regular Dot Matrix Screen effect definition (D-01, D-05, D-20).
 * Snaps to square pixel grid, samples cell-center RGB via env.sampleAt,
 * computes area-proportional radius sqrt(lum), and applies fwidth() anti-aliasing.
 */
export const dotsEffect: EffectDefinition = {
  id: 'dots',
  label: 'Dot Matrix Screen',
  category: 'stylize',
  requiresPass: false,
  spatial: true,
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
    const spacing = toNode(uniforms.spacing, 10.0);
    const radius = toNode(uniforms.radius, 1.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pixelCoord = st.mul(safeRes);
      const cellSize = spacing.max(4.0);

      const cellCoord = floor(pixelCoord.div(cellSize));
      const cellCenterUV = cellCoord.add(0.5).mul(cellSize).div(safeRes).clamp(0.001, 0.999);
      const baseCol = sampleWithEnv(inputNode, env, cellCenterUV);

      const lum = rec601PerceptualLuminance(baseCol.rgb);
      const cellFrac = fract(pixelCoord.div(cellSize)).sub(0.5);
      const dist = cellFrac.length();

      const dotR = lum.max(0.0).sqrt().mul(0.48).mul(radius).clamp(0.0, 0.72);
      const aa = fwidth(dist).max(0.02);
      const dotMask = float(1.0).sub(smoothstep(dotR.sub(aa), dotR.add(aa), dist));

      const housingBg = baseCol.rgb.mul(0.03).add(vec3(0.002, 0.0024, 0.003));
      const finalRGB = mix(housingBg, baseCol.rgb, dotMask);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
