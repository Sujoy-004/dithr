/**
 * Character ramp presets and Rec. 601 perceptual luminance weights.
 * The ten Grainrad-derived sets are ordered from darkest (lowest luminance)
 * to brightest so the GPU atlas lookup stays 1:1 with the shader ramp index.
 */
import type { RampPreset } from '../types/studio';

export const DEFAULT_CHARS = ' .:-=+*#%@';

export const CHAR_PRESETS: Record<RampPreset, string> = {
  standard: DEFAULT_CHARS,
  // Filled block elements for high-contrast monochrome rendering.
  blocks: ' \u2591\u2592\u2593\u2588',
  // Binary: two ink levels only.
  binary: ' 01',
  // Dense: many grayscale ramps, subtle midtone steps (classic 70-step).
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  // Minimal: four coarse but instantly readable steps.
  minimal: ' .:#',
  // Alphabetic: letters ordered by approximate ink coverage.
  alphabetic: ' .icotCOXWM',
  // Numeric: digits ordered by stroke density.
  numeric: ' 1234567890',
  // Math: mathematical operators and relation symbols.
  math: ' .-+\u00d7\u00f7=\u2260<>\u2264\u2265\u221e\u2211\u220f\u221a\u222b',
  // Symbols: geometric bullets, circles, and half-filled discs.
  symbols: ' \u00b7\u2022\u25cb\u25ce\u25cf\u25d0\u25d1\u25d2\u25d3\u25d4\u25d5\u25d6\u25d7',
  // Custom resolves through AsciiSettings.customChars; standard is the fallback.
  custom: DEFAULT_CHARS,
};

export interface CharPresetMeta {
  id: RampPreset;
  label: string;
  sample: string;
}

/** UI metadata for the 10 Grainrad character sets. */
export const CHAR_PRESET_LIST: readonly CharPresetMeta[] = [
  { id: 'standard', label: 'STANDARD', sample: CHAR_PRESETS.standard },
  { id: 'blocks', label: 'BLOCKS', sample: CHAR_PRESETS.blocks },
  { id: 'binary', label: 'BINARY', sample: CHAR_PRESETS.binary },
  { id: 'detailed', label: 'DETAILED', sample: CHAR_PRESETS.detailed.slice(0, 12) },
  { id: 'minimal', label: 'MINIMAL', sample: CHAR_PRESETS.minimal },
  { id: 'alphabetic', label: 'ALPHABETIC', sample: CHAR_PRESETS.alphabetic },
  { id: 'numeric', label: 'NUMERIC', sample: CHAR_PRESETS.numeric },
  { id: 'math', label: 'MATH', sample: CHAR_PRESETS.math },
  { id: 'symbols', label: 'SYMBOLS', sample: CHAR_PRESETS.symbols },
  { id: 'custom', label: 'CUSTOM', sample: 'abc' },
] as const;

/** Resolves a preset id (or custom override) to the concrete glyph ramp. */
export function resolveChars(preset: RampPreset, customChars?: string): string {
  if (customChars && customChars.length > 0) return customChars;
  const chars = CHAR_PRESETS[preset];
  return chars && chars.length > 0 ? chars : DEFAULT_CHARS;
}

/** Rec. 601 perceptual luminance weights (src/renderer.py:49-51). */
export const REC601_WEIGHTS = {
  r: 0.299,
  g: 0.587,
  b: 0.114,
} as const;

/** Aspect ratio of monospace characters (width / height, default 0.5). */
export const DEFAULT_CHAR_ASPECT = 0.5;
