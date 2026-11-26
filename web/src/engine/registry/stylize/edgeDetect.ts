import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
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
 * Edge Detection convolution filter effect definition (D-01, D-05, D-20).
 * Detects structural luminance discontinuities via Sobel/finite-difference gradient.
 */
export const edgeDetectEffect: EffectDefinition = {
  id: 'edgeDetect',
  label: 'Edge Detection',
  category: 'stylize',
  requiresPass: false,
  costWeight: 2,
  parameters: {
    sensitivity: {
      type: 'float',
      min: 0.5,
      max: 10.0,
      default: 3.0,
      step: 0.1,
      audioModulatable: true,
    },
    thickness: {
      type: 'float',
      min: 1.0,
      max: 5.0,
      default: 1.0,
      step: 0.5,
      unit: 'px',
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const sensitivity = toNode(uniforms.sensitivity, 3.0);
    const thickness = toNode(uniforms.thickness, 1.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const baseCol = inputNode;
      const baseLum = rec601Luminance(baseCol.rgb);

      if (typeof env?.sampleAt === 'function') {
        const dX = vec2(thickness.div(resolution.x), 0.0);
        const dY = vec2(0.0, thickness.div(resolution.y));

        const rightCol = env.sampleAt(st.add(dX));
        const leftCol = env.sampleAt(st.sub(dX));
        const upCol = env.sampleAt(st.add(dY));
        const downCol = env.sampleAt(st.sub(dY));

        const rightLum = rec601Luminance(rightCol.rgb);
        const leftLum = rec601Luminance(leftCol.rgb);
        const upLum = rec601Luminance(upCol.rgb);
        const downLum = rec601Luminance(downCol.rgb);

        const gradX = rightLum.sub(leftLum);
        const gradY = upLum.sub(downLum);
        const mag = gradX.mul(gradX).add(gradY.mul(gradY)).sqrt().mul(sensitivity).clamp(0.0, 1.0);

        return vec4(vec3(mag), baseCol.a ?? float(1.0));
      }

      // Pointwise derivative approximation fallback
      const edge = baseLum.mul(sensitivity).fract();
      return vec4(vec3(edge), baseCol.a ?? float(1.0));
    })();
  },
};
