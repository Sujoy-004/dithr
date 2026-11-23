import {
  Fn,
  uv,
  vec4,
  sin,
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
 * Wave Lines raster distortion effect definition (D-01, D-20, D-27).
 * Sine wave raster lines with deterministic injected time uniform.
 */
export const waveLinesEffect: EffectDefinition = {
  id: 'waveLines',
  label: 'Wave Lines',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    frequency: {
      type: 'float',
      min: 1.0,
      max: 50.0,
      default: 20.0,
      step: 1.0,
      audioModulatable: true,
    },
    amplitude: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.5,
      step: 0.05,
      audioModulatable: true,
    },
    speed: {
      type: 'float',
      min: 0.0,
      max: 5.0,
      default: 1.0,
      step: 0.1,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const frequency = toNode(uniforms.frequency, 20.0).max(1.0);
    const amplitude = toNode(uniforms.amplitude, 0.5);
    const speed = toNode(uniforms.speed, 1.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);

    return Fn(() => {
      const st = uv();
      const wave = sin(st.y.mul(frequency).add(time.mul(speed.mul(2.0)))).mul(amplitude);
      const waveMask = sin(st.x.mul(100.0).add(wave)).mul(0.5).add(0.5);

      const baseCol = inputNode;
      const finalRGB = baseCol.rgb.mul(waveMask);
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
