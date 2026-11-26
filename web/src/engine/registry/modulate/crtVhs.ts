import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  fract,
  clamp,
  max,
} from 'three/tsl';
import type { EffectDefinition } from '../types';

function toNode(val: any, fallback = 0.0): any {
  if (val === undefined || val === null) return float(fallback);
  if (typeof val === 'number') return float(val);
  if (typeof val === 'boolean') return float(val ? 1.0 : 0.0);
  return val;
}

export type CrtVhsProfileName = 'vhsSp' | 'vhsEp' | 'crtArcade' | 'broadcastMonitor';

export interface CrtVhsProfileParams {
  curvature: number;
  scanlineIntensity: number;
  scanlineCount: number;
  phosphorDecay: number;
  trackingJitter: number;
  aberration?: number;
  bloomIntensity: number;
  vignette: number;
  noiseIntensity: number;
}

/**
 * Authentic analog CRT and VHS profiles (D-09, FX-04).
 * VHS SP: clean tape playback with subtle scanlines and jitter.
 * VHS EP: worn tape playback with heavy jitter, tracking noise, and phosphor decay.
 * CRT Arcade: curved shadow mask with heavy scanlines and bloom.
 * Broadcast Monitor: crisp aperture grille with fine scanlines and subtle curvature.
 */
export const CRT_VHS_PROFILES: Record<CrtVhsProfileName, CrtVhsProfileParams> = {
  vhsSp: {
    curvature: 0.0,
    scanlineIntensity: 0.2,
    scanlineCount: 480.0,
    phosphorDecay: 0.1,
    trackingJitter: 0.1,
    aberration: 0.1,
    bloomIntensity: 0.15,
    vignette: 0.1,
    noiseIntensity: 0.05,
  },
  vhsEp: {
    curvature: 0.02,
    scanlineIntensity: 0.45,
    scanlineCount: 360.0,
    phosphorDecay: 0.4,
    trackingJitter: 0.6,
    aberration: 0.4,
    bloomIntensity: 0.25,
    vignette: 0.2,
    noiseIntensity: 0.5,
  },
  crtArcade: {
    curvature: 0.15,
    scanlineIntensity: 0.6,
    scanlineCount: 240.0,
    phosphorDecay: 0.25,
    trackingJitter: 0.05,
    aberration: 0.15,
    bloomIntensity: 0.4,
    vignette: 0.35,
    noiseIntensity: 0.08,
  },
  broadcastMonitor: {
    curvature: 0.05,
    scanlineIntensity: 0.3,
    scanlineCount: 600.0,
    phosphorDecay: 0.15,
    trackingJitter: 0.02,
    aberration: 0.05,
    bloomIntensity: 0.2,
    vignette: 0.15,
    noiseIntensity: 0.02,
  },
};

/**
 * Returns parameters for a named analog profile (D-09).
 */
export function applyCrtProfile(profileName: CrtVhsProfileName): CrtVhsProfileParams {
  return { ...CRT_VHS_PROFILES[profileName] };
}

/**
 * Computes barrel distortion and boundary detection for normalized UV [0, 1] (D-09).
 * Formula: uv' = 0.5 + (uv - 0.5) * (1 + curvature * r^2)
 */
export function computeBarrelDistortion(
  uvCoord: { x: number; y: number },
  curvature: number
): { x: number; y: number; inBounds: boolean } {
  const ccX = uvCoord.x - 0.5;
  const ccY = uvCoord.y - 0.5;
  const r2 = ccX * ccX + ccY * ccY;
  const distFactor = 1.0 + curvature * r2;
  const distortedX = 0.5 + ccX * distFactor;
  const distortedY = 0.5 + ccY * distFactor;
  const inBounds =
    distortedX >= 0.0 && distortedX <= 1.0 && distortedY >= 0.0 && distortedY <= 1.0;
  return { x: distortedX, y: distortedY, inBounds };
}

/**
 * Advanced Analog CRT and VHS emulation effect definition (D-09, FX-04).
 * Features barrel curvature, scanline tracking jitter, phosphor decay feedback,
 * highlight bloom extraction, and analog noise.
 */
