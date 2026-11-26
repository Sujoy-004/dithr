import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore, DEFAULT_INITIAL_STACK } from '../store/useStudioStore';

describe('useStudioStore effect stack slice (D-02, D-03, D-04, FX-01)', () => {
  beforeEach(() => {
    // Reset store to default clean state (empty stack = pristine media passthrough)
    useStudioStore.setState({
      activeStack: structuredClone(DEFAULT_INITIAL_STACK),
      selectedPassId: null,
      effect: 'dither',
    });
  });

  it('initializes with default empty active stack (pristine media passthrough)', () => {
    const state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(0);
    expect(state.selectedPassId).toBeNull();
    expect(state.effect).toBe('dither');
  });

  it('addEffect appends a pass with default parameters to empty stack and sets it as selected', () => {
    const { addEffect } = useStudioStore.getState();
    addEffect('dither');

    const state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(1);

    const ditherPass = state.activeStack[0];
    expect(ditherPass.effectId).toBe('dither');
    expect(ditherPass.enabled).toBe(true);
    expect(ditherPass.intensity).toBe(1.0);
    expect(ditherPass.blendMode).toBe('normal');
    expect(ditherPass.parameters.colorSteps).toBe(4);
    expect(ditherPass.parameters.spread).toBe(0.5);
    expect(state.selectedPassId).toBe(ditherPass.instanceId);
  });

  it('allows stacking multiple shaders seamlessly (e.g. VHS on top of Dither)', () => {
    const { addEffect } = useStudioStore.getState();
    addEffect('dither');
    addEffect('vhs');

    const state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(2);
    expect(state.activeStack[0].effectId).toBe('dither');
    expect(state.activeStack[1].effectId).toBe('vhs');
    expect(state.selectedPassId).toBe(state.activeStack[1].instanceId);
  });

  it('addEffect allows overriding initial parameters', () => {
    const { addEffect } = useStudioStore.getState();
    addEffect('halftone', { frequency: 120, angle: 60 });

    const state = useStudioStore.getState();
    const halftonePass = state.activeStack[0];
    expect(halftonePass.effectId).toBe('halftone');
    expect(halftonePass.parameters.frequency).toBe(120);
    expect(halftonePass.parameters.angle).toBe(60);
    expect(halftonePass.parameters.dotRadius).toBe(1.0); // default preserved
  });

  it('removeEffect removes pass and falls back selectedPassId to previous pass or null', () => {
    const { addEffect, removeEffect } = useStudioStore.getState();
    addEffect('dither');
    addEffect('halftone');

    let state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(2);
    const pass0 = state.activeStack[0].instanceId;
    const pass1 = state.activeStack[1].instanceId;

    // Selected is pass1. Removing pass1 should fallback to pass0.
    removeEffect(pass1);
    state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(1);
    expect(state.activeStack.map((p) => p.instanceId)).toEqual([pass0]);
    expect(state.selectedPassId).toBe(pass0);

    // Removing pass0 leaves stack empty and selectedPassId null.
    removeEffect(pass0);
    state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(0);
    expect(state.selectedPassId).toBeNull();
  });

  it('reorderStack performs immutable reordering with ES2024 toSpliced', () => {
    const { addEffect, reorderStack } = useStudioStore.getState();
    addEffect('dither');
    addEffect('halftone');
    addEffect('matrix');

    const beforeState = useStudioStore.getState();
    const stackBefore = beforeState.activeStack;
    const id0 = stackBefore[0].instanceId;
    const id1 = stackBefore[1].instanceId;
    const id2 = stackBefore[2].instanceId;

    // Move index 0 to index 2: [id0, id1, id2] -> [id1, id2, id0]
    reorderStack(0, 2);

    const afterState = useStudioStore.getState();
    const stackAfter = afterState.activeStack;

    expect(stackAfter.map((p) => p.instanceId)).toEqual([id1, id2, id0]);
    // Immutability check: stackAfter must be a new array reference
    expect(stackAfter).not.toBe(stackBefore);
    // Original stack array should remain unmodified
    expect(stackBefore.map((p) => p.instanceId)).toEqual([id0, id1, id2]);
  });

  it('toggleEffect flips enabled state without mutating original pass', () => {
    const { addEffect, toggleEffect } = useStudioStore.getState();
    addEffect('dither');
    const passId = useStudioStore.getState().activeStack[0].instanceId;
    const originalPass = useStudioStore.getState().activeStack[0];

    toggleEffect(passId);

    const toggledPass = useStudioStore.getState().activeStack[0];
    expect(toggledPass.enabled).toBe(false);
    expect(originalPass.enabled).toBe(true); // immutability
    expect(toggledPass).not.toBe(originalPass);

    toggleEffect(passId);
    expect(useStudioStore.getState().activeStack[0].enabled).toBe(true);
  });

  it('duplicateEffect deep-clones pass, generates new instanceId, and inserts adjacent', () => {
    const { addEffect, duplicateEffect, updatePassParam } = useStudioStore.getState();
    addEffect('dither');

    const originalPass = useStudioStore.getState().activeStack[0];
    updatePassParam(originalPass.instanceId, 'colorSteps', 8);

    duplicateEffect(originalPass.instanceId);

    const state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(2);

    const clonedPass = state.activeStack[1];
    expect(clonedPass.instanceId).not.toBe(originalPass.instanceId);
    expect(clonedPass.effectId).toBe('dither');
    expect(clonedPass.parameters.colorSteps).toBe(8);
    expect(state.selectedPassId).toBe(clonedPass.instanceId);

    // Deep clone immutability check
    expect(clonedPass.parameters).not.toBe(originalPass.parameters);
  });

  it('setEffectIntensity clamps value between 0.0 and 1.0', () => {
    const { addEffect, setEffectIntensity } = useStudioStore.getState();
    addEffect('dither');
    const passId = useStudioStore.getState().activeStack[0].instanceId;

    setEffectIntensity(passId, 0.45);
    expect(useStudioStore.getState().activeStack[0].intensity).toBe(0.45);

    setEffectIntensity(passId, -0.5);
    expect(useStudioStore.getState().activeStack[0].intensity).toBe(0.0);

    setEffectIntensity(passId, 2.5);
    expect(useStudioStore.getState().activeStack[0].intensity).toBe(1.0);
  });

  it('setEffectBlendMode updates blend mode including overlay and softLight', () => {
    const { addEffect, setEffectBlendMode } = useStudioStore.getState();
    addEffect('dither');
    const passId = useStudioStore.getState().activeStack[0].instanceId;

    setEffectBlendMode(passId, 'multiply');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('multiply');

    setEffectBlendMode(passId, 'screen');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('screen');

    setEffectBlendMode(passId, 'add');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('add');

    setEffectBlendMode(passId, 'overlay');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('overlay');

    setEffectBlendMode(passId, 'softLight');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('softLight');
  });

  it('updatePassParam updates specific parameter value', () => {
    const { addEffect, updatePassParam } = useStudioStore.getState();
    addEffect('dither');
    const ditherPass = useStudioStore.getState().activeStack[0];

    updatePassParam(ditherPass.instanceId, 'spread', 1.25);
    const updated = useStudioStore.getState().activeStack[0];
    expect(updated.parameters.spread).toBe(1.25);
  });

  it('setSingleEffectFastPath clears stack and sets exactly 1 enabled pass (D-04)', () => {
    const { addEffect, setSingleEffectFastPath } = useStudioStore.getState();
    addEffect('dither');
    addEffect('halftone');
    expect(useStudioStore.getState().activeStack.length).toBe(2);

    setSingleEffectFastPath('matrix');

    const state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(1);
    expect(state.activeStack[0].effectId).toBe('matrix');
    expect(state.activeStack[0].enabled).toBe(true);
    expect(state.activeStack[0].parameters.speed).toBe(1.0);
    expect(state.selectedPassId).toBe(state.activeStack[0].instanceId);
    expect(state.effect).toBe('matrix');
  });
});
