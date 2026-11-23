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
  max,
  pow,
  dot,
  sin,
  cos,
  pointUV,
  normalView,
  positionView,
} from 'three/tsl';
import { rec601Luminance } from '../color/luminance';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

export interface AsciiPointCloudOptions {
  pointSize?: any;
  keyLightIntensity?: any;
  rimLightIntensity?: any;
  depthFalloff?: any;
  density?: any;
  atlasTexture?: any;
  charCount?: any;
  resolution?: any;
  time?: any;
}

/**
 * Creates a PointsNodeMaterial for 3D ASCII point cloud rendering (D-16, D-18, FX-06).
 * - Shading: Key directional light + Rim light silhouette (pow(1.0 - dot(N, V), 3.0)).
 * - Perceived luminance: Rec. 601 luminance weighting.
 * - Point sprite UV: maps pointUV coordinate to TextureAtlas character glyph slice.
 * - Point size: scaled by inverse depth distance from camera.
 */
export function createAsciiPointCloudMaterial(
  options: AsciiPointCloudOptions = {}
): THREE.PointsNodeMaterial {
  const material = new THREE.PointsNodeMaterial();

  const baseSize = toNode(options.pointSize, 16.0);
  const keyLightIntensity = toNode(options.keyLightIntensity, 1.0);
  const rimLightIntensity = toNode(options.rimLightIntensity, 0.8);
  const depthFalloff = toNode(options.depthFalloff, 0.5);
  const charCount = toNode(options.charCount, 10.0);

  // Depth scaling: size / depth (D-18)
  const depth = positionView.z.negate().max(float(0.1));
  material.sizeNode = baseSize.mul(float(3.0)).div(depth);

  // Lighting & Glyph sampling node
  material.colorNode = Fn(() => {
    // Key directional light vector normalize(vec3(1.0, 1.5, 2.0))
    const keyLightDir = vec3(1.0, 1.5, 2.0).normalize();
    const N = normalView.normalize();
    const V = vec3(0.0, 0.0, 1.0); // View direction in view space

    // Diffuse key light
    const NdotL = max(float(0.0), dot(N, keyLightDir));
    const diffuse = NdotL.mul(keyLightIntensity);

    // Rim light silhouette pow(1.0 - dot(N, V), 3.0)
    const NdotV = clamp(dot(N, V), float(0.0), float(1.0));
    const rim = pow(float(1.0).sub(NdotV), float(3.0)).mul(rimLightIntensity);

    // Combine perceived luminance via Rec. 601
    const totalLight = diffuse.add(rim);
    const lum = rec601Luminance((vec4 as any)(totalLight, totalLight, totalLight, float(1.0)));

    // Quantize luminance to character glyph index in TextureAtlas
    const charIdx = clamp(floor(lum.mul(charCount)), float(0.0), charCount.sub(float(1.0)));

    // Map point sprite UV to atlas horizontal strip
    const pUv = pointUV as any;
    const atlasU = charIdx.add(pUv.x).div(charCount);
    const atlasV = pUv.y;

    const glyph = options.atlasTexture
      ? texture(options.atlasTexture, vec2(atlasU, atlasV))
      : (vec4 as any)(totalLight, totalLight, totalLight, float(1.0));

    // Depth-based attenuation falloff
    const falloff = float(1.0).div(float(1.0).add(depth.mul(depthFalloff).mul(float(0.1))));

    const finalRgb = glyph.rgb.mul(totalLight).mul(falloff);
    const finalAlpha = glyph.a.mul(falloff);

    return (vec4 as any)(finalRgb, finalAlpha);
  })();

  material.transparent = true;
  material.depthWrite = true;
  return material;
}

/**
 * Builds a 3D ASCII point cloud TSL shader node for graph composition (D-16, D-18, FX-06).
 * Computes ray-surface projection, key/rim lighting, and glyph atlas sampling.
 */
