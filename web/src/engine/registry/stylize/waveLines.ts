import {
  Fn,
  uv,
  vec3,
  vec4,
  sin,
  floor,
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
 * Modernized Analog Oscilloscope Wave Lines effect definition (D-01, D-20, D-27).
 * True luminance-deflected oscilloscope raster scanlines on dark CRT phosphor screen.
 * Renders the media to its bone — zero continuous video underneath.
 */
export const waveLinesEffect: EffectDefinition = {
  id: 'waveLines',
  label: 'Wave Lines',
  category: 'stylize',
  requiresPass: false,
  requiresSpatialSampling: true,
  costWeight: 2,
  parameters: {
    frequency: {
      type: 'float',
      min: 5.0,
      max: 80.0,
      default: 35.0,
      step: 1.0,
      audioModulatable: true,
    },
    amplitude: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.45,
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
    const frequency = toNode(uniforms.frequency, 35.0).max(5.0);
    const amplitude = toNode(uniforms.amplitude, 0.45);
    const speed = toNode(uniforms.speed, 1.0);
    const lineWidth = toNode(uniforms.lineWidth, 0.12);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));

      // CRT oscilloscope void background
      const bg = vec3(0.015, 0.015, 0.025);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      // Discrete scanlines down the screen
      const lineCount = frequency;
      const scanlineIdx = floor(st.y.mul(lineCount));
      const lineCenterY = scanlineIdx.add(0.5).div(lineCount);

      // Sample image along this scanline
      const sampleCol = sampleFn(vec2(st.x as any, lineCenterY as any));
      const lum = rec601Luminance(sampleCol.rgb);

      // Analog oscilloscope deflection: luminance pushes the beam vertically
      const sineHum = sin(st.x.mul(25.0).add(time.mul(speed.mul(3.0)))).mul(0.005);
      const waveDisplace = lum.mul(amplitude.mul(0.08)).add(sineHum);
      const displacedLineY = lineCenterY.add(waveDisplace);

      // Distance from pixel to the displaced waveform
      const distInPixels = st.y.sub(displacedLineY).abs().mul(safeRes.y);
      const stroke = smoothstep(lineWidth.mul(safeRes.y).max(1.2), float(0.0), distInPixels);

      // Glowing oscilloscope phosphor line
      const phosphorGreen = vec3(0.15, 1.0, 0.45);
      const glowingLine = mix(phosphorGreen, sampleCol.rgb.mul(1.5), 0.5);

      const finalRGB = mix(bg, glowingLine, stroke);
      return vec4(finalRGB, sampleCol.a ?? float(1.0));
    })();
  },
};
