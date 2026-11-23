import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
  validateGLBHeader,
  normalizeMeshBounds,
  MAX_GLB_FILE_SIZE,
  GLB_MAGIC_LITTLE_ENDIAN,
} from '../services/meshLoader';
import { createPrimitive } from '../engine/3d/PrimitiveFactory';
import { OrbitController } from '../engine/3d/OrbitController';
import { threeDEffect } from '../engine/registry/stylize/threeD';
import {
  createAsciiPointCloudMaterial,
  buildAsciiPointCloudNode,
} from '../engine/3d/AsciiPointCloud';
import {
  linearizeDepth,
  createDepthRasterMaterial,
  buildDepthRasterNode,
} from '../engine/3d/DepthRaster';
import { compileLinearEffectStack, EffectRegistry } from '../engine/registry/index';
import type { ActiveEffectPass } from '../engine/registry/types';
import { vec4, uniform, vec2 } from 'three/tsl';

describe('3D Mesh Ingestion & Security Validation (D-15, T-02-11, T-02-12)', () => {
  it('rejects files exceeding the 50MB ceiling', async () => {
    // Mock a file larger than 50MB
    const oversizedFile = {
      size: MAX_GLB_FILE_SIZE + 1024,
      slice: vi.fn(),
    } as unknown as File;

    await expect(validateGLBHeader(oversizedFile)).rejects.toThrow(
      'File exceeds 50MB limit.'
    );
  });

  it('rejects files with invalid binary magic headers', async () => {
    // 4 bytes of invalid magic (e.g. 0x00000000 or ASCII 'RIFF')
    const buffer = new Uint8Array([0x52, 0x49, 0x46, 0x46]).buffer; // 'RIFF'
    const invalidFile = {
      size: 1024,
      slice: () => ({
        arrayBuffer: async () => buffer,
      }),
    } as unknown as File;

    await expect(validateGLBHeader(invalidFile)).rejects.toThrow(
      'Invalid GLB binary header. Expected glTF container.'
    );
  });

  it('accepts files with valid glTF binary magic bytes (0x46546C67)', async () => {
    // 4 bytes: 'g', 'l', 'T', 'F' (0x67, 0x6C, 0x54, 0x46)
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, GLB_MAGIC_LITTLE_ENDIAN, true);

    const validFile = {
      size: 2048,
      slice: () => ({
        arrayBuffer: async () => buffer,
      }),
    } as unknown as File;

    await expect(validateGLBHeader(validFile)).resolves.toBeUndefined();
  });

  it('normalizes mesh bounding boxes to fit within unit bounds [-1.5, 1.5]', () => {
    // Create an off-center large mesh (10x20x30 centered at 50, 100, 150)
    const geometry = new THREE.BoxGeometry(10, 20, 30);
    const mesh = new THREE.Mesh(geometry);
    mesh.position.set(50, 100, 150);

    const group = new THREE.Group();
    group.add(mesh);

    const normalized = normalizeMeshBounds(group);
    normalized.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(normalized);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Center must be at (0, 0, 0) within precision
    expect(center.x).toBeCloseTo(0, 3);
    expect(center.y).toBeCloseTo(0, 3);
    expect(center.z).toBeCloseTo(0, 3);

    // Max dimension must be <= 3.0 (i.e. bounds in [-1.5, 1.5])
    const maxDim = Math.max(size.x, size.y, size.z);
    expect(maxDim).toBeCloseTo(3.0, 3);
    expect(box.min.x).toBeGreaterThanOrEqual(-1.501);
    expect(box.min.y).toBeGreaterThanOrEqual(-1.501);
    expect(box.min.z).toBeGreaterThanOrEqual(-1.501);
    expect(box.max.x).toBeLessThanOrEqual(1.501);
    expect(box.max.y).toBeLessThanOrEqual(1.501);
    expect(box.max.z).toBeLessThanOrEqual(1.501);
  });
});

describe('Primitive Factory (D-15)', () => {
  it('generates torus knot, sphere, cube, and plane BufferGeometries', () => {
    const primitives = ['torusKnot', 'sphere', 'cube', 'plane'] as const;

    for (const type of primitives) {
      const geo = createPrimitive(type);
      expect(geo).toBeInstanceOf(THREE.BufferGeometry);

      // Verify position and normal attributes exist
      const posAttr = geo.getAttribute('position');
      const normAttr = geo.getAttribute('normal');

      expect(posAttr).toBeDefined();
      expect(normAttr).toBeDefined();
      expect(posAttr.count).toBeGreaterThan(0);
      expect(normAttr.count).toBeGreaterThan(0);

      // Verify geometry is centered around (0, 0, 0)
      geo.computeBoundingBox();
      const center = new THREE.Vector3();
      geo.boundingBox?.getCenter(center);
      expect(center.x).toBeCloseTo(0, 3);
      expect(center.y).toBeCloseTo(0, 3);
      expect(center.z).toBeCloseTo(0, 3);
    }
  });
});

