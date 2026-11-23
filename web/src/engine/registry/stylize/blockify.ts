import {
  Fn,
  uv,
  vec4,
  floor,
  fract,
  float,
  vec2,
} from 'three/tsl';
import type { EffectDefinition } from '../types';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * Blockify (Mosaic / Pixelation) effect definition (D-01, D-20).
 * Quantizes UVs into square pixel blocks with configurable grid lines.
 */
export const blockifyEffect: EffectDefinition = {
  id: 'blockify',
  label: 'Blockify (Mosaic)',
  category: 'stylize',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    blockSize: {
      type: 'float',
      min: 2.0,
      max: 64.0,
      default: 8.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    gridLine: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.0,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const blockSize = toNode(uniforms.blockSize, 8.0);
    const gridLine = toNode(uniforms.gridLine, 0.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const pixelCoord = st.mul(safeRes);
      const b = blockSize.max(2.0);
      const cellCoord = floor(pixelCoord.div(b));
      const cellCenterPx = cellCoord.mul(b).add(b.mul(0.5));
      const cellCenterUV = cellCenterPx.div(safeRes).clamp(0.0, 1.0);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const baseCol = sampleFn(cellCenterUV);

      const cellFrac = fract(pixelCoord.div(b));
      const borderX = cellFrac.x.lessThan(b.reciprocal()).or(cellFrac.x.greaterThan(float(1.0).sub(b.reciprocal())));
      const borderY = cellFrac.y.lessThan(b.reciprocal()).or(cellFrac.y.greaterThan(float(1.0).sub(b.reciprocal())));
      const isBorder = borderX.or(borderY);
      const gridDim = float(1.0).sub(gridLine.mul(0.5));
      const finalRGB = isBorder.select(baseCol.rgb.mul(gridDim), baseCol.rgb);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
