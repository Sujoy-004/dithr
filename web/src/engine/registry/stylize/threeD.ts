import type { EffectDefinition } from '../types';
import { buildAsciiPointCloudNode } from '../../3d/AsciiPointCloud';
import { buildDepthRasterNode } from '../../3d/DepthRaster';

/**
 * 3D ASCII Generator Effect Definition (D-15, D-16, D-18, D-19, FX-06).
 * Supports dual rendering modes:
 * - 'pointCloud': surface-sampled ASCII point cloud with key/rim lighting and glyph atlas sampling.
 * - 'depthRaster': linearized depth buffer representation mapped to ASCII luminance ramp.
 * Composites with upstream passes via linear light blend modes and pass intensity.
 */
export const threeDEffect: EffectDefinition = {
  id: 'threeD',
  label: '3D ASCII',
  category: 'stylize',
  requiresPass: true,
  costWeight: 3,
  parameters: {
    renderMode: {
      type: 'select',
      options: ['pointCloud', 'depthRaster'],
      default: 'pointCloud',
    },
    pointSize: {
      type: 'float',
      min: 4,
      max: 64,
      default: 16.0,
      step: 1.0,
      unit: 'px',
      audioModulatable: true,
    },
    density: {
      type: 'float',
      min: 0.2,
      max: 3.0,
      default: 1.0,
      step: 0.1,
      audioModulatable: true,
    },
    keyLightIntensity: {
      type: 'float',
      min: 0.0,
      max: 2.0,
      default: 1.0,
      step: 0.05,
      audioModulatable: true,
    },
    rimLightIntensity: {
      type: 'float',
      min: 0.0,
      max: 2.0,
      default: 0.8,
      step: 0.05,
      audioModulatable: true,
    },
    depthFalloff: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.5,
      step: 0.05,
      audioModulatable: true,
    },
    primitive: {
      type: 'select',
      options: ['torusKnot', 'sphere', 'cube', 'plane', 'custom'],
      default: 'torusKnot',
    },
  },
  buildNode: (_inputNode, uniforms, env) => {
    const rawMode = uniforms.renderMode;
    const isDepthRaster = rawMode === 'depthRaster' || (typeof rawMode === 'object' && rawMode?.value === 'depthRaster');

    const atlasTexture = env?.textureAtlas ?? uniforms.atlasTexture;
    const resolution = env?.resolution ?? uniforms.resolution;
    const time = env?.time ?? uniforms.time;

    if (isDepthRaster) {
      return buildDepthRasterNode({
        pointSize: uniforms.pointSize,
        near: 0.1,
        far: 50.0,
        charCount: 10,
        atlasTexture,
        resolution,
        time,
      });
    }

    return buildAsciiPointCloudNode({
      pointSize: uniforms.pointSize,
      keyLightIntensity: uniforms.keyLightIntensity,
      rimLightIntensity: uniforms.rimLightIntensity,
      depthFalloff: uniforms.depthFalloff,
      density: uniforms.density,
      atlasTexture,
      charCount: 10,
      resolution,
      time,
    });
  },
};
