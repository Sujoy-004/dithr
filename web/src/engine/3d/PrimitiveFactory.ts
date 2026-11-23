import * as THREE from 'three/webgpu';

export type PrimitiveType = 'torusKnot' | 'sphere' | 'cube' | 'plane';

export interface PrimitiveOptions {
  radialSegments?: number;
  tubularSegments?: number;
  widthSegments?: number;
  heightSegments?: number;
}

/**
 * Procedural 3D primitive geometry factory for ASCII point clouds and depth rasters (D-15).
 * Generates centered, normalized BufferGeometry instances with computeVertexNormals().
 */
export function createPrimitive(
  type: PrimitiveType,
  options: PrimitiveOptions = {}
): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;

  switch (type) {
    case 'torusKnot': {
      // Radius ~0.8, tube ~0.26, radial segments 100, tubular segments 16
      geometry = new THREE.TorusKnotGeometry(
        0.8,
        0.26,
        options.tubularSegments ?? 100,
        options.radialSegments ?? 16
      );
      break;
    }
    case 'sphere': {
      // Radius ~1.2, widthSegments 32, heightSegments 32
      geometry = new THREE.SphereGeometry(
        1.2,
        options.widthSegments ?? 32,
        options.heightSegments ?? 32
      );
      break;
    }
    case 'cube': {
      // Size 1.8x1.8x1.8, segmented for surface point density
      geometry = new THREE.BoxGeometry(
        1.8,
        1.8,
        1.8,
        options.widthSegments ?? 16,
        options.heightSegments ?? 16,
        options.radialSegments ?? 16
      );
      break;
    }
    case 'plane': {
      // Size 2.4x2.4 centered
      geometry = new THREE.PlaneGeometry(
        2.4,
        2.4,
        options.widthSegments ?? 32,
        options.heightSegments ?? 32
      );
      break;
    }
    default: {
      geometry = new THREE.TorusKnotGeometry(0.8, 0.26, 100, 16);
    }
  }

  // Ensure vertex normals and origin centering
  geometry.computeVertexNormals();
  geometry.center();

  return geometry;
}
