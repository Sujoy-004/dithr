import { describe, it, expect } from 'vitest';
import { getEffectDefinition } from '../engine/registry';
import {
  rgbSplitEffect,
  computeChannelOffsets,
} from '../engine/registry/modulate/rgbSplit';

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
      default: 0.0,
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
