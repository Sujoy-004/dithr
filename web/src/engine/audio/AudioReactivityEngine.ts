/**
 * Audio Reactivity Engine (D-11, D-12, D-14, FX-05).
 *
 * Partitions 128 FFT frequency bins (fftSize: 256) into Bass, Mid, and Treble bands.
 * Applies an asymmetric attack/release envelope filter (fast ~20ms attack, musical ~200ms release)
 * with zero per-frame buffer allocations. Scaled by sensitivity [0.1, 3.0] and strictly clamped
 * to [0.0, 1.0].
 */

export interface AudioReactivityOptions {
  sensitivity?: number;
  attackMs?: number;
  releaseMs?: number;
  bassAttack?: number;
  bassRelease?: number;
  midAttack?: number;
  midRelease?: number;
  trebleAttack?: number;
  trebleRelease?: number;
  bassSensitivity?: number;
  midSensitivity?: number;
  trebleSensitivity?: number;
}

export interface AudioBandEnergies {
  bass: number;
  mid: number;
  treble: number;
}

export const AUDIO_ENVELOPE_PRESETS = {
  punchy: { attackMs: 10, releaseMs: 100 },
  standard: { attackMs: 20, releaseMs: 200 },
  smooth: { attackMs: 40, releaseMs: 400 },
} as const;

export type AudioEnvelopePresetKey = keyof typeof AUDIO_ENVELOPE_PRESETS;

export class AudioReactivityEngine {
  // Pre-allocated single Uint8Array(128) for zero per-frame garbage collection churn (D-12)
  private readonly freqData = new Uint8Array(128);

  // Filter state
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedTreble = 0;

  // Configuration parameters
  public sensitivity: number = 1.0;
  public attackMs: number = 20.0;
  public releaseMs: number = 200.0;

  // Optional per-band overrides (D-14)
  public bassAttack?: number;
  public bassRelease?: number;
  public midAttack?: number;
  public midRelease?: number;
  public trebleAttack?: number;
  public trebleRelease?: number;

  public bassSensitivity?: number;
  public midSensitivity?: number;
  public trebleSensitivity?: number;

  constructor(options?: AudioReactivityOptions) {
    if (options) {
      if (options.sensitivity !== undefined) this.sensitivity = options.sensitivity;
      if (options.attackMs !== undefined) this.attackMs = options.attackMs;
      if (options.releaseMs !== undefined) this.releaseMs = options.releaseMs;
      if (options.bassAttack !== undefined) this.bassAttack = options.bassAttack;
      if (options.bassRelease !== undefined) this.bassRelease = options.bassRelease;
      if (options.midAttack !== undefined) this.midAttack = options.midAttack;
      if (options.midRelease !== undefined) this.midRelease = options.midRelease;
      if (options.trebleAttack !== undefined) this.trebleAttack = options.trebleAttack;
      if (options.trebleRelease !== undefined) this.trebleRelease = options.trebleRelease;
      if (options.bassSensitivity !== undefined) this.bassSensitivity = options.bassSensitivity;
      if (options.midSensitivity !== undefined) this.midSensitivity = options.midSensitivity;
      if (options.trebleSensitivity !== undefined) this.trebleSensitivity = options.trebleSensitivity;
    }
  }

  /**
   * Resets internal smoothed energy accumulator state to 0.
   */
  public reset(): void {
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;
    this.freqData.fill(0);
  }

  /**
   * Directly get the internal frequency buffer (128 elements).
   */
  public getFrequencyBuffer(): Uint8Array {
    return this.freqData;
  }

  /**
   * Update audio reactivity state using data from an AnalyserNode.
   * Runs in the 60 FPS RAF render loop.
   */
  public update(analyser?: AnalyserNode | null, deltaMs = 16.67): AudioBandEnergies {
    if (analyser) {
      analyser.getByteFrequencyData(this.freqData);
    }
    return this.processCurrentBuffer(deltaMs);
  }

