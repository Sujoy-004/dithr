import {
  Fn,
  uv,
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
 * Phosphor green falling digital code streams composited over source footage with sourceBlend.
 */
export const matrixEffect: EffectDefinition = {
  id: 'matrix',
  label: 'Matrix Digital Rain',
  category: 'stylize',
  requiresPass: false,
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
    sourceBlend: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.5,
      step: 0.05,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const speed = toNode(uniforms.speed, 1.0);
    const dropLength = toNode(uniforms.dropLength, 5.0);
    const density = toNode(uniforms.density, 40.0);
    const sourceBlend = toNode(uniforms.sourceBlend, 0.5).clamp(0.0, 1.0);
    const time = env?.time ?? uniforms.time ?? float(0.0);
    const seed = env?.seed ?? uniforms.seed ?? float(12.9898);

    return Fn(() => {
      const st = uv();
      const colCount = density.max(10.0);
      const colIdx = floor(st.x.mul(colCount));

      // Deterministic column pseudorandom offset based on injected seed
      const colRand = fract(sin(colIdx.mul(seed)).mul(43758.5453));
      const effectiveSpeed = speed.mul(colRand.mul(0.5).add(0.75));

      const streamY = fract(st.y.add(time.mul(effectiveSpeed)).add(colRand));
      const trail = fract(streamY.mul(dropLength));
      const intensity = trail.pow(3.0);

      const baseCol = inputNode;
      const rgb = baseCol.rgb;
      const lum = rec601Luminance(rgb);

      const greenTail = vec3(0.0, 1.0, 0.4).mul(intensity).mul(lum.add(0.2));
      const whiteHead = vec3(0.8, 1.0, 0.8).mul(intensity.pow(4.0));
      const matrixColor = greenTail.add(whiteHead);

      // Composite over preserved source video / photo footage
      const sourcePreserved = rgb.mul(sourceBlend);
      const finalRGB = clamp(sourcePreserved.add(matrixColor), 0.0, 1.0);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
