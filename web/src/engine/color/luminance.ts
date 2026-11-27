import { Fn, vec2, vec3, fract, dot } from 'three/tsl';
import { linearTosRGBChannel } from './colorSpace';

/**
 * Rec. 601 and Rec. 709 Luminance standards and TSL shader nodes (D-05, D-20, FX-01, FX-02).
 * Rec. 601 coefficients strictly match src/renderer.py:49-51 for ASCII luminance parity.
 */

export const REC601_COEFFICIENTS = {
  r: 0.299,
  g: 0.587,
  b: 0.114,
} as const;

export const REC709_COEFFICIENTS = {
  r: 0.2126,
  g: 0.7152,
  b: 0.0722,
} as const;

export type LuminanceStandard = 'rec601' | 'rec709';

/**
 * CPU perceived luminance using Rec. 601 weights (float output).
 */
export function rec601LuminanceCpu(r: number, g: number, b: number): number {
  return REC601_COEFFICIENTS.r * r + REC601_COEFFICIENTS.g * g + REC601_COEFFICIENTS.b * b;
}

/**
 * CPU perceived luminance using Rec. 601 integer truncated math matching src/renderer.py:49-51.
 */
export function rec601LuminanceInt(r: number, g: number, b: number): number {
  return Math.floor(REC601_COEFFICIENTS.r * r + REC601_COEFFICIENTS.g * g + REC601_COEFFICIENTS.b * b);
}

/**
 * CPU perceived luminance using Rec. 709 HDTV weights (float output).
 */
export function rec709LuminanceCpu(r: number, g: number, b: number): number {
  return REC709_COEFFICIENTS.r * r + REC709_COEFFICIENTS.g * g + REC709_COEFFICIENTS.b * b;
}

/**
 * TSL perceived luminance node using Rec. 601 weights (0.299*R + 0.587*G + 0.114*B).
 * Matches src/renderer.py:49-51 for ASCII character selection parity.
 */
export const rec601Luminance = (rgb: any) => {
  return rgb.r.mul(REC601_COEFFICIENTS.r)
    .add(rgb.g.mul(REC601_COEFFICIENTS.g))
    .add(rgb.b.mul(REC601_COEFFICIENTS.b));
};

/**
 * Perceptual Rec. 601 luminance evaluated in sRGB perceptual space from a Linear RGB node.
 * Ensures sRGB mid-gray 0.5 evaluates to ~0.500 instead of linear-light ~0.214.
 */
export const rec601PerceptualLuminance = (rgb: any) => {
  const sr = linearTosRGBChannel(rgb.r);
  const sg = linearTosRGBChannel(rgb.g);
  const sb = linearTosRGBChannel(rgb.b);
  return sr.mul(REC601_COEFFICIENTS.r)
    .add(sg.mul(REC601_COEFFICIENTS.g))
    .add(sb.mul(REC601_COEFFICIENTS.b));
};

/**
 * TSL perceived luminance node using Rec. 709 HDTV weights (0.2126*R + 0.7152*G + 0.0722*B).
 */
export const rec709Luminance = (rgb: any) => {
  return rgb.r.mul(REC709_COEFFICIENTS.r)
    .add(rgb.g.mul(REC709_COEFFICIENTS.g))
    .add(rgb.b.mul(REC709_COEFFICIENTS.b));
};

/**
 * Global standard support for luminance calculation per D-05.
 */
export const getLuminanceNode = (rgb: any, standard: LuminanceStandard = 'rec601') => {
  return standard === 'rec709' ? rec709Luminance(rgb) : rec601Luminance(rgb);
};

/**
 * GPU-precision-safe Dave Hoskins Hash-without-Sine (vec2 -> float in [0, 1)).
 * Avoids diagonal sin() precision striping on WebGPU/ANGLE backends.
 */
export const hash12Node = Fn(([p]: [any]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(0.1031));
  const d = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
  const p3b = p3.add(d);
  return fract(p3b.x.add(p3b.y).mul(p3b.z));
});

/**
 * GPU-precision-safe Dave Hoskins Hash-without-Sine (vec2 -> vec2 in [0, 1)).
 * Avoids diagonal sin() precision striping on WebGPU/ANGLE backends.
 */
export const hash22Node = Fn(([p]: [any]) => {
  const p3 = fract(vec3(p.x, p.y, p.x).mul(vec3(0.1031, 0.1030, 0.0973)));
  const d = dot(p3, vec3(p3.y, p3.z, p3.x).add(33.33));
  const p3b = p3.add(d);
  return fract(vec2(p3b.x.add(p3b.y), p3b.x.add(p3b.z)).mul(vec2(p3b.z, p3b.y)));
});
