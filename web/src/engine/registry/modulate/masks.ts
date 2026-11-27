import {
  Fn,
  uv,
  vec2,
  vec4,
  float,
  smoothstep,
  abs,
  max,
  min,
  mix,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { toNode, resolveSelectNode } from '../tslHelpers';

const MASK_SHAPES = ['vignette', 'box', 'circle'] as const;

export interface MaskParams {
  shape?: 'vignette' | 'box' | 'circle';
  centerX?: number;
  centerY?: number;
  width?: number;
  height?: number;
  radius?: number;
  feather?: number;
  invert?: boolean;
  strength?: number;
}

function smoothstepJs(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Pure TypeScript helper to evaluate mask values at normalized coordinates [0, 1] (D-07).
 */
export function computeMaskValue(x: number, y: number, params: MaskParams = {}): number {
  const shape = params.shape ?? 'vignette';
  const centerX = params.centerX ?? 0.5;
  const centerY = params.centerY ?? 0.5;
  const width = params.width ?? 0.8;
  const height = params.height ?? 0.8;
  const radius = params.radius ?? 0.4;
  const feather = Math.max(0.001, params.feather ?? 0.2);
  const invert = params.invert ?? false;
  const strength = params.strength ?? 1.0;

  let rawMask = 0;
  if (shape === 'box') {
    const halfW = width * 0.5;
    const halfH = height * 0.5;
    const dx = Math.abs(x - centerX) - halfW;
    const dy = Math.abs(y - centerY) - halfH;
    const dist = Math.max(dx, dy);
    const inner = -feather * 0.5;
    const outer = feather * 0.5;
    rawMask = smoothstepJs(outer, inner, dist);
  } else {
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inner = Math.max(0, radius - feather * 0.5);
    const outer = radius + feather * 0.5;
    rawMask = smoothstepJs(outer, inner, dist);
  }

  const effMask = invert ? 1.0 - rawMask : rawMask;
  return 1.0 * (1.0 - strength) + effMask * strength;
}

/**
 * Procedural Spatial Masks effect definition (D-07, FX-03).
 * Aspect-corrected circle & vignette SDFs when resolution is provided, plus box SDF.
 */
export const masksEffect: EffectDefinition = {
  id: 'masks',
  label: 'Spatial Masks',
  category: 'modulate',
  requiresPass: false,
  costWeight: 1,
  parameters: {
    shape: {
      type: 'select',
      default: 'vignette',
      options: [...MASK_SHAPES],
    },
    centerX: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.5,
      step: 0.01,
      audioModulatable: true,
    },
    centerY: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.5,
      step: 0.01,
      audioModulatable: true,
    },
    width: {
      type: 'float',
      min: 0.05,
      max: 1.0,
      default: 0.8,
      step: 0.01,
      audioModulatable: true,
    },
    height: {
      type: 'float',
      min: 0.05,
      max: 1.0,
      default: 0.8,
      step: 0.01,
      audioModulatable: true,
    },
    radius: {
      type: 'float',
      min: 0.05,
      max: 1.0,
      default: 0.4,
      step: 0.01,
      audioModulatable: true,
    },
    feather: {
      type: 'float',
      min: 0.01,
      max: 1.0,
      default: 0.2,
      step: 0.01,
      audioModulatable: true,
    },
    invert: {
      type: 'boolean',
      default: false,
    },
    strength: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 1.0,
      step: 0.01,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const shapeIdx = resolveSelectNode(uniforms.shape, MASK_SHAPES, 0);
    const centerX = toNode(uniforms.centerX, 0.5);
    const centerY = toNode(uniforms.centerY, 0.5);
    const width = toNode(uniforms.width, 0.8);
    const height = toNode(uniforms.height, 0.8);
    const radius = toNode(uniforms.radius, 0.4);
    const feather = toNode(uniforms.feather, 0.2);
    const invert = toNode(uniforms.invert, 0.0);
    const strength = toNode(uniforms.strength, 1.0);
    const resolution = env?.resolution ?? uniforms.resolution;

    return Fn(() => {
      const st: any = uv();
      const center: any = vec2(centerX, centerY);
      const rawDelta: any = st.sub(center);

      // Aspect-correct circular/vignette distance when resolution is available
      const radialDelta: any = resolution
        ? rawDelta.mul(resolution).div(min(resolution.x, resolution.y).max(1.0))
        : rawDelta;

      // Circle SDF
      const circleDist: any = radialDelta.length();
      const circleInner: any = radius.sub(feather.mul(0.5)).max(0.0);
      const circleOuter: any = radius.add(feather.mul(0.5));
      const circleMask: any = smoothstep(circleOuter, circleInner, circleDist);

      // Box SDF
      const halfSize: any = vec2(width, height).mul(0.5);
      const boxD: any = abs(rawDelta).sub(halfSize);
      const boxDist: any = max(boxD.x, boxD.y);
      const boxInner: any = feather.mul(-0.5);
      const boxOuter: any = feather.mul(0.5);
      const boxMask: any = smoothstep(boxOuter, boxInner, boxDist);

      // Vignette SDF (gentle radial falloff)
      const vigDist: any = radialDelta.length();
      const vigInner: any = radius.sub(feather.mul(0.5)).max(0.0);
      const vigOuter: any = radius.add(feather.mul(0.5));
      const vigMask: any = smoothstep(vigOuter, vigInner, vigDist);

      const rawMask: any = shapeIdx
        .equal(float(1.0))
        .select(boxMask, shapeIdx.equal(float(2.0)).select(circleMask, vigMask));

      const effMask: any = mix(rawMask, float(1.0).sub(rawMask), invert);
      const finalMask: any = mix(float(1.0), effMask, strength);

      const baseCol: any = inputNode;
      const finalRGB: any = baseCol.rgb.mul(finalMask);

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
