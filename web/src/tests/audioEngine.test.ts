import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
