import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  abs,
  mix,
  clamp,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import {
  hash12Node,
  hash22Node,
  rec601PerceptualLuminance,
} from '../../color/luminance';
import { toNode } from '../tslHelpers';

/**
 * Seeded Noise grain field effect definition (D-01, D-20, D-27).
 * Pixel-snapped grid using precision-safe Dave Hoskins Hash-without-Sine,
 * triangular PDF distribution, and film emulsion midtone weighting.
 */
export const noiseEffect: EffectDefinition = {
  id: 'noise',
  label: 'Seeded Noise',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    intensity: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.28,
      step: 0.02,
      audioModulatable: true,
    },
    grainSize: {
      type: 'float',
      min: 1.0,
      max: 8.0,
      default: 1.5,
      step: 0.5,
      unit: 'px',
    },
    monochrome: {
      type: 'boolean',
      default: true,
    },
    speed: {
      type: 'float',
      min: 0.0,
      max: 5.0,
      default: 1.0,
      step: 0.1,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const intensity = toNode(uniforms.intensity, 0.28);
    const grainSize = toNode(uniforms.grainSize, 1.5);
    const monochrome = toNode(uniforms.monochrome, 1.0);
    const speed = toNode(uniforms.speed, 1.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(12.9898);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const gSize = grainSize.max(1.0);
      const gridCoord = floor(st.mul(safeRes).div(gSize));

      const tStep = floor(time.mul(speed).mul(24.0));
      const seedVec = vec2(seed.mul(1.37).add(tStep.mul(0.73)), seed.mul(2.19).sub(tStep.mul(1.11)));

      // Triangular PDF [-1, 1] via two independent precision-safe hashes
      const h1 = hash22Node(gridCoord.add(seedVec));
      const h2 = hash22Node(gridCoord.add(seedVec.mul(1.73)).add(vec2(19.31, 7.53)));
      const triR = h1.x.add(h2.y).sub(1.0);
      const triG = h1.y.add(hash12Node(gridCoord.add(seedVec).add(vec2(31.7, 11.3)))).sub(1.0);
      const triB = hash12Node(gridCoord.add(seedVec).add(vec2(53.1, 29.7)))
        .add(h2.x)
        .sub(1.0);

      const baseCol = inputNode;
      const lum = rec601PerceptualLuminance(baseCol.rgb);
      const midtoneWeight = float(0.35).add(
        float(0.65).mul(float(1.0).sub(abs(lum.mul(2.0).sub(1.0))))
      );

      const colorGrain = vec3(triR, triG, triB);
      const monoGrain = vec3(triR);
      const noiseVec = mix(colorGrain, monoGrain, monochrome)
        .mul(intensity)
        .mul(midtoneWeight)
        .mul(0.35);

      const finalRGB = clamp(baseCol.rgb.add(noiseVec), 0.0, 1.0);
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
