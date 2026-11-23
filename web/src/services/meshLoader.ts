import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MAX_GLB_FILE_SIZE = 50 * 1024 * 1024; // 50MB ceiling (T-02-11)
export const GLB_MAGIC_LITTLE_ENDIAN = 0x46546c67; // 'glTF' (0x67, 0x6C, 0x54, 0x46)
export const GLB_MAGIC_BIG_ENDIAN = 0x676c5446;

export interface LoadGLBOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Validates a GLB file's size and magic bytes before parsing (T-02-11).
 * Rejects with descriptive errors if limits or headers are violated.
 */
export async function validateGLBHeader(file: File): Promise<void> {
  if (file.size > MAX_GLB_FILE_SIZE) {
    throw new Error('File exceeds 50MB limit.');
  }

  const slice = file.slice(0, 4);
  const buffer = await slice.arrayBuffer();
  if (buffer.byteLength < 4) {
    throw new Error('Invalid GLB binary header. Expected glTF container.');
  }

  const view = new DataView(buffer);
  const magicLE = view.getUint32(0, true);
  const magicBE = view.getUint32(0, false);

  if (magicLE !== GLB_MAGIC_LITTLE_ENDIAN && magicBE !== GLB_MAGIC_LITTLE_ENDIAN) {
    throw new Error('Invalid GLB binary header. Expected glTF container.');
  }
}

/**
 * Normalizes an object's bounding box so that its center is at (0, 0, 0)
 * and its maximum dimension fits within [-1.5, 1.5] (size 3.0).
 */
export function normalizeMeshBounds(object: THREE.Object3D): THREE.Group {
  // Update matrix world to ensure bounding box is accurate
  object.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDimension = Math.max(size.x, size.y, size.z, 0.0001);
  const targetDimension = 3.0; // [-1.5, 1.5]
  const scale = targetDimension / maxDimension;

  const root = new THREE.Group();
  // Center geometry
  object.position.set(-center.x, -center.y, -center.z);
  root.add(object);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  return root;
}

/**
 * Validates and loads a GLB binary file with size/magic checks, timeout protection,
 * and unit bounding box normalization (D-15, T-02-11, T-02-12).
 */
export async function validateAndLoadGLB(
  file: File,
  signalOrOptions?: AbortSignal | LoadGLBOptions
): Promise<THREE.Group> {
  // 1. Enforce size and magic header validation
  await validateGLBHeader(file);

  // 2. Setup abort / timeout signal (AbortSignal.timeout(10000) default)
  let userSignal: AbortSignal | undefined;
  let timeoutMs = 10000;

  if (signalOrOptions instanceof AbortSignal) {
    userSignal = signalOrOptions;
  } else if (signalOrOptions) {
    userSignal = signalOrOptions.signal;
    if (typeof signalOrOptions.timeoutMs === 'number') {
      timeoutMs = signalOrOptions.timeoutMs;
    }
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const activeSignal = userSignal ? AbortSignal.any([userSignal, timeoutSignal]) : timeoutSignal;

  if (activeSignal.aborted) {
    throw new Error('GLB loading timed out or aborted.');
  }

  // 3. Read array buffer
  const arrayBuffer = await file.arrayBuffer();

  if (activeSignal.aborted) {
    throw new Error('GLB loading timed out or aborted.');
  }

  // 4. Parse GLTF binary with GLTFLoader
  const loader = new GLTFLoader();
  const gltf = await new Promise<any>((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (!settled) {
        settled = true;
        reject(new Error('GLB loading timed out or aborted.'));
      }
    };

    activeSignal.addEventListener('abort', onAbort, { once: true });

    try {
      loader.parse(
        arrayBuffer,
        '',
        (result) => {
          if (!settled) {
            settled = true;
            activeSignal.removeEventListener('abort', onAbort);
            resolve(result);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            activeSignal.removeEventListener('abort', onAbort);
            reject(error);
          }
        }
      );
    } catch (err) {
      if (!settled) {
        settled = true;
        activeSignal.removeEventListener('abort', onAbort);
        reject(err);
      }
    }
  });

  const rawScene = gltf.scene || gltf.scenes?.[0] || new THREE.Group();

  // 5. Compute bounding box and normalize/center to [-1.5, 1.5]
  return normalizeMeshBounds(rawScene);
}
