/**
 * Persistent Web Audio graph with singleton node reuse per D-05, D-10, D-12, D-13.
 *
 * Browsers forbid calling createMediaElementSource() more than once on the same
 * HTMLMediaElement, throwing uncatchable InvalidStateError. This module holds a
 * persistent singleton AudioContext, MediaElementAudioSourceNode, GainNode,
 * MediaStreamDestination, MixerGain, AnalyserNode, and MediaStreamAudioSourceNode.
 *
 * Audio reactivity and export route through this single AudioContext with zero
 * secondary instances (D-10).
 */

export type AudioInputSource = 'media' | 'mic' | 'both';
export type AudioContextStatus = 'live' | 'suspended' | 'denied' | 'unavailable';

let sharedAudioCtx: AudioContext | null = null;
let sharedSourceNode: MediaElementAudioSourceNode | null = null;
let sharedGainNode: GainNode | null = null;
let sharedStreamDest: MediaStreamAudioDestinationNode | null = null;
let attachedVideoEl: HTMLVideoElement | null = null;

// Audio reactivity singletons (D-10, D-12)
let sharedMixerGain: GainNode | null = null;
let sharedMediaInputGain: GainNode | null = null;
let sharedMicInputGain: GainNode | null = null;
let sharedAnalyserNode: AnalyserNode | null = null;
let sharedMicSourceNode: MediaStreamAudioSourceNode | null = null;
let sharedMicStream: MediaStream | null = null;
let currentAudioSource: AudioInputSource = 'media';
let isGainConnectedToMixer = false;

export interface AudioGraphHandles {
  audioContext: AudioContext;
  sourceNode: MediaElementAudioSourceNode;
  gainNode: GainNode;
  streamDestination: MediaStreamAudioDestinationNode;
}

/**
 * Retrieve or create the application-wide singleton AudioContext per D-10.
 */
export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioContextClass =
      (typeof window !== 'undefined' &&
        (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) ||
      (globalThis as unknown as { AudioContext: typeof AudioContext }).AudioContext;

    if (!AudioContextClass) {
      throw new Error('AudioContext not supported in this environment');
    }

    sharedAudioCtx = new AudioContextClass();
    sharedSourceNode = null;
    sharedGainNode = null;
    sharedStreamDest = null;
    sharedMixerGain = null;
    sharedMediaInputGain = null;
    sharedMicInputGain = null;
    sharedAnalyserNode = null;
    sharedMicSourceNode = null;
    sharedMicStream = null;
    attachedVideoEl = null;
    isGainConnectedToMixer = false;
  }
  return sharedAudioCtx;
}

/**
 * Internal helper to ensure mixer bus and intermediate gains are wired to sharedAudioCtx.
 */
function ensureMixerGraph(ctx: AudioContext): void {
  if (!sharedMixerGain) {
    sharedMixerGain = ctx.createGain();
    sharedMixerGain.gain.value = 1.0;
  }
  if (!sharedMediaInputGain) {
    sharedMediaInputGain = ctx.createGain();
    sharedMediaInputGain.gain.value =
      currentAudioSource === 'media' || currentAudioSource === 'both' ? 1.0 : 0.0;
    sharedMediaInputGain.connect(sharedMixerGain);
  }
  if (!sharedMicInputGain) {
    sharedMicInputGain = ctx.createGain();
    sharedMicInputGain.gain.value =
      currentAudioSource === 'mic' || currentAudioSource === 'both' ? 1.0 : 0.0;
    sharedMicInputGain.connect(sharedMixerGain);
  }
  if (sharedGainNode && !isGainConnectedToMixer) {
    try {
      sharedGainNode.connect(sharedMediaInputGain);
      isGainConnectedToMixer = true;
    } catch (err) {
      console.warn('[AudioGraph] Failed to connect sharedGainNode to mixer:', err);
    }
  }
}

/**
 * Retrieve or lazily create the persistent singleton AnalyserNode per D-12.
 * Configured with fftSize = 256 (128 frequency bins) and smoothingTimeConstant = 0.0
 * (envelope smoothing is handled in JS by AudioReactivityEngine).
 */
export function getSharedAnalyserNode(): AnalyserNode {
  const ctx = getSharedAudioContext();
  ensureMixerGraph(ctx);

  if (!sharedAnalyserNode) {
    sharedAnalyserNode = ctx.createAnalyser();
    sharedAnalyserNode.fftSize = 256;
    sharedAnalyserNode.smoothingTimeConstant = 0.0;
    sharedMixerGain!.connect(sharedAnalyserNode);
  }

  return sharedAnalyserNode;
}

/**
 * Configure audio reactivity input source ('media' | 'mic' | 'both').
 * Only requests microphone permissions upon explicit user invocation (D-10, D-13, T-02-09).
 */
