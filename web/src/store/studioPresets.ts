import type { StudioPreset } from '../types/studio';
import { DEFAULT_ASCII, DEFAULT_POST_PROCESSING, DEFAULT_PROCESSING, DEFAULT_TONE } from './defaults';

function pass(
  effectId: string,
  parameters: Record<string, number | boolean | string>,
  intensity = 1
): StudioPreset['stack'][number] {
  return {
    effectId,
    enabled: true,
    intensity,
    blendMode: 'normal',
    parameters,
  };
}

function post(overrides: Partial<StudioPreset['postProcessing']>): StudioPreset['postProcessing'] {
  return {
    bloom: { ...DEFAULT_POST_PROCESSING.bloom, ...(overrides.bloom ?? {}) },
    grain: { ...DEFAULT_POST_PROCESSING.grain, ...(overrides.grain ?? {}) },
    chromatic: { ...DEFAULT_POST_PROCESSING.chromatic, ...(overrides.chromatic ?? {}) },
    scanlines: { ...DEFAULT_POST_PROCESSING.scanlines, ...(overrides.scanlines ?? {}) },
    vignette: { ...DEFAULT_POST_PROCESSING.vignette, ...(overrides.vignette ?? {}) },
    crtCurve: { ...DEFAULT_POST_PROCESSING.crtCurve, ...(overrides.crtCurve ?? {}) },
    phosphor: { ...DEFAULT_POST_PROCESSING.phosphor, ...(overrides.phosphor ?? {}) },
  };
}

/**
 * Grainrad's six built-in presets, mapped onto dithr's real composable stack,
 * Stage-0 tone/processing, ASCII ramp, and global post-processing chain.
 */
export const BUILTIN_STUDIO_PRESETS: readonly StudioPreset[] = [
  {
    id: 'terminal-green',
    name: 'Terminal Green',
    builtIn: true,
    stack: [pass('ascii', { colorMode: 'green', cellScale: 8, contrast: 1.2 })],
    tone: { ...DEFAULT_TONE, contrast: 1.05 },
    ascii: { ...DEFAULT_ASCII, rampPreset: 'standard' },
    processing: { ...DEFAULT_PROCESSING },
    postProcessing: post({
      scanlines: { enabled: true, opacity: 0.18, spacing: 3 },
      vignette: { enabled: true, intensity: 0.35, radius: 0.55 },
      phosphor: { enabled: true, mode: 'green', color: '#00ff41', intensity: 0.35 },
    }),
    studioTheme: 'cassette',
  },
  {
    id: 'matrix',
    name: 'Matrix',
    builtIn: true,
    stack: [pass('matrix', { speed: 1.2, dropLength: 10, density: 70 })],
    tone: { ...DEFAULT_TONE, contrast: 1.1 },
    ascii: { ...DEFAULT_ASCII, rampPreset: 'standard' },
    processing: { ...DEFAULT_PROCESSING },
    postProcessing: post({
      bloom: { enabled: true, threshold: 0.55, intensity: 0.55 },
      scanlines: { enabled: true, opacity: 0.14, spacing: 3 },
      phosphor: { enabled: true, mode: 'green', color: '#00ff41', intensity: 0.4 },
    }),
    studioTheme: 'cassette',
  },
  {
    id: 'retro-crt',
    name: 'Retro CRT',
    builtIn: true,
    stack: [
      pass('dither', { colorSteps: 4, spread: 0.5, matrixType: 'bayer8', pixelSize: 2 }),
      pass('crtVhs', { profile: 'vhsSp' }, 0.85),
    ],
    tone: { ...DEFAULT_TONE, contrast: 1.08 },
    ascii: { ...DEFAULT_ASCII, rampPreset: 'standard' },
    processing: { ...DEFAULT_PROCESSING },
    postProcessing: post({
      scanlines: { enabled: true, opacity: 0.2, spacing: 3 },
      vignette: { enabled: true, intensity: 0.4, radius: 0.55 },
      crtCurve: { enabled: true, amount: 0.15 },
    }),
    studioTheme: 'vt320',
  },
  {
    id: 'high-detail',
    name: 'High Detail',
    builtIn: true,
    stack: [
      pass('ascii', {
        colorMode: 'truecolor',
        cellScale: 6,
        charSpacing: 0,
        charAspect: 0.5,
        contrast: 1.1,
      }),
    ],
    tone: { ...DEFAULT_TONE, contrast: 1.15, sharpness: 0.2 },
    ascii: { ...DEFAULT_ASCII, rampPreset: 'detailed' },
    processing: { ...DEFAULT_PROCESSING, edgeEnhance: 0.15 },
    postProcessing: post({
      bloom: { enabled: true, threshold: 0.75, intensity: 0.25 },
    }),
    studioTheme: 'default',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    builtIn: true,
    stack: [
      pass('ascii', {
        colorMode: 'monochrome',
        cellScale: 14,
        charSpacing: 1,
        contrast: 1.2,
      }),
    ],
    tone: { ...DEFAULT_TONE, contrast: 1.2 },
    ascii: { ...DEFAULT_ASCII, rampPreset: 'minimal' },
    processing: { ...DEFAULT_PROCESSING },
    postProcessing: post({
      grain: { enabled: true, intensity: 0.12, size: 2, speed: 1 },
    }),
    studioTheme: 'default',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    builtIn: true,
    stack: [
      pass('dither', {
        colorSteps: 6,
        spread: 0.6,
        matrixType: 'bayer8',
        pixelSize: 2,
        palette: 'cyberpunk',
      }),
      pass('rgbSplit', { masterAmount: 3, masterAngle: 0 }),
    ],
    tone: { ...DEFAULT_TONE, saturation: 1.3, contrast: 1.1 },
    ascii: { ...DEFAULT_ASCII, rampPreset: 'standard' },
    processing: { ...DEFAULT_PROCESSING, quantizeColors: 8 },
    postProcessing: post({
      bloom: { enabled: true, threshold: 0.6, intensity: 0.7 },
      chromatic: { enabled: true, offset: 2.5 },
      scanlines: { enabled: true, opacity: 0.1, spacing: 3 },
    }),
    studioTheme: 'coldwar',
  },
] as const;

export function getBuiltInPreset(id: string): StudioPreset | undefined {
  return BUILTIN_STUDIO_PRESETS.find((preset) => preset.id === id);
}
