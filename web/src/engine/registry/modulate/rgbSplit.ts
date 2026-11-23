import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  cos,
  sin,
} from 'three/tsl';
import type { EffectDefinition } from '../types';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

export interface RgbSplitParams {
  masterAmount?: number;
  masterAngle?: number;
  redOffsetX?: number;
  redOffsetY?: number;
  greenOffsetX?: number;
  greenOffsetY?: number;
  blueOffsetX?: number;
  blueOffsetY?: number;
}

export interface ChannelOffsets {
  red: { x: number; y: number };
  green: { x: number; y: number };
  blue: { x: number; y: number };
}

/**
 * Computes net pixel offsets per RGB channel combining master vector and individual channel offsets (D-08).
 * Master angle/amount applies symmetric chromatic displacement (Red +vector, Blue -vector).
 */
export function computeChannelOffsets(params: RgbSplitParams = {}): ChannelOffsets {
  const masterAmount = params.masterAmount ?? 0;
  const masterAngle = params.masterAngle ?? 0;
  const rad = (masterAngle * Math.PI) / 180;
  const masterVecX = Math.cos(rad) * masterAmount;
  const masterVecY = Math.sin(rad) * masterAmount;

  return {
    red: {
      x: (params.redOffsetX ?? 0) + masterVecX,
      y: (params.redOffsetY ?? 0) + masterVecY,
    },
    green: {
      x: params.greenOffsetX ?? 0,
      y: params.greenOffsetY ?? 0,
    },
    blue: {
      x: (params.blueOffsetX ?? 0) - masterVecX,
      y: (params.blueOffsetY ?? 0) - masterVecY,
    },
  };
}

/**
 * Chromatic RGB Channel Separation effect definition (D-08, FX-03).
 * Samples red, green, and blue texture taps with independent coordinate displacements in linear space.
 */
export const rgbSplitEffect: EffectDefinition = {
  id: 'rgbSplit',
  label: 'RGB Split',
  category: 'modulate',
  requiresPass: false,
  requiresSpatialSampling: true,
  costWeight: 1,
  parameters: {
    masterAmount: {
      type: 'float',
      min: 0.0,
      max: 50.0,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    masterAngle: {
      type: 'float',
      min: 0.0,
      max: 360.0,
      default: 0.0,
      step: 1.0,
      unit: 'deg',
      audioModulatable: true,
    },
    redOffsetX: {
      type: 'float',
      min: -50.0,
      max: 50.0,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    redOffsetY: {
      type: 'float',
      min: -50.0,
      max: 50.0,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    greenOffsetX: {
      type: 'float',
      min: -50.0,
      max: 50.0,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    greenOffsetY: {
      type: 'float',
      min: -50.0,
      max: 50.0,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    blueOffsetX: {
      type: 'float',
      min: -50.0,
      max: 50.0,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
    blueOffsetY: {
      type: 'float',
      min: -50.0,
      max: 50.0,
      default: 0.0,
      step: 0.5,
      unit: 'px',
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const masterAmount = toNode(uniforms.masterAmount, 0.0);
    const masterAngle = toNode(uniforms.masterAngle, 0.0);
    const redOffsetX = toNode(uniforms.redOffsetX, 0.0);
    const redOffsetY = toNode(uniforms.redOffsetY, 0.0);
    const greenOffsetX = toNode(uniforms.greenOffsetX, 0.0);
    const greenOffsetY = toNode(uniforms.greenOffsetY, 0.0);
    const blueOffsetX = toNode(uniforms.blueOffsetX, 0.0);
    const blueOffsetY = toNode(uniforms.blueOffsetY, 0.0);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st: any = uv();
      const rad: any = masterAngle.mul(float(Math.PI / 180.0));
      const masterVec: any = vec2(cos(rad), sin(rad)).mul(masterAmount);

      const netRedOffset: any = vec2(redOffsetX, redOffsetY).add(masterVec);
      const netGreenOffset: any = vec2(greenOffsetX, greenOffsetY);
      const netBlueOffset: any = vec2(blueOffsetX, blueOffsetY).sub(masterVec);

      const safeRes: any = vec2(resolution.x.max(1.0), resolution.y.max(1.0));
      const uvR: any = st.add(netRedOffset.div(safeRes)).clamp(0.0, 1.0);
      const uvG: any = st.add(netGreenOffset.div(safeRes)).clamp(0.0, 1.0);
      const uvB: any = st.add(netBlueOffset.div(safeRes)).clamp(0.0, 1.0);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const rSample: any = sampleFn(uvR);
      const gSample: any = sampleFn(uvG);
      const bSample: any = sampleFn(uvB);
      const baseCol: any = sampleFn(st);

      const finalRGB: any = vec3(rSample.r, gSample.g, bSample.b);
      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
