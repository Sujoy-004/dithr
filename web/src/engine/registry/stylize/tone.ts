import {
  Fn,
  vec3,
  vec4,
  clamp,
  pow,
  mix,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { linearTosRGBChannel, sRGBToLinearChannel } from '../../color/colorSpace';
import { toNode } from '../tslHelpers';

/**
 * Tone Adjustment effect definition (D-01, D-05, D-20).
 * Operates in perceptual sRGB space for intuitive brightness/contrast/saturation/hue/gamma
 * curves, then converts cleanly back to Linear working space.
 */
export const toneEffect: EffectDefinition = {
  id: 'tone',
  label: 'Tone Adjustment',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    brightness: {
      type: 'float',
      min: 0,
      max: 2,
      default: 1.0,
      step: 0.01,
      audioModulatable: true,
    },
    contrast: {
      type: 'float',
      min: 0,
      max: 2,
      default: 1.0,
      step: 0.01,
      audioModulatable: true,
    },
    saturation: {
      type: 'float',
      min: 0,
      max: 2,
      default: 1.0,
      step: 0.01,
      audioModulatable: true,
    },
    hueRotation: {
      type: 'float',
      min: -180,
      max: 180,
      default: 0.0,
      step: 1.0,
      unit: 'deg',
      audioModulatable: true,
    },
    gamma: {
      type: 'float',
      min: 0.1,
      max: 3.0,
      default: 1.0,
      step: 0.05,
      audioModulatable: true,
    },
    invert: {
      type: 'boolean',
      default: false,
    },
  },
  buildNode: (inputNode, uniforms) => {
    const brightness = toNode(uniforms.brightness, 1.0);
    const contrast = toNode(uniforms.contrast, 1.0);
    const saturation = toNode(uniforms.saturation, 1.0);
    const hueRotation = toNode(uniforms.hueRotation, 0.0);
    const gamma = toNode(uniforms.gamma, 1.0);
    const invert = toNode(uniforms.invert, 0.0);

    return Fn(() => {
      const col = inputNode;

      // Convert Linear working light -> perceptual sRGB for grading
      let rgb: any = vec3(
        linearTosRGBChannel(col.r),
        linearTosRGBChannel(col.g),
        linearTosRGBChannel(col.b)
      );

      // 1. Brightness offset
      rgb = rgb.add(brightness.sub(1.0));

      // 2. Contrast around perceptual 0.5 mid-gray
      rgb = rgb.sub(0.5).mul(contrast).add(0.5);

      // 3. Saturation: blend with Rec. 601 perceptual luminance
      const lum = rgb.r.mul(0.299).add(rgb.g.mul(0.587)).add(rgb.b.mul(0.114));
      rgb = mix(vec3(lum), rgb, saturation);

      // 4. Hue rotation (unclamped intermediate Rodrigues rotation)
      const angle = hueRotation.mul(0.017453292519943295);
      const cosA = angle.cos();
      const sinA = angle.sin();
      const oneMinusCos = cosA.oneMinus();

      const k = vec3(0.5773502691896258);
      const kCrossRgb = k.cross(rgb);
      const kDotRgb = k.dot(rgb);

      rgb = rgb
        .mul(cosA)
        .add(kCrossRgb.mul(sinA))
        .add(k.mul(kDotRgb).mul(oneMinusCos));

      rgb = clamp(rgb, 0.0, 1.0);

      // 5. Gamma shaping
      const invGamma = gamma.max(0.05).reciprocal();
      rgb = pow(rgb.clamp(0.0001, 1.0), vec3(invGamma));

      // 6. Invert toggle
      rgb = mix(rgb, vec3(1.0).sub(rgb), invert);
      rgb = clamp(rgb, 0.0, 1.0);

      // Convert perceptual sRGB -> Linear working light
      const linearRGB = vec3(
        sRGBToLinearChannel(rgb.r),
        sRGBToLinearChannel(rgb.g),
        sRGBToLinearChannel(rgb.b)
      );

      return vec4(linearRGB, col.a ?? float(1.0));
    })();
  },
};
