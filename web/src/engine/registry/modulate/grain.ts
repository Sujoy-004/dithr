import {
  Fn,
  uv,
  vec3,
  vec4,
  fract,
  sin,
  clamp,
  float,
  mix,
} from 'three/tsl';
import type { EffectDefinition } from '../types';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * Film Grain modulation effect definition (D-01, D-20, D-27).
 * Modulates pixel colors with fine-grained film emulsion grain using injected time and seed.
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

    return Fn(() => {
      const st = uv();
      const t = time.mul(speed);

      // Seeded high-frequency noise
      const nCoordR = st.x.mul(seed).add(st.y.mul(78.233)).add(t.mul(5.0));
      const nCoordG = st.x.mul(seed.add(11.0)).add(st.y.mul(93.112)).add(t.mul(5.0));
      const nCoordB = st.x.mul(seed.add(23.0)).add(st.y.mul(61.456)).add(t.mul(5.0));

      const noiseR = fract(sin(nCoordR).mul(43758.5453)).sub(0.5);
      const noiseG = fract(sin(nCoordG).mul(43758.5453)).sub(0.5);
      const noiseB = fract(sin(nCoordB).mul(43758.5453)).sub(0.5);

      const colorNoise = (vec3 as any)(noiseR, noiseG, noiseB).mul(amount);
      const monoNoise = vec3(noiseR as any).mul(amount);
      const finalNoise = (mix as any)(colorNoise, monoNoise, monochrome);

      const baseCol = inputNode;
      const finalRGB = clamp(baseCol.rgb.add(finalNoise), 0.0, 1.0);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
