import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  fract,
  abs,
  float,
  mix,
  fwidth,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, sampleWithEnv } from '../tslHelpers';

/**
 * Topographic Contour Banding effect definition (D-01, D-05, D-20).
 * 5-tap cross-smoothed perceptual luma via env.sampleAt and fwidth()-normalized
 * isoline thickness so contour lines stay crisp at any gradient slope.
 */
export const contourEffect: EffectDefinition = {
  id: 'contour',
  label: 'Topographic Contour',
  category: 'stylize',
  requiresPass: false,
  spatial: true,
  costWeight: 1,
  parameters: {
    steps: {
      type: 'float',
      min: 2.0,
      max: 32.0,
      default: 10.0,
      step: 1.0,
      audioModulatable: true,
    },
    lineWidth: {
      type: 'float',
      min: 0.5,
      max: 4.0,
      default: 1.5,
      step: 0.1,
      unit: 'px',
      audioModulatable: true,
    },
    colorize: {
      type: 'boolean',
      default: false,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const steps = toNode(uniforms.steps, 10.0);
    const lineWidth = toNode(uniforms.lineWidth, 1.5);
    const colorize = toNode(uniforms.colorize, 0.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const d = vec2(1.5).div(safeRes);

      const c0 = sampleWithEnv(inputNode, env, st);
      const cR = sampleWithEnv(inputNode, env, st.add(vec2(d.x, 0.0)).clamp(0.001, 0.999));
      const cL = sampleWithEnv(inputNode, env, st.sub(vec2(d.x, 0.0)).clamp(0.001, 0.999));
      const cU = sampleWithEnv(inputNode, env, st.add(vec2(0.0, d.y)).clamp(0.001, 0.999));
      const cD = sampleWithEnv(inputNode, env, st.sub(vec2(0.0, d.y)).clamp(0.001, 0.999));

      const lum = rec601PerceptualLuminance(c0.rgb)
        .mul(2.0)
        .add(rec601PerceptualLuminance(cR.rgb))
        .add(rec601PerceptualLuminance(cL.rgb))
        .add(rec601PerceptualLuminance(cU.rgb))
        .add(rec601PerceptualLuminance(cD.rgb))
        .div(6.0);

      const v = lum.mul(steps);
      const deriv = fwidth(v).max(0.0001);
      const distInPx = abs(fract(v.sub(0.5)).sub(0.5)).div(deriv);

      const halfW = lineWidth.mul(0.5);
      const lineMask = float(1.0).sub(smoothstep(halfW, halfW.add(1.2), distInPx));

      const chalk = vec3(0.84, 0.86, 0.90); // #e9ebf0 linear
      const bg = vec3(0.003, 0.0035, 0.005); // #07080b linear
      const fg = mix(chalk, c0.rgb, colorize);

      return vec4(mix(bg, fg, lineMask), c0.a ?? float(1.0));
    })();
  },
};
