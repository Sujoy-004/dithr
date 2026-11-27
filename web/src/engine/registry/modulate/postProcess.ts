import {
  Fn,
  float,
  mix,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type {
  EffectEnvironment,
} from '../types';
import type { PostProcessingSettings } from '../../../types/studio';
import { hash12Node } from '../../color/luminance';
import { linearTosRGBChannel, sRGBToLinearChannel } from '../../color/colorSpace';

export interface PostProcessUniforms {
  bloomThreshold: any;
  bloomIntensity: any;
  grainIntensity: any;
  grainSize: any;
  grainSpeed: any;
  chromaticOffset: any;
  scanlineOpacity: any;
  scanlineSpacing: any;
  vignetteIntensity: any;
  vignetteRadius: any;
  crtAmount: any;
  phosphorIntensity: any;
  phosphorColor: any;
}

/** True when at least one post-processing stage is enabled. */
export function isPostProcessingActive(settings: PostProcessingSettings): boolean {
  return (
    settings.bloom.enabled ||
    settings.grain.enabled ||
    settings.chromatic.enabled ||
    settings.scanlines.enabled ||
    settings.vignette.enabled ||
    settings.crtCurve.enabled ||
    settings.phosphor.enabled
  );
}

/** Stable topology signature used in the pipeline cache key. */
export function postProcessTopology(settings: PostProcessingSettings): string {
  const parts: string[] = [];
  if (settings.crtCurve.enabled) parts.push('crtCurve');
  if (settings.bloom.enabled) parts.push('bloom');
  if (settings.grain.enabled) parts.push('grain');
  if (settings.chromatic.enabled) parts.push('chromatic');
  if (settings.scanlines.enabled) parts.push('scanlines');
  if (settings.vignette.enabled) parts.push('vignette');
  if (settings.phosphor.enabled) parts.push(`phosphor:${settings.phosphor.mode}`);
  return parts.join('+');
}

/**
 * Builds the global finishing chain after the composable stack.
 * Operates in perceptual sRGB for predictable photographic controls and
 * converts back into the Linear working space consumed by the display.
 */
export function buildPostProcessNode(
  input: any,
  settings: PostProcessingSettings,
  uniforms: PostProcessUniforms,
  env?: EffectEnvironment
): any {
  const resolution = env?.resolution ?? vec2(1920.0, 1080.0);
  const time = env?.time ?? float(0.0);
  const seed = env?.seed ?? float(1.0);
  const sampleAt =
    typeof env?.sampleAt === 'function' ? env.sampleAt : () => input;

  return Fn(() => {
    const st = uv();
    const safeRes = resolution.max(vec2(1.0, 1.0));

    // CRT barrel curve samples the upstream target at a distorted UV.
    let sampleUv: any = st;
    let outside: any = null;
    if (settings.crtCurve.enabled) {
      const amount = uniforms.crtAmount;
      const centered = st.mul(2.0).sub(1.0);
      const curve = centered.mul(
        vec2(
          float(1.0).add(amount.mul(centered.y).mul(centered.y)),
          float(1.0).add(amount.mul(centered.x).mul(centered.x))
        )
      );
      sampleUv = curve.mul(0.5).add(0.5);
      outside = sampleUv.x
        .lessThan(0.0)
        .or(sampleUv.x.greaterThan(1.0))
        .or(sampleUv.y.lessThan(0.0))
        .or(sampleUv.y.greaterThan(1.0));
    }

    const baseLinear = sampleAt(sampleUv);
    let rgb: any = vec3(
      linearTosRGBChannel(baseLinear.r),
      linearTosRGBChannel(baseLinear.g),
      linearTosRGBChannel(baseLinear.b)
    );

    // Bloom: thresholded 4-tap glow around the current pixel.
    if (settings.bloom.enabled) {
      const texel = vec2(1.0, 1.0).div(safeRes).mul(3.0);
      const tapA = sampleAt(sampleUv.add(vec2(texel.x, 0.0)));
      const tapB = sampleAt(sampleUv.sub(vec2(texel.x, 0.0)));
      const tapC = sampleAt(sampleUv.add(vec2(0.0, texel.y)));
      const tapD = sampleAt(sampleUv.sub(vec2(0.0, texel.y)));
      const glow = vec3(
        linearTosRGBChannel(tapA.r.add(tapB.r).add(tapC.r).add(tapD.r).mul(0.25)),
        linearTosRGBChannel(tapA.g.add(tapB.g).add(tapC.g).add(tapD.g).mul(0.25)),
        linearTosRGBChannel(tapA.b.add(tapB.b).add(tapC.b).add(tapD.b).mul(0.25))
      );
      const bright = glow.sub(vec3(uniforms.bloomThreshold)).max(vec3(0.0));
      rgb = rgb.add(bright.mul(uniforms.bloomIntensity));
    }

    // Film grain: pixel-snapped Dave Hoskins hash.
    if (settings.grain.enabled) {
      const cell = st.mul(safeRes).div(uniforms.grainSize.max(1.0));
      const noise = hash12Node(cell.add(vec2(time.mul(uniforms.grainSpeed), seed)));
      rgb = rgb.add(noise.sub(0.5).mul(uniforms.grainIntensity));
    }

    // Chromatic aberration: separate R/B channel taps.
    if (settings.chromatic.enabled) {
      const offset = vec2(uniforms.chromaticOffset.div(safeRes.x), 0.0);
      const rTap = sampleAt(sampleUv.add(offset));
      const bTap = sampleAt(sampleUv.sub(offset));
      rgb = vec3(
        linearTosRGBChannel(rTap.r),
        rgb.g,
        linearTosRGBChannel(bTap.b)
      );
    }

    // Scanlines.
    if (settings.scanlines.enabled) {
      const line = sin(st.y.mul(safeRes.y).div(uniforms.scanlineSpacing.max(1.0)).mul(3.14159265))
        .mul(0.5)
        .add(0.5);
      rgb = rgb.mul(float(1.0).sub(line.mul(uniforms.scanlineOpacity)));
    }

    // Vignette.
    if (settings.vignette.enabled) {
      const centered = st.sub(0.5).mul(2.0);
      const dist = centered.dot(centered).sqrt();
      const falloff = smoothstep(
        uniforms.vignetteRadius,
        uniforms.vignetteRadius.add(0.45),
        dist
      );
      rgb = rgb.mul(float(1.0).sub(falloff.mul(uniforms.vignetteIntensity)));
    }

    // Phosphor tint (green / amber / white / custom).
    if (settings.phosphor.enabled) {
      const lum = rgb.r.mul(0.299).add(rgb.g.mul(0.587)).add(rgb.b.mul(0.114));
      const tinted = vec3(lum).mul(uniforms.phosphorColor);
      rgb = mix(rgb, tinted, uniforms.phosphorIntensity);
    }

    if (outside) {
      rgb = outside.select(vec3(0.0), rgb);
    }

    rgb = rgb.clamp(0.0, 1.0);

    const linearRGB = vec3(
      sRGBToLinearChannel(rgb.r),
      sRGBToLinearChannel(rgb.g),
      sRGBToLinearChannel(rgb.b)
    );

    return vec4(linearRGB, baseLinear.a ?? float(1.0));
  })();
}
