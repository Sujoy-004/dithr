import type {
  AsciiSettings,
  PostProcessingSettings,
  ProcessingSettings,
  StudioTheme,
  ToneSettings,
} from '../types/studio';

export const DEFAULT_TONE: ToneSettings = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hueRotation: 0,
  gamma: 1,
  invert: false,
  sharpness: 0,
};

export const DEFAULT_ASCII: AsciiSettings = {
  cellScale: 8,
  charSpacing: 0,
  charAspect: 0.5,
  rampPreset: 'standard',
  customChars: '',
};

export const DEFAULT_PROCESSING: ProcessingSettings = {
  invert: false,
  brightnessMap: 0,
  edgeEnhance: 0,
  blur: 0,
  quantizeColors: 0,
};

export const DEFAULT_POST_PROCESSING: PostProcessingSettings = {
  bloom: { enabled: false, threshold: 0.65, intensity: 0.6 },
  grain: { enabled: false, intensity: 0.25, size: 2, speed: 1 },
  chromatic: { enabled: false, offset: 2 },
  scanlines: { enabled: false, opacity: 0.25, spacing: 3 },
  vignette: { enabled: false, intensity: 0.5, radius: 0.55 },
  crtCurve: { enabled: false, amount: 0.18 },
  phosphor: { enabled: false, mode: 'green', color: '#00ff41', intensity: 0.35 },
};

export const STUDIO_THEME_ORDER: readonly StudioTheme[] = [
  'default',
  'vt320',
  'cassette',
  'coldwar',
  'light',
] as const;

export const STUDIO_THEME_LABELS: Record<StudioTheme, string> = {
  default: 'Default',
  vt320: 'VT320',
  cassette: 'Cassette',
  coldwar: 'NORAD',
  light: 'Light',
};