  /**
   * Feed raw frequency bytes directly (useful for testing and offline simulation).
   */
  public processRawData(data: Uint8Array, deltaMs = 16.67): AudioBandEnergies {
    const len = Math.min(data.length, this.freqData.length);
    for (let i = 0; i < len; i++) {
      this.freqData[i] = data[i];
    }
    return this.processCurrentBuffer(deltaMs);
  }

  /**
   * Core envelope shaping and band extraction logic.
   */
  private processCurrentBuffer(deltaMs: number): AudioBandEnergies {
    // 1. Partition 128 bins into 3 bands per D-12:
    // Bass: bins 0-2 (3 bins, ~0-375Hz)
    const rawBass =
      (this.freqData[0] + this.freqData[1] + this.freqData[2]) / (3 * 255);

    // Mid: bins 3-14 (12 bins, ~560-2600Hz)
    let sumMid = 0;
    for (let i = 3; i <= 14; i++) {
      sumMid += this.freqData[i];
    }
    const rawMid = sumMid / (12 * 255);

    // Treble: bins 15-63 (49 bins, ~2.8-11.8kHz)
    let sumTreble = 0;
    for (let i = 15; i <= 63; i++) {
      sumTreble += this.freqData[i];
    }
    const rawTreble = sumTreble / (49 * 255);

    // 2. Asymmetric attack/release envelope filter (D-14)
    // Formula: coeff = 1.0 - Math.exp(-deltaMs / timeConstantMs)
    const smoothBand = (
      rawTarget: number,
      smoothedCurrent: number,
      attack: number,
      release: number
    ): number => {
      if (deltaMs <= 0) return smoothedCurrent;
      const isAttack = rawTarget > smoothedCurrent;
      const tc = Math.max(0.1, isAttack ? attack : release);
      const coeff = 1.0 - Math.exp(-deltaMs / tc);
      return smoothedCurrent + (rawTarget - smoothedCurrent) * coeff;
    };

    const bAttack = this.bassAttack ?? this.attackMs;
    const bRelease = this.bassRelease ?? this.releaseMs;
    this.smoothedBass = smoothBand(rawBass, this.smoothedBass, bAttack, bRelease);

    const mAttack = this.midAttack ?? this.attackMs;
    const mRelease = this.midRelease ?? this.releaseMs;
    this.smoothedMid = smoothBand(rawMid, this.smoothedMid, mAttack, mRelease);

    const tAttack = this.trebleAttack ?? this.attackMs;
    const tRelease = this.trebleRelease ?? this.releaseMs;
    this.smoothedTreble = smoothBand(rawTreble, this.smoothedTreble, tAttack, tRelease);

    // 3. Apply sensitivity and clamp strictly to [0.0, 1.0]
    const bSens = this.bassSensitivity ?? this.sensitivity;
    const mSens = this.midSensitivity ?? this.sensitivity;
    const tSens = this.trebleSensitivity ?? this.sensitivity;

    const outBass = Math.min(1.0, Math.max(0.0, this.smoothedBass * bSens));
    const outMid = Math.min(1.0, Math.max(0.0, this.smoothedMid * mSens));
    const outTreble = Math.min(1.0, Math.max(0.0, this.smoothedTreble * tSens));

    return {
      bass: outBass,
      mid: outMid,
      treble: outTreble,
    };
  }

  /**
   * Return currently smoothed energies.
   */
  public getSmoothedValues(): AudioBandEnergies {
    const bSens = this.bassSensitivity ?? this.sensitivity;
    const mSens = this.midSensitivity ?? this.sensitivity;
    const tSens = this.trebleSensitivity ?? this.sensitivity;

    return {
      bass: Math.min(1.0, Math.max(0.0, this.smoothedBass * bSens)),
      mid: Math.min(1.0, Math.max(0.0, this.smoothedMid * mSens)),
      treble: Math.min(1.0, Math.max(0.0, this.smoothedTreble * tSens)),
    };
  }

  /**
   * Apply an envelope preset.
   */
  public setPreset(preset: AudioEnvelopePresetKey): void {
    const cfg = AUDIO_ENVELOPE_PRESETS[preset];
    if (cfg) {
      this.attackMs = cfg.attackMs;
      this.releaseMs = cfg.releaseMs;
    }
  }
}
