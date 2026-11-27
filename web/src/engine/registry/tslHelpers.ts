import { float } from 'three/tsl';
import type { EffectEnvironment } from './types';

/**
 * Normalizes JS primitives or undefined values into TSL float nodes while passing
 * existing TSL nodes through untouched.
 */
export function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

/**
 * Resolves a 'select' parameter to a numeric TSL node index.
 * Handles both raw JS option strings (unit tests) and numeric UniformNodes (GraphCompiler).
 */
export function resolveSelectNode(
  val: any,
  options: readonly string[],
  fallbackIdx = 0
): any {
  if (typeof val === 'string') {
    const idx = options.indexOf(val);
    return float(idx >= 0 ? idx : fallbackIdx);
  }
  if (val && typeof val === 'object' && 'value' in val && typeof val.value === 'string') {
    const idx = options.indexOf(val.value);
    return float(idx >= 0 ? idx : fallbackIdx);
  }
  return toNode(val, fallbackIdx);
}

/**
 * Samples upstream color at an arbitrary normalized UV coordinate using env.sampleAt
 * when available, falling back gracefully for function or mock vec4 test inputs.
 */
export function sampleWithEnv(
  inputNode: any,
  env: EffectEnvironment | undefined,
  uvCoord: any
): any {
  if (typeof env?.sampleAt === 'function') {
    return env.sampleAt(uvCoord);
  }
  if (typeof inputNode === 'function') {
    return inputNode(uvCoord);
  }
  return inputNode;
}