export const crtVhsEffect: EffectDefinition = {
  id: 'crtVhs',
  label: 'CRT / VHS Emulation',
  category: 'modulate',
  requiresPass: true,
  costWeight: 3,
  parameters: {
    profile: {
      type: 'select',
      default: 'vhsSp',
      options: ['vhsSp', 'vhsEp', 'crtArcade', 'broadcastMonitor'],
    },
    curvature: {
      type: 'float',
      min: 0.0,
      max: 0.5,
      default: 0.0,
      step: 0.01,
      audioModulatable: true,
    },
    scanlineIntensity: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.2,
      step: 0.01,
      audioModulatable: true,
    },
    scanlineCount: {
      type: 'float',
      min: 100.0,
      max: 1200.0,
      default: 480.0,
      step: 10.0,
    },
    phosphorDecay: {
      type: 'float',
      min: 0.0,
      max: 0.95,
      default: 0.1,
      step: 0.01,
      audioModulatable: true,
    },
    trackingJitter: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.1,
      step: 0.01,
      audioModulatable: true,
    },
    aberration: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.1,
      step: 0.01,
      audioModulatable: true,
    },
    bloomIntensity: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.15,
      step: 0.01,
      audioModulatable: true,
    },
    vignette: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.1,
      step: 0.01,
      audioModulatable: true,
    },
    noiseIntensity: {
      type: 'float',
      min: 0.0,
      max: 1.0,
      default: 0.05,
      step: 0.01,
      audioModulatable: true,
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const curvature = toNode(uniforms.curvature, 0.0);
    const scanlineIntensity = toNode(uniforms.scanlineIntensity, 0.2);
    const scanlineCount = toNode(uniforms.scanlineCount, 480.0);
    const rawPhosphorDecay = toNode(uniforms.phosphorDecay, 0.1);
    const trackingJitter = toNode(uniforms.trackingJitter, 0.1);
    const aberration = toNode(uniforms.aberration, 0.1);
    const bloomIntensity = toNode(uniforms.bloomIntensity, 0.15);
    const vignette = toNode(uniforms.vignette, 0.1);
    const noiseIntensity = toNode(uniforms.noiseIntensity, 0.05);

    // T-02-07 Mitigation: strictly clamp phosphor decay to < 0.98 to prevent runaway luminance accumulation
    const safePhosphorDecay = clamp(rawPhosphorDecay, 0.0, 0.97);

    const time = env?.time ?? uniforms.time ?? float(0.0);

    return Fn(() => {
      const st: any = uv();

      // 1. CRT Barrel Distortion
      const cc: any = st.sub(0.5);
      const distSq: any = cc.x.mul(cc.x).add(cc.y.mul(cc.y));
      const distFactor: any = distSq.mul(curvature).add(1.0);
      const distortedUV: any = cc.mul(distFactor).add(0.5);

      const inBounds: any = distortedUV.x.greaterThanEqual(0.0)
        .and(distortedUV.x.lessThanEqual(1.0))
        .and(distortedUV.y.greaterThanEqual(0.0))
        .and(distortedUV.y.lessThanEqual(1.0));

      // 2. Tracking Jitter
      const jitterSeed: any = distortedUV.y.mul(30.0).add(time.mul(15.0));
      const jitterNoise: any = fract(sin(jitterSeed).mul(43758.5453)).sub(0.5);
      const jitterOffset: any = jitterNoise.mul(trackingJitter).mul(0.02);
      const sampleUV: any = vec2(distortedUV.x.add(jitterOffset), distortedUV.y).clamp(0.0, 1.0);

      const sampleFn = (coord: any) => {
        if (typeof env?.sampleAt === 'function') return env.sampleAt(coord);
        if (typeof inputNode === 'function') return inputNode(coord);
        return inputNode;
      };

      const aberOffset = aberration.mul(0.0035);
      const colR: any = sampleFn(vec2(sampleUV.x.add(aberOffset), sampleUV.y).clamp(0.0, 1.0));
      const colG: any = sampleFn(sampleUV);
      const colB: any = sampleFn(vec2(sampleUV.x.sub(aberOffset), sampleUV.y).clamp(0.0, 1.0));
      let rgb: any = vec3(colR.r, colG.g, colB.b);
      const sampledAlpha = colG.a ?? float(1.0);

      // 3. Scanline simulation
      const scanlinePhase: any = distortedUV.y.mul(scanlineCount).add(time.mul(2.0));
      const scanline: any = sin(scanlinePhase).mul(0.5).add(0.5);
      const scanlineMod: any = scanlineIntensity.mul(scanline.sub(1.0)).add(1.0);
      rgb = rgb.mul(scanlineMod);

      // 4. Analog tape static noise
      const noiseSeed: any = sampleUV.x.mul(12.9898).add(sampleUV.y.mul(78.233)).add(time.mul(43.123));
      const noiseVal: any = fract(sin(noiseSeed).mul(43758.5453)).sub(0.5);
      rgb = rgb.add(vec3(noiseVal.mul(noiseIntensity)));

      // 5. Highlight bloom extraction and additive combine
      // Rec. 601 luminance: 0.299 R + 0.587 G + 0.114 B
      const lum: any = rgb.r.mul(0.299).add(rgb.g.mul(0.587)).add(rgb.b.mul(0.114));
      const highlight: any = lum.sub(0.7).max(0.0).mul(3.33);
      const bloomCol: any = rgb.mul(highlight).mul(bloomIntensity);
      rgb = rgb.add(bloomCol);

      // 6. Phosphor decay temporal accumulation (clamped < 0.98 per T-02-07)
      if (typeof env?.previousPassTexture === 'function') {
        const prevCol: any = env.previousPassTexture(sampleUV);
        rgb = max(rgb, prevCol.rgb.mul(safePhosphorDecay));
      }

      // 7. Vignette darkening towards edges
      const vigFactor: any = clamp(float(1.0).sub(distSq.mul(vignette.mul(2.0))), 0.0, 1.0);
      rgb = rgb.mul(vigFactor);

      // Darken out of bounds
      const finalRGB: any = inBounds.select(clamp(rgb, 0.0, 1.0), vec3(0.0));
      return vec4(finalRGB, sampledAlpha);
    })();
  },
};
