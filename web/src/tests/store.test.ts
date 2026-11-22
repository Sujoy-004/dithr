import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore, ZOOM_MIN, ZOOM_MAX } from '../store/useStudioStore';

describe('useStudioStore state and actions (RELY-05)', () => {
  beforeEach(() => {
    useStudioStore.setState({
      zoom: 1,
      pan: { x: 0, y: 0 },
      mediaType: null,
      mediaUrl: null,
      mediaName: null,
      dimensions: null,
      detectedTier: 'high',
      activeTier: 'high',
      tierOverride: null,
      renderStatus: 'active',
    });
  });

  it('clamps zoom within valid boundaries', () => {
    const { setZoom } = useStudioStore.getState();
    setZoom(0.01);
    expect(useStudioStore.getState().zoom).toBe(ZOOM_MIN);

    setZoom(100);
    expect(useStudioStore.getState().zoom).toBe(ZOOM_MAX);

    setZoom(2.5);
    expect(useStudioStore.getState().zoom).toBe(2.5);
  });

  it('updates pan and resets via resetHUD', () => {
    const { setPan, resetHUD } = useStudioStore.getState();
    setPan({ x: 120, y: -45 });
    expect(useStudioStore.getState().pan).toEqual({ x: 120, y: -45 });

    resetHUD();
    expect(useStudioStore.getState().pan).toEqual({ x: 0, y: 0 });
    expect(useStudioStore.getState().zoom).toBe(1);
  });

  it('correctly sets detected GPU capabilities and auto-assigns active tier', () => {
    const { setDetectedCapabilities } = useStudioStore.getState();
    setDetectedCapabilities({
      tier: 'medium',
      engine: 'webgl2',
      maxTextureSize: 4096,
      memoryGb: 4,
      isMobile: false,
    });

    const state = useStudioStore.getState();
    expect(state.detectedTier).toBe('medium');
    expect(state.activeTier).toBe('medium');
    expect(state.gpuEngine).toBe('webgl2');
    expect(state.maxTextureSize).toBe(4096);
  });

  it('manual tier override takes precedence and reverts cleanly to auto', () => {
    const { setDetectedCapabilities, setTierOverride } = useStudioStore.getState();
    setDetectedCapabilities({
      tier: 'medium',
      engine: 'webgpu',
      maxTextureSize: 8192,
      isMobile: false,
    });

    expect(useStudioStore.getState().activeTier).toBe('medium');

    // Manual override to 'low'
    setTierOverride('low');
    expect(useStudioStore.getState().tierOverride).toBe('low');
    expect(useStudioStore.getState().activeTier).toBe('low');

    // Revert override to auto (null)
    setTierOverride(null);
    expect(useStudioStore.getState().tierOverride).toBeNull();
    expect(useStudioStore.getState().activeTier).toBe('medium');
  });

  it('updates renderStatus between active and paused', () => {
    const { setRenderStatus } = useStudioStore.getState();
    setRenderStatus('paused');
    expect(useStudioStore.getState().renderStatus).toBe('paused');

    setRenderStatus('active');
    expect(useStudioStore.getState().renderStatus).toBe('active');
  });
});
