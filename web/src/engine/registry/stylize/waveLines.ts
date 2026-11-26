import {
  Fn,
  uv,
  vec3,
  vec4,
  sin,
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
 * Modernized Analog Oscilloscope Wave Lines effect definition (D-01, D-20, D-27).
 * True luminance-displaced analog oscilloscope raster scanlines with smooth anti-aliased falloff.
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
      min: 5.0,
      max: 80.0,
      default: 30.0,
      step: 1.0,
      audioModulatable: true,
    },
    amplitude: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.4,
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
    lineWidth: {
      type: 'float',
      min: 0.02,
      max: 0.4,
      default: 0.12,
      step: 0.01,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const frequency = toNode(uniforms.frequency, 30.0).max(1.0);
    const amplitude = toNode(uniforms.amplitude, 0.4);
    const speed = toNode(uniforms.speed, 1.0);
    const lineWidth = toNode(uniforms.lineWidth, 0.12);
    const time = env?.time ?? uniforms.time ?? float(0.0);

    return Fn(() => {
      const st = uv();
      const baseCol = inputNode;
      const lum = rec601Luminance(baseCol.rgb);

      // Analog oscilloscope sine modulation + luminance vertical displacement
      const wavePhase = st.x.mul(25.0).add(time.mul(speed.mul(3.0)));
      const sineWave = sin(wavePhase).mul(amplitude.mul(0.15));
      const lumDisplace = lum.sub(0.5).mul(amplitude.mul(0.35));
      const totalDisplace = sineWave.add(lumDisplace);

      // Distance to raster line center
      const lineDist = fract(st.y.mul(frequency).add(totalDisplace)).sub(0.5).abs().mul(2.0);

      // Anti-aliased line stroke falloff via smoothstep
      const stroke = smoothstep(lineWidth, float(0.0), lineDist);

      // Illuminate raster lines while preserving scene exposure
      const dimmedSource = baseCol.rgb.mul(0.25);
      const brightLine = baseCol.rgb.mul(1.4).add(vec3(0.08, 0.15, 0.12));
      const finalRGB = mix(dimmedSource, brightLine, stroke);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
