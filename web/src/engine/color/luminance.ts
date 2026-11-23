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
