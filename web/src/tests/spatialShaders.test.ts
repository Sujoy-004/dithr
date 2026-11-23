import { describe, it, expect, vi } from 'vitest';
import { vec2, vec4, float } from 'three/tsl';
import { edgeDetectEffect } from '../engine/registry/stylize/edgeDetect';
import { pixelSortEffect } from '../engine/registry/stylize/pixelSort';
import { rgbSplitEffect } from '../engine/registry/modulate/rgbSplit';
import { blockifyEffect } from '../engine/registry/stylize/blockify';
import { asciiEffect } from '../engine/registry/stylize/ascii';
import type { EffectEnvironment } from '../engine/registry/types';

describe('Spatial Sampling Shaders (edgeDetect, pixelSort, rgbSplit, blockify, ascii)', () => {
  const dummyInput = vec4(0.5, 0.5, 0.5, 1.0);
  const resolution = vec2(800.0, 600.0);

  function evaluateNode(node: any): any {
    if (node?.shaderNode?.jsFunc) {
      return node.shaderNode.jsFunc();
    }
    return node;
  }

  describe('edgeDetectEffect: 3x3 Sobel Convolution & Fallback', () => {
    it('samples 8 neighborhood taps via env.sampleAt when available', () => {
      const sampledCoords: any[] = [];
      const mockSampleAt = vi.fn((coord: any) => {
        sampledCoords.push(coord);
        return vec4(0.5, 0.5, 0.5, 1.0);
      });

      const env: EffectEnvironment = {
        resolution,
        sampleAt: mockSampleAt,
      };

      const resultNode = edgeDetectEffect.buildNode(
        dummyInput,
        { sensitivity: 3.0, thickness: 1.0 },
        env
      );

      expect(resultNode).toBeDefined();
      evaluateNode(resultNode);

      // Exactly 8 neighborhood taps sampled for 3x3 Sobel kernel
      expect(mockSampleAt).toHaveBeenCalledTimes(8);
      expect(sampledCoords).toHaveLength(8);
    });

    it('gracefully falls back when env.sampleAt is omitted without throwing', () => {
      expect(() => {
        const resultNode = edgeDetectEffect.buildNode(
          dummyInput,
          { sensitivity: 3.0, thickness: 1.0 },
          { resolution }
        );
        expect(resultNode).toBeDefined();
        evaluateNode(resultNode);
      }).not.toThrow();
    });
  });

  describe('pixelSortEffect: 8-tap Directional Search & Fallback', () => {
    it('samples 8 directional scanline taps + base coord via env.sampleAt', () => {
      const sampledCoords: any[] = [];
      const mockSampleAt = vi.fn((coord: any) => {
        sampledCoords.push(coord);
        return vec4(0.5, 0.5, 0.5, 1.0);
      });

      const env: EffectEnvironment = {
        resolution,
        time: float(0.0),
        seed: float(42.0),
        sampleAt: mockSampleAt,
      };

      const resultNode = pixelSortEffect.buildNode(
        dummyInput,
        { threshold: 0.5, sortSpan: 20.0, direction: 'horizontal' },
        env
      );

      expect(resultNode).toBeDefined();
      evaluateNode(resultNode);

      // 1 base sample + 8 directional search taps = 9 samples
      expect(mockSampleAt).toHaveBeenCalledTimes(9);
    });

    it('gracefully falls back when env.sampleAt is omitted without throwing', () => {
      expect(() => {
        const resultNode = pixelSortEffect.buildNode(
          dummyInput,
          { threshold: 0.5, sortSpan: 20.0, direction: 'vertical' },
          { resolution, time: float(0.0), seed: float(1.0) }
        );
        expect(resultNode).toBeDefined();
        evaluateNode(resultNode);
      }).not.toThrow();
    });
  });

  describe('rgbSplitEffect: Chromatic Separation & Fallback', () => {
    it('samples red, green, blue displaced coordinates + base tap via env.sampleAt', () => {
      const sampledCoords: any[] = [];
      const mockSampleAt = vi.fn((coord: any) => {
        sampledCoords.push(coord);
        return vec4(0.5, 0.5, 0.5, 1.0);
      });

      const env: EffectEnvironment = {
        resolution,
        sampleAt: mockSampleAt,
      };

      const resultNode = rgbSplitEffect.buildNode(
        dummyInput,
        {
          masterAmount: 10.0,
          masterAngle: 45.0,
          redOffsetX: 2.0,
          redOffsetY: 0.0,
          greenOffsetX: 0.0,
          greenOffsetY: 0.0,
          blueOffsetX: -2.0,
          blueOffsetY: 0.0,
        },
        env
      );

      expect(resultNode).toBeDefined();
      evaluateNode(resultNode);

      // uvR, uvG, uvB, and base tap st = 4 samples
      expect(mockSampleAt).toHaveBeenCalledTimes(4);
    });

    it('gracefully falls back when env.sampleAt is omitted without throwing', () => {
      expect(() => {
        const resultNode = rgbSplitEffect.buildNode(
          dummyInput,
          { masterAmount: 10.0, masterAngle: 0.0 },
          { resolution }
        );
        expect(resultNode).toBeDefined();
        evaluateNode(resultNode);
      }).not.toThrow();
    });
  });

  describe('blockifyEffect: Cell Center Sampling & Fallback', () => {
    it('samples quantized cell center UV via env.sampleAt', () => {
      const mockSampleAt = vi.fn((_coord: any) => vec4(0.8, 0.2, 0.4, 1.0));

      const env: EffectEnvironment = {
        resolution,
        sampleAt: mockSampleAt,
      };

      const resultNode = blockifyEffect.buildNode(
        dummyInput,
        { blockSize: 16.0, gridLine: 0.1 },
        env
      );

      expect(resultNode).toBeDefined();
      evaluateNode(resultNode);
      expect(mockSampleAt).toHaveBeenCalledOnce();
    });

    it('gracefully falls back when env.sampleAt is omitted without throwing', () => {
      expect(() => {
        const resultNode = blockifyEffect.buildNode(
          dummyInput,
          { blockSize: 8.0, gridLine: 0.0 },
          { resolution }
        );
        expect(resultNode).toBeDefined();
        evaluateNode(resultNode);
      }).not.toThrow();
    });
  });

  describe('asciiEffect: Cell Center Luminance Sampling & Fallback', () => {
    it('samples quantized cell center UV via env.sampleAt for glyph mapping', () => {
      const mockSampleAt = vi.fn((_coord: any) => vec4(0.6, 0.6, 0.6, 1.0));

      const env: EffectEnvironment = {
        resolution,
        sampleAt: mockSampleAt,
      };

      const resultNode = asciiEffect.buildNode(
        dummyInput,
        { cellScale: 12.0, charSpacing: 0.0, charAspect: 0.5, rampLength: 10 },
        env
      );

      expect(resultNode).toBeDefined();
      evaluateNode(resultNode);
      expect(mockSampleAt).toHaveBeenCalledOnce();
    });

    it('gracefully falls back when env.sampleAt is omitted without throwing', () => {
      expect(() => {
        const resultNode = asciiEffect.buildNode(
          dummyInput,
          { cellScale: 12.0, charSpacing: 0.0, charAspect: 0.5, rampLength: 10 },
          { resolution }
        );
        expect(resultNode).toBeDefined();
        evaluateNode(resultNode);
      }).not.toThrow();
    });
  });
});