export function buildAsciiPointCloudNode(
  options: AsciiPointCloudOptions = {}
): any {
  const pointSize = toNode(options.pointSize, 16.0);
  const keyLightIntensity = toNode(options.keyLightIntensity, 1.0);
  const rimLightIntensity = toNode(options.rimLightIntensity, 0.8);
  const depthFalloff = toNode(options.depthFalloff, 0.5);
  const charCount = toNode(options.charCount, 10.0);
  const resolution = options.resolution ?? vec2(1920.0, 1080.0);
  const time = toNode(options.time, 0.0);

  return Fn(() => {
    const st = uv();
    const pixelCoord = st.mul(resolution);

    // Grid cell for ASCII point cloud sampling
    const cellSize = pointSize.max(float(4.0));
    const cellCoord = floor(pixelCoord.div(cellSize));
    const cellUV = fract(pixelCoord.div(cellSize));

    // Normalized screen coordinates [-1, 1] adjusted for aspect ratio
    const aspect = resolution.x.div(resolution.y.max(float(1.0)));
    const gridCenter = cellCoord.add(float(0.5)).mul(cellSize).div(resolution);
    const pX = gridCenter.x.sub(float(0.5)).mul(aspect).mul(float(2.0));
    const pY = gridCenter.y.sub(float(0.5)).mul(float(-2.0));
    const p = (vec2 as any)(pX, pY);

    // Spherical/torus surface simulation
    const r2 = dot(p, p);
    const inBounds = r2.lessThanEqual(float(1.0));

    // Approximate 3D hemisphere surface normal and depth
    const z = float(1.0).sub(r2).max(float(0.0)).sqrt();
    const normal = vec3(p.x, p.y, z).normalize();
    const viewDir = vec3(0.0, 0.0, 1.0);

    // Animated Key directional light
    const rotSpeed = time.mul(float(0.5));
    const lightX = sin(rotSpeed);
    const lightZ = cos(rotSpeed);
    const keyLightDir = vec3(lightX.add(float(0.5)), float(1.2), lightZ.add(float(1.0))).normalize();

    // Key light diffuse
    const NdotL = max(float(0.0), dot(normal, keyLightDir));
    const diffuse = NdotL.mul(keyLightIntensity);

    // Rim light silhouette pow(1.0 - dot(N, V), 3.0)
    const NdotV = clamp(dot(normal, viewDir), float(0.0), float(1.0));
    const rim = pow(float(1.0).sub(NdotV), float(3.0)).mul(rimLightIntensity);

    // Total light and Rec. 601 perceived luminance
    const totalLight = diffuse.add(rim);
    const lum = rec601Luminance((vec4 as any)(totalLight, totalLight, totalLight, float(1.0)));

    // Character index in TextureAtlas
    const charIdx = clamp(floor(lum.mul(charCount)), float(0.0), charCount.sub(float(1.0)));

    // Glyph UV in atlas
    const atlasU = charIdx.add(cellUV.x).div(charCount);
    const atlasV = cellUV.y;

    const glyphColor = options.atlasTexture
      ? texture(options.atlasTexture, vec2(atlasU, atlasV))
      : (vec4 as any)(totalLight, totalLight, totalLight, float(1.0));

    // Depth falloff
    const depthVal = float(2.0).sub(z);
    const falloff = float(1.0).div(float(1.0).add(depthVal.mul(depthFalloff).mul(float(0.2))));

    // Composite point sprite within cell
    const pointSpriteDist = cellUV.sub(float(0.5)).length().mul(float(2.0));
    const pointMask = float(1.0).sub(pointSpriteDist).clamp(float(0.0), float(1.0));

    const finalAlpha = inBounds.select(glyphColor.a.mul(pointMask).mul(falloff), float(0.0));
    const finalRgb = glyphColor.rgb.mul(totalLight).mul(falloff);

    return (vec4 as any)(finalRgb, finalAlpha);
  });
}
