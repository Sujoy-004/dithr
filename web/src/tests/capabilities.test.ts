import { describe, it, expect, afterEach } from 'vitest';
import {
  detectGpuCapabilities,
  evaluateTierBudget,
  TIER_CONFIGS,
} from '../engine/capabilities';
import type { ActiveEffectPass } from '../engine/registry/types';

describe('detectGpuCapabilities (D-08, RELY-09)', () => {
  const originalGpu = (navigator as any).gpu;
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    Object.defineProperty(navigator, 'gpu', {
      value: originalGpu,
      writable: true,
      configurable: true,
    });
  });

  it('classifies desktop WebGPU with large texture limits as high tier', async () => {
    Object.defineProperty(navigator, 'gpu', {
      value: {
        requestAdapter: async () => ({
          limits: { maxTextureDimension2D: 8192 },
        }),
      },
      writable: true,
      configurable: true,
    });

    const caps = await detectGpuCapabilities();
    expect(caps.engine).toBe('webgpu');
    expect(caps.maxTextureSize).toBe(8192);
    expect(caps.tier).toBe('high');
  });

  it('classifies mobile device as medium tier even with WebGPU', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      configurable: true,
    });

    Object.defineProperty(navigator, 'gpu', {
      value: {
        requestAdapter: async () => ({
          limits: { maxTextureDimension2D: 8192 },
        }),
      },
      writable: true,
      configurable: true,
    });

    const caps = await detectGpuCapabilities();
    expect(caps.isMobile).toBe(true);
    expect(caps.tier).toBe('medium');

    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('falls back to WebGL2 when WebGPU is unavailable', async () => {
    Object.defineProperty(navigator, 'gpu', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const caps = await detectGpuCapabilities();
    expect(caps.engine).toBe('webgl2');
    expect(['high', 'medium', 'low']).toContain(caps.tier);
  });
});

describe('Tier Budget & Resolution Enforcement (D-23, D-29, FX-01)', () => {
  it('enforces maximum dimensions and target FPS across quality tiers', () => {
    expect(TIER_CONFIGS.high.maxDimension).toBe(1080);
    expect(TIER_CONFIGS.high.targetFps).toBe(60);
    expect(TIER_CONFIGS.high.maxPassBudget).toBe(8);
    expect(TIER_CONFIGS.high.maxIntermediateTargets).toBe(4);

    expect(TIER_CONFIGS.medium.maxDimension).toBe(720);
    expect(TIER_CONFIGS.medium.targetFps).toBe(30);
    expect(TIER_CONFIGS.medium.maxPassBudget).toBe(5);
    expect(TIER_CONFIGS.medium.maxIntermediateTargets).toBe(2);

    expect(TIER_CONFIGS.low.maxDimension).toBe(480);
    expect(TIER_CONFIGS.low.targetFps).toBe(30);
    expect(TIER_CONFIGS.low.maxPassBudget).toBe(3);
    expect(TIER_CONFIGS.low.maxIntermediateTargets).toBe(1);
  });

  it('allows stacks within tier budget without disabling passes', () => {
    const stack: ActiveEffectPass[] = [
      {
        instanceId: 'pass-tone',
        effectId: 'tone',
        enabled: true,
        intensity: 1.0,
        blendMode: 'normal',
        parameters: {},
      },
      {
        instanceId: 'pass-ascii',
        effectId: 'ascii',
        enabled: true,
        intensity: 1.0,
        blendMode: 'normal',
        parameters: {},
      },
    ];

    const evalResult = evaluateTierBudget(stack, 'low');
    expect(evalResult.exceeded).toBe(false);
    expect(evalResult.disabledPassIds.length).toBe(0);
    expect(evalResult.allowedStack.every((p) => p.enabled)).toBe(true);
  });

  it('auto-disables lower-priority later passes when cost exceeds tier budget', () => {
    // Each pass has costWeight 1; low tier budget is 3
    const stack: ActiveEffectPass[] = [
      { instanceId: 'p1', effectId: 'tone', enabled: true, intensity: 1.0, blendMode: 'normal', parameters: {} },
      { instanceId: 'p2', effectId: 'dither', enabled: true, intensity: 1.0, blendMode: 'normal', parameters: {} },
      { instanceId: 'p3', effectId: 'ascii', enabled: true, intensity: 1.0, blendMode: 'normal', parameters: {} },
      { instanceId: 'p4', effectId: 'noise', enabled: true, intensity: 1.0, blendMode: 'normal', parameters: {} },
      { instanceId: 'p5', effectId: 'grain', enabled: true, intensity: 1.0, blendMode: 'normal', parameters: {} },
    ];

    const evalResult = evaluateTierBudget(stack, 'low');
    expect(evalResult.exceeded).toBe(true);
    expect(evalResult.totalCost).toBe(3); // 3 allowed
    expect(evalResult.disabledPassIds).toEqual(['p4', 'p5']);

    // First 3 stay enabled, last 2 disabled
    expect(evalResult.allowedStack[0].enabled).toBe(true);
    expect(evalResult.allowedStack[1].enabled).toBe(true);
    expect(evalResult.allowedStack[2].enabled).toBe(true);
    expect(evalResult.allowedStack[3].enabled).toBe(false);
    expect(evalResult.allowedStack[4].enabled).toBe(false);
  });

  it('enforces intermediate render target limits across tiers', () => {
    // crtVhs (requiresPass: true) and threeD (requiresPass: true)
    const stack: ActiveEffectPass[] = [
      { instanceId: 'crt1', effectId: 'crtVhs', enabled: true, intensity: 1.0, blendMode: 'normal', parameters: {} },
      { instanceId: '3d1', effectId: 'threeD', enabled: true, intensity: 1.0, blendMode: 'normal', parameters: {} },
    ];

    // Low tier maxIntermediateTargets is 1 -> 3d1 must be disabled
    const lowEval = evaluateTierBudget(stack, 'low');
    expect(lowEval.exceeded).toBe(true);
    expect(lowEval.disabledPassIds).toContain('3d1');
    expect(lowEval.allowedStack[0].enabled).toBe(true);
    expect(lowEval.allowedStack[1].enabled).toBe(false);

    // High tier maxIntermediateTargets is 4 and budget is 8 -> both allowed
    const highEval = evaluateTierBudget(stack, 'high');
    expect(highEval.exceeded).toBe(false);
    expect(highEval.disabledPassIds.length).toBe(0);
    expect(highEval.allowedStack.every((p) => p.enabled)).toBe(true);
  });
});
