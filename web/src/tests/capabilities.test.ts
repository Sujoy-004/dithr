import { describe, it, expect, afterEach } from 'vitest';
import { detectGpuCapabilities } from '../engine/capabilities';

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
