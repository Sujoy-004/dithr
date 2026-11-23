import { Fn, vec4, float } from 'three/tsl';

/**
 * Exact piecewise sRGB <-> Linear color transfer functions (IEC 61966-2-1, D-06, D-28, FX-02).
 * Thresholds: 0.04045 (sRGB -> Linear), 0.0031308 (Linear -> sRGB).
 * Factor: 12.92, Exponent: 2.4.
 * Clamps inputs cleanly to [0.0, 1.0] to prevent NaN/Infinity or out-of-bounds GPU artifacts.
 */

export const SRGB_THRESHOLD = 0.04045;
export const LINEAR_THRESHOLD = 0.0031308;
export const SRGB_FACTOR = 12.92;
export const SRGB_GAMMA = 2.4;

/**
 * CPU exact sRGB to Linear scalar conversion.
 */
export function sRGBToLinearCpu(c: number): number {
  if (Number.isNaN(c)) return 0.0;
  if (c <= 0.0) return 0.0;
  if (c >= 1.0) return 1.0;
  if (c <= SRGB_THRESHOLD) {
    return c / SRGB_FACTOR;
  }
  return Math.pow((c + 0.055) / 1.055, SRGB_GAMMA);
}

/**
 * CPU exact Linear to sRGB scalar conversion.
 */
export function linearTosRGBCpu(c: number): number {
  if (Number.isNaN(c)) return 0.0;
  if (c <= 0.0) return 0.0;
  if (c >= 1.0) return 1.0;
  if (c <= LINEAR_THRESHOLD) {
    return Math.min(Math.max(c * SRGB_FACTOR, 0.0), 1.0);
  }
  const srgb = 1.055 * Math.pow(c, 1.0 / SRGB_GAMMA) - 0.055;
  return Math.min(Math.max(srgb, 0.0), 1.0);
}

/**
 * CPU exact sRGB to Linear conversion for RGB triples.
 */
export function sRGBToLinearRgbCpu(rgb: [number, number, number]): [number, number, number] {
  return [sRGBToLinearCpu(rgb[0]), sRGBToLinearCpu(rgb[1]), sRGBToLinearCpu(rgb[2])];
}

/**
 * CPU exact Linear to sRGB conversion for RGB triples.
 */
export function linearTosRGBRgbCpu(rgb: [number, number, number]): [number, number, number] {
  return [linearTosRGBCpu(rgb[0]), linearTosRGBCpu(rgb[1]), linearTosRGBCpu(rgb[2])];
}

/**
 * TSL channel-level sRGB to Linear piecewise transfer function.
 */
export const sRGBToLinearChannel = Fn(([c]: [any]) => {
  const clamped = c.clamp(0.0, 1.0);
  const isLinear = clamped.lessThanEqual(SRGB_THRESHOLD);
  const low = clamped.div(SRGB_FACTOR);
  const high = clamped.add(0.055).div(1.055).pow(SRGB_GAMMA);
  return isLinear.select(low, high);
});

/**
 * TSL channel-level Linear to sRGB piecewise transfer function.
 */
export const linearTosRGBChannel = Fn(([c]: [any]) => {
  const clamped = c.clamp(0.0, 1.0);
  const isLow = clamped.lessThanEqual(LINEAR_THRESHOLD);
  const low = clamped.mul(SRGB_FACTOR);
  const high = clamped.max(0.000001).pow(1.0 / SRGB_GAMMA).mul(1.055).sub(0.055);
  return isLow.select(low, high).clamp(0.0, 1.0);
});

/**
 * TSL node converter from sRGB color to Linear light (D-06).
 */
export const sRGBToLinear = (colorNode: any) => {
  return Fn(() => {
    const col = colorNode;
    const r = sRGBToLinearChannel(col.r);
    const g = sRGBToLinearChannel(col.g);
    const b = sRGBToLinearChannel(col.b);
    return vec4(r, g, b, col.a ?? float(1.0));
  })();
};

/**
 * TSL node converter from Linear light to display sRGB color (D-06, D-28).
 */
export const linearTosRGB = (colorNode: any) => {
  return Fn(() => {
    const col = colorNode;
    const r = linearTosRGBChannel(col.r);
    const g = linearTosRGBChannel(col.g);
    const b = linearTosRGBChannel(col.b);
    return vec4(r, g, b, col.a ?? float(1.0));
  })();
};
