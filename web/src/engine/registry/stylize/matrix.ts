import {
  Fn,
  uv,
  texture,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  pow,
  clamp,
  float,
  mix,
  fwidth,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { hash12Node, rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, sampleWithEnv } from '../tslHelpers';

/**
 * Matrix Digital Rain effect definition (D-01, D-20, D-27).
 * Aspect-corrected monospace cells, TextureAtlas glyph sampling,
 * falling phosphor rain trails + glowing white-green heads modulated by subject luminance.
 */
export const matrixEffect: EffectDefinition = {
  id: 'matrix',
  label: 'Matrix Digital Rain',
  category: 'stylize',
  requiresPass: false,
  spatial: true,
  costWeight: 2,
  parameters: {
    speed: {
      type: 'float',
      min: 0.1,
      max: 5.0,
      default: 1.0,
      step: 0.1,
      audioModulatable: true,
    },
    dropLength: {
      type: 'float',
      min: 1.0,
      max: 20.0,
      default: 8.0,
      step: 0.5,
      audioModulatable: true,
    },
    density: {
      type: 'float',
      min: 10.0,
      max: 120.0,
      default: 60.0,
      step: 2.0,
      audioModulatable: true,
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
    const speed = toNode(uniforms.speed, 1.0);
    const dropLength = toNode(uniforms.dropLength, 8.0);
    const density = toNode(uniforms.density, 60.0);
    const rampLength = toNode(uniforms.rampLength, 10);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(12.9898);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);
    const atlasTex = env?.textureAtlas ?? uniforms.atlasTexture;
    const atlasPad = env?.atlasPadding ?? vec2(0.06, 0.06);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const pixelCoord = st.mul(safeRes);

      const cellW = safeRes.x.div(density.max(10.0)).max(4.0);
      const cellH = cellW.mul(1.45).max(6.0);
      const cellSize = vec2(cellW, cellH);

      const cellIdx = floor(pixelCoord.div(cellSize));
      const cellUV = fract(pixelCoord.div(cellSize));
      const cellCenterUV = cellIdx.add(0.5).mul(cellSize).div(safeRes).clamp(0.001, 0.999);

      const baseCol = sampleWithEnv(inputNode, env, cellCenterUV);
      const lum = rec601PerceptualLuminance(baseCol.rgb);

      // Column speed & phase via precision-safe Dave Hoskins hash
      const colRand = hash12Node(vec2(cellIdx.x, seed));
      const effSpeed = speed.mul(colRand.mul(0.65).add(0.65));

      const rowNorm = cellIdx.y.div(24.0);
      const stream = fract(rowNorm.add(time.mul(effSpeed)).add(colRand.mul(7.0)));
      const trail = pow(float(1.0).sub(stream), dropLength.mul(0.35).max(0.5));
      const head = smoothstep(0.08, 0.0, stream);

      // Flickering glyph index per cell (skip index 0 space so rain glyphs stay visible)
      const flickerTime = floor(time.mul(6.0).add(hash12Node(cellIdx).mul(17.0)));
      const glyphRand = hash12Node(cellIdx.add(vec2(flickerTime, flickerTime.mul(0.37))));
      const nonEmptyMax = rampLength.sub(1.0).max(1.0);
      const charIdx = floor(glyphRand.mul(nonEmptyMax).add(1.0)).clamp(0.0, rampLength.sub(1.0).max(0.0));

      let glyphMask: any = float(0.85);
      if (atlasTex) {
        const padVec: any = atlasPad;
        const innerX: any = mix(padVec.x, float(1.0).sub(padVec.x), cellUV.x);
        const innerY: any = mix(padVec.y, float(1.0).sub(padVec.y), cellUV.y);
        const atlasU: any = charIdx.add(innerX).div(rampLength);
        const atlasUV = vec2(atlasU, innerY);
        const rawAlpha = texture(atlasTex, atlasUV).r;
        const aaWidth = fwidth(rawAlpha).clamp(0.06, 0.22);
        glyphMask = smoothstep(float(0.45).sub(aaWidth), float(0.45).add(aaWidth), rawAlpha);
      }

      const phosphorGreen = vec3(0.04, 0.95, 0.32).mul(lum.mul(0.8).add(trail.mul(0.45)));
      const headGlow = vec3(0.76, 1.0, 0.84).mul(head).mul(lum.mul(0.6).add(0.4));
      const bgCol = vec3(0.002, 0.004, 0.0025);
      const matrixColor = mix(bgCol, phosphorGreen.add(headGlow), glyphMask);

      return vec4(clamp(matrixColor, 0.0, 1.0), baseCol.a ?? float(1.0));
    })();
  },
};
