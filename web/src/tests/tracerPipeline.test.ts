import { describe, it, expect } from 'vitest';
import { vec4, uniform, vec2 } from 'three/tsl';
import {
  rec601Luminance,
  rec709Luminance,
  rec601LuminanceCpu,
  rec709LuminanceCpu,
  rec601LuminanceInt,
  getLuminanceNode,
  REC601_COEFFICIENTS,
  REC709_COEFFICIENTS,
} from '../engine/color/luminance';
import {
  sRGBToLinear,
  linearTosRGB,
  sRGBToLinearCpu,
  linearTosRGBCpu,
} from '../engine/color/colorSpace';
import {
  EffectRegistry,
  compileLinearEffectStack,
  getGroupedEffects,
  getEffectDefinition,
} from '../engine/registry/index';
import type { ActiveEffectPass } from '../engine/registry/types';

describe('Tracer Pipeline: Color Science & Registry Slice (D-01, D-05, D-06, D-20, FX-01, FX-02)', () => {
  describe('Luminance Standards (D-05, FX-02)', () => {
    it('evaluates Rec. 601 coefficients matching Python parity', () => {
      expect(REC601_COEFFICIENTS.r).toBeCloseTo(0.299, 4);
      expect(REC601_COEFFICIENTS.g).toBeCloseTo(0.587, 4);
      expect(REC601_COEFFICIENTS.b).toBeCloseTo(0.114, 4);

      // Float parity with Rec. 601 coefficients
      expect(rec601LuminanceCpu(1.0, 0.0, 0.0)).toBeCloseTo(0.299, 4);
      expect(rec601LuminanceCpu(0.0, 1.0, 0.0)).toBeCloseTo(0.587, 4);
      expect(rec601LuminanceCpu(0.0, 0.0, 1.0)).toBeCloseTo(0.114, 4);

      // Integer parity with src/renderer.py:49-51
      expect(rec601LuminanceInt(255, 0, 0)).toBe(76);
      expect(rec601LuminanceInt(0, 255, 0)).toBe(149);
      expect(rec601LuminanceInt(0, 0, 255)).toBe(29);
      expect(rec601LuminanceInt(255, 255, 255)).toBe(255);
      expect(rec601LuminanceInt(0, 0, 0)).toBe(0);
    });

    it('evaluates Rec. 709 coefficients matching HDTV standard', () => {
      expect(REC709_COEFFICIENTS.r).toBeCloseTo(0.2126, 4);
      expect(REC709_COEFFICIENTS.g).toBeCloseTo(0.7152, 4);
      expect(REC709_COEFFICIENTS.b).toBeCloseTo(0.0722, 4);

      const pureRed = rec709LuminanceCpu(1.0, 0.0, 0.0);
      expect(pureRed).toBeCloseTo(0.2126, 4);

      const pureGreen = rec709LuminanceCpu(0.0, 1.0, 0.0);
      expect(pureGreen).toBeCloseTo(0.7152, 4);

      const pureBlue = rec709LuminanceCpu(0.0, 0.0, 1.0);
      expect(pureBlue).toBeCloseTo(0.0722, 4);
    });

    it('builds TSL luminance nodes for both standards without error', () => {
      const input = vec4(0.5, 0.6, 0.7, 1.0);
      const node601 = rec601Luminance(input);
      expect(node601).toBeDefined();
      expect(node601.isNode).toBe(true);

      const node709 = rec709Luminance(input);
      expect(node709).toBeDefined();
      expect(node709.isNode).toBe(true);

      const standardNode = getLuminanceNode(input, 'rec601');
      expect(standardNode).toBeDefined();
      expect(standardNode.isNode).toBe(true);
    });
  });

  describe('Piecewise sRGB <-> Linear Transfer Functions (D-06, D-28)', () => {
    it('executes linear-to-sRGB and sRGB-to-linear CPU roundtrips across [0, 1]', () => {
      const steps = 256;
      for (let i = 0; i <= steps; i++) {
        const srgbVal = i / steps;
        const linearVal = sRGBToLinearCpu(srgbVal);
        const reconstructed = linearTosRGBCpu(linearVal);
        expect(reconstructed).toBeCloseTo(srgbVal, 3);
      }
    });

    it('clamps negative or out-of-range floats cleanly to [0.0, 1.0]', () => {
      expect(sRGBToLinearCpu(-0.5)).toBe(0.0);
      expect(sRGBToLinearCpu(1.5)).toBe(1.0);
      expect(linearTosRGBCpu(-0.5)).toBe(0.0);
      expect(linearTosRGBCpu(1.5)).toBe(1.0);
      expect(sRGBToLinearCpu(NaN)).toBe(0.0);
      expect(linearTosRGBCpu(NaN)).toBe(0.0);
    });

    it('constructs TSL color space conversion nodes without error', () => {
      const testCol = vec4(0.2, 0.4, 0.8, 1.0);
      const linearNode = sRGBToLinear(testCol);
      expect(linearNode).toBeDefined();
      expect(linearNode.isNode).toBe(true);

      const srgbNode = linearTosRGB(linearNode);
      expect(srgbNode).toBeDefined();
      expect(srgbNode.isNode).toBe(true);
    });
  });

  describe('Effect Registry Expansion (D-01, D-20, D-23, D-27, FX-01)', () => {
    const EXPECTED_STYLIZE_IDS = [
      'ascii',
      'tone',
      'dither',
      'halftone',
      'matrix',
      'pixelSort',
      'blockify',
      'threshold',
      'edgeDetect',
      'crosshatch',
      'waveLines',
      'noise',
      'voronoi',
      'dots',
      'contour',
    ];
    const EXPECTED_MODULATE_IDS = ['grain', 'rgbSplit', 'masks', 'crtVhs'];

    it('registers Grainrad and advanced FX modes in EffectRegistry', () => {
      const registry = new EffectRegistry();
      const all = registry.getAll();
      expect(all.length).toBe(19);

      const allIds = all.map((e) => e.id).sort();
      const expectedIds = [...EXPECTED_STYLIZE_IDS, ...EXPECTED_MODULATE_IDS].sort();
      expect(allIds).toEqual(expectedIds);
    });

    it('partitions all modes into stylize (15) and modulate (4) per D-01', () => {
      const grouped = getGroupedEffects();
      expect(grouped.stylize.length).toBe(15);
      expect(grouped.modulate.length).toBe(4);

      const stylizeIds = grouped.stylize.map((e) => e.id);
      for (const id of EXPECTED_STYLIZE_IDS) {
        expect(stylizeIds).toContain(id);
        expect(getEffectDefinition(id)).toBeDefined();
      }

      const modulateIds = grouped.modulate.map((e) => e.id);
      for (const id of EXPECTED_MODULATE_IDS) {
        expect(modulateIds).toContain(id);
        expect(getEffectDefinition(id)).toBeDefined();
      }
    });

    it('verifies every registered effect has valid parameter schema, costWeight, and buildNode', () => {
      const registry = new EffectRegistry();
      for (const effect of registry.getAll()) {
        expect(effect.id).toBeDefined();
        expect(effect.label).toBeDefined();
        expect(['stylize', 'modulate']).toContain(effect.category);
        expect([1, 2, 3]).toContain(effect.costWeight);
        expect(typeof effect.requiresPass).toBe('boolean');
        expect(typeof effect.buildNode).toBe('function');

        // Parameter schema checks
        for (const [, schema] of Object.entries(effect.parameters)) {
          expect(['float', 'int', 'boolean', 'select']).toContain(schema.type);
          expect(schema.default).toBeDefined();

          if (schema.type === 'float' || schema.type === 'int') {
            expect(typeof schema.min).toBe('number');
            expect(typeof schema.max).toBe('number');
            expect(schema.min).toBeLessThanOrEqual(schema.max as number);
            expect(typeof schema.step).toBe('number');
          }

          if (schema.type === 'select') {
            expect(Array.isArray(schema.options)).toBe(true);
            expect(schema.options?.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it('builds node graphs for all 16 registered effects without error', () => {
      const registry = new EffectRegistry();
      const testInput = vec4(0.4, 0.5, 0.6, 1.0);
      const env = {
        resolution: vec2(1920, 1080),
        time: uniform(1.5),
        seed: uniform(99.0),
      };

      for (const effect of registry.getAll()) {
        const defaultUniforms: Record<string, any> = {};
        for (const [key, schema] of Object.entries(effect.parameters)) {
          defaultUniforms[key] = schema.default;
        }

        const node = effect.buildNode(testInput, defaultUniforms, env);
        expect(node).toBeDefined();
        expect(node.isNode).toBe(true);
      }
    });
  });

  describe('Two-Pass Tracer Shader Graph Compilation (D-01, D-03, D-06, FX-01)', () => {
    it('compiles a two-pass linear-light shader chain (tone -> ascii) end-to-end', () => {
      const registry = new EffectRegistry();

      const sourceNode = vec4(0.3, 0.4, 0.5, 1.0);

      const activeStack: ActiveEffectPass[] = [
        {
          instanceId: 'pass-tone-1',
          effectId: 'tone',
          enabled: true,
          intensity: 1.0,
          blendMode: 'normal',
          parameters: {
            brightness: 1.1,
            contrast: 1.05,
            saturation: 1.2,
            hueRotation: 15,
            gamma: 1.0,
            invert: false,
          },
        },
        {
          instanceId: 'pass-ascii-1',
          effectId: 'ascii',
          enabled: true,
          intensity: 0.85,
          blendMode: 'multiply',
          parameters: {
            cellScale: 14,
            charSpacing: 1,
            charAspect: 0.5,
            rampLength: 10,
          },
        },
      ];

      const env = {
        resolution: vec2(1920, 1080),
        time: uniform(0.0),
        seed: uniform(42.0),
      };

      const compiledNode = compileLinearEffectStack(sourceNode, activeStack, registry, env);

      expect(compiledNode).toBeDefined();
      expect(compiledNode.isNode).toBe(true);
      expect(compiledNode._inspectorNode).toBeNull(); // clean uncorrupted node
    });

    it('bypasses disabled passes cleanly during compilation', () => {
      const registry = new EffectRegistry();
      const sourceNode = vec4(0.5, 0.5, 0.5, 1.0);

      const activeStack: ActiveEffectPass[] = [
        {
          instanceId: 'pass-1',
          effectId: 'tone',
          enabled: false,
          intensity: 1.0,
          blendMode: 'normal',
          parameters: {},
        },
      ];

      const compiledNode = compileLinearEffectStack(sourceNode, activeStack, registry);
      expect(compiledNode).toBeDefined();
      expect(compiledNode.isNode).toBe(true);
    });
  });
});
