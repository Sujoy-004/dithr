import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  sin,
  floor,
  abs,
  clamp,
  max,
  mix,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { hash12Node, rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, sampleWithEnv } from '../tslHelpers';

export type CrtVhsProfileName = 'vhsSp' | 'vhsEp' | 'crtArcade' | 'broadcastMonitor';

export interface CrtVhsProfileParams {
  curvature: number;
  scanlineIntensity: number;
  scanlineCount: number;
  phosphorDecay: number;
  trackingJitter: number;
  bloomIntensity: number;
  vignette: number;
  noiseIntensity: number;
}

/**
 * Authentic analog CRT and VHS profiles (D-09, FX-04).
 */
export const CRT_VHS_PROFILES: Record<CrtVhsProfileName, CrtVhsProfileParams> = {
  vhsSp: {
    curvature: 0.0,
    scanlineIntensity: 0.2,
    scanlineCount: 480.0,
    phosphorDecay: 0.1,
    trackingJitter: 0.1,
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
    bloomIntensity: 0.2,
    vignette: 0.15,
    noiseIntensity: 0.02,
  },
};

export function applyCrtProfile(profileName: CrtVhsProfileName): CrtVhsProfileParams {
  return { ...CRT_VHS_PROFILES[profileName] };
}

/**
 * Computes barrel distortion and boundary detection for normalized UV [0, 1] (D-09).
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
 * Analog CRT & VHS Emulation effect definition (D-09, FX-04).
 * Barrel curvature with anti-aliased bezel, VHS tracking wave & head-switch tear,
 * 3-tap horizontal chroma aberration, Nyquist-damped scanlines, Dave Hoskins noise,
 * and 5-tap highlight phosphor bloom.
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
      max: 12.0,
      default: 2.0,
      step: 0.5,
      unit: 'px',
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
    const aberration = toNode(uniforms.aberration, 2.0);
    const bloomIntensity = toNode(uniforms.bloomIntensity, 0.15);
    const vignette = toNode(uniforms.vignette, 0.1);
    const noiseIntensity = toNode(uniforms.noiseIntensity, 0.05);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    // T-02-07 / T-hlm-01: strictly clamp phosphor decay < 0.98
    const safePhosphorDecay = clamp(rawPhosphorDecay, 0.0, 0.97);
    const time = env?.time ?? uniforms.time ?? float(0.0);

    return Fn(() => {
      const st: any = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));

      // 1. CRT Barrel Distortion + smooth anti-aliased bezel
      const cc: any = st.sub(0.5);
      const distSq: any = cc.x.mul(cc.x).add(cc.y.mul(cc.y));
      const distFactor: any = distSq.mul(curvature).add(1.0);
      const distortedUV: any = cc.mul(distFactor).add(0.5);

      const edgeDist = max(abs(distortedUV.x.sub(0.5)), abs(distortedUV.y.sub(0.5)));
      const bezelMask = float(1.0).sub(smoothstep(0.494, 0.502, edgeDist));

      // 2. VHS horizontal tracking wave + line jitter + bottom head-switch tear
      const waveOffset = sin(distortedUV.y.mul(14.0).add(time.mul(4.5)))
        .mul(trackingJitter)
        .mul(0.004);
      const lineBand = floor(distortedUV.y.mul(180.0));
      const lineRand = hash12Node(vec2(lineBand, floor(time.mul(24.0)))).sub(0.5);
      const lineJitter = lineRand.mul(trackingJitter).mul(0.015);
      const headSwitch = smoothstep(0.92, 0.99, float(1.0).sub(distortedUV.y))
        .mul(trackingJitter)
        .mul(0.025)
        .mul(sin(time.mul(35.0)));

      const sampleUV: any = vec2(
        distortedUV.x.add(waveOffset).add(lineJitter).add(headSwitch),
        distortedUV.y
      ).clamp(0.001, 0.999);

      // 3. 3-tap horizontal chroma R/B aberration
      const abOffset = aberration.div(safeRes.x);
      const cR = sampleWithEnv(
        inputNode,
        env,
        vec2(sampleUV.x.add(abOffset), sampleUV.y).clamp(0.001, 0.999)
      );
      const cG = sampleWithEnv(inputNode, env, sampleUV);
      const cB = sampleWithEnv(
        inputNode,
        env,
        vec2(sampleUV.x.sub(abOffset), sampleUV.y).clamp(0.001, 0.999)
      );
      let rgb: any = vec3(cR.r, cG.g, cB.b);

      // 4. Nyquist-safe scanlines
      const scanPhase: any = distortedUV.y.mul(scanlineCount).mul(6.2831853).add(time.mul(2.0));
      const scanVal: any = sin(scanPhase).mul(0.5).add(0.5);
      const nyquistDamp = clamp(
        safeRes.y.div(scanlineCount.mul(1.5).max(1.0)),
        0.15,
        1.0
      );
      const scanMod: any = mix(float(1.0), scanVal, scanlineIntensity.mul(0.8).mul(nyquistDamp));
      rgb = rgb.mul(scanMod);

      // 5. Dave Hoskins analog tape noise
      const noiseCoord = vec2(
        floor(sampleUV.x.mul(safeRes.x).mul(0.5)),
        floor(sampleUV.y.mul(safeRes.y)).add(floor(time.mul(30.0)))
      );
      const noiseVal: any = hash12Node(noiseCoord).sub(0.5);
      rgb = rgb.add(vec3(noiseVal.mul(noiseIntensity).mul(0.35)));

      // 6. 5-tap highlight phosphor bloom
      if (typeof env?.sampleAt === 'function' || typeof inputNode === 'function') {
        const bStep = vec2(2.5).div(safeRes);
        const b1 = sampleWithEnv(inputNode, env, sampleUV.add(vec2(bStep.x, 0.0))).rgb;
        const b2 = sampleWithEnv(inputNode, env, sampleUV.sub(vec2(bStep.x, 0.0))).rgb;
        const b3 = sampleWithEnv(inputNode, env, sampleUV.add(vec2(0.0, bStep.y))).rgb;
        const b4 = sampleWithEnv(inputNode, env, sampleUV.sub(vec2(0.0, bStep.y))).rgb;
        const bloomAvg = rgb.add(b1).add(b2).add(b3).add(b4).mul(0.2);
        const bloomLum = rec601PerceptualLuminance(bloomAvg);
        const highlight = bloomLum.sub(0.55).max(0.0).mul(2.2);
        rgb = rgb.add(bloomAvg.mul(highlight).mul(bloomIntensity));
      } else {
        const lum: any = rgb.r.mul(0.299).add(rgb.g.mul(0.587)).add(rgb.b.mul(0.114));
        const highlight: any = lum.sub(0.6).max(0.0).mul(2.5);
        rgb = rgb.add(rgb.mul(highlight).mul(bloomIntensity));
      }

      // 7. Phosphor decay temporal accumulation (clamped < 0.98)
      if (typeof env?.previousPassTexture === 'function') {
        const prevCol: any = env.previousPassTexture(sampleUV);
        rgb = max(rgb, prevCol.rgb.mul(safePhosphorDecay));
      }

      // 8. Vignette & bezel mask
      const vigFactor: any = clamp(float(1.0).sub(distSq.mul(vignette.mul(1.8))), 0.0, 1.0);
      rgb = rgb.mul(vigFactor).mul(bezelMask);

      return vec4(clamp(rgb, 0.0, 1.0), cG.a ?? float(1.0));
    })();
  },
};