describe('OrbitController (D-17)', () => {
  it('initializes with default spherical coordinates and updates theta during auto-rotation', () => {
    const controller = new OrbitController({
      radius: 4.0,
      theta: 0.0,
      phi: Math.PI / 2,
      autoRotate: true,
      autoRotateSpeed: 1.0,
    });

    const camera = new THREE.PerspectiveCamera();
    controller.update(0.5, camera);

    // Theta advances by autoRotateSpeed * delta = 1.0 * 0.5 = 0.5 rad
    expect(controller.theta).toBeCloseTo(0.5, 4);
    expect(camera.position.length()).toBeCloseTo(4.0, 3);
  });

  it('pauses auto-rotation while user pointer is dragging', () => {
    const controller = new OrbitController({
      radius: 3.5,
      theta: 0.0,
      autoRotate: true,
      autoRotateSpeed: 1.0,
    });

    // Start drag
    const stopProp = vi.fn();
    controller.onPointerDown({ clientX: 100, clientY: 100, stopPropagation: stopProp });
    expect(stopProp).toHaveBeenCalled();
    expect(controller.getIsDragging()).toBe(true);

    // Update frame during drag: theta should NOT change from auto-rotate
    controller.update(1.0);
    expect(controller.theta).toBe(0.0);

    // Pointer move changes angles
    controller.onPointerMove({ clientX: 150, clientY: 120, stopPropagation: stopProp });
    expect(controller.theta).toBeCloseTo(-0.5, 3); // - (50 * 0.01)

    // Release drag
    controller.onPointerUp({ stopPropagation: stopProp });
    expect(controller.getIsDragging()).toBe(false);

    // Now auto-rotation resumes
    controller.update(1.0);
    expect(controller.theta).toBeCloseTo(0.5, 3); // -0.5 + 1.0 = 0.5
  });

  it('clamps polar angle phi within [0.01, Math.PI - 0.01]', () => {
    const controller = new OrbitController({
      phi: Math.PI / 2,
    });

    controller.onPointerDown({ clientX: 0, clientY: 0 });

    // Drag upwards by huge amount
    controller.onPointerMove({ clientX: 0, clientY: 10000 });
    expect(controller.phi).toBeCloseTo(0.01, 3);

    // Drag downwards by huge amount
    controller.onPointerMove({ clientX: 0, clientY: -20000 });
    expect(controller.phi).toBeCloseTo(Math.PI - 0.01, 3);
  });

  it('clamps zoom radius within [1.0, 10.0]', () => {
    const controller = new OrbitController({
      radius: 5.0,
    });

    const stopProp = vi.fn();
    const preventDef = vi.fn();

    // Zoom in drastically
    controller.onWheel({ deltaY: -5000, stopPropagation: stopProp, preventDefault: preventDef });
    expect(stopProp).toHaveBeenCalled();
    expect(preventDef).toHaveBeenCalled();
    expect(controller.radius).toBe(1.0);

    // Zoom out drastically
    controller.onWheel({ deltaY: 10000, stopPropagation: stopProp, preventDefault: preventDef });
    expect(controller.radius).toBe(10.0);
  });

  it('resets camera to default spherical coordinates', () => {
    const controller = new OrbitController({
      radius: 3.5,
      theta: 0.0,
      phi: 1.2,
    });

    controller.radius = 8.0;
    controller.theta = 2.5;
    controller.phi = 0.5;

    controller.reset();
    expect(controller.radius).toBe(3.5);
    expect(controller.theta).toBe(0.0);
    expect(controller.phi).toBe(1.2);
  });
});

