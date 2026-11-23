import {
  Fn,
  uv,
  texture,
  vec2,
  vec4,
  floor,
  fract,
  clamp,
  float,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601Luminance } from '../../color/luminance';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * ASCII Art effect definition (D-01, D-05, D-20, FX-01).
 * Quantizes UVs into monospace cell blocks, extracts perceived luminance via Rec. 601,
 * and samples character glyphs from the horizontal texture atlas strip.
 */
export const asciiEffect: EffectDefinition = {
  id: 'ascii',
  label: 'ASCII Art',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    cellScale: {
      type: 'float',
      min: 4,
      max: 32,
      default: 12.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    charSpacing: {
      type: 'float',
      min: 0,
      max: 8,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    charAspect: {
      type: 'float',
      min: 0.25,
      max: 1.0,
      default: 0.5,
      step: 0.05,
    },
    rampLength: {
      type: 'int',
      min: 2,
      max: 64,
      default: 10,
      step: 1,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const cellScale = toNode(uniforms.cellScale, 12.0);
    const charSpacing = toNode(uniforms.charSpacing, 0.0);
    const charAspect = toNode(uniforms.charAspect, 0.5);
    const rampLength = toNode(uniforms.rampLength, 10);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);
    const atlasTex = env?.textureAtlas ?? uniforms.atlasTexture;

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const pixelCoord = st.mul(safeRes);

      const cellW = cellScale.mul(charAspect).max(1.0);
      const cellH = cellScale.max(1.0);
      const cellSize = vec2(cellW, cellH);

      const cellIndex = floor(pixelCoord.div(cellSize));
      const cellCenterPx = cellIndex.mul(cellSize).add(cellSize.mul(0.5));
      const cellCenterUV = cellCenterPx.div(safeRes).clamp(0.0, 1.0);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const sampledColor = sampleFn(cellCenterUV);
      const rgb = sampledColor.rgb;

      // Rec. 601 perceived luminance (0.299*R + 0.587*G + 0.114*B) - matches src/renderer.py
      const lum = rec601Luminance(rgb);

      const maxIdx = rampLength.sub(1.0).max(0.0);
      const charIdx = floor(lum.mul(maxIdx.add(0.999))).clamp(0.0, maxIdx);

      const cellUV = fract(pixelCoord.div(cellSize));
      const padNorm = charSpacing.div(cellSize).min(0.45);
      const innerUV = clamp(
        cellUV.sub(padNorm).div(vec2(1.0).sub(padNorm.mul(2.0))),
        0.0,
        1.0
      );

      if (atlasTex) {
        const atlasUV = vec2(charIdx.add(innerUV.x).div(rampLength), innerUV.y);
        const glyphMask = texture(atlasTex, atlasUV).r;
        const finalRGB = rgb.mul(glyphMask);
        return vec4(finalRGB, sampledColor.a ?? float(1.0));
      }

      // Fallback when no atlas texture is attached (e.g. headless unit tests)
      return vec4(rgb.mul(lum), sampledColor.a ?? float(1.0));
    })();
  },
};
