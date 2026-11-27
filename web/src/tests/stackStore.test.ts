import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore, DEFAULT_INITIAL_STACK } from '../store/useStudioStore';

describe('useStudioStore effect stack slice (D-02, D-03, D-04, FX-01)', () => {
  beforeEach(() => {
    // Reset store to media-first passthrough state
    useStudioStore.setState({
      activeStack: structuredClone(DEFAULT_INITIAL_STACK),
      selectedPassId: null,
      effect: null,
    });
  });

  it('initializes with media-first empty active stack (passthrough default)', () => {
    const state = useStudioStore.getState();
    expect(DEFAULT_INITIAL_STACK).toEqual([]);
    expect(state.activeStack).toEqual([]);
    expect(state.selectedPassId).toBeNull();
    expect(state.effect).toBeNull();
  });

  it('addEffect appends passes sequentially and canonicalizes vhs -> crtVhs', () => {
    const { addEffect } = useStudioStore.getState();
    addEffect('dither');
    addEffect('vhs');

    const state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(2);

    const ditherPass = state.activeStack[0];
    expect(ditherPass.effectId).toBe('dither');
    expect(ditherPass.enabled).toBe(true);
    expect(ditherPass.intensity).toBe(1.0);
    expect(ditherPass.blendMode).toBe('normal');
    expect(ditherPass.parameters.colorSteps).toBe(4);
    expect(ditherPass.parameters.spread).toBe(0.5);

    const vhsPass = state.activeStack[1];
    expect(vhsPass.effectId).toBe('crtVhs');
    expect(vhsPass.enabled).toBe(true);
    expect(state.selectedPassId).toBe(vhsPass.instanceId);
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

  it('removeEffect removes pass and falls back selectedPassId to previous pass', () => {
    const { addEffect, removeEffect } = useStudioStore.getState();
    addEffect('ascii');
    addEffect('dither');
    addEffect('halftone');

    let state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(3);
    const pass0 = state.activeStack[0].instanceId;
    const pass1 = state.activeStack[1].instanceId;
    const pass2 = state.activeStack[2].instanceId;

    // Selected is pass2. Removing pass2 should fallback to pass1.
    removeEffect(pass2);
    state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(2);
    expect(state.activeStack.map((p) => p.instanceId)).toEqual([pass0, pass1]);
    expect(state.selectedPassId).toBe(pass1);

    // Selected is pass1. Removing pass1 should fallback to pass0.
    removeEffect(pass1);
    state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(1);
    expect(state.selectedPassId).toBe(pass0);

    // Removing pass0 leaves stack empty, selectedPassId null, and effect null.
    removeEffect(pass0);
    state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(0);
    expect(state.selectedPassId).toBeNull();
    expect(state.effect).toBeNull();
  });

  it('clearStack empties activeStack and returns to raw media passthrough', () => {
    const { addEffect, clearStack } = useStudioStore.getState();
    addEffect('dither');
    addEffect('vhs');
    expect(useStudioStore.getState().activeStack.length).toBe(2);

    clearStack();
    const state = useStudioStore.getState();
    expect(state.activeStack).toEqual([]);
    expect(state.selectedPassId).toBeNull();
    expect(state.effect).toBeNull();
  });

  it('reorderStack performs immutable reordering with ES2024 toSpliced', () => {
    const { addEffect, reorderStack } = useStudioStore.getState();
    addEffect('ascii');
    addEffect('dither');
    addEffect('halftone');

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
    expect(stackAfter).not.toBe(stackBefore);
    expect(stackBefore.map((p) => p.instanceId)).toEqual([id0, id1, id2]);
  });

  it('toggleEffect flips enabled state without mutating original pass', () => {
    const { addEffect, toggleEffect } = useStudioStore.getState();
    addEffect('ascii');
    const passId = useStudioStore.getState().activeStack[0].instanceId;
    const originalPass = useStudioStore.getState().activeStack[0];

    toggleEffect(passId);

    const toggledPass = useStudioStore.getState().activeStack[0];
    expect(toggledPass.enabled).toBe(false);
    expect(originalPass.enabled).toBe(true);
    expect(toggledPass).not.toBe(originalPass);

    toggleEffect(passId);
    expect(useStudioStore.getState().activeStack[0].enabled).toBe(true);
  });

  it('duplicateEffect deep-clones pass, generates new instanceId, and inserts adjacent', () => {
    const { addEffect, duplicateEffect, updatePassParam } = useStudioStore.getState();
    addEffect('ascii');
    addEffect('dither');

    const originalPass = useStudioStore.getState().activeStack[1];
    updatePassParam(originalPass.instanceId, 'colorSteps', 8);

    duplicateEffect(originalPass.instanceId);

    const state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(3);

    const clonedPass = state.activeStack[2];
    expect(clonedPass.instanceId).not.toBe(originalPass.instanceId);
    expect(clonedPass.effectId).toBe('dither');
    expect(clonedPass.parameters.colorSteps).toBe(8);
    expect(state.selectedPassId).toBe(clonedPass.instanceId);
    expect(clonedPass.parameters).not.toBe(originalPass.parameters);
  });

  it('setEffectIntensity clamps value between 0.0 and 1.0', () => {
    const { addEffect, setEffectIntensity } = useStudioStore.getState();
    addEffect('ascii');
    const passId = useStudioStore.getState().activeStack[0].instanceId;

    setEffectIntensity(passId, 0.45);
    expect(useStudioStore.getState().activeStack[0].intensity).toBe(0.45);

    setEffectIntensity(passId, -0.5);
    expect(useStudioStore.getState().activeStack[0].intensity).toBe(0.0);

    setEffectIntensity(passId, 2.5);
    expect(useStudioStore.getState().activeStack[0].intensity).toBe(1.0);
  });

  it('setEffectBlendMode updates blend mode', () => {
    const { addEffect, setEffectBlendMode } = useStudioStore.getState();
    addEffect('ascii');
    const passId = useStudioStore.getState().activeStack[0].instanceId;

    setEffectBlendMode(passId, 'multiply');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('multiply');

    setEffectBlendMode(passId, 'screen');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('screen');

    setEffectBlendMode(passId, 'add');
    expect(useStudioStore.getState().activeStack[0].blendMode).toBe('add');
  });

  it('updatePassParam updates parameters and syncs crtVhs profile bundles', () => {
    const { addEffect, updatePassParam } = useStudioStore.getState();
    addEffect('dither');
    const ditherPass = useStudioStore.getState().activeStack[0];

    updatePassParam(ditherPass.instanceId, 'spread', 1.25);
    expect(useStudioStore.getState().activeStack[0].parameters.spread).toBe(1.25);

    addEffect('vhs');
    const vhsPass = useStudioStore.getState().activeStack[1];
    expect(vhsPass.effectId).toBe('crtVhs');

    updatePassParam(vhsPass.instanceId, 'profile', 'crtArcade');
    const updatedVhs = useStudioStore.getState().activeStack[1];
    expect(updatedVhs.parameters.profile).toBe('crtArcade');
    expect(updatedVhs.parameters.curvature).toBe(0.15);
    expect(updatedVhs.parameters.scanlineCount).toBe(240.0);
    expect(updatedVhs.parameters.scanlineIntensity).toBe(0.6);
  });

  it('setSingleEffectFastPath clears stack, canonicalizes vhs -> crtVhs, and sets 1 pass (D-04)', () => {
    const { addEffect, setSingleEffectFastPath } = useStudioStore.getState();
    addEffect('dither');
    addEffect('halftone');
    expect(useStudioStore.getState().activeStack.length).toBe(2);

    setSingleEffectFastPath('matrix');
    let state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(1);
    expect(state.activeStack[0].effectId).toBe('matrix');
    expect(state.activeStack[0].enabled).toBe(true);
    expect(state.activeStack[0].parameters.speed).toBe(1.0);
    expect(state.selectedPassId).toBe(state.activeStack[0].instanceId);
    expect(state.effect).toBe('matrix');

    setSingleEffectFastPath('vhs');
    state = useStudioStore.getState();
    expect(state.activeStack.length).toBe(1);
    expect(state.activeStack[0].effectId).toBe('crtVhs');
    expect(state.effect).toBe('vhs');
  });
});