export async function setAudioInputSource(source: AudioInputSource): Promise<void> {
  currentAudioSource = source;
  const ctx = getSharedAudioContext();
  ensureMixerGraph(ctx);

  if (source === 'mic' || source === 'both') {
    if (!sharedMicStream) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this environment');
      }
      sharedMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    if (!sharedMicSourceNode && sharedMicStream) {
      sharedMicSourceNode = ctx.createMediaStreamSource(sharedMicStream);
      sharedMicSourceNode.connect(sharedMicInputGain!);
    }

    if (sharedMicInputGain) {
      sharedMicInputGain.gain.value = 1.0;
    }
  } else {
    // source === 'media': disconnect and stop mic tracks
    if (sharedMicInputGain) {
      sharedMicInputGain.gain.value = 0.0;
    }
    if (sharedMicStream) {
      for (const track of sharedMicStream.getTracks()) {
        track.stop();
      }
      sharedMicStream = null;
    }
    if (sharedMicSourceNode) {
      try {
        sharedMicSourceNode.disconnect();
      } catch {
        // ignore
      }
      sharedMicSourceNode = null;
    }
  }

  if (sharedMediaInputGain) {
    sharedMediaInputGain.gain.value =
      source === 'media' || source === 'both' ? 1.0 : 0.0;
  }
}

export async function selectAudioSource(source: AudioInputSource): Promise<void> {
  return setAudioInputSource(source);
}

export async function enableMicSource(): Promise<void> {
  return setAudioInputSource('mic');
}

export async function disableMicSource(): Promise<void> {
  return setAudioInputSource('media');
}

export function getCurrentAudioSource(): AudioInputSource {
  return currentAudioSource;
}

/**
 * Retrieve or create persistent Web Audio graph for the given HTMLVideoElement per D-05.
 */
export function getOrCreateAudioGraph(videoEl: HTMLVideoElement): AudioGraphHandles {
  const ctx = getSharedAudioContext();

  if (!sharedGainNode) {
    sharedGainNode = ctx.createGain();
    sharedGainNode.gain.value = 1.0;
    isGainConnectedToMixer = false;
  }

  if (!sharedStreamDest) {
    sharedStreamDest = ctx.createMediaStreamDestination();
  }

  ensureMixerGraph(ctx);

  // Create MediaElementAudioSourceNode once per element
  if (!sharedSourceNode || attachedVideoEl !== videoEl) {
    if (attachedVideoEl && attachedVideoEl !== videoEl) {
      console.warn('[AudioGraph] Video element changed; reusing AudioContext for new element.');
    }
    sharedSourceNode = ctx.createMediaElementSource(videoEl);
    attachedVideoEl = videoEl;

    // Dual routing per D-05:
    // 1. To speakers so user hears video playback during export
    sharedSourceNode.connect(sharedGainNode);
    sharedGainNode.connect(ctx.destination);

    // 2. To stream destination for MediaRecorder canvas track recording
    sharedGainNode.connect(sharedStreamDest);
  }

  return {
    audioContext: ctx,
    sourceNode: sharedSourceNode,
    gainNode: sharedGainNode,
    streamDestination: sharedStreamDest,
  };
}

/**
 * Resume AudioContext inside a user click interaction for browser autoplay compliance per D-05, D-13.
 * Returns the resulting status: 'live' | 'suspended' | 'denied' | 'unavailable'.
 */
export async function resumeAudioContext(): Promise<AudioContextStatus> {
  let ctx: AudioContext;
  try {
    ctx = getSharedAudioContext();
  } catch {
    return 'unavailable';
  }

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state === 'running') {
      return 'live';
    }
    if (ctx.state === 'suspended') {
      return 'suspended';
    }
    return 'unavailable';
  } catch (err) {
    console.warn('[AudioGraph] Failed to resume AudioContext:', err);
    return 'denied';
  }
}

/**
 * Retrieve current audio stream track for muxing into canvas captureStream.
 */
export function getAudioStreamTrack(): MediaStreamTrack | null {
  if (sharedStreamDest && sharedStreamDest.stream) {
    const tracks = sharedStreamDest.stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }
  return null;
}

/**
 * Fully reset and release audio graph resources.
 */
export function cleanupAudioGraph(): void {
  if (sharedMicStream) {
    for (const track of sharedMicStream.getTracks()) {
      track.stop();
    }
    sharedMicStream = null;
  }
  if (sharedMicSourceNode) {
    try {
      sharedMicSourceNode.disconnect();
    } catch {
      // ignore
    }
    sharedMicSourceNode = null;
  }
  if (sharedAnalyserNode) {
    try {
      sharedAnalyserNode.disconnect();
    } catch {
      // ignore
    }
    sharedAnalyserNode = null;
  }
  if (sharedMixerGain) {
    try {
      sharedMixerGain.disconnect();
    } catch {
      // ignore
    }
    sharedMixerGain = null;
  }
  if (sharedMediaInputGain) {
    try {
      sharedMediaInputGain.disconnect();
    } catch {
      // ignore
    }
    sharedMediaInputGain = null;
  }
  if (sharedMicInputGain) {
    try {
      sharedMicInputGain.disconnect();
    } catch {
      // ignore
    }
    sharedMicInputGain = null;
  }
  if (sharedGainNode) {
    try {
      sharedGainNode.disconnect();
    } catch {
      // ignore
    }
    sharedGainNode = null;
  }
  if (sharedSourceNode) {
    try {
      sharedSourceNode.disconnect();
    } catch {
      // ignore
    }
    sharedSourceNode = null;
  }
  if (sharedAudioCtx && sharedAudioCtx.state !== 'closed') {
    try {
      void sharedAudioCtx.close();
    } catch {
      // ignore
    }
  }
  sharedAudioCtx = null;
  sharedStreamDest = null;
  attachedVideoEl = null;
  isGainConnectedToMixer = false;
  currentAudioSource = 'media';
}
