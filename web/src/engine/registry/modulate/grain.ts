import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  abs,
  clamp,
  float,
  mix,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import {
  hash12Node,
  hash22Node,
  rec601PerceptualLuminance,
} from '../../color/luminance';
import { toNode } from '../tslHelpers';

/**
 * Film Grain modulation effect definition (D-01, D-20, D-27).
 * Pixel-snapped Dave Hoskins Hash-without-Sine emulsion grain with midtone weighting.
 */
export const grainEffect: EffectDefinition = {
  id: 'grain',
  label: 'Film Grain',
  category: 'modulate',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    amount: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.2,
      step: 0.02,
      audioModulatable: true,
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
    const amount = toNode(uniforms.amount, 0.2);
    const monochrome = toNode(uniforms.monochrome, 1.0);
    const speed = toNode(uniforms.speed, 1.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(43.123);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pxCoord = floor(st.mul(safeRes));
      const tStep = floor(time.mul(speed).mul(24.0));
      const seedVec = vec2(seed.mul(1.13).add(tStep.mul(0.89)), seed.mul(2.41).sub(tStep.mul(1.37)));

      const h = hash22Node(pxCoord.add(seedVec));
      const nR = h.x.sub(0.5);
      const nG = h.y.sub(0.5);
      const nB = hash12Node(pxCoord.add(seedVec).add(vec2(37.1, 17.7))).sub(0.5);

      const baseCol = inputNode;
      const lum = rec601PerceptualLuminance(baseCol.rgb);
      const midtoneWeight = float(0.35).add(
        float(0.65).mul(float(1.0).sub(abs(lum.mul(2.0).sub(1.0))))
      );

      const colorNoise = vec3(nR, nG, nB).mul(amount).mul(midtoneWeight).mul(0.55);
      const monoNoise = vec3(nR).mul(amount).mul(midtoneWeight).mul(0.55);
      const finalNoise = mix(colorNoise, monoNoise, monochrome);

      const finalRGB = clamp(baseCol.rgb.add(finalNoise), 0.0, 1.0);
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
