import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  abs,
  sin,
  mix,
  fwidth,
  smoothstep,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, sampleWithEnv } from '../tslHelpers';

/**
 * Wave Lines oscilloscope modulation effect definition (D-01, D-20, D-27).
 * Divides canvas into horizontal scanlines, samples perceptual Rec. 601 luma via env.sampleAt,
 * modulates harmonic vertical displacement + stroke width by luminance with fwidth() AA.
 */
export const waveLinesEffect: EffectDefinition = {
  id: 'waveLines',
  label: 'Wave Lines',
  category: 'stylize',
  requiresPass: false,
  spatial: true,
  costWeight: 1,
  parameters: {
    frequency: {
      type: 'float',
      min: 8.0,
      max: 120.0,
      default: 48.0,
      step: 1.0,
      audioModulatable: true,
    },
    amplitude: {
      type: 'float',
      min: 0.0,
      max: 2.0,
      default: 0.7,
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
    colorize: {
      type: 'boolean',
      default: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const frequency = toNode(uniforms.frequency, 48.0);
    const amplitude = toNode(uniforms.amplitude, 0.7);
    const speed = toNode(uniforms.speed, 1.0);
    const colorize = toNode(uniforms.colorize, 1.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pixelCoord = st.mul(safeRes);

      const lineSpacing: any = safeRes.y.div(frequency.max(8.0)).max(2.0);
      const lineIdx: any = floor(pixelCoord.y.div(lineSpacing));
      const lineCenterY: any = lineIdx.add(0.5).mul(lineSpacing).div(safeRes.y).clamp(0.001, 0.999);

      const lineCol = sampleWithEnv(inputNode, env, vec2(st.x, lineCenterY));
      const lum = rec601PerceptualLuminance(lineCol.rgb);

      const phase = pixelCoord.x
        .mul(0.045)
        .add(time.mul(speed.mul(3.0)))
        .add(lineIdx.mul(0.7));
      const carrier = sin(phase).mul(lum).mul(amplitude).mul(lineSpacing).mul(0.42);

      const localY = fract(pixelCoord.y.div(lineSpacing)).sub(0.5).mul(lineSpacing);
      const dist = abs(localY.sub(carrier));

      const halfThick = mix(float(0.45), lineSpacing.mul(0.42), lum);
      const aa = fwidth(dist).max(0.65);
      const mask = float(1.0).sub(smoothstep(halfThick.sub(aa), halfThick.add(aa), dist));

      const bgCol = vec3(0.002, 0.0024, 0.003); // #06070a linear
      const chalk = vec3(0.84, 0.86, 0.90);
      const fgCol = mix(chalk, lineCol.rgb, colorize);
      const finalRGB = mix(bgCol, fgCol, mask);

      return vec4(finalRGB, lineCol.a ?? float(1.0));
    })();
  },
};
