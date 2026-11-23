import {
  Fn,
  uv,
  vec3,
  vec4,
  fract,
  sin,
  clamp,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * Seeded Noise grain field effect definition (D-01, D-20, D-27).
 * Deterministic pseudorandom noise field with injected time and seed uniforms.
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
      default: 0.3,
      step: 0.02,
      audioModulatable: true,
    },
    scale: {
      type: 'float',
      min: 1.0,
      max: 50.0,
      default: 10.0,
      step: 1.0,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const intensity = toNode(uniforms.intensity, 0.3);
    const scale = toNode(uniforms.scale, 10.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(12.9898);

    return Fn(() => {
      const st = uv();
      const coord = st.mul(scale);
      const coordSeed = coord.x.mul(seed).add(coord.y.mul(78.233)).add(time.mul(10.0));
      const noise = fract(sin(coordSeed).mul(43758.5453)).sub(0.5).mul(intensity);

      const baseCol = inputNode;
      const finalRGB = clamp(baseCol.rgb.add(vec3(noise)), 0.0, 1.0);
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
