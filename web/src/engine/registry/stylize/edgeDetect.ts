import {
  Fn,
  uv,
  vec2,
  vec3,
  vec4,
  float,
  mix,
  smoothstep,
} from 'three/tsl';
import type { EffectDefinition } from '../types';
import { rec601PerceptualLuminance } from '../../color/luminance';
import { toNode, resolveSelectNode, sampleWithEnv } from '../tslHelpers';

const EDGE_MODES = ['whiteOnBlack', 'blackOnWhite', 'colorEdges'] as const;

/**
 * Edge Detection convolution filter effect definition (D-01, D-05, D-20).
 * Full 3x3 Sobel gradient operator over perceptual Rec. 601 luminance via env.sampleAt
 * with noise-floor smoothstep and whiteOnBlack / blackOnWhite / colorEdges modes.
 */
export const edgeDetectEffect: EffectDefinition = {
  id: 'edgeDetect',
  label: 'Edge Detection',
  category: 'stylize',
  requiresPass: true,
  costWeight: 2,
  parameters: {
    sensitivity: {
      type: 'float',
      min: 0.5,
      max: 10.0,
      default: 2.5,
      step: 0.1,
      audioModulatable: true,
    },
    thickness: {
      type: 'float',
      min: 1.0,
      max: 5.0,
      default: 1.0,
      step: 0.5,
      unit: 'px',
    },
    mode: {
      type: 'select',
      default: 'colorEdges',
      options: [...EDGE_MODES],
    },
  },
  buildNode: (inputNode, uniforms, env) => {
    const sensitivity = toNode(uniforms.sensitivity, 2.5);
    const thickness = toNode(uniforms.thickness, 1.0);
    const modeIdx = resolveSelectNode(uniforms.mode, EDGE_MODES, 2);
    const resolution = env?.resolution ?? uniforms.resolution ?? vec2(1920.0, 1080.0);

    return Fn(() => {
      const st = uv();
      const safeRes = resolution.max(vec2(1.0, 1.0));
      const baseCol = sampleWithEnv(inputNode, env, st);

      const step = vec2(thickness).div(safeRes);

      const lumaAt = (dx: number, dy: number) => {
        const coord = st.add(vec2(step.x.mul(dx), step.y.mul(dy))).clamp(0.001, 0.999);
        return rec601PerceptualLuminance(sampleWithEnv(inputNode, env, coord).rgb);
      };

      const tl = lumaAt(-1, -1);
      const tc = lumaAt(0, -1);
      const tr = lumaAt(1, -1);
      const ml = lumaAt(-1, 0);
      const mr = lumaAt(1, 0);
      const bl = lumaAt(-1, 1);
      const bc = lumaAt(0, 1);
      const br = lumaAt(1, 1);

      const gx = tr
        .add(mr.mul(2.0))
        .add(br)
        .sub(tl)
        .sub(ml.mul(2.0))
        .sub(bl);
      const gy = bl
        .add(bc.mul(2.0))
        .add(br)
        .sub(tl)
        .sub(tc.mul(2.0))
        .sub(tr);

      const rawMag = gx.mul(gx).add(gy.mul(gy)).sqrt();
      const mag = smoothstep(0.06, 0.9, rawMag.mul(sensitivity));

      const inkBg = vec3(0.003, 0.0035, 0.005);
      const chalk = vec3(0.88, 0.90, 0.93);

      const whiteOnBlack = mix(inkBg, chalk, mag);
      const blackOnWhite = mix(chalk, inkBg, mag);
      const colorEdges = mix(inkBg, baseCol.rgb.mul(1.35).clamp(0.0, 1.0), mag);

      const finalRGB = modeIdx
        .equal(float(0.0))
        .select(
          whiteOnBlack,
          modeIdx.equal(float(1.0)).select(blackOnWhite, colorEdges)
        );

      return vec4(finalRGB, baseCol.a ?? float(1.0));
    })();
  },
};
