import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  getSharedAudioContext,
  getSharedAnalyserNode,
  setAudioInputSource,
  enableMicSource,
  disableMicSource,
  resumeAudioContext,
  cleanupAudioGraph,
  getCurrentAudioSource,
  getOrCreateAudioGraph,
} from '../export/audioGraph';
import {
  AudioReactivityEngine,
  AUDIO_ENVELOPE_PRESETS,
} from '../engine/audio/AudioReactivityEngine';
import {
  useStudioStore,
  DEFAULT_AUDIO_STATE,
  DEFAULT_INITIAL_STACK,
} from '../store/useStudioStore';
import AudioPanel from '../components/panels/AudioPanel';

describe('audioGraph Web Audio Singleton & Analyser (D-10, D-12, D-13, FX-05)', () => {
  beforeEach(() => {
    cleanupAudioGraph();
  });

  afterEach(() => {
    cleanupAudioGraph();
    vi.restoreAllMocks();
  });

  it('preserves singleton AudioContext and does not create secondary instances', () => {
    const ctx1 = getSharedAudioContext();
    const ctx2 = getSharedAudioContext();
    expect(ctx1).toBe(ctx2);
  });

  it('getSharedAnalyserNode returns the same singleton instance with fftSize = 256', () => {
    const analyser1 = getSharedAnalyserNode();
    const analyser2 = getSharedAnalyserNode();

    expect(analyser1).toBe(analyser2);
    expect(analyser1.fftSize).toBe(256);
    expect(analyser1.frequencyBinCount).toBe(128);
    expect(analyser1.smoothingTimeConstant).toBe(0.0);
  });

  it('allocates frequency buffer with exactly 128 elements', () => {
    const analyser = getSharedAnalyserNode();
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    expect(freqData.length).toBe(128);

    analyser.getByteFrequencyData(freqData);
    expect(freqData.length).toBe(128);
  });

  it('defaults audio source to media and updates source via setAudioInputSource', async () => {
    expect(getCurrentAudioSource()).toBe('media');

    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    // Mock getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    });

    await setAudioInputSource('mic');
    expect(getCurrentAudioSource()).toBe('mic');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });

    // Switch back to media: should stop microphone tracks
    await setAudioInputSource('media');
    expect(getCurrentAudioSource()).toBe('media');
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('enableMicSource and disableMicSource properly toggle source and tracks', async () => {
    const mockTrack = { stop: vi.fn() };
    const mockStream = {
      getTracks: () => [mockTrack],
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    });

    await enableMicSource();
    expect(getCurrentAudioSource()).toBe('mic');

    await disableMicSource();
    expect(getCurrentAudioSource()).toBe('media');
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('resumeAudioContext resumes context and returns status', async () => {
    const status = await resumeAudioContext();
    expect(status).toBe('live');
  });

  it('integrates with getOrCreateAudioGraph for video element without duplicating context', () => {
    const ctxBefore = getSharedAudioContext();
    const fakeVideo = document.createElement('video');
    const handles = getOrCreateAudioGraph(fakeVideo);

    expect(handles.audioContext).toBe(ctxBefore);
    expect(handles.gainNode).toBeDefined();
    expect(handles.sourceNode).toBeDefined();

    // Calling analyser node still shares the exact same context
    const analyser = getSharedAnalyserNode();
    expect(analyser.fftSize).toBe(256);
  });
});

describe('AudioReactivityEngine & Envelope Smoothing (D-11, D-12, D-14, FX-05)', () => {
  it('pre-allocates a single Uint8Array(128) with zero per-frame allocation', () => {
    const engine = new AudioReactivityEngine();
    const buf1 = engine.getFrequencyBuffer();
    const buf2 = engine.getFrequencyBuffer();

    expect(buf1).toBe(buf2);
    expect(buf1.length).toBe(128);
  });

  it('partitions 128 bins into Bass (0-2), Mid (3-14), and Treble (15-63)', () => {
    const engine = new AudioReactivityEngine({ attackMs: 0.1, releaseMs: 0.1 }); // instantaneous response

    // 1. Bass only: bins 0, 1, 2 = 255
    const bassData = new Uint8Array(128);
    bassData[0] = 255;
    bassData[1] = 255;
    bassData[2] = 255;
    let result = engine.processRawData(bassData, 100);
    expect(result.bass).toBeCloseTo(1.0, 2);
    expect(result.mid).toBe(0.0);
    expect(result.treble).toBe(0.0);

    engine.reset();

    // 2. Mid only: bins 3..14 = 255
    const midData = new Uint8Array(128);
    for (let i = 3; i <= 14; i++) midData[i] = 255;
    result = engine.processRawData(midData, 100);
    expect(result.bass).toBe(0.0);
    expect(result.mid).toBeCloseTo(1.0, 2);
    expect(result.treble).toBe(0.0);

    engine.reset();

    // 3. Treble only: bins 15..63 = 255
    const trebleData = new Uint8Array(128);
    for (let i = 15; i <= 63; i++) trebleData[i] = 255;
    result = engine.processRawData(trebleData, 100);
    expect(result.bass).toBe(0.0);
    expect(result.mid).toBe(0.0);
    expect(result.treble).toBeCloseTo(1.0, 2);

    engine.reset();

    // 4. Inactive high frequencies: bins 64..127 do not leak into bands
    const highData = new Uint8Array(128);
    for (let i = 64; i < 128; i++) highData[i] = 255;
    result = engine.processRawData(highData, 100);
    expect(result.bass).toBe(0.0);
    expect(result.mid).toBe(0.0);
    expect(result.treble).toBe(0.0);
  });

  it('asymmetric attack/release reaches ~63% on attack (20ms) and decays over release (200ms)', () => {
    const engine = new AudioReactivityEngine({
      attackMs: 20.0,
      releaseMs: 200.0,
      sensitivity: 1.0,
    });

    const stepUp = new Uint8Array(128);
    stepUp[0] = 255;
    stepUp[1] = 255;
    stepUp[2] = 255;

    // Step up for exactly 20ms (one time constant):
    // Target is 1.0, starting from 0.0
    // Expected = 1.0 - exp(-20/20) = 1.0 - exp(-1) ≈ 0.63212
    const afterAttack = engine.processRawData(stepUp, 20.0);
    expect(afterAttack.bass).toBeCloseTo(1.0 - Math.exp(-1), 3);

    // Let it saturate to 1.0 with a long step
    engine.processRawData(stepUp, 500.0);
    expect(engine.getSmoothedValues().bass).toBeCloseTo(1.0, 3);

    // Step down to 0 for exactly 200ms (one release time constant):
    // Target is 0.0, starting from 1.0
    // Expected = 1.0 - (1.0 - exp(-200/200)) = exp(-1) ≈ 0.36788
    const stepDown = new Uint8Array(128);
    const afterRelease = engine.processRawData(stepDown, 200.0);
    expect(afterRelease.bass).toBeCloseTo(Math.exp(-1), 3);
  });

  it('scales band energies with sensitivity and clamps strictly to [0.0, 1.0]', () => {
    const engine = new AudioReactivityEngine({
      attackMs: 0.1,
      releaseMs: 0.1,
      sensitivity: 3.0, // High sensitivity
    });

    // Feed 50% energy (128 / 255 ≈ 0.5)
    const midEnergy = new Uint8Array(128);
    for (let i = 0; i < 3; i++) midEnergy[i] = 128;
    const res = engine.processRawData(midEnergy, 100);

    // 0.5 * 3.0 = 1.5 -> clamped strictly to 1.0
    expect(res.bass).toBe(1.0);

    // Now low sensitivity = 0.5 on 100% input
    engine.sensitivity = 0.5;
    const fullEnergy = new Uint8Array(128);
    for (let i = 0; i < 3; i++) fullEnergy[i] = 255;
    const res2 = engine.processRawData(fullEnergy, 100);
    expect(res2.bass).toBeCloseTo(0.5, 2);
  });

  it('supports per-band attack and release overrides', () => {
    const engine = new AudioReactivityEngine({
      attackMs: 50.0,
      releaseMs: 500.0,
      bassAttack: 10.0,
      bassRelease: 100.0,
    });

    const stepUp = new Uint8Array(128);
    stepUp[0] = 255;
    stepUp[1] = 255;
    stepUp[2] = 255;

    // After 10ms, bass (with bassAttack=10) should reach ~63%
    const res = engine.processRawData(stepUp, 10.0);
    expect(res.bass).toBeCloseTo(1.0 - Math.exp(-1), 3);
  });

  it('supports presets (punchy, standard, smooth)', () => {
    const engine = new AudioReactivityEngine();
    engine.setPreset('punchy');
    expect(engine.attackMs).toBe(AUDIO_ENVELOPE_PRESETS.punchy.attackMs);
    expect(engine.releaseMs).toBe(AUDIO_ENVELOPE_PRESETS.punchy.releaseMs);

    engine.setPreset('smooth');
    expect(engine.attackMs).toBe(AUDIO_ENVELOPE_PRESETS.smooth.attackMs);
    expect(engine.releaseMs).toBe(AUDIO_ENVELOPE_PRESETS.smooth.releaseMs);
  });
});

describe('useStudioStore audioState & AudioPanel UI (D-10, D-11, D-13, FX-05)', () => {
  beforeEach(() => {
    cleanupAudioGraph();
    const initialPass = {
      instanceId: 'initial-ascii',
      effectId: 'ascii',
      enabled: true,
      intensity: 1.0,
      blendMode: 'normal' as const,
      parameters: { cellScale: 12 },
    };
    useStudioStore.setState({
      activeStack: [initialPass],
      selectedPassId: 'initial-ascii',
      audioState: structuredClone(DEFAULT_AUDIO_STATE),
    });
  });

  afterEach(() => {
    cleanupAudioGraph();
    vi.restoreAllMocks();
  });

  it('manages audioState actions (enable, source, sensitivity, preset, mappings)', () => {
    const store = useStudioStore.getState();

    // 1. Initial defaults
    expect(store.audioState.enabled).toBe(false);
    expect(store.audioState.status).toBe('off');
    expect(store.audioState.source).toBe('media');
    expect(store.audioState.sensitivity).toBe(1.0);
    expect(store.audioState.envelopePreset).toBe('standard');
    expect(store.audioState.mappings).toHaveLength(0);

    // 2. Enable audio
    store.setAudioEnabled(true);
    expect(useStudioStore.getState().audioState.enabled).toBe(true);
    expect(useStudioStore.getState().audioState.status).toBe('waiting');

    // 3. Set source & sensitivity
    store.setAudioSource('mic');
    expect(useStudioStore.getState().audioState.source).toBe('mic');

    store.setAudioSensitivity(2.5);
    expect(useStudioStore.getState().audioState.sensitivity).toBe(2.5);

    // Clamping: max 3.0, min 0.1
    store.setAudioSensitivity(5.0);
    expect(useStudioStore.getState().audioState.sensitivity).toBe(3.0);
    store.setAudioSensitivity(0.01);
    expect(useStudioStore.getState().audioState.sensitivity).toBe(0.1);

    // 4. Envelope presets
    store.setAudioEnvelopePreset('punchy');
    expect(useStudioStore.getState().audioState.envelopePreset).toBe('punchy');

    // 5. Add, update, and remove mappings
    store.addAudioMapping({
      passInstanceId: 'initial-ascii',
      paramKey: 'cellScale',
      band: 'bass',
      amount: 0.75,
    });

    const withMapping = useStudioStore.getState().audioState;
    expect(withMapping.mappings).toHaveLength(1);
    const mappingId = withMapping.mappings[0].id;
    expect(withMapping.mappings[0].paramKey).toBe('cellScale');
    expect(withMapping.mappings[0].band).toBe('bass');
    expect(withMapping.mappings[0].amount).toBe(0.75);

    store.updateAudioMapping(mappingId, { band: 'treble', amount: -0.5 });
    expect(useStudioStore.getState().audioState.mappings[0].band).toBe('treble');
    expect(useStudioStore.getState().audioState.mappings[0].amount).toBe(-0.5);

    store.removeAudioMapping(mappingId);
    expect(useStudioStore.getState().audioState.mappings).toHaveLength(0);
  });

  it('removeEffect automatically removes orphaned audio mappings for that pass', () => {
    const store = useStudioStore.getState();
    store.addAudioMapping({
      passInstanceId: 'initial-ascii',
      paramKey: 'cellScale',
      band: 'bass',
      amount: 0.5,
    });
    expect(useStudioStore.getState().audioState.mappings).toHaveLength(1);

    // Remove the pass from the stack
    store.removeEffect('initial-ascii');
    expect(useStudioStore.getState().activeStack).toHaveLength(0);
    expect(useStudioStore.getState().audioState.mappings).toHaveLength(0);
  });

  it('AudioPanel renders Enable Audio button, status chip, source buttons, and presets', () => {
    render(React.createElement(AudioPanel));

    // Enable button
    expect(screen.getByRole('button', { name: /enable audio reactivity/i })).toBeInTheDocument();

    // Status chip
    expect(screen.getByRole('status')).toHaveTextContent(/off/i);

    // Source radios
    expect(screen.getByRole('radio', { name: /video audio/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /microphone/i })).toBeInTheDocument();

    // Preset buttons
    expect(screen.getByRole('button', { name: /punchy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /standard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /smooth/i })).toBeInTheDocument();
  });

  it('clicking Enable Audio activates the audio context and updates status to live', async () => {
    render(React.createElement(AudioPanel));

    const enableBtn = screen.getByRole('button', { name: /enable audio reactivity/i });
    fireEvent.click(enableBtn);

    // Context resumed and live
    await waitFor(() => {
      expect(useStudioStore.getState().audioState.enabled).toBe(true);
      expect(useStudioStore.getState().audioState.status).toBe('live');
    });
    expect(screen.getByRole('status')).toHaveTextContent(/live/i);

    // Clicking again disables audio
    const disableBtn = screen.getByRole('button', { name: /disable audio reactivity/i });
    fireEvent.click(disableBtn);

    await waitFor(() => {
      expect(useStudioStore.getState().audioState.enabled).toBe(false);
      expect(useStudioStore.getState().audioState.status).toBe('off');
    });
  });

  it('clicking Add Mapping creates a new mapping row with controls', () => {
    render(React.createElement(AudioPanel));

    const addBtn = screen.getByRole('button', { name: /add audio modulation mapping/i });
    fireEvent.click(addBtn);

    expect(useStudioStore.getState().audioState.mappings).toHaveLength(1);
    expect(screen.getByLabelText(/modulation depth/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove modulation mapping/i })).toBeInTheDocument();
  });
});
