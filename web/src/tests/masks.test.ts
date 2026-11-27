import { describe, it, expect } from 'vitest';
import { getEffectDefinition } from '../engine/registry';
import {
  rgbSplitEffect,
  computeChannelOffsets,
} from '../engine/registry/modulate/rgbSplit';
import {
  masksEffect,
  computeMaskValue,
} from '../engine/registry/modulate/masks';
import {
  crtVhsEffect,
  applyCrtProfile,
  computeBarrelDistortion,
  CRT_VHS_PROFILES,
} from '../engine/registry/modulate/crtVhs';

describe('RGB Channel Separation (Task 1: D-08, FX-03)', () => {
  it('registers rgbSplit in EffectRegistry under modulate category with costWeight 1', () => {
    const def = getEffectDefinition('rgbSplit');
    expect(def).toBeDefined();
    expect(def?.id).toBe('rgbSplit');
    expect(def?.category).toBe('modulate');
    expect(def?.costWeight).toBe(1);
    expect(def?.requiresPass).toBe(false);
  });

  it('exposes full per-channel offsets and master symmetric controls in parameter schema', () => {
    const params = rgbSplitEffect.parameters;
    expect(params.masterAmount).toMatchObject({
      type: 'float',
      default: 4.0,
      min: 0.0,
      max: 50.0,
      unit: 'px',
    });
    expect(params.masterAngle).toMatchObject({
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 360.0,
      unit: 'deg',
    });
    expect(params.redOffsetX).toMatchObject({
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      unit: 'px',
    });
    expect(params.redOffsetY).toMatchObject({
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      unit: 'px',
    });
    expect(params.greenOffsetX).toMatchObject({
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      unit: 'px',
    });
    expect(params.greenOffsetY).toMatchObject({
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      unit: 'px',
    });
    expect(params.blueOffsetX).toMatchObject({
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      unit: 'px',
    });
    expect(params.blueOffsetY).toMatchObject({
      type: 'float',
      default: 0.0,
      min: -50.0,
      max: 50.0,
      unit: 'px',
    });
  });

  it('computes exact zero net offsets when all inputs are default zero', () => {
    const offsets = computeChannelOffsets({});
    expect(offsets.red).toEqual({ x: 0, y: 0 });
    expect(offsets.green).toEqual({ x: 0, y: 0 });
    expect(offsets.blue).toEqual({ x: 0, y: 0 });
  });

  it('calculates symmetric chromatic split along master angle vector', () => {
    // 0 deg: along +X axis
    const offsets0 = computeChannelOffsets({ masterAmount: 12, masterAngle: 0 });
    expect(offsets0.red.x).toBeCloseTo(12, 4);
    expect(offsets0.red.y).toBeCloseTo(0, 4);
    expect(offsets0.green.x).toBe(0);
    expect(offsets0.green.y).toBe(0);
    expect(offsets0.blue.x).toBeCloseTo(-12, 4);
    expect(offsets0.blue.y).toBeCloseTo(0, 4);

    // 90 deg: along +Y axis
    const offsets90 = computeChannelOffsets({ masterAmount: 15, masterAngle: 90 });
    expect(offsets90.red.x).toBeCloseTo(0, 4);
    expect(offsets90.red.y).toBeCloseTo(15, 4);
    expect(offsets90.blue.x).toBeCloseTo(0, 4);
    expect(offsets90.blue.y).toBeCloseTo(-15, 4);
  });

  it('sums individual channel offsets with master vector', () => {
    const offsets = computeChannelOffsets({
      masterAmount: 10,
      masterAngle: 0,
      redOffsetX: 2,
      redOffsetY: -3,
      greenOffsetX: 1,
      greenOffsetY: 4,
      blueOffsetX: -5,
      blueOffsetY: 6,
    });

    expect(offsets.red.x).toBeCloseTo(12, 4); // 2 + 10
    expect(offsets.red.y).toBeCloseTo(-3, 4);
    expect(offsets.green.x).toBeCloseTo(1, 4);
    expect(offsets.green.y).toBeCloseTo(4, 4);
    expect(offsets.blue.x).toBeCloseTo(-15, 4); // -5 - 10
    expect(offsets.blue.y).toBeCloseTo(6, 4);
  });

  it('buildNode executes and constructs a valid TSL node tree', () => {
    const sampleCalls: any[] = [];
    const mockEnv = {
      sampleAt: (coord: any) => {
        sampleCalls.push(coord);
        return { r: 0.8, g: 0.5, b: 0.2, rgb: { r: 0.8, g: 0.5, b: 0.2 }, a: 1.0 };
      },
    };

    const node = rgbSplitEffect.buildNode(
      { rgb: { r: 0.5, g: 0.5, b: 0.5 }, a: 1.0 },
      { masterAmount: 0.0, masterAngle: 0.0 },
      mockEnv
    );

    expect(node).toBeDefined();
    // Executing the TSL Fn node returns a node structure
    const output = typeof node === 'function' ? node() : node;
    expect(output).toBeDefined();
  });
});

