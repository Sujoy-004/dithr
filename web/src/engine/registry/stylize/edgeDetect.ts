import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  mix,
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
 * Modernized Edge Detection convolution filter effect definition (D-01, D-05, D-20).
 * Neon vector blueprint outlines on black space.
 * Renders the media to its bone — zero continuous video underneath.
 */
export const edgeDetectEffect: EffectDefinition = {
  id: 'edgeDetect',
  label: 'Edge Detection',
  category: 'stylize',
  requiresPass: false,
  requiresSpatialSampling: true,
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

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const resX = resolution.x.max(1.0);
      const resY = resolution.y.max(1.0);
      const dx = thickness.div(resX);
      const dy = thickness.div(resY);

      // 8 surrounding taps clamped to [0.0, 1.0] (T-261123-02)
      const uvTL = st.add(vec2(dx.negate(), dy)).clamp(0.0, 1.0);
      const uvT  = st.add(vec2(float(0.0), dy)).clamp(0.0, 1.0);
      const uvTR = st.add(vec2(dx, dy)).clamp(0.0, 1.0);
      const uvL  = st.add(vec2(dx.negate(), float(0.0))).clamp(0.0, 1.0);
      const uvR  = st.add(vec2(dx, float(0.0))).clamp(0.0, 1.0);
      const uvBL = st.add(vec2(dx.negate(), dy.negate())).clamp(0.0, 1.0);
      const uvB  = st.add(vec2(float(0.0), dy.negate())).clamp(0.0, 1.0);
      const uvBR = st.add(vec2(dx, dy.negate())).clamp(0.0, 1.0);

      const tlCol = sampleFn(uvTL);
      const tCol  = sampleFn(uvT);
      const trCol = sampleFn(uvTR);
      const lCol  = sampleFn(uvL);
      const rCol  = sampleFn(uvR);
      const blCol = sampleFn(uvBL);
      const bCol  = sampleFn(uvB);
      const brCol = sampleFn(uvBR);

      const tlLum = rec601Luminance(tlCol.rgb);
      const tLum  = rec601Luminance(tCol.rgb);
      const trLum = rec601Luminance(trCol.rgb);
      const lLum  = rec601Luminance(lCol.rgb);
      const rLum  = rec601Luminance(rCol.rgb);
      const blLum = rec601Luminance(blCol.rgb);
      const bLum  = rec601Luminance(bCol.rgb);
      const brLum = rec601Luminance(brCol.rgb);

      // Sobel horizontal gradient: gx = (tr + r*2.0 + br) - (tl + l*2.0 + bl)
      const gx = trLum.add(rLum.mul(2.0)).add(brLum).sub(tlLum.add(lLum.mul(2.0)).add(blLum));

      // Sobel vertical gradient: gy = (bl + b*2.0 + br) - (tl + t*2.0 + tr)
      const gy = blLum.add(bLum.mul(2.0)).add(brLum).sub(tlLum.add(tLum.mul(2.0)).add(trLum));

      const edge = gx.mul(gx).add(gy.mul(gy)).sqrt().mul(sensitivity);

      const bg = vec3(0.01, 0.02, 0.04);
      const neonEdge = mix(vec3(0.1, 0.85, 1.0), baseCol.rgb.mul(1.5), 0.5);
      const finalRGB = mix(bg, neonEdge, edge.clamp(0.0, 1.0));

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
