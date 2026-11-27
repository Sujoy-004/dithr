import { Fn, float } from 'three/tsl';
import type { EffectDefinition } from '../types';
import { buildAsciiPointCloudNode } from '../../3d/AsciiPointCloud';
import { buildDepthRasterNode } from '../../3d/DepthRaster';
import { resolveSelectNode, toNode } from '../tslHelpers';

const RENDER_MODES = ['pointCloud', 'depthRaster'] as const;

/**
 * 3D ASCII Generator Effect Definition (D-15, D-16, D-18, D-19, FX-06).
 * Supports live uniform index switching for renderMode ('pointCloud' | 'depthRaster')
 * and dynamic rampLength propagation from TextureAtlas.
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
      options: [...RENDER_MODES],
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
    const atlasTexture = env?.textureAtlas ?? uniforms.atlasTexture;
    const resolution = env?.resolution ?? uniforms.resolution;
    const time = env?.time ?? uniforms.time;
    const charCount = toNode(uniforms.rampLength, 10);

    // Preserve direct string fast path for unit tests
    if (typeof rawMode === 'string') {
      if (rawMode === 'depthRaster') {
        return buildDepthRasterNode({
          pointSize: uniforms.pointSize,
          near: 0.1,
          far: 50.0,
          charCount,
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
        charCount,
        resolution,
        time,
      });
    }

    // Live UniformNode path: switch dynamically via TSL select without recompiling
    const modeIdx = resolveSelectNode(rawMode, RENDER_MODES, 0);
    const pointCloudFn = buildAsciiPointCloudNode({
      pointSize: uniforms.pointSize,
      keyLightIntensity: uniforms.keyLightIntensity,
      rimLightIntensity: uniforms.rimLightIntensity,
      depthFalloff: uniforms.depthFalloff,
      density: uniforms.density,
      atlasTexture,
      charCount,
      resolution,
      time,
    });
    const depthRasterFn = buildDepthRasterNode({
      pointSize: uniforms.pointSize,
      near: 0.1,
      far: 50.0,
      charCount,
      atlasTexture,
      resolution,
      time,
    });

    return Fn(() => {
      const pc = pointCloudFn();
      const dr = depthRasterFn();
      return modeIdx.equal(float(1.0)).select(dr, pc);
    })();
  },
};