describe('Procedural Spatial Masks (Task 2: D-07, FX-03, T-02-08)', () => {
  it('registers masks in EffectRegistry under modulate category with costWeight 1', () => {
    const def = getEffectDefinition('masks');
    expect(def).toBeDefined();
    expect(def?.id).toBe('masks');
    expect(def?.category).toBe('modulate');
    expect(def?.costWeight).toBe(1);
    expect(def?.requiresPass).toBe(false);
  });

  it('exposes full numeric parameter schema with vignette, box, and circle modes', () => {
    const params = masksEffect.parameters;
    expect(params.shape).toMatchObject({
      type: 'select',
      default: 'vignette',
      options: ['vignette', 'box', 'circle'],
    });
    expect(params.centerX).toMatchObject({
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
    expect(params.centerY).toMatchObject({
      type: 'float',
      default: 0.5,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
    expect(params.width).toMatchObject({
      type: 'float',
      default: 0.8,
      min: 0.05,
      max: 1.0,
      step: 0.01,
    });
    expect(params.height).toMatchObject({
      type: 'float',
      default: 0.8,
      min: 0.05,
      max: 1.0,
      step: 0.01,
    });
    expect(params.radius).toMatchObject({
      type: 'float',
      default: 0.4,
      min: 0.05,
      max: 1.0,
      step: 0.01,
    });
    expect(params.feather).toMatchObject({
      type: 'float',
      default: 0.2,
      min: 0.01,
      max: 1.0,
      step: 0.01,
    });
    expect(params.invert).toMatchObject({
      type: 'boolean',
      default: false,
    });
    expect(params.strength).toMatchObject({
      type: 'float',
      default: 1.0,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
  });

  it('computes circle distance field with center at 1.0 and smooth feather falloff', () => {
    const params = {
      shape: 'circle' as const,
      centerX: 0.5,
      centerY: 0.5,
      radius: 0.4,
      feather: 0.2,
      invert: false,
      strength: 1.0,
    };

    // Center is completely inside inner boundary (0.5, 0.5) -> 1.0
    const centerVal = computeMaskValue(0.5, 0.5, params);
    expect(centerVal).toBe(1.0);

    // Deep inside circle (0.5, 0.7) -> distance is 0.2 < 0.3 -> 1.0
    const innerVal = computeMaskValue(0.5, 0.7, params);
    expect(innerVal).toBe(1.0);

    // On outer boundary (dist = 0.5) -> 0.0
    const outerVal = computeMaskValue(0.5, 1.0, params);
    expect(outerVal).toBe(0.0);

    // Well outside circle (dist = 0.7) -> 0.0
    const farVal = computeMaskValue(0.0, 0.0, params);
    expect(farVal).toBe(0.0);

    // Mid-feather transition (dist = 0.4) -> should be between 0 and 1
    const midVal = computeMaskValue(0.5, 0.9, params);
    expect(midVal).toBeGreaterThan(0.0);
    expect(midVal).toBeLessThan(1.0);
  });

  it('computes box distance field with rectangular bounds and smooth feather falloff', () => {
    const params = {
      shape: 'box' as const,
      centerX: 0.5,
      centerY: 0.5,
      width: 0.6,
      height: 0.4,
      feather: 0.1,
      invert: false,
      strength: 1.0,
    };

    // Center is 1.0
    expect(computeMaskValue(0.5, 0.5, params)).toBe(1.0);

    // Inside box bounds: x = 0.6 (dx = 0.1 < 0.3), y = 0.55 (dy = 0.05 < 0.2)
    expect(computeMaskValue(0.6, 0.55, params)).toBe(1.0);

    // Outside box in X: x = 0.9 (dx = 0.4 > 0.3 + feather/2 = 0.35)
    expect(computeMaskValue(0.9, 0.5, params)).toBe(0.0);

    // Outside box in Y: y = 0.8 (dy = 0.3 > 0.2 + feather/2 = 0.25)
    expect(computeMaskValue(0.5, 0.8, params)).toBe(0.0);
  });

  it('computes vignette with smooth falloff and responds to invert and strength', () => {
    const normalParams = {
      shape: 'vignette' as const,
      centerX: 0.5,
      centerY: 0.5,
      radius: 0.4,
      feather: 0.2,
      invert: false,
      strength: 1.0,
    };

    const invertedParams = {
      ...normalParams,
      invert: true,
    };

    const attenuatedParams = {
      ...normalParams,
      strength: 0.0, // 0 strength = no attenuation (1.0 everywhere)
    };

    // Normal: center 1.0, corner 0.0
    expect(computeMaskValue(0.5, 0.5, normalParams)).toBe(1.0);
    expect(computeMaskValue(0.0, 0.0, normalParams)).toBe(0.0);

    // Inverted: center 0.0, corner 1.0
    expect(computeMaskValue(0.5, 0.5, invertedParams)).toBe(0.0);
    expect(computeMaskValue(0.0, 0.0, invertedParams)).toBe(1.0);

    // Attenuated (strength 0): 1.0 everywhere
    expect(computeMaskValue(0.5, 0.5, attenuatedParams)).toBe(1.0);
    expect(computeMaskValue(0.0, 0.0, attenuatedParams)).toBe(1.0);
  });

  it('buildNode constructs valid TSL nodes for circle, box, and vignette', () => {
    const shapes: Array<'vignette' | 'box' | 'circle'> = ['vignette', 'box', 'circle'];

    for (const shape of shapes) {
      const node = masksEffect.buildNode(
        { rgb: { r: 0.7, g: 0.7, b: 0.7, mul: () => ({ r: 0.7, g: 0.7, b: 0.7 }) }, a: 1.0 },
        { shape, centerX: 0.5, centerY: 0.5, radius: 0.4, width: 0.8, height: 0.8 }
      );
      expect(node).toBeDefined();
      const output = typeof node === 'function' ? node() : node;
      expect(output).toBeDefined();
    }
  });
});

describe('Analog CRT and VHS Emulation (Task 3: D-09, FX-04, T-02-07)', () => {
  it('registers crtVhs in EffectRegistry under modulate category with costWeight 3 and requiresPass true', () => {
    const def = getEffectDefinition('crtVhs');
    expect(def).toBeDefined();
    expect(def?.id).toBe('crtVhs');
    expect(def?.category).toBe('modulate');
    expect(def?.costWeight).toBe(3);
    expect(def?.requiresPass).toBe(true);
  });

  it('exposes granular analog parameter sliders in schema', () => {
    const params = crtVhsEffect.parameters;
    expect(params.profile).toMatchObject({
      type: 'select',
      default: 'vhsSp',
      options: ['vhsSp', 'vhsEp', 'crtArcade', 'broadcastMonitor'],
    });
    expect(params.curvature).toMatchObject({
      type: 'float',
      default: 0.0,
      min: 0.0,
      max: 0.5,
      step: 0.01,
    });
    expect(params.scanlineIntensity).toMatchObject({
      type: 'float',
      default: 0.2,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
    expect(params.scanlineCount).toMatchObject({
      type: 'float',
      default: 480.0,
      min: 100.0,
      max: 1200.0,
      step: 10.0,
    });
    expect(params.phosphorDecay).toMatchObject({
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 0.95,
      step: 0.01,
    });
    expect(params.trackingJitter).toMatchObject({
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
    expect(params.bloomIntensity).toMatchObject({
      type: 'float',
      default: 0.15,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
    expect(params.vignette).toMatchObject({
      type: 'float',
      default: 0.1,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
    expect(params.noiseIntensity).toMatchObject({
      type: 'float',
      default: 0.05,
      min: 0.0,
      max: 1.0,
      step: 0.01,
    });
  });

  it('provides all 4 named profiles with authentic parameter bundles', () => {
    expect(Object.keys(CRT_VHS_PROFILES)).toEqual([
      'vhsSp',
      'vhsEp',
      'crtArcade',
      'broadcastMonitor',
    ]);

    // VHS SP (clean tape)
    const sp = applyCrtProfile('vhsSp');
    expect(sp.curvature).toBe(0.0);
    expect(sp.trackingJitter).toBe(0.1);
    expect(sp.scanlineIntensity).toBe(0.2);
    expect(sp.bloomIntensity).toBe(0.15);

    // VHS EP (worn tape)
    const ep = applyCrtProfile('vhsEp');
    expect(ep.trackingJitter).toBe(0.6);
    expect(ep.noiseIntensity).toBe(0.5);
    expect(ep.phosphorDecay).toBe(0.4);

    // CRT Arcade (shadow mask & curvature)
    const arcade = applyCrtProfile('crtArcade');
    expect(arcade.curvature).toBe(0.15);
    expect(arcade.scanlineCount).toBe(240.0);
    expect(arcade.scanlineIntensity).toBe(0.6);
    expect(arcade.bloomIntensity).toBe(0.4);

    // Broadcast Monitor (crisp aperture grille)
    const broadcast = applyCrtProfile('broadcastMonitor');
    expect(broadcast.curvature).toBe(0.05);
    expect(broadcast.scanlineCount).toBe(600.0);
    expect(broadcast.scanlineIntensity).toBe(0.3);
  });

  it('preserves center coordinate and maintains odd symmetry in barrel distortion', () => {
    // Center point (0.5, 0.5) must never move under any curvature
    const centerDistorted = computeBarrelDistortion({ x: 0.5, y: 0.5 }, 0.25);
    expect(centerDistorted.x).toBeCloseTo(0.5, 5);
    expect(centerDistorted.y).toBeCloseTo(0.5, 5);
    expect(centerDistorted.inBounds).toBe(true);

    // Symmetry test: offset (+dx, +dy) from center has opposite displacement to (-dx, -dy)
    const dx = 0.2;
    const dy = 0.15;
    const curvature = 0.3;

    const pos = computeBarrelDistortion({ x: 0.5 + dx, y: 0.5 + dy }, curvature);
    const neg = computeBarrelDistortion({ x: 0.5 - dx, y: 0.5 - dy }, curvature);

    const posDisplacementX = pos.x - 0.5;
    const posDisplacementY = pos.y - 0.5;
    const negDisplacementX = neg.x - 0.5;
    const negDisplacementY = neg.y - 0.5;

    expect(posDisplacementX).toBeCloseTo(-negDisplacementX, 5);
    expect(posDisplacementY).toBeCloseTo(-negDisplacementY, 5);
  });

  it('detects out of bounds coordinates under extreme curvature', () => {
    // Extreme corner at (1.0, 1.0) with strong curvature pushes outside [0, 1]
    const corner = computeBarrelDistortion({ x: 0.99, y: 0.99 }, 0.45);
    expect(corner.x).toBeGreaterThan(1.0);
    expect(corner.y).toBeGreaterThan(1.0);
    expect(corner.inBounds).toBe(false);
  });

  it('buildNode executes and constructs a valid TSL node tree with clamped phosphor decay', () => {
    const mockEnv = {
      previousPassTexture: (_coord: any) => ({
        rgb: { r: 0.4, g: 0.4, b: 0.4, mul: () => ({ r: 0.3, g: 0.3, b: 0.3 }) },
      }),
    };

    const node = crtVhsEffect.buildNode(
      {
        rgb: {
          r: { mul: () => 0.1 },
          g: { mul: () => 0.2 },
          b: { mul: () => 0.05 },
          mul: () => ({ add: () => ({}) }),
          add: () => ({}),
        },
        a: 1.0,
      },
      {
        curvature: 0.1,
        scanlineIntensity: 0.3,
        scanlineCount: 480.0,
        phosphorDecay: 0.99, // input exceeding safe threshold
        trackingJitter: 0.1,
        bloomIntensity: 0.2,
      },
      mockEnv
    );

    expect(node).toBeDefined();
    const output = typeof node === 'function' ? node() : node;
    expect(output).toBeDefined();
  });
});
