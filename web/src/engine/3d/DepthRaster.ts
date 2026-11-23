import * as THREE from 'three/webgpu';
import {
  Fn,
  uv,
  texture,
  vec2,
  vec3,
  vec4,
  float,
  clamp,
  floor,
  fract,
  dot,
  positionView,
} from 'three/tsl';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

export interface DepthRasterOptions {
  pointSize?: any;
  near?: any;
  far?: any;
  charCount?: any;
  atlasTexture?: any;
  resolution?: any;
  depthTexture?: any;
  time?: any;
}

/**
 * Calculates linearized normalized depth in [0, 1] (D-16, FX-06).
 * Formula: Z_linear = (2.0 * near) / (far + near - z * (far - near))
 */
export function linearizeDepth(depthVal: any, nearVal: any = 0.1, farVal: any = 50.0): any {
  const near = toNode(nearVal, 0.1);
  const far = toNode(farVal, 50.0);
  const twoNear = near.mul(float(2.0));
  const farPlusNear = far.add(near);
  const farMinusNear = far.sub(near);

  const denom = farPlusNear.sub(depthVal.mul(farMinusNear)).max(float(0.0001));
  return twoNear.div(denom).clamp(float(0.0), float(1.0));
}

/**
 * Creates a MeshBasicNodeMaterial that renders linearized normalized depth into an offscreen target (D-16).
 */
export function createDepthRasterMaterial(
  nearVal: number = 0.1,
  farVal: number = 50.0
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial();

  const near = float(nearVal);
  const far = float(farVal);

  material.colorNode = Fn(() => {
    // In view space, -positionView.z is distance from camera
    const linearDist = positionView.z.negate();
    const normalizedDepth = linearDist.sub(near).div(far.sub(near)).clamp(float(0.0), float(1.0));
    return vec4(vec3(normalizedDepth), float(1.0));
  })();

  return material;
}

/**
 * Builds a depth rasterization ASCII TSL shader node for graph composition (D-16, FX-06).
 * Samples/simulates normalized depth, downsamples to character cells, and maps to ASCII luminance.
 */
export function buildDepthRasterNode(options: DepthRasterOptions = {}): any {
  const pointSize = toNode(options.pointSize, 16.0);
  const near = toNode(options.near, 0.1);
  const far = toNode(options.far, 50.0);
  const charCount = toNode(options.charCount, 10.0);
  const resolution = options.resolution ?? vec2(1920.0, 1080.0);

  return Fn(() => {
    const st = uv();
    const pixelCoord = st.mul(resolution);

    // Downsample depth to ASCII character grid dimensions (D-16)
    const cellSize = pointSize.max(float(4.0));
    const cellCoord = floor(pixelCoord.div(cellSize));
    const cellUV = fract(pixelCoord.div(cellSize));

    // Screen coordinates centered at cell
    const aspect = resolution.x.div(resolution.y.max(float(1.0)));
    const gridCenter = cellCoord.add(float(0.5)).mul(cellSize).div(resolution);
    const pX = gridCenter.x.sub(float(0.5)).mul(aspect).mul(float(2.0));
    const pY = gridCenter.y.sub(float(0.5)).mul(float(-2.0));
    const p = (vec2 as any)(pX, pY);

    // 3D Depth calculation
    const r2 = dot(p, p);
    const inBounds = r2.lessThanEqual(float(1.0));

    // Z in [0, 1] representing surface depth
    const zSphere = float(1.0).sub(r2).max(float(0.0)).sqrt();
    const zBufferVal = float(1.0).sub(zSphere.mul(float(0.5)));

    // Linearize normalized depth
    const zLinear = linearizeDepth(zBufferVal, near, far);

    // Invert so nearer objects have higher luminance in ASCII ramp (or direct mapping)
    const asciiLuminance = float(1.0).sub(zLinear).clamp(float(0.0), float(1.0));

    // Map normalized depth to ASCII character index
    const charIdx = clamp(floor(asciiLuminance.mul(charCount)), float(0.0), charCount.sub(float(1.0)));

    // Map cell UV to TextureAtlas character cell
    const atlasU = charIdx.add(cellUV.x).div(charCount);
    const atlasV = cellUV.y;

    const glyphColor = options.atlasTexture
      ? texture(options.atlasTexture, (vec2 as any)(atlasU, atlasV))
      : (vec4 as any)(asciiLuminance, asciiLuminance, asciiLuminance, float(1.0));

    const finalAlpha = inBounds.select(glyphColor.a, float(0.0));
    const finalRgb = glyphColor.rgb.mul(asciiLuminance);

    return (vec4 as any)(finalRgb, finalAlpha);
  });
}
