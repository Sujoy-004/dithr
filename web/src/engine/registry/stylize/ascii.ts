import {
  Fn,
  uv,
  texture,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  clamp,
  float,
  mix,
  fwidth,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, resolveSelectNode, sampleWithEnv } from '../tslHelpers';

const COLOR_MODES = ['truecolor', 'monochrome', 'green', 'amber'] as const;

/**
 * ASCII Art effect definition (D-01, D-05, D-20, FX-01).
 * 4-tap cell box supersampling via env.sampleAt, perceptual Rec. 601 luminance,
 * padded LinearFilter glyph atlas lookup with fwidth() anti-aliased edge crispness.
 */
export const asciiEffect: EffectDefinition = {
  id: 'ascii',
  label: 'ASCII Art',
  category: 'stylize',
  requiresPass: false,
  spatial: true,
  costWeight: 1,
  parameters: {
    cellScale: {
      type: 'float',
      min: 4,
      max: 32,
      default: 10.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    charSpacing: {
      type: 'float',
      min: 0,
      max: 8,
      default: 1.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    charAspect: {
      type: 'float',
      min: 0.25,
      max: 1.0,
      default: 0.55,
      step: 0.05,
    },
    contrast: {
      type: 'float',
      min: 0.5,
      max: 2.5,
      default: 1.15,
      step: 0.05,
      audioModulatable: true,
    },
    colorMode: {
      type: 'select',
      default: 'truecolor',
      options: [...COLOR_MODES],
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
    const cellScale = toNode(uniforms.cellScale, 10.0);
    const charSpacing = toNode(uniforms.charSpacing, 1.0);
    const charAspect = toNode(uniforms.charAspect, 0.55);
    const contrast = toNode(uniforms.contrast, 1.15);
    const colorModeIdx = resolveSelectNode(uniforms.colorMode, COLOR_MODES, 0);
    const rampLength = toNode(uniforms.rampLength, 10);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);
    const atlasTex = env?.textureAtlas ?? uniforms.atlasTexture;
    const atlasPad = env?.atlasPadding ?? vec2(0.06, 0.06);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pixelCoord = st.mul(safeRes);

      const cellW = cellScale.mul(charAspect).max(4.0);
      const cellH = cellScale.max(4.0);
      const cellSize = vec2(cellW, cellH);

      const cellIndex = floor(pixelCoord.div(cellSize));

      // 4-tap box supersampling across cell quadrants for clean anti-aliased luma & color
      const uv0 = cellIndex.add(vec2(0.25, 0.25)).mul(cellSize).div(safeRes).clamp(0.001, 0.999);
      const uv1 = cellIndex.add(vec2(0.75, 0.25)).mul(cellSize).div(safeRes).clamp(0.001, 0.999);
      const uv2 = cellIndex.add(vec2(0.25, 0.75)).mul(cellSize).div(safeRes).clamp(0.001, 0.999);
      const uv3 = cellIndex.add(vec2(0.75, 0.75)).mul(cellSize).div(safeRes).clamp(0.001, 0.999);

      const s0 = sampleWithEnv(inputNode, env, uv0);
      const s1 = sampleWithEnv(inputNode, env, uv1);
      const s2 = sampleWithEnv(inputNode, env, uv2);
      const s3 = sampleWithEnv(inputNode, env, uv3);

      const avgRgb = s0.rgb.add(s1.rgb).add(s2.rgb).add(s3.rgb).mul(0.25);

      // Perceptual Rec. 601 luminance with contrast shaping & dark noise floor
      const rawLum = rec601PerceptualLuminance(avgRgb);
      const lum = rawLum.sub(0.5).mul(contrast).add(0.5).clamp(0.0, 1.0);

      const maxIdx = rampLength.sub(1.0).max(0.0);
      const computedIdx = floor(lum.mul(maxIdx.add(0.999))).clamp(0.0, maxIdx);
      const charIdx = lum.lessThan(0.03).select(float(0.0), computedIdx);

      const cellUV = fract(pixelCoord.div(cellSize));
      const padNorm = charSpacing.div(cellSize).min(0.42);
      const span = vec2(1.0).sub(padNorm.mul(2.0)).max(0.05);
      const boxUV = cellUV.sub(padNorm).div(span);

      const inBox = boxUV.x
        .greaterThanEqual(0.0)
        .and(boxUV.x.lessThanEqual(1.0))
        .and(boxUV.y.greaterThanEqual(0.0))
        .and(boxUV.y.lessThanEqual(1.0));

      // Clamp strictly inside padded glyph slot to eliminate LinearFilter neighbor bleed
      const clampedBox: any = clamp(boxUV, 0.0, 1.0);
      const padVec: any = atlasPad;
      const innerX: any = mix(padVec.x, float(1.0).sub(padVec.x), clampedBox.x);
      const innerY: any = mix(padVec.y, float(1.0).sub(padVec.y), clampedBox.y);
      const innerUV: any = vec2(innerX, innerY);

      // Foreground palette per colorMode ('truecolor' | 'monochrome' | 'green' | 'amber')
      const fgMono = vec3(0.84, 0.86, 0.90).mul(lum.max(0.12));
      const fgGreen = vec3(0.04, 0.95, 0.28).mul(lum.max(0.15));
      const fgAmber = vec3(0.98, 0.56, 0.04).mul(lum.max(0.15));

      const fgColor = colorModeIdx
        .equal(float(1.0))
        .select(
          fgMono,
          colorModeIdx
            .equal(float(2.0))
            .select(fgGreen, colorModeIdx.equal(float(3.0)).select(fgAmber, avgRgb))
        );

      const bgColor = vec3(0.002, 0.0024, 0.003); // linear #060709

      if (atlasTex) {
        const atlasUV = vec2(charIdx.add(innerUV.x).div(rampLength), innerUV.y);
        const rawAlpha = texture(atlasTex, atlasUV).r;
        const aaWidth = fwidth(rawAlpha).clamp(0.06, 0.22);
        const glyphMask = smoothstep(
          float(0.48).sub(aaWidth),
          float(0.48).add(aaWidth),
          rawAlpha
        ).mul(inBox.select(float(1.0), float(0.0)));
        const finalRGB = mix(bgColor, fgColor, glyphMask);
        return vec4(finalRGB, s0.a ?? float(1.0));
      }

      // Fallback when no atlas texture is attached (headless unit tests)
      return vec4(mix(bgColor, fgColor, lum), s0.a ?? float(1.0));
    })();
  },
};
