import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { vec4 } from 'three/tsl';
import { PassPool } from '../engine/graph/PassPool';
import {
  computeTopologyHash,
  planExecutionStages,
  compileGraph,
  GraphCompiler,
} from '../engine/graph/GraphCompiler';
import { EffectRegistry } from '../engine/registry/index';
import type { ActiveEffectPass, EffectDefinition } from '../engine/registry/types';

describe('PassPool: RenderTarget Caching & Context Lifecycle (D-24, T-02-03)', () => {
  it('acquires and reuses pooled RenderTarget instances matching width, height, and format', () => {
    const pool = new PassPool();

    const targetA = pool.acquire(800, 600, THREE.RGBAFormat);
    expect(targetA).toBeDefined();
    expect(targetA.width).toBe(800);
    expect(targetA.height).toBe(600);
    expect(pool.getInUseCount()).toBe(1);
    expect(pool.getIdleCount()).toBe(0);

    // Release targetA back to pool
    pool.release(targetA);
    expect(pool.getInUseCount()).toBe(0);
    expect(pool.getIdleCount()).toBe(1);

    // Acquiring identical specs reuses targetA
    const targetB = pool.acquire(800, 600, THREE.RGBAFormat);
    expect(targetB).toBe(targetA);
    expect(pool.getInUseCount()).toBe(1);
    expect(pool.getIdleCount()).toBe(0);

    // Acquiring different dimensions instantiates a distinct target
    const targetC = pool.acquire(1920, 1080, THREE.RGBAFormat);
    expect(targetC).not.toBe(targetA);
    expect(pool.getInUseCount()).toBe(2);
    expect(pool.getTotalCount()).toBe(2);

    pool.disposeAll();
    expect(pool.getTotalCount()).toBe(0);
  });

  it('resetFrame recycles all in-use targets back into idle pool', () => {
    const pool = new PassPool();

    const t1 = pool.acquire(512, 512);
    const t2 = pool.acquire(512, 512);
    expect(pool.getInUseCount()).toBe(2);
    expect(pool.getIdleCount()).toBe(0);

    pool.resetFrame();
    expect(pool.getInUseCount()).toBe(0);
    expect(pool.getIdleCount()).toBe(2);

    // Both should now be recycled
    const recycled1 = pool.acquire(512, 512);
    const recycled2 = pool.acquire(512, 512);
    expect([t1, t2]).toContain(recycled1);
    expect([t1, t2]).toContain(recycled2);

    pool.disposeAll();
  });

  it('prune reduces idle targets to maxIdleCount and disposes excess', () => {
    const pool = new PassPool();

    const targets = [
      pool.acquire(256, 256),
      pool.acquire(256, 256),
      pool.acquire(256, 256),
      pool.acquire(256, 256),
    ];

    targets.forEach((t) => {
      vi.spyOn(t, 'dispose');
      pool.release(t);
    });

    expect(pool.getIdleCount()).toBe(4);

    pool.prune(2);
    expect(pool.getIdleCount()).toBe(2);

    // Exactly 2 targets should have had dispose() called
    const disposedCount = targets.filter((t) => vi.mocked(t.dispose).mock.calls.length > 0).length;
    expect(disposedCount).toBe(2);

    pool.disposeAll();
  });

  it('disposeAll calls .dispose() on all pooled and in-use targets and clears internal Maps', () => {
    const pool = new PassPool();

    const inUseTarget = pool.acquire(640, 480);
    const idleTarget = pool.acquire(640, 480);
    pool.release(idleTarget);

    const inUseDisposeSpy = vi.spyOn(inUseTarget, 'dispose');
    const idleDisposeSpy = vi.spyOn(idleTarget, 'dispose');

    expect(pool.getTotalCount()).toBe(2);
    pool.disposeAll();

    expect(inUseDisposeSpy).toHaveBeenCalledOnce();
    expect(idleDisposeSpy).toHaveBeenCalledOnce();
    expect(pool.getTotalCount()).toBe(0);
    expect(pool.getIdleCount()).toBe(0);
    expect(pool.getInUseCount()).toBe(0);
  });

  it('attaches webgl context listeners and disposes resources on context lost', () => {
    const pool = new PassPool();
    const canvas = document.createElement('canvas');

    const onLost = vi.fn();
    const onRestored = vi.fn();
    const unbind = pool.attachContextListeners(canvas, onRestored, onLost);

    const target = pool.acquire(400, 300);
    const disposeSpy = vi.spyOn(target, 'dispose');

    // Simulate webglcontextlost event
    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lostEvent);

    expect(lostEvent.defaultPrevented).toBe(true);
    expect(disposeSpy).toHaveBeenCalled();
    expect(pool.getTotalCount()).toBe(0);
    expect(onLost).toHaveBeenCalledOnce();

    // Simulate webglcontextrestored event
    const restoredEvent = new Event('webglcontextrestored');
    canvas.dispatchEvent(restoredEvent);
    expect(onRestored).toHaveBeenCalledOnce();

    unbind();
  });
});

