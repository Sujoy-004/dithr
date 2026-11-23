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
import { rec601Luminance } from '../../color/luminance';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * Tone Adjustment effect definition (D-01, D-05, D-20).
 * Pointwise color grading in linear light:
 * Brightness offset, contrast scaling, saturation via Rec. 601 luminance,
 * Rodrigues hue rotation, gamma shaping, and inversion.
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
      let rgb = col.rgb;

      // 1. Brightness: offset is brightness - 1.0
      rgb = rgb.add(brightness.sub(1.0));

      // 2. Contrast: (rgb - 0.5) * contrast + 0.5
      rgb = rgb.sub(0.5).mul(contrast).add(0.5);

      // 3. Saturation: blend with Rec. 601 perceived luminance (D-05)
      const lum = rec601Luminance(rgb);
      const gray = vec3(lum);
      rgb = mix(gray, rgb, saturation);

      // 4. Hue rotation: Rodrigues rotation around diagonal axis (1, 1, 1)/sqrt(3)
      const angle = hueRotation.mul(0.017453292519943295);
      const cosA = angle.cos();
      const sinA = angle.sin();
      const oneMinusCos = cosA.oneMinus();

      const k = vec3(0.5773502691896258);
      const kCrossRgb = k.cross(rgb);
      const kDotRgb = k.dot(rgb);

      const hueRotated = rgb
        .mul(cosA)
        .add(kCrossRgb.mul(sinA))
        .add(k.mul(kDotRgb).mul(oneMinusCos));

      rgb = clamp(hueRotated, 0.0, 1.0);

      // 5. Gamma correction
      const invGamma = gamma.reciprocal();
      rgb = pow(rgb.clamp(0.0001, 1.0), vec3(invGamma));

      // 6. Invert
      const invertedRgb = vec3(1.0).sub(rgb);
      rgb = mix(rgb, invertedRgb, invert);

      return vec4(rgb, col.a ?? float(1.0));
    })();
  },
};
