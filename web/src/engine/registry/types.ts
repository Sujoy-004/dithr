/**
 * Typed EffectDefinition registry contracts (D-01, D-03, D-20, FX-01).
 * Single source of truth for UI inspector, pipeline compilation, and shader presets.
 */

export type ParameterType = 'float' | 'int' | 'boolean' | 'select';

export interface ParameterSchema {
  type: ParameterType;
  min?: number;
  max?: number;
  default: number | boolean | string;
  step?: number;
  unit?: string;
  options?: string[];
  audioModulatable?: boolean;
}

export type EffectCategory = 'stylize' | 'modulate';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'add';

export interface EffectEnvironment {
  resolution?: any;     // vec2 TSL uniform
  time?: any;           // float TSL uniform (injected per D-27)
  seed?: any;           // float TSL uniform (injected per D-27)
  textureAtlas?: any;   // Texture or texture node for glyph sampling
  sampleAt?: (uvCoord: any) => any; // Arbitrary UV coordinate sampler
  [key: string]: any;
}

export interface EffectDefinition {
  id: string;
  label: string;
  category: EffectCategory;
  parameters: Record<string, ParameterSchema>;
  requiresPass: boolean;
  costWeight: number; // 1 for pointwise, 2 for spatial/convolution, 3 for temporal/heavy
  buildNode: (inputNode: any, uniforms: Record<string, any>, env?: EffectEnvironment) => any;
}

export interface ActiveEffectPass {
  instanceId: string;
  effectId: string;
  enabled: boolean;
  intensity: number; // [0, 1]
  blendMode: BlendMode;
  parameters: Record<string, number | boolean | string>;
}