describe('GraphCompiler: Pass Fusion & Topology Hashing (D-03, D-06, D-21, D-22)', () => {
  const createPass = (
    effectId: string,
    instanceId: string,
    parameters: Record<string, any> = {},
    blendMode: any = 'normal',
    enabled = true
  ): ActiveEffectPass => ({
    instanceId,
    effectId,
    enabled,
    intensity: 1.0,
    blendMode,
    parameters,
  });

  describe('computeTopologyHash (D-22)', () => {
    it('produces a stable hash dependent on pass order and blendMode but independent of parameter values', () => {
      const stackA: ActiveEffectPass[] = [
        createPass('tone', 'tone-1', { brightness: 1.2, contrast: 1.0 }),
        createPass('dither', 'dither-1', { spread: 0.5 }, 'screen'),
      ];

      const stackB: ActiveEffectPass[] = [
        createPass('tone', 'tone-1', { brightness: 0.8, contrast: 2.0 }),
        createPass('dither', 'dither-1', { spread: 0.9 }, 'screen'),
      ];

      const hashA = computeTopologyHash(stackA);
      const hashB = computeTopologyHash(stackB);

      // Must be identical despite different uniform values
      expect(hashA).toBe(hashB);
      expect(hashA).toContain('tone:normal');
      expect(hashA).toContain('dither:screen');

      // Changing blend mode alters hash
      const stackC: ActiveEffectPass[] = [
        createPass('tone', 'tone-1', { brightness: 1.2 }),
        createPass('dither', 'dither-1', { spread: 0.5 }, 'multiply'),
      ];
      expect(computeTopologyHash(stackC)).not.toBe(hashA);

      // Disabling a pass alters hash
      const stackD: ActiveEffectPass[] = [
        createPass('tone', 'tone-1', {}, 'normal', false),
        createPass('dither', 'dither-1', {}, 'screen'),
      ];
      expect(computeTopologyHash(stackD)).not.toBe(hashA);

      // Reordering passes alters hash
      const stackE: ActiveEffectPass[] = [
        createPass('dither', 'dither-1', {}, 'screen'),
        createPass('tone', 'tone-1', {}, 'normal'),
      ];
      expect(computeTopologyHash(stackE)).not.toBe(hashA);
    });
  });

  describe('planExecutionStages (D-21)', () => {
    it('compiles a 4-pass stack (tone, dither, blockify, threshold) into exactly 1 fused fragment stage with 0 intermediate render targets', () => {
      const stack: ActiveEffectPass[] = [
        createPass('tone', 'pass-1'),
        createPass('dither', 'pass-2'),
        createPass('blockify', 'pass-3'),
        createPass('threshold', 'pass-4'),
      ];

      const stages = planExecutionStages(stack);

      expect(stages).toHaveLength(1);
      expect(stages[0].type).toBe('fused_fragment');
      expect(stages[0].passes).toHaveLength(4);
      expect(stages[0].requiresTarget).toBe(false);

      const intermediateTargetsCount = stages.filter((s) => s.requiresTarget).length;
      expect(intermediateTargetsCount).toBe(0);
    });

    it('splits execution into 2 stages with 1 intermediate render target when a pass requiring an intermediate target is inserted', () => {
      // Create a test registry with a pass requiring an intermediate target
      const customRegistry = new EffectRegistry();
      const mockMultiPassDef: EffectDefinition = {
        id: 'mockBloom',
        label: 'Mock Bloom',
        category: 'modulate',
        parameters: { blurRadius: { type: 'float', default: 4.0 } },
        requiresPass: true, // Requires intermediate target
        costWeight: 3,
        buildNode: (input) => input,
      };
      customRegistry.register(mockMultiPassDef);

      const stack: ActiveEffectPass[] = [
        createPass('tone', 'pass-1'),
        createPass('mockBloom', 'pass-2'),
        createPass('dither', 'pass-3'),
        createPass('threshold', 'pass-4'),
      ];

      const stages = planExecutionStages(stack, customRegistry);

      expect(stages).toHaveLength(2);

      // Stage 0: preceding pointwise pass(es) writing into intermediate target
      expect(stages[0].type).toBe('fused_fragment');
      expect(stages[0].passes).toHaveLength(1);
      expect(stages[0].passes[0].effectId).toBe('tone');
      expect(stages[0].requiresTarget).toBe(true);

      // Stage 1: multi-pass effect + fused subsequent passes rendering to final output
      expect(stages[1].type).toBe('intermediate_target');
      expect(stages[1].passes).toHaveLength(3);
      expect(stages[1].passes.map((p) => p.effectId)).toEqual(['mockBloom', 'dither', 'threshold']);
      expect(stages[1].requiresTarget).toBe(false);

      const intermediateTargetsCount = stages.filter((s) => s.requiresTarget).length;
      expect(intermediateTargetsCount).toBe(1);
    });
  });

  describe('compileGraph (D-03, D-06, D-21)', () => {
    it('compiles 4-pass pointwise stack into a single Material pipeline with linear compositing and uniform references', () => {
      const stack: ActiveEffectPass[] = [
        createPass('tone', 'tone-1', { brightness: 1.5, contrast: 1.0, saturation: 1.0 }),
        createPass('dither', 'dither-1', { colorSteps: 4, spread: 0.5 }),
        createPass('blockify', 'blockify-1', { blockSize: 8 }),
        createPass('threshold', 'thresh-1', { threshold: 0.5 }),
      ];

      const stages = planExecutionStages(stack);
      const uniformsMap = new Map<string, any>();
      const sourceNode = vec4(0.5, 0.5, 0.5, 1.0);

      const compiled = compileGraph(sourceNode, stages, uniformsMap);

      expect(compiled.stages).toHaveLength(1);
      expect(compiled.intermediateTargetCount).toBe(0);
      expect(compiled.stageDescriptors).toHaveLength(1);
      expect(compiled.finalMaterial).toBeDefined();
      expect(compiled.finalMaterial.colorNode).toBeDefined();

      // Verify uniformsMap contains registered uniforms for the pass instances
      expect(uniformsMap.has('tone-1:brightness')).toBe(true);
      expect(uniformsMap.get('tone-1:brightness').value).toBe(1.5);

      // Verify uniform value update in-place without altering map identity
      uniformsMap.get('tone-1:brightness').value = 2.0;
      expect(uniformsMap.get('tone-1:brightness').value).toBe(2.0);

      compiled.dispose();
    });

    it('compiles 2-stage pipeline with intermediate target descriptor and proper cleanup', () => {
      const customRegistry = new EffectRegistry();
      customRegistry.register({
        id: 'blurPass',
        label: 'Blur',
        category: 'modulate',
        parameters: { radius: { type: 'float', default: 2.0 } },
        requiresPass: true,
        costWeight: 2,
        buildNode: (input) => input,
      });

      const stack: ActiveEffectPass[] = [
        createPass('tone', 'tone-1'),
        createPass('blurPass', 'blur-1'),
        createPass('dither', 'dither-1'),
      ];

      const stages = planExecutionStages(stack, customRegistry);
      const compiler = new GraphCompiler(customRegistry);
      const sourceNode = vec4(0.2, 0.4, 0.6, 1.0);

      const compiled = compiler.compileGraph(sourceNode, stages);

      expect(compiled.stages).toHaveLength(2);
      expect(compiled.intermediateTargetCount).toBe(1);
      expect(compiled.stageDescriptors).toHaveLength(2);

      // Stage 0 requires an intermediate target
      expect(compiled.stageDescriptors[0].stage.requiresTarget).toBe(true);
      expect(compiled.stageDescriptors[0].targetDescriptor).toBeDefined();

      // Stage 1 samples from intermediate texture node
      expect(compiled.stageDescriptors[1].stage.requiresTarget).toBe(false);
      expect(compiled.stageDescriptors[1].inputTextureNode).toBeDefined();

      compiled.dispose();
    });
  });
});
