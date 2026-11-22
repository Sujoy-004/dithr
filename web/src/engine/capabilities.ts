/**
 * Client GPU capability detection and quality tier classification (D-08, RELY-09).
 */

export type QualityTier = 'high' | 'medium' | 'low';

export interface GpuCapabilities {
  tier: QualityTier;
  engine: 'webgpu' | 'webgl2';
  maxTextureSize: number;
  memoryGb?: number;
  isMobile: boolean;
}

export interface TierConfig {
  maxDimension: number;
  targetFps: number;
  label: string;
}

export const TIER_CONFIGS: Record<QualityTier, TierConfig> = {
  high: {
    maxDimension: 1080,
    targetFps: 60,
    label: 'High (1080p canvas, full shader passes, 60 FPS)',
  },
  medium: {
    maxDimension: 720,
    targetFps: 30,
    label: 'Medium (720p canvas, optimized passes, 30 FPS)',
  },
  low: {
    maxDimension: 480,
    targetFps: 30,
    label: 'Low (480p canvas, minimal passes, 30 FPS)',
  },
};

/**
 * Detect client WebGPU / WebGL2 capabilities and device characteristics to
 * determine appropriate quality tier per D-08 and RELY-09.
 */
export async function detectGpuCapabilities(): Promise<GpuCapabilities> {
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const memoryGb: number =
    typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? (navigator as any).deviceMemory
      : 8;

  // 1. WebGPU capability probing
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter({
        powerPreference: 'high-performance',
      });
      if (adapter) {
        const maxTextureDimension2D: number =
          adapter.limits?.maxTextureDimension2D || 8192;

        let tier: QualityTier = 'high';
        if (isMobile || maxTextureDimension2D < 8192 || (memoryGb && memoryGb < 4)) {
          tier = 'medium';
        } else if (memoryGb && memoryGb < 2) {
          tier = 'low';
        }

        return {
          tier,
          engine: 'webgpu',
          maxTextureSize: maxTextureDimension2D,
          memoryGb,
          isMobile,
        };
      }
    } catch (e) {
      console.warn('[detectGpuCapabilities] WebGPU probe failed, falling back to WebGL2:', e);
    }
  }

  // 2. WebGL2 capability probing
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (gl) {
        const maxTextureSize: number = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        let tier: QualityTier = 'medium';
        if (maxTextureSize >= 8192 && (!memoryGb || memoryGb >= 8) && !isMobile) {
          tier = 'high';
        } else if (maxTextureSize < 4096 || (memoryGb && memoryGb < 4)) {
          tier = 'low';
        }

        return {
          tier,
          engine: 'webgl2',
          maxTextureSize,
          memoryGb,
          isMobile,
        };
      }
    } catch (e) {
      console.warn('[detectGpuCapabilities] WebGL2 probe failed:', e);
    }
  }

  // 3. Fallback safe defaults
  return {
    tier: 'low',
    engine: 'webgl2',
    maxTextureSize: 2048,
    memoryGb,
    isMobile,
  };
}
