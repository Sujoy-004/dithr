/**
 * Studio type contracts — phase 02-02.
 * SHADER-01: charSpacing in [0, 8] px; SHADER-03: hueRotation in [-180, 180] degrees.
 * charAspect mirrors `char_aspect = 0.5` from src/config.py (Rec. 601 pipeline).
 */

import type { ActiveEffectPass, EffectDefinition, BlendMode } from '../engine/registry/types';

export type { ActiveEffectPass, EffectDefinition, BlendMode };

export type MediaType = 'image' | 'video' | 'webcam';

export type ThemeMode = 'dark' | 'light';

/** Grainrad-derived switchable terminal themes (plus the original light theme). */
export type StudioTheme = 'default' | 'vt320' | 'cassette' | 'coldwar' | 'light';

/** The 16 Grainrad effect modes (D-02). */
export type EffectMode =
  | 'ascii'
  | 'dither'
  | 'halftone'
  | 'vhs'
  | 'matrix'
  | 'dots'
  | 'contour'
  | 'pixelSort'
  | 'blockify'
  | 'threshold'
  | 'edgeDetect'
  | 'crosshatch'
  | 'waveLines'
  | 'noise'
  | 'voronoi'
  | 'tone';

/** Grainrad's 10 ASCII character sets. */
export type RampPreset =
  | 'standard'
  | 'blocks'
  | 'binary'
  | 'detailed'
  | 'minimal'
  | 'alphabetic'
  | 'numeric'
  | 'math'
  | 'symbols'
  | 'custom';

/** Pre-tone adjustments applied before the primary effect (SHADER-03, D-06 stage 1). */
export interface ToneSettings {
  /** 0..2, 1 = neutral */
  brightness: number;
  /** 0..2, 1 = neutral */
  contrast: number;
  /** 0..2, 1 = neutral */
  saturation: number;
  /** [-180, 180] degrees (SHADER-03) */
  hueRotation: number;
  /** 0.1..3, 1 = neutral */
  gamma: number;
  invert: boolean;
  /** 0..1 unsharp-style local contrast, 0 = neutral */
  sharpness: number;
}

/** Global Stage-0 processing controls (Grainrad "Processing" section). */
export interface ProcessingSettings {
  invert: boolean;
  /** 0..1 shadow lift / brightness map, 0 = neutral */
  brightnessMap: number;
  /** 0..1 edge-enhancement contrast, 0 = neutral */
  edgeEnhance: number;
  /** 0..1 gaussian-ish softening, 0 = neutral */
  blur: number;
  /** 0 = off, otherwise number of quantized colour levels (2..16) */
  quantizeColors: number;
}

export interface BloomSettings {
  enabled: boolean;
  threshold: number;
  intensity: number;
}

export interface GrainSettings {
  enabled: boolean;
  intensity: number;
  size: number;
  speed: number;
}

export interface ChromaticSettings {
  enabled: boolean;
  offset: number;
}

export interface ScanlineSettings {
  enabled: boolean;
  opacity: number;
  spacing: number;
}

export interface VignetteSettings {
  enabled: boolean;
  intensity: number;
  radius: number;
}

export interface CrtCurveSettings {
  enabled: boolean;
  amount: number;
}

export type PhosphorMode = 'green' | 'amber' | 'white' | 'custom';

export interface PhosphorSettings {
  enabled: boolean;
  mode: PhosphorMode;
  color: string;
  intensity: number;
}

/** Global finishing chain applied AFTER the composable effect stack. */
export interface PostProcessingSettings {
  bloom: BloomSettings;
  grain: GrainSettings;
  chromatic: ChromaticSettings;
  scanlines: ScanlineSettings;
  vignette: VignetteSettings;
  crtCurve: CrtCurveSettings;
  phosphor: PhosphorSettings;
}

/** A serialisable studio look used by built-in and custom presets. */
export interface StudioPreset {
  id: string;
  name: string;
  builtIn?: boolean;
  stack: Omit<ActiveEffectPass, 'instanceId'>[];
  tone: ToneSettings;
  ascii: AsciiSettings;
  processing: ProcessingSettings;
  postProcessing: PostProcessingSettings;
  studioTheme?: StudioTheme;
}

/** ASCII engine parameters (SHADER-01, D-07). */
export interface AsciiSettings {
  /** Base cell size in px */
  cellScale: number;
  /** [0, 8] px extra spacing between character cells (SHADER-01) */
  charSpacing: number;
  /** Cell width/height ratio, default 0.5 (monospace glyphs are taller than wide) */
  charAspect: number;
  rampPreset: RampPreset;
  /** Freeform custom ramp (lowest luminance first); overrides rampPreset when non-empty */
  customChars: string;
}

export interface Dimensions {
  width: number;
  height: number;
}

/** Audio reactivity types (D-10, D-11, D-12, D-13, D-14, FX-05). */
export type AudioSourceType = 'media' | 'mic';
export type AudioStatusType = 'off' | 'waiting' | 'live' | 'denied' | 'unavailable';
export type AudioFrequencyBand = 'bass' | 'mid' | 'treble';

export interface AudioMapping {
  id: string;
  passInstanceId: string;
  paramKey: string;
  band: AudioFrequencyBand;
  amount: number; // [-1.0, 1.0]
}

export interface AudioState {
  enabled: boolean;
  source: AudioSourceType;
  status: AudioStatusType;
  sensitivity: number;
  envelopePreset: 'punchy' | 'standard' | 'smooth';
  mappings: AudioMapping[];
}

/** 3D scene & model state (D-15, D-16, D-17, FX-06). */
export type ThreeDPrimitiveType = 'torusKnot' | 'sphere' | 'cube' | 'plane' | 'custom';

export interface ThreeDState {
  primitive: ThreeDPrimitiveType;
  customMesh: any | null;
  customMeshName: string | null;
  autoRotate: boolean;
  autoRotateSpeed: number;
  cameraResetTrigger: number;
}

/** Export targets for the client-side export suite (D-08). */
export type ExportFormat = 'png' | 'jpeg' | 'svg' | 'txt' | 'gif' | 'webm';

export interface ExportConfig {
  format: ExportFormat;
  /** Output scale multiplier relative to media native dimensions */
  scale: number;
}

export interface EffectParams {
  ditherSteps: number;
  ditherSpread: number;
  halftoneFreq: number;
  halftoneAngle: number;
  halftoneRadius: number;
  matrixSpeed: number;
  matrixDensity: number;
  sortThreshold: number;
  sortSpan: number;
  sortDirection: number;
  genericA: number;
  genericB: number;
  vhsScanlineIntensity: number;
  vhsAberration: number;
  vhsNoiseIntensity: number;
  vhsCurvature: number;
}
