import { float, mix, smoothstep, vec3 } from 'three/tsl';
import { PALETTE_OPTIONS, RETRO_PALETTES, hexToRgb, type RetroPaletteId } from '../../store/palettes';
import { sRGBToLinearChannel } from '../color/colorSpace';

function linearColor(hex: string): any {
  const [r, g, b] = hexToRgb(hex);
  return vec3(
    sRGBToLinearChannel(float(r)),
    sRGBToLinearChannel(float(g)),
    sRGBToLinearChannel(float(b))
  );
}

/**
 * Builds a piecewise-linear gradient through a palette's sRGB stops and
 * converts each stop into the Linear working space used by the pipeline.
 */
function paletteGradient(t: any, colors: string[]): any {
  if (colors.length === 0) return vec3(0.0);
  if (colors.length === 1) return linearColor(colors[0]);

  const last = colors.length - 1;
  let result: any = linearColor(colors[0]);
  for (let i = 0; i < last; i++) {
    const start = i / last;
    const end = (i + 1) / last;
    result = mix(result, linearColor(colors[i + 1]), smoothstep(start, end, t));
  }
  return result;
}

/**
 * Applies a Grainrad retro palette to an input colour using luminance as the
 * lookup coordinate. Palette index 0 (`none`) returns the original colour.
 * `paletteIdx` may be a select UniformNode or a raw option string in tests.
 */
export function buildPaletteNode(originalRgb: any, luminance: any, paletteIdx: any): any {
  let node: any = originalRgb;

  for (let i = 1; i < PALETTE_OPTIONS.length; i++) {
    const id = PALETTE_OPTIONS[i] as RetroPaletteId;
    const palette = RETRO_PALETTES[id];
    const gradient = paletteGradient(luminance, palette.colors);
    node = paletteIdx.equal(float(i)).select(gradient, node);
  }

  return node;
}
