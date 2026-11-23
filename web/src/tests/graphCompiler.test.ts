import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { PassPool } from '../engine/graph/PassPool';

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
