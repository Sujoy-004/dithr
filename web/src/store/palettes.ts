/**
 * Grainrad-derived retro colour palettes.
 * Colours are authored in sRGB hex and consumed by the dither/threshold
 * palette LUT and by the Studio inspector swatches.
 */

export type RetroPaletteId =
  | 'gameboy'
  | 'cga'
  | 'ega'
  | 'nes'
  | 'pico8'
  | 'c64'
  | 'appleII'
  | 'macintosh'
  | 'sepia'
  | 'cyberpunk'
  | 'newspaper'
  | 'risograph';

export interface RetroPalette {
  id: RetroPaletteId;
  label: string;
  colors: string[];
}

export const RETRO_PALETTES: Record<RetroPaletteId, RetroPalette> = {
  gameboy: {
    id: 'gameboy',
    label: 'GameBoy',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  },
  cga: {
    id: 'cga',
    label: 'CGA',
    colors: ['#000000', '#55ffff', '#ff55ff', '#ffffff'],
  },
  ega: {
    id: 'ega',
    label: 'EGA',
    colors: [
      '#000000',
      '#0000aa',
      '#00aa00',
      '#00aaaa',
      '#aa0000',
      '#aa00aa',
      '#aa5500',
      '#aaaaaa',
      '#555555',
      '#5555ff',
      '#55ff55',
      '#55ffff',
      '#ff5555',
      '#ff55ff',
      '#ffff55',
      '#ffffff',
    ],
  },
  nes: {
    id: 'nes',
    label: 'NES',
    colors: [
      '#000000',
      '#1d2b53',
      '#7e2553',
      '#008751',
      '#ab5236',
      '#5f574f',
      '#c2c3c7',
      '#fff1e8',
      '#ff004d',
      '#ffa300',
      '#ffec27',
      '#00e436',
      '#29adff',
      '#83769c',
      '#ff77a8',
      '#ffccaa',
    ],
  },
  pico8: {
    id: 'pico8',
    label: 'PICO-8',
    colors: [
      '#000000',
      '#1d2b53',
      '#7e2553',
      '#008751',
      '#ab5236',
      '#5f574f',
      '#c2c3c7',
      '#fff1e8',
      '#ff004d',
      '#ffa300',
      '#ffec27',
      '#00e436',
      '#29adff',
      '#83769c',
      '#ff77a8',
      '#ffccaa',
    ],
  },
  c64: {
    id: 'c64',
    label: 'C64',
    colors: [
      '#000000',
      '#ffffff',
      '#880000',
      '#aaffee',
      '#cc44cc',
      '#00cc55',
      '#0000aa',
      '#eeee77',
      '#dd8855',
      '#664400',
      '#ff7777',
      '#333333',
      '#777777',
      '#aaff66',
      '#0088ff',
      '#bbbbbb',
    ],
  },
  appleII: {
    id: 'appleII',
    label: 'Apple II',
    colors: [
      '#000000',
      '#ffffff',
      '#ff0000',
      '#00ff00',
      '#0000ff',
      '#ffff00',
      '#00ffff',
      '#ff00ff',
      '#ff8000',
      '#808080',
      '#800000',
      '#008000',
      '#000080',
      '#808000',
      '#008080',
      '#800080',
    ],
  },
  macintosh: {
    id: 'macintosh',
    label: 'Macintosh',
    colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'],
  },
  sepia: {
    id: 'sepia',
    label: 'Sepia',
    colors: ['#1a120b', '#3c2a21', '#6b4f34', '#8b6f47', '#d4b483', '#f0e6d2'],
  },
  cyberpunk: {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    colors: ['#0d0221', '#3a0ca3', '#ff2a6d', '#05d9e8', '#d1f7ff', '#ffb000'],
  },
  newspaper: {
    id: 'newspaper',
    label: 'Newspaper',
    colors: ['#111111', '#333333', '#777777', '#b8b0a0', '#d9d2c0', '#f5f0e1'],
  },
  risograph: {
    id: 'risograph',
    label: 'Risograph',
    colors: ['#0b0b0b', '#ff4c00', '#0078bf', '#ffd400', '#f5f0e1'],
  },
};

export const RETRO_PALETTE_LIST: readonly RetroPalette[] = Object.values(RETRO_PALETTES);

/** Palette option ids exposed to effect parameter selects (first = neutral). */
export const PALETTE_OPTIONS = ['none', ...RETRO_PALETTE_LIST.map((p) => p.id)] as const;

/** Parses `#rrggbb` into normalized [0..1] sRGB components. */
export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int)) return [0, 0, 0];
  return [
    ((int >> 16) & 0xff) / 255,
    ((int >> 8) & 0xff) / 255,
    (int & 0xff) / 255,
  ];
}
