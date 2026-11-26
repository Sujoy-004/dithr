import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  floor,
  fract,
  sin,
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
 * Modernized Matrix Digital Rain effect definition (D-01, D-20, D-27).
 * Phosphor green falling digital code streams constructing the media on terminal black void.
 * Renders the media to its bone — zero continuous video underneath.
 */
export const matrixEffect: EffectDefinition = {
  id: 'matrix',
  label: 'Matrix Digital Rain',
  category: 'stylize',
  requiresPass: false,
  requiresSpatialSampling: true,
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
      default: 5.0,
      step: 0.5,
      audioModulatable: true,
    },
    density: {
      type: 'float',
      min: 10.0,
      max: 100.0,
      default: 40.0,
      step: 2.0,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const speed = toNode(uniforms.speed, 1.0);
    const dropLength = toNode(uniforms.dropLength, 5.0);
    const density = toNode(uniforms.density, 40.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(12.9898);

    return Fn(() => {
      const st = uv();
      const colCount = density.max(10.0);
      const colIdx = floor(st.x.mul(colCount));
      const rowIdx = floor(st.y.mul(colCount.mul(1.8)));

      const cellCenterUV: any = vec2(
        colIdx.add(0.5).div(colCount) as any,
        rowIdx.add(0.5).div(colCount.mul(1.8)) as any
      );
      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };
      const cellCol = sampleFn(cellCenterUV);
      const cellLum = rec601Luminance(cellCol.rgb);

      // Falling rain stream
      const colRand = fract(sin(colIdx.mul(seed)).mul(43758.5453));
      const effectiveSpeed = speed.mul(colRand.mul(0.5).add(0.75));
      const streamY = fract(st.y.add(time.mul(effectiveSpeed)).add(colRand));
      const trail = fract(streamY.mul(dropLength));
      const streamIntensity = trail.pow(3.0);

      // Green phosphor tail and white glowing head powered by video luminance
      const greenTail = vec3(0.08, 1.0, 0.35).mul(streamIntensity).mul(cellLum.mul(2.2).add(0.08));
      const whiteHead = vec3(0.9, 1.0, 0.9).mul(streamIntensity.pow(4.0)).mul(cellLum.mul(2.5));
      const matrixColor = greenTail.add(whiteHead);

      const finalRGB = clamp(matrixColor, 0.0, 1.0);
      return vec4(finalRGB, cellCol.a ?? float(1.0));
    })();
  },
};
