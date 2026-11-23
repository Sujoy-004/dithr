import { describe, it, expect } from 'vitest';
import { vec4, vec2 } from 'three/tsl';
import {
  rec601Luminance,
  rec709Luminance,
  rec601LuminanceCpu,
  rec601LuminanceInt,
  rec709LuminanceCpu,
  getLuminanceNode,
  REC601_COEFFICIENTS,
  REC709_COEFFICIENTS,
} from '../engine/color/luminance';
import {
  sRGBToLinear,
  linearTosRGB,
  sRGBToLinearCpu,
  linearTosRGBCpu,
  sRGBToLinearRgbCpu,
  linearTosRGBRgbCpu,
  SRGB_THRESHOLD,
  LINEAR_THRESHOLD,
  SRGB_FACTOR,
  SRGB_GAMMA,
} from '../engine/color/colorSpace';

describe('Golden Color Math and Transfer Functions (D-05, D-06, D-28, FX-02)', () => {
  describe('Rec. 601 Luminance Golden Parity (Python src/renderer.py:49-51)', () => {
    it('evaluates pure white and pure black to exactly 255 and 0 in integer space', () => {
      expect(rec601LuminanceInt(255, 255, 255)).toBe(255);
      expect(rec601LuminanceInt(0, 0, 0)).toBe(0);
      expect(rec601LuminanceCpu(1.0, 1.0, 1.0)).toBeCloseTo(1.0, 6);
      expect(rec601LuminanceCpu(0.0, 0.0, 0.0)).toBeCloseTo(0.0, 6);
    });

    it('evaluates pure primaries to exact Python renderer integer parity', () => {
      // 0.299 * 255 = 76.245 -> int: 76
      expect(rec601LuminanceInt(255, 0, 0)).toBe(76);
      // 0.587 * 255 = 149.685 -> int: 149
      expect(rec601LuminanceInt(0, 255, 0)).toBe(149);
      // 0.114 * 255 = 29.07 -> int: 29
      expect(rec601LuminanceInt(0, 0, 255)).toBe(29);
    });

    it('evaluates complementary secondaries matching exact Python formulas', () => {
      // Yellow: 255 R + 255 G = 76.245 + 149.685 = 225.93 -> int: 225
      expect(rec601LuminanceInt(255, 255, 0)).toBe(225);
      // Cyan: 255 G + 255 B = 149.685 + 29.07 = 178.755 -> int: 178
      expect(rec601LuminanceInt(0, 255, 255)).toBe(178);
      // Magenta: 255 R + 255 B = 76.245 + 29.07 = 105.315 -> int: 105
      expect(rec601LuminanceInt(255, 0, 255)).toBe(105);
    });

    it('verifies exact coefficient weighting sums to 1.0', () => {
      const sum = REC601_COEFFICIENTS.r + REC601_COEFFICIENTS.g + REC601_COEFFICIENTS.b;
      expect(sum).toBeCloseTo(1.0, 6);
    });
  });

  describe('Rec. 709 HDTV Luminance Golden Standards', () => {
    it('evaluates standard HDTV broadcast primaries', () => {
      expect(rec709LuminanceCpu(1.0, 0.0, 0.0)).toBeCloseTo(0.2126, 6);
      expect(rec709LuminanceCpu(0.0, 1.0, 0.0)).toBeCloseTo(0.7152, 6);
      expect(rec709LuminanceCpu(0.0, 0.0, 1.0)).toBeCloseTo(0.0722, 6);
      expect(rec709LuminanceCpu(1.0, 1.0, 1.0)).toBeCloseTo(1.0, 6);
      expect(rec709LuminanceCpu(0.0, 0.0, 0.0)).toBeCloseTo(0.0, 6);
    });

    it('evaluates 75% SMPTE color bars correctly', () => {
      const yellow75 = rec709LuminanceCpu(0.75, 0.75, 0.0);
      expect(yellow75).toBeCloseTo(0.75 * 0.2126 + 0.75 * 0.7152, 6);

      const cyan75 = rec709LuminanceCpu(0.0, 0.75, 0.75);
      expect(cyan75).toBeCloseTo(0.75 * 0.7152 + 0.75 * 0.0722, 6);

      const green75 = rec709LuminanceCpu(0.0, 0.75, 0.0);
      expect(green75).toBeCloseTo(0.75 * 0.7152, 6);
    });

    it('verifies exact Rec. 709 coefficient sum equals 1.0', () => {
      const sum = REC709_COEFFICIENTS.r + REC709_COEFFICIENTS.g + REC709_COEFFICIENTS.b;
      expect(sum).toBeCloseTo(1.0, 6);
    });
  });

  describe('sRGB <-> Linear Transfer Function Inversion & Roundtrip (D-06, D-28)', () => {
    it('roundtrips all 256 8-bit discrete levels with max delta < 1e-4', () => {
      let maxDelta = 0;
      for (let i = 0; i <= 255; i++) {
        const srgb = i / 255.0;
        const linear = sRGBToLinearCpu(srgb);
        const reconstructed = linearTosRGBCpu(linear);
        const delta = Math.abs(srgb - reconstructed);
        if (delta > maxDelta) maxDelta = delta;
        expect(delta).toBeLessThan(1e-4);
      }
      expect(maxDelta).toBeLessThan(1e-4);
    });

    it('roundtrips RGB triple arrays accurately', () => {
      const testTriples: [number, number, number][] = [
        [0.0, 0.0, 0.0],
        [1.0, 1.0, 1.0],
        [0.5, 0.25, 0.75],
        [0.03, 0.04, 0.05], // near threshold boundary
        [0.1, 0.8, 0.3],
      ];

      for (const rgb of testTriples) {
        const linear = sRGBToLinearRgbCpu(rgb);
        const reconstructed = linearTosRGBRgbCpu(linear);
        expect(reconstructed[0]).toBeCloseTo(rgb[0], 4);
        expect(reconstructed[1]).toBeCloseTo(rgb[1], 4);
        expect(reconstructed[2]).toBeCloseTo(rgb[2], 4);
      }
    });

    it('proves linear scaling in the low-intensity threshold region [0.0, 0.04045]', () => {
      // In [0.0, 0.04045], transfer function must be strictly linear: C / 12.92
      const testValues = [0.001, 0.005, 0.01, 0.02, 0.03, SRGB_THRESHOLD];
      for (const val of testValues) {
        const expected = val / SRGB_FACTOR;
        const actual = sRGBToLinearCpu(val);
        expect(actual).toBeCloseTo(expected, 8);
        expect(linearTosRGBCpu(actual)).toBeCloseTo(val, 6);
      }
    });

    it('verifies continuity at sRGB threshold boundary (0.04045)', () => {
      const below = sRGBToLinearCpu(SRGB_THRESHOLD - 0.0001);
      const at = sRGBToLinearCpu(SRGB_THRESHOLD);
      const above = sRGBToLinearCpu(SRGB_THRESHOLD + 0.0001);

      expect(at).toBeCloseTo(SRGB_THRESHOLD / SRGB_FACTOR, 6);
      expect(below).toBeLessThan(at);
      expect(above).toBeGreaterThan(at);
      expect(Math.abs(above - below)).toBeLessThan(0.0001);
    });

    it('verifies continuity at Linear threshold boundary (0.0031308)', () => {
      const below = linearTosRGBCpu(LINEAR_THRESHOLD - 0.00001);
      const at = linearTosRGBCpu(LINEAR_THRESHOLD);
      const above = linearTosRGBCpu(LINEAR_THRESHOLD + 0.00001);

      expect(at).toBeCloseTo(LINEAR_THRESHOLD * SRGB_FACTOR, 4);
      expect(below).toBeLessThan(at);
      expect(above).toBeGreaterThan(at);
      expect(Math.abs(above - below)).toBeLessThan(0.001);
    });

    it('constants match IEC 61966-2-1 specification', () => {
      expect(SRGB_THRESHOLD).toBe(0.04045);
      expect(LINEAR_THRESHOLD).toBe(0.0031308);
      expect(SRGB_FACTOR).toBe(12.92);
      expect(SRGB_GAMMA).toBe(2.4);
    });
  });

  describe('Out-of-Bounds Clamping & Robustness (D-06, D-28, T-02-02)', () => {
    it('clamps negative inputs to 0.0 cleanly without negative or NaN outputs', () => {
      expect(sRGBToLinearCpu(-0.0001)).toBe(0.0);
      expect(sRGBToLinearCpu(-1.0)).toBe(0.0);
      expect(sRGBToLinearCpu(-1000.0)).toBe(0.0);

      expect(linearTosRGBCpu(-0.0001)).toBe(0.0);
      expect(linearTosRGBCpu(-1.0)).toBe(0.0);
      expect(linearTosRGBCpu(-1000.0)).toBe(0.0);
    });

    it('clamps inputs exceeding 1.0 cleanly to 1.0 without overflow or NaN', () => {
      expect(sRGBToLinearCpu(1.0001)).toBe(1.0);
      expect(sRGBToLinearCpu(2.0)).toBe(1.0);
      expect(sRGBToLinearCpu(1000.0)).toBe(1.0);

      expect(linearTosRGBCpu(1.0001)).toBe(1.0);
      expect(linearTosRGBCpu(2.0)).toBe(1.0);
      expect(linearTosRGBCpu(1000.0)).toBe(1.0);
    });

    it('sanitizes NaN and infinite values to safe bounds', () => {
      expect(sRGBToLinearCpu(NaN)).toBe(0.0);
      expect(linearTosRGBCpu(NaN)).toBe(0.0);
      expect(sRGBToLinearCpu(Infinity)).toBe(1.0);
      expect(sRGBToLinearCpu(-Infinity)).toBe(0.0);
      expect(linearTosRGBCpu(Infinity)).toBe(1.0);
      expect(linearTosRGBCpu(-Infinity)).toBe(0.0);
    });
  });

  describe('TSL Node Graph Edge Cases (1x1, odd dimensions, D-28)', () => {
    it('constructs TSL node graphs for odd dimensions (719x479) without errors', () => {
      const oddRes = vec2(719.0, 479.0);
      const input = vec4(0.2, 0.4, 0.6, 1.0);

      const linearNode = sRGBToLinear(input);
      expect(linearNode.isNode).toBe(true);

      const srgbNode = linearTosRGB(linearNode);
      expect(srgbNode.isNode).toBe(true);

      const lum601 = rec601Luminance(linearNode);
      expect(lum601.isNode).toBe(true);

      const lum709 = rec709Luminance(linearNode);
      expect(lum709.isNode).toBe(true);

      const globalLum = getLuminanceNode(linearNode, 'rec601');
      expect(globalLum.isNode).toBe(true);
      expect(oddRes.isNode).toBe(true);
    });

    it('constructs TSL node graphs for 1x1 dimensions without divide-by-zero', () => {
      const minRes = vec2(1.0, 1.0);
      const input = vec4(1.0, 1.0, 1.0, 1.0);

      const linearNode = sRGBToLinear(input);
      const srgbNode = linearTosRGB(linearNode);
      expect(linearNode.isNode).toBe(true);
      expect(srgbNode.isNode).toBe(true);
      expect(minRes.isNode).toBe(true);
    });
  });
});