describe('Dual-Mode 3D ASCII Generator & Stack Compositing (D-16, D-18, D-19, FX-06)', () => {
  it('registers threeD effect definition with costWeight 3 and requiresPass true', () => {
    expect(threeDEffect.id).toBe('threeD');
    expect(threeDEffect.label).toBe('3D ASCII');
    expect(threeDEffect.category).toBe('stylize');
    expect(threeDEffect.costWeight).toBe(3);
    expect(threeDEffect.requiresPass).toBe(true);

    // Verify parameter schema
    const params = threeDEffect.parameters;
    expect(params.renderMode).toBeDefined();
    expect(params.renderMode.options).toEqual(['pointCloud', 'depthRaster']);
    expect(params.pointSize).toBeDefined();
    expect(params.density).toBeDefined();
    expect(params.keyLightIntensity).toBeDefined();
    expect(params.rimLightIntensity).toBeDefined();
    expect(params.depthFalloff).toBeDefined();
    expect(params.primitive).toBeDefined();
  });

  it('creates PointsNodeMaterial with inverse depth size scaling and key/rim shading', () => {
    const dummyTexture = new THREE.Texture();
    const material = createAsciiPointCloudMaterial({
      pointSize: uniform(16.0),
      keyLightIntensity: uniform(1.2),
      rimLightIntensity: uniform(0.9),
      depthFalloff: uniform(0.5),
      atlasTexture: dummyTexture,
      charCount: uniform(10.0),
    });

    expect(material).toBeInstanceOf(THREE.PointsNodeMaterial);
    expect(material.sizeNode).toBeDefined();
    expect(material.sizeNode!.isNode).toBe(true);
    expect(material.colorNode).toBeDefined();
    expect(material.colorNode!.isNode).toBe(true);
    expect(material.transparent).toBe(true);
  });

  it('creates MeshBasicNodeMaterial outputting linearized normalized depth', () => {
    const material = createDepthRasterMaterial(0.1, 50.0);

    expect(material).toBeInstanceOf(THREE.MeshBasicNodeMaterial);
    expect(material.colorNode).toBeDefined();
    expect(material.colorNode!.isNode).toBe(true);

    const linDepthNode = linearizeDepth(uniform(0.5), 0.1, 50.0);
    expect(linDepthNode).toBeDefined();
    expect(linDepthNode.isNode).toBe(true);
  });

  it('builds valid TSL nodes for point cloud and depth raster modes', () => {
    const env = {
      resolution: vec2(1920, 1080),
      time: uniform(1.0),
      seed: uniform(42.0),
    };

    // Point cloud node
    const pointCloudNode = buildAsciiPointCloudNode({
      pointSize: uniform(16.0),
      keyLightIntensity: uniform(1.0),
      rimLightIntensity: uniform(0.8),
      depthFalloff: uniform(0.5),
      resolution: env.resolution,
      time: env.time,
    });
    expect(pointCloudNode).toBeDefined();
    expect(pointCloudNode.isNode).toBe(true);

    // Depth raster node
    const depthRasterNode = buildDepthRasterNode({
      pointSize: uniform(16.0),
      near: uniform(0.1),
      far: uniform(50.0),
      resolution: env.resolution,
    });
    expect(depthRasterNode).toBeDefined();
    expect(depthRasterNode.isNode).toBe(true);

    // Dual-mode evaluation via threeDEffect.buildNode
    const nodeFromEffectPC = threeDEffect.buildNode(
      vec4(0.0),
      { renderMode: 'pointCloud', pointSize: uniform(16.0) },
      env
    );
    expect(nodeFromEffectPC).toBeDefined();
    expect(nodeFromEffectPC.isNode).toBe(true);

    const nodeFromEffectDR = threeDEffect.buildNode(
      vec4(0.0),
      { renderMode: 'depthRaster', pointSize: uniform(16.0) },
      env
    );
    expect(nodeFromEffectDR).toBeDefined();
    expect(nodeFromEffectDR.isNode).toBe(true);
  });

  it('composites 3D ASCII pass with upstream passes in the effect stack (D-19)', () => {
    const registry = new EffectRegistry();
    const sourceNode = vec4(0.2, 0.4, 0.6, 1.0);

    const activeStack: ActiveEffectPass[] = [
      {
        instanceId: 'pass-tone',
        effectId: 'tone',
        enabled: true,
        intensity: 1.0,
        blendMode: 'normal',
        parameters: { brightness: 1.2 },
      },
      {
        instanceId: 'pass-3d',
        effectId: 'threeD',
        enabled: true,
        intensity: 0.8,
        blendMode: 'screen',
        parameters: {
          renderMode: 'pointCloud',
          pointSize: 16.0,
          primitive: 'torusKnot',
        },
      },
    ];

    const env = {
      resolution: vec2(1280, 720),
      time: uniform(0.0),
      seed: uniform(1.0),
    };

    const compiledNode = compileLinearEffectStack(sourceNode, activeStack, registry, env);
    expect(compiledNode).toBeDefined();
    expect(compiledNode.isNode).toBe(true);
  });
});
