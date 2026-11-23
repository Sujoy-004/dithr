/**
 * Client GPU capability detection and quality tier classification (D-08, RELY-09).
 */

import type { ActiveEffectPass } from './registry/types';
import { effectRegistry, EffectRegistry } from './registry/index';

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
  maxPassBudget: number;
  maxIntermediateTargets: number;
}

export const TIER_CONFIGS: Record<QualityTier, TierConfig> = {
  high: {
    maxDimension: 1080,
    targetFps: 60,
    label: 'High (1080p canvas, full shader passes, 60 FPS)',
    maxPassBudget: 8,
    maxIntermediateTargets: 4,
  },
  medium: {
    maxDimension: 720,
    targetFps: 30,
    label: 'Medium (720p canvas, optimized passes, 30 FPS)',
    maxPassBudget: 5,
    maxIntermediateTargets: 2,
  },
  low: {
    maxDimension: 480,
    targetFps: 30,
    label: 'Low (480p canvas, minimal passes, 30 FPS)',
    maxPassBudget: 3,
    maxIntermediateTargets: 1,
  },
};

export interface TierBudgetEvaluation {
  allowedStack: ActiveEffectPass[];
  exceeded: boolean;
  disabledPassIds: string[];
  totalCost: number;
  maxBudget: number;
}

/**
 * Evaluates active stack cost weights and intermediate target requirements against
 * GPU quality tier budgets per D-23. Auto-disables lowest priority passes when exceeded.
 */
export function evaluateTierBudget(
  stack: ActiveEffectPass[],
  tier: QualityTier,
  registry: EffectRegistry = effectRegistry
): TierBudgetEvaluation {
  const config = TIER_CONFIGS[tier];
  const maxBudget = config.maxPassBudget;
  const maxIntermediateTargets = config.maxIntermediateTargets;

  let currentCost = 0;
  let intermediateTargetCount = 0;
  const disabledPassIds: string[] = [];
  const allowedStack: ActiveEffectPass[] = [];

  // Pass evaluation: foundational passes earlier in the stack take priority over later passes
  for (let i = 0; i < stack.length; i++) {
    const pass = stack[i];
    if (!pass.enabled) {
      allowedStack.push({ ...pass });
      continue;
    }

    const def = registry.get(pass.effectId);
    const cost = def?.costWeight ?? 1;
    const requiresPass = def?.requiresPass ?? false;

    const projectedCost = currentCost + cost;
    const projectedTargets = intermediateTargetCount + (requiresPass ? 1 : 0);

    if (projectedCost > maxBudget || projectedTargets > maxIntermediateTargets) {
      disabledPassIds.push(pass.instanceId);
      allowedStack.push({ ...pass, enabled: false });
    } else {
      currentCost = projectedCost;
      if (requiresPass) {
        intermediateTargetCount++;
      }
      allowedStack.push({ ...pass });
    }
  }

  return {
    allowedStack,
    exceeded: disabledPassIds.length > 0,
    disabledPassIds,
    totalCost: currentCost,
    maxBudget,
  };
}

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
