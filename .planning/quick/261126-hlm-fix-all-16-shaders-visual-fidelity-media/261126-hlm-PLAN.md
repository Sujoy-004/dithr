---
phase: quick-261126-hlm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/engine/color/luminance.ts
  - web/src/engine/registry/types.ts
  - web/src/engine/registry/index.ts
  - web/src/engine/TextureAtlas.ts
  - web/src/engine/graph/GraphCompiler.ts
  - web/src/engine/Pipeline.ts
  - web/src/engine/registry/stylize/ascii.ts
  - web/src/engine/registry/stylize/dither.ts
  - web/src/engine/registry/stylize/halftone.ts
  - web/src/engine/registry/stylize/matrix.ts
  - web/src/engine/registry/stylize/dots.ts
  - web/src/engine/registry/stylize/contour.ts
  - web/src/engine/registry/stylize/pixelSort.ts
  - web/src/engine/registry/stylize/blockify.ts
  - web/src/engine/registry/stylize/threshold.ts
  - web/src/engine/registry/stylize/edgeDetect.ts
  - web/src/engine/registry/stylize/crosshatch.ts
  - web/src/engine/registry/stylize/waveLines.ts
  - web/src/engine/registry/stylize/noise.ts
  - web/src/engine/registry/stylize/voronoi.ts
  - web/src/engine/registry/stylize/tone.ts
  - web/src/engine/registry/stylize/threeD.ts
  - web/src/engine/registry/modulate/crtVhs.ts
  - web/src/engine/registry/modulate/grain.ts
  - web/src/engine/registry/modulate/rgbSplit.ts
  - web/src/engine/registry/modulate/masks.ts
  - web/src/store/useStudioStore.ts
  - web/src/components/layout/CenterStage.tsx
  - web/src/components/panels/SourceAndShaderPanel.tsx
  - web/src/components/panels/EffectInspector.tsx
  - web/src/components/panels/ExportDrawer.tsx
  - web/src/tests/stackStore.test.ts
  - web/src/tests/audioEngine.test.ts
  - web/src/tests/masks.test.ts
  - web/src/tests/graphCompiler.test.ts
  - web/src/tests/tracerPipeline.test.ts
  - web/e2e/shaderSnapshots.spec.ts
autonomous: true
requirements:
  - SHADER-01
  - SHADER-03
  - FX-01
  - FX-02
  - FX-03
  - FX-04
  - MEDIA-01
estimate:
  tokens: 55000
  raw_tokens: 55000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "Uploading an image or video defaults to an empty shader stack (activeStack = []) and renders the original media faithfully in passthrough mode at capped native aspect and resolution without ASCII applied."
    - "Clicking any of the 16 shaders in the left shader list (including vhs -> crtVhs) immediately renders that shader on the uploaded media with responsive right-rail parameter sliders and dropdowns."
    - "Users can stack additional shaders sequentially on top of any active shader (e.g., dither -> vhs or ascii -> vhs) via + Stack buttons or Add effect pass, reorder/bypass/duplicate/remove individual passes, or Clear all back to raw media."
    - "All 16 stylize/modulate shaders evaluate perceptual Rec. 601 luminance without double sRGB/Linear conversion, use env.sampleAt via TextureNode.sample for spatial/multi-tap sampling across HalfFloatType ping-pong FBO stages, and apply fwidth() anti-aliasing."
  artifacts:
    - path: "web/src/engine/graph/GraphCompiler.ts"
      provides: "Linear-working-space stage planner and TSL graph compiler with env.sampleAt, select index uniforms, and HalfFloatType intermediate targets"
    - path: "web/src/engine/Pipeline.ts"
      provides: "Single-source-of-truth activeStack pipeline with implicit Stage-0 pre-tone and active ASCII/Matrix ramp uniform propagation"
    - path: "web/src/engine/TextureAtlas.ts"
      provides: "64px bold padded monospace glyph atlas with LinearFilter and NoColorSpace"
    - path: "web/src/store/useStudioStore.ts"
      provides: "Media-first empty default stack (DEFAULT_INITIAL_STACK = []), canonical vhs/crtVhs handling, clearStack, and CRT profile parameter sync"
    - path: "web/src/components/panels/SourceAndShaderPanel.tsx"
      provides: "16-shader selector with immediate auditioning, explicit + Stack buttons, Clear all, signal-flow ordering, and conditional ASCII ramp presets"
  key_links:
    - from: "web/src/engine/graph/GraphCompiler.ts"
      to: "web/src/engine/Pipeline.ts"
      via: "compileGraph and planExecutionStages with env.sampleAt and HalfFloatType stageDescriptors"
    - from: "web/src/engine/Pipeline.ts"
      to: "web/src/components/layout/CenterStage.tsx"
      via: "syncStack, updateTone, updateAscii, and resize without syncLegacyStack overwrite"
    - from: "web/src/store/useStudioStore.ts"
      to: "web/src/components/panels/SourceAndShaderPanel.tsx"
      via: "setSingleEffectFastPath, addEffect, clearStack, removeEffect, reorderStack, toggleEffect"
    - from: "web/src/components/panels/ExportDrawer.tsx"
      to: "web/src/export/imageExport.ts"
      via: "getActivePipeline().render() prior to exportRasterImage canvas.toBlob"
---

<objective>
Overhaul the Studio WebGPU/WebGL2 shader pipeline, all 16 stylize/modulate shaders, and the Studio state/UI so uploaded media opens cleanly in true passthrough (non-ASCII default), every one of the 16 shaders renders with crisp, authentic visual fidelity, and users can seamlessly audition, stack sequentially (e.g. `dither` -> `vhs`), reorder, bypass, tweak parameters, or clear back to original media at any time.

Purpose: Eliminate the five systemic engine bugs identified in research (missing `env.sampleAt`, double sRGB/Linear conversion crushing luminance, `syncLegacyStack()` overwriting `activeStack` and breaking sliders/Tone Curve/`vhs`, unbound `'select'` uniforms, and idle 60fps loop / uncapped image resize) and upgrade every shader algorithm for crisp aspect-corrected, anti-aliased visual output.
Output: Repaired TSL `GraphCompiler`/`Pipeline`/`TextureAtlas`, modernized 16+ shader definitions, media-first composable stack store/UI/export wiring, and passing Vitest unit + Playwright E2E test suites.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@GEMINI.md
@DESIGN.md
@.planning/quick/261126-hlm-fix-all-16-shaders-visual-fidelity-media/261126-hlm-RESEARCH.md
@web/src/engine/graph/GraphCompiler.ts
@web/src/engine/Pipeline.ts
@web/src/engine/TextureAtlas.ts
@web/src/engine/color/luminance.ts
@web/src/engine/registry/index.ts
@web/src/engine/registry/types.ts
@web/src/store/useStudioStore.ts
@web/src/components/layout/CenterStage.tsx
@web/src/components/panels/SourceAndShaderPanel.tsx
@web/src/components/panels/EffectInspector.tsx
@web/src/components/panels/ExportDrawer.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Overhaul GraphCompiler, Pipeline, TextureAtlas, and Color/Luminance Foundation</name>
  <files>web/src/engine/color/luminance.ts, web/src/engine/registry/types.ts, web/src/engine/registry/index.ts, web/src/engine/TextureAtlas.ts, web/src/engine/graph/GraphCompiler.ts, web/src/engine/Pipeline.ts, web/src/engine/shaders/ascii.ts, web/src/engine/shaders/dither.ts, web/src/engine/shaders/effects.ts, web/src/engine/shaders/halftone.ts, web/src/engine/shaders/matrixRain.ts, web/src/engine/shaders/pixelSort.ts, web/src/engine/shaders/preTone.ts, web/src/engine/shaders/vhs.ts</files>
  <action>
1. Update `web/src/engine/color/luminance.ts`: preserve all existing exports (`REC601_COEFFICIENTS`, `REC709_COEFFICIENTS`, `rec601LuminanceCpu`, `rec601LuminanceInt`, `rec709LuminanceCpu`, `rec601Luminance`, `rec709Luminance`, `getLuminanceNode`) and add `rec601PerceptualLuminance(rgbNode)` which converts Linear RGB channels via `linearTosRGBChannel` from `./colorSpace` before computing Rec. 601 `0.299*R + 0.587*G + 0.114*B` so mid-gray `0.5` sRGB evaluates to `0.500` perceptual luminance. Also export GPU-precision-safe Dave Hoskins Hash-without-Sine TSL helpers (`hash12Node(p)` and `hash22Node(p)` using integer-free `fract`/`dot`/`vec3` arithmetic, no `sin`) so `noise`, `grain`, `matrix`, `voronoi`, and `crtVhs` avoid diagonal `sin` precision striping.
2. Update `web/src/engine/registry/types.ts` and `web/src/engine/registry/index.ts`:
   - Add optional `spatial?: boolean` on `EffectDefinition` (indicating neighborhood/cell UV sampling via `env.sampleAt`).
   - In `EffectRegistry.get(id)`, resolve `'vhs'` as an alias to `this.effects.get('crtVhs')` while keeping `ALL_EFFECT_DEFINITIONS` at 20 entries (`16` stylize + `4` modulate) so existing registry count assertions stay valid.
   - Update `compileLinearEffectStack()` to pass `sampleAt` in `passEnv` when `typeof sourceTextureNode?.sample === 'function'` and avoid double `sRGBToLinear`/`linearTosRGB` wrapping when `sourceTextureNode` is already a `TextureNode` or `vec4` linear input in tests.
3. Upgrade `web/src/engine/TextureAtlas.ts`:
   - Change default `fontSize` from `32` to `64`, render glyphs with `bold ${this.fontSize}px ${this.fontFamily}`, add a `4px` horizontal and vertical internal gutter per glyph cell (`slotWidth = charWidth + 8`, `slotHeight = charHeight + 8`), configure `this.texture.minFilter = THREE.LinearFilter`, `this.texture.magFilter = THREE.LinearFilter`, `this.texture.generateMipmaps = false`, and `this.texture.colorSpace = THREE.NoColorSpace`.
   - Preserve existing public methods (`updateRamp`, `getTexture`, `getCharCount`, `getCharWidth`, `getCharHeight`, `dispose`) and add `getSlotPaddingRatio()` returning `{ padX, padY }` so `ascii.ts` and `matrix.ts` clamp `innerUV` strictly inside the padded glyph box with zero neighbor bleed.
4. Overhaul `web/src/engine/graph/GraphCompiler.ts`:
   - Remove `sRGBToLinear` on Stage 0 input and `linearTosRGB` on Final Stage output (and on empty passthrough `stages.length === 0`), since `WebGPURenderer` already converts `SRGBColorSpace` textures to Linear on read and converts Linear to sRGB in `renderOutput()`. For empty passthrough (`stages.length === 0`), output `sourceNode` directly when present (or `vec4(0.004, 0.0045, 0.006, 1.0)` when null) unless an active Stage-0 pre-tone node is supplied in `env`.
   - Configure `dummyTexture` with `THREE.LinearFilter`, `generateMipmaps = false`, and `isRenderTargetTexture = true`.
   - Update `planExecutionStages(stack, registry)` so contiguous pointwise passes (`!def.requiresPass && !def.spatial`) plus at most ONE `spatial: true` pass (`!def.requiresPass`) fuse into a single `fused_fragment` stage (preserving 1-stage, 0-target fusion for `[tone, dither, blockify, threshold]`), while splitting to a new `requiresTarget: true` stage whenever a second `spatial: true` pass or a `requiresPass: true` pass follows any existing pass in `currentPasses`.
   - In `compileGraph()`, bind `env.sampleAt` cleanly for every pass in every stage: Stage 0 uses `(uvCoord) => sourceNode.sample(uvCoord)` when `typeof sourceNode?.sample === 'function'` (falling back to `sourceNode` for headless mock/vec4 test inputs), and Stage > 0 uses `(uvCoord) => inputTextureNode.sample(uvCoord)`. When a pointwise pass precedes a `spatial: true` pass in the same stage, wrap `stageSampleAt` through those pointwise transforms so the fused spatial pass samples pre-processed UVs accurately.
   - For `'select'` parameter schemas, bind `uniform(Math.max(0, schema.options.indexOf(String(paramValue))))` in `uniformsMap` (preserving `computeTopologyHash` independence from parameter values).
   - Set intermediate stage `targetDescriptor` to `{ format: THREE.RGBAFormat, type: THREE.HalfFloatType }` for 16-bit linear FBO precision without dark banding.
   - Support optional Stage-0 pre-tone via `env?.preToneUniforms` (applied before Stage 0 effects, and even on empty `activeStack` when `preToneActive` is true, without mutating `activeStack` or `computeTopologyHash`).
5. Overhaul `web/src/engine/Pipeline.ts`:
   - Delete `syncLegacyStack()`, `setEffect()`, `setColorGrading()`, `updateEffectParam()`, `activeEffect`, `colorGrading`, and `legacyParams`. In `init()`, call `this.syncStack(this.currentStack, this.currentTier)` (empty `[]` default) instead of `syncLegacyStack()`.
   - Update `updateTone(settings: ToneSettings)` to write `__preTone__:*` uniforms (`brightness`, `contrast`, `saturation`, `hueRotation`, `gamma`, `invert`) and toggle Stage-0 pre-tone inclusion only when transitioning between neutral (`1,1,1,0,1,false`) and non-neutral, keeping raw passthrough zero-overhead when neutral.
   - Update `updateAscii(settings: AsciiSettings)` to update `this.textureAtlas.updateRamp(...)` and propagate `rampLength = this.textureAtlas.getCharCount()` across all active `'ascii'`, `'matrix'`, and `'threeD'` passes in `this.currentStack` / `this.uniformsMap`.
   - Update `updateUniform(instanceId, paramKey, value)` so `'select'` string values resolve via `schema.options.indexOf(String(value))` into numeric uniform values without triggering graph recompilation.
   - Guard `PassPool.acquire` in `render()` so if `HalfFloatType` target creation fails on a constrained context, it falls back safely to `UnsignedByteType`.
   - Remove the 8 dead legacy files under `web/src/engine/shaders/`.
  </action>
  <verify>
    <automated>npm --prefix web run build && npm --prefix web run test:unit</automated>
  </verify>
  <done>
`GraphCompiler.ts`, `Pipeline.ts`, `TextureAtlas.ts`, `luminance.ts`, and `registry/index.ts` compile cleanly under `tsc --noEmit` and `vite build`, dead `web/src/engine/shaders/*.ts` files are deleted, `env.sampleAt` + `HalfFloatType` FBOs + `vhs` alias + `select` uniform indexing are wired, and `npm --prefix web run test:unit` passes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Upgrade Visual Fidelity and Parameter Controls Across All 16 Shaders (+ Modulate &amp; 3D)</name>
  <files>web/src/engine/registry/stylize/ascii.ts, web/src/engine/registry/stylize/dither.ts, web/src/engine/registry/stylize/halftone.ts, web/src/engine/registry/modulate/crtVhs.ts, web/src/engine/registry/stylize/matrix.ts, web/src/engine/registry/stylize/dots.ts, web/src/engine/registry/stylize/contour.ts, web/src/engine/registry/stylize/pixelSort.ts, web/src/engine/registry/stylize/blockify.ts, web/src/engine/registry/stylize/threshold.ts, web/src/engine/registry/stylize/edgeDetect.ts, web/src/engine/registry/stylize/crosshatch.ts, web/src/engine/registry/stylize/waveLines.ts, web/src/engine/registry/stylize/noise.ts, web/src/engine/registry/stylize/voronoi.ts, web/src/engine/registry/stylize/tone.ts, web/src/engine/registry/stylize/threeD.ts, web/src/engine/registry/modulate/grain.ts, web/src/engine/registry/modulate/rgbSplit.ts, web/src/engine/registry/modulate/masks.ts, web/src/tests/masks.test.ts</files>
  <action>
Upgrade every shader definition in `web/src/engine/registry/` so each produces authentic, aspect-corrected, anti-aliased visual output using perceptual Rec. 601 luminance (`rec601PerceptualLuminance`) where luminance drives glyphs/dots/thresholds/bands, while preserving mock-object resilience (`typeof env?.sampleAt === 'function'`, `typeof inputNode === 'function'`, fallback `inputNode`), preserving `capabilities.test.ts` `costWeight` expectations (`1` for `tone`, `dither`, `ascii`, `noise`, `grain`, `blockify`, `threshold`, `dots`, `rgbSplit`, `masks`), and preserving all helper exports tested in `masks.test.ts` (`computeChannelOffsets`, `computeMaskValue`, `applyCrtProfile`, `computeBarrelDistortion`, `CRT_VHS_PROFILES`):

1. `stylize/ascii.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 1`): 4-tap box supersampling per cell (`cellW = max(4, cellScale * charAspect)`, `cellH = max(4, cellScale)`) via `sampleAt`; perceptual Rec. 601 luminance with `contrast` parameter (default `1.15`) and dark floor (`< 0.03` -> space); padded `LinearFilter` atlas lookup with `fwidth`-sharpened `smoothstep` alpha; `colorMode` select (`'truecolor' | 'monochrome' | 'green' | 'amber'`, default `'truecolor'`) over `#060709` ink background.
2. `stylize/dither.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 1`): Add `pixelSize` (`1..8 px`, default `2.0`) cell-center sampling via `sampleAt`; evaluate quantization in perceptual sRGB and convert back to Linear; implement `matrixType` select (`'bayer4' | 'bayer8' | 'bayer2' | 'ign'`, default `'bayer8'`) driven by numeric uniform index; scale threshold offset by `spread / (colorSteps - 1)`; add `monochrome` boolean (default `false`); keep `colorSteps` default `4.0` and `spread` default `0.5` (compatible with existing store tests).
3. `stylize/halftone.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 1`): Aspect-corrected pixel-space rotation `(st - 0.5) * resolution`, cell quantization at `resolution.y / frequency`, inverse-rotated `sampleAt(cellCenterUV)`, perceptual luma `sqrt(lum) * 0.5 * dotRadius`, `fwidth(dist)` anti-aliased `smoothstep`, and `mode` select (`'color' | 'monochrome' | 'cmyk'`, default `'color'`).
4. `modulate/crtVhs.ts` (`requiresPass: true`, `costWeight: 3`): Keep `id: 'crtVhs'`, `CRT_VHS_PROFILES`, `applyCrtProfile`, `computeBarrelDistortion`, and existing schema defaults (`profile: 'vhsSp'`, `curvature: 0.0`, `scanlineIntensity: 0.2`, `scanlineCount: 480.0`, `phosphorDecay: 0.1`, `trackingJitter: 0.1`, `bloomIntensity: 0.15`, `vignette: 0.1`, `noiseIntensity: 0.05`) plus `aberration` (`0..12 px`, default `2.0`). Use `sampleAt` for barrel distortion with `smoothstep` anti-aliased bezel, VHS horizontal tracking wave + head-switch tear, 3-tap chroma R/B aberration, anti-aliased scanlines, Dave Hoskins noise, and 5-tap highlight phosphor bloom.
5. `stylize/matrix.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 2`): Quantize into aspect-corrected cells (`cellW = resolution.x / density`, `cellH = cellW * 1.45`), sample `sampleAt(cellCenterUV)` for perceptual `lum`, drive column stream/head with Dave Hoskins hash, sample flickering glyphs from `env.textureAtlas` (`LinearFilter` + `smoothstep` sharpening with `rampLength`), and modulate phosphor green by `lum * 0.8 + stream * 0.45`.
6. `stylize/dots.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 1`): Snap to square grid `cellSize = max(4, spacing)`, `sampleAt(cellCenterUV)`, perceptual `lum` -> `dotR = sqrt(lum) * 0.48 * radius`, `fwidth(dist)` anti-aliased `smoothstep` onto dark `#050608` LED housing (`0.03 * col`).
7. `stylize/contour.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 1`): 5-tap cross-smoothed perceptual `lum` via `sampleAt`, derivative-normalized isolines `abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 0.0001)` with `smoothstep`, `lineWidth` (`0.5..4.0 px`, default `1.5`), and `colorize` boolean (default `false` chalk `#e9ebf0` on `#07080b`).
8. `stylize/pixelSort.ts` (`requiresPass: true`, `costWeight: 2`): 12 directional taps via `sampleAt` along `direction` (`horizontal` / `vertical` uniform index) over `sortSpan` with band-quantized smooth time modulation (eliminating frame-strobing random noise) and distance-tapered streak interpolation.
9. `stylize/blockify.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 1`): 4-tap box average inside `blockSize` via `sampleAt` plus symmetric tile border SDF with `smoothstep` grout darkening (`gridLine`, default `0.15`).
10. `stylize/threshold.ts` (`requiresPass: false`, `costWeight: 1`): Perceptual `lum`, `softness` (`0..0.25`, default `0.02`), `fwidth(lum)` anti-aliased `smoothstep` outputting `#07080b` / `#f0f2f6`, `cutoff` default `0.45`, `invert` toggle.
11. `stylize/edgeDetect.ts` (`requiresPass: true`, `costWeight: 2`): Full 3x3 Sobel operator over perceptual Rec. 601 luma via `sampleAt` at `thickness / resolution` step, `smoothstep(0.06, 0.9, mag * sensitivity)`, and `mode` select (`'whiteOnBlack' | 'blackOnWhite' | 'colorEdges'`, default `'colorEdges'`).
12. `stylize/crosshatch.ts` (`requiresPass: false`, `costWeight: 1`): Perceptual `lum`, 4-angle engraving layers (`45°`, `-45°`, `26.5°`, `-63.5°`) with `fwidth`-normalized stroke AA, `invert` toggle, and `colorInk` mix (`0..1`, default `0.0`).
13. `stylize/waveLines.ts` (`spatial: true`, `requiresPass: false`, `costWeight: 1`): `frequency` horizontal scanlines (`resolution.y / frequency`), `sampleAt(vec2(st.x, lineCenterY))` for perceptual `lum`, harmonic vertical displacement + thickness modulation driven by `lum * amplitude`, `fwidth`-smoothed `smoothstep` wave lines, `colorize` toggle (default `true`) on `#06070a`.
14. `stylize/noise.ts` (`requiresPass: false`, `costWeight: 1`): Pixel-snapped grid `floor(st * resolution / grainSize)` using Dave Hoskins Hash-without-Sine (`hash12Node` / `hash22Node`) with triangular PDF, midtone emulsion weighting, `monochrome` toggle (default `true`), `speed` param.
15. `stylize/voronoi.ts` (`requiresPass: true`, `costWeight: 2`): Genuine 3x3 Worley neighbor search in pixel space `(st * resolution) / scale` with Dave Hoskins jittered seeds, tracking `d1`, `d2`, and `bestCellUV`, sampling `sampleAt(bestCellUV)` for flat facet coloring plus optional `fwidth`-smoothed `borderWidth` via `(d2 - d1)`.
16. `stylize/tone.ts` (`requiresPass: false`, `costWeight: 1`): Convert Linear -> sRGB via `linearTosRGB`, apply `brightness`, `contrast` around `0.5`, Rec. 601 `saturation`, unclamped Rodrigues `hueRotation`, `gamma`, `invert`, clamp `[0,1]`, and convert back to Linear via `sRGBToLinear`.
17. `stylize/threeD.ts`, `modulate/grain.ts`, `modulate/rgbSplit.ts`, `modulate/masks.ts`, and `web/src/tests/masks.test.ts`: Update `threeD.ts` to read numeric uniform indices for `renderMode`/`primitive`; update `grain.ts` to Dave Hoskins hash + midtone weighting; mark `rgbSplit.ts` `spatial: true` with `masterAmount` default `4.0` (so stacking `rgbSplit` is immediately visible) and update `web/src/tests/masks.test.ts` `masterAmount.default` expectation to `4.0`; add aspect-ratio correction in `masks.ts` when `env?.resolution` is provided while keeping `computeMaskValue` unchanged.
  </action>
  <verify>
    <automated>npm --prefix web run build && npm --prefix web run test:unit</automated>
  </verify>
  <done>
All 20 `EffectRegistry` shaders build valid TSL node graphs without errors, implement perceptual luminance / `env.sampleAt` / `fwidth()` anti-aliasing / authentic algorithms, `web/src/tests/masks.test.ts` reflects the visible `rgbSplit.masterAmount` default (`4.0`), and `npm --prefix web run build && npm --prefix web run test:unit` passes completely.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire Media-First Non-ASCII Default, Composable Stack UI/Export, and Expand Unit + Playwright E2E Tests</name>
  <files>web/src/types/studio.ts, web/src/store/useStudioStore.ts, web/src/components/layout/CenterStage.tsx, web/src/components/panels/SourceAndShaderPanel.tsx, web/src/components/panels/EffectInspector.tsx, web/src/export/imageExport.ts, web/src/components/panels/ExportDrawer.tsx, web/src/tests/stackStore.test.ts, web/src/tests/audioEngine.test.ts, web/src/tests/graphCompiler.test.ts, web/src/tests/tracerPipeline.test.ts, web/e2e/shaderSnapshots.spec.ts</files>
  <action>
1. Update `web/src/types/studio.ts` & `web/src/store/useStudioStore.ts`:
   - Set `DEFAULT_INITIAL_STACK = []` (empty array — media-first passthrough, NOT ASCII by default).
   - Update `StudioState` so `effect: EffectMode | null` (initial value `null`), `selectedPassId: null`, and `activeStack: DEFAULT_INITIAL_STACK`.
   - Canonicalize `'vhs'` -> `'crtVhs'` inside `addEffect` and `setSingleEffectFastPath` so clicking `vhs` in the 16-shader list or calling `setSingleEffectFastPath('vhs')` / `addEffect('vhs')` resolves cleanly to `crtVhsEffect` and displays in the active stack.
   - Add `clearStack()` action to empty `activeStack` (`[]`), set `selectedPassId: null`, `effect: null`, and call `activePipeline?.syncStack([], state.activeTier)` to return immediately to raw original media.
   - In `updatePassParam`, when `pass.effectId === 'crtVhs'` and `paramKey === 'profile'`, apply `applyCrtProfile(value as CrtVhsProfileName)` parameters onto the pass and push those uniform updates to `activePipeline?.updateUniform(...)` so sliders and GPU output stay synchronized.
   - Call `activePipeline?.updateTone(nextTone)` on `updateTone`/`resetTone` and `activePipeline?.updateAscii(nextAscii)` on `updateAscii` directly in addition to state updates.
2. Update `web/src/components/layout/CenterStage.tsx`:
   - Remove the stale `useEffect(() => pipelineRef.current?.setEffect(effect), [effect])` and `useEffect(() => ... updateEffectParam, [effectParams])` hooks that overwrote `activeStack`.
   - Extract a single `getCappedDimensions(dims, tier)` helper and use it consistently in `bootPipeline`, `activeTier/dimensions` resize effect, `img.onload`, `onLoadedMetadata`, and `onPlaying` so uploaded media always renders at true aspect ratio capped to the active tier's `maxDimension`.
   - Update `shouldRunContinuousLoop()` so static images do NOT spin a continuous 60fps loop when idle — only run continuous `rAF` when `isTestMode`, `mediaType === 'video' | 'webcam'`, `audioState.enabled && audioState.status === 'live'`, or an enabled animated shader (`matrix`, `waveLines`, `noise`, `grain`, `crtVhs`, `threeD`, `pixelSort`) is in `activeStack`. Trigger an immediate single-frame render whenever `activeStack`, `tone`, `ascii`, `dimensions`, `activeTier`, or `mediaUrl` updates while idle on a static image.
3. Update `web/src/components/panels/SourceAndShaderPanel.tsx` & `web/src/components/panels/EffectInspector.tsx` (strictly preserving `DESIGN.md` zero-chroma `#0c0d10`/`#13151a`/`#1d2028`/`#e9ebf0` tokens and `0px` docked corners):
   - In `SourceAndShaderPanel.tsx`:
     - Show `"Original media (no active shaders)"` in the Active Stack section when `activeStack.length === 0`.
     - Add a **`Clear all`** button when `activeStack.length > 0` to clear back to raw media in one click.
     - On every active stack row, display 1-based signal-flow index (`1`, `2`, ...), **Move Up** and **Move Down** buttons alongside drag handle / keyboard Space+Arrows, Eye (bypass), Duplicate, and Trash (remove).
     - In the 16-shader list (`EFFECT_LIST`), match `'vhs'` to `'crtVhs'` for active/present highlighting; clicking the shader row calls `setSingleEffectFastPath(mode)` for instant 1-click stylizing, while an explicit **`+ Stack`** button on every shader row calls `addEffect(mode)` so the user can stack `vhs` on top of `dither` (or any chain) at any moment.
     - Render `ASCII ramp presets` only when `activeStack` contains an enabled or present `ascii`, `matrix`, or `threeD` pass.
   - In `EffectInspector.tsx`: update the empty selection message to guide users to select any of the 16 shaders or `+ Stack` to layer effects.
4. Update `web/src/export/imageExport.ts` & `web/src/components/panels/ExportDrawer.tsx`:
   - In `ExportDrawer.tsx` (`handleRaster`), call `getActivePipeline()?.render(useStudioStore.getState().playbackTime || 0)` immediately before `exportRasterImage(canvas, format)` so static-image snapshots never read a cleared WebGL2 backbuffer (`preserveDrawingBuffer: false`).
5. Update and expand unit & Playwright E2E tests:
   - `web/src/tests/stackStore.test.ts`: test `DEFAULT_INITIAL_STACK` is `[]`, `selectedPassId` is `null`, `effect` is `null`, `addEffect('dither')` -> `addEffect('vhs')` builds a 2-pass `['dither', 'crtVhs']` stack, `clearStack()` restores `[]`, `crtVhs` `profile` change updates bundled parameters, plus `reorderStack`, `removeEffect`, `toggleEffect`, `duplicateEffect`, `setSingleEffectFastPath`.
   - `web/src/tests/audioEngine.test.ts`: initialize an `'ascii'` pass in the `beforeEach` store setup rather than indexing empty `DEFAULT_INITIAL_STACK[0]`.
   - `web/src/tests/graphCompiler.test.ts`: add unit tests covering (a) empty stack passthrough without double sRGB/Linear conversion, (b) `[tone, dither, blockify, threshold]` 1-stage 0-target fusion with `env.sampleAt` wired, (c) `[dither, crtVhs]`, `[ascii, crtVhs]`, and `[halftone, blockify]` splitting into multi-stage ping-pong FBOs with `HalfFloatType` targets and `inputTextureNode.sample` wiring, and (d) `'select'` parameter index uniform registration.
   - `web/src/tests/tracerPipeline.test.ts`: verify `getEffectDefinition('vhs')` resolves to `crtVhsEffect` and `rec601PerceptualLuminance` builds a valid TSL node.
   - `web/e2e/shaderSnapshots.spec.ts`: inject a deterministic colored/gradient synthetic test image into `useStudioStore` (`mediaType: 'image'`), verify empty stack renders faithful passthrough colors (non-ASCII), verify all 16 shaders + `crtVhs`/`rgbSplit`/`masks`/`threeD` + stacked `dither -> vhs` and `ascii -> vhs` render non-black, non-NaN frames in Chromium SwiftShader, and verify clicking a shader row + `+ Stack` + `Clear all` in the Studio UI works end-to-end.
  </action>
  <verify>
    <automated>npm --prefix web run build && npm --prefix web run test:unit && npm --prefix web run test:e2e</automated>
  </verify>
  <done>
Media loads cleanly in non-ASCII passthrough (`activeStack = []`), all 16 shaders + stacked compositions (`dither -> vhs`, `ascii -> vhs`) render accurately in Chromium, `npm --prefix web run build`, `npm --prefix web run test:unit`, and `npm --prefix web run test:e2e` all pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local File / Drag-and-Drop -> Browser Canvas / GPU Texture | User-selected image, video, webcam stream, or GLB mesh enters local browser memory (`URL.createObjectURL`, `THREE.Texture`, `THREE.VideoTexture`) |
| UI Controls / Audio Reactivity -> Shader Uniforms | Slider, numeric input, select dropdown, custom ASCII ramp string, and audio band values bind into GPU uniform nodes |
| GPU Canvas / Offscreen RenderTargets -> WebGL2/WebGPU Context & Export | Multi-stage `HalfFloatType` FBO allocations and `canvas.toBlob()` readbacks execute inside browser GPU sandbox |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-hlm-01 | Tampering | `web/src/engine/registry/**` & `web/src/store/useStudioStore.ts` | medium | mitigate | Strictly clamp shader uniforms (`phosphorDecay` < 0.98, `cellScale` >= 4, `fwidth` denominators >= 0.0001, `zoom` in `[0.1, 8]`) and map `'select'` parameters via bounded `options.indexOf` so invalid values cannot produce NaN/Infinity or infinite loops in GPU shaders |
| T-hlm-02 | Denial of Service | `web/src/engine/graph/PassPool.ts` & `web/src/components/layout/CenterStage.tsx` | medium | mitigate | Cap canvas/FBO dimensions via `TIER_CONFIGS[activeTier].maxDimension`, enforce `evaluateTierBudget` stage/target limits, pause `rAF` on static idle images and hidden tabs, and dispose `sourceTexture`, `pipelineCache`, and `PassPool` targets on eject/unmount/context-loss |
| T-hlm-03 | Information Disclosure / XSS | `web/src/components/panels/EffectInspector.tsx` & `web/src/engine/TextureAtlas.ts` | low | mitigate | Render custom ASCII ramp strings strictly onto 2D `<canvas>` via `ctx.fillText` and React text nodes without `dangerouslySetInnerHTML` or `eval`; keep all media processing 100% local in-browser |
| T-hlm-04 | Spoofing / Resource Exhaustion | `web/src/store/useStudioStore.ts` & `web/src/services/meshLoader.ts` | low | accept | Existing extension/MIME checks and 50MB GLB magic-header validation remain enforced in `loadMediaFile` and `validateGLBHeader` |
| T-hlm-SC | Tampering | npm/pip/cargo installs | low | accept | No new npm, pip, or cargo packages are introduced in this task; uses pinned workspace `three@0.187.0` and existing `web/package.json` dependencies |
</threat_model>

<verification>
1. Type-check & production bundle: `npm --prefix web run build` exits 0 with zero TypeScript or Vite bundling errors.
2. Unit & shader graph suite: `npm --prefix web run test:unit` passes all test files including updated `stackStore.test.ts`, `audioEngine.test.ts`, `masks.test.ts`, `graphCompiler.test.ts`, and `tracerPipeline.test.ts`.
3. Browser E2E visual & stack verification: `npm --prefix web run test:e2e` passes `canvas.spec.ts`, `export.spec.ts`, `tier.spec.ts`, and expanded `shaderSnapshots.spec.ts` (passthrough fidelity, all 16 shaders, and multi-pass `dither -> vhs` / `ascii -> vhs` stacks).
</verification>

<success_criteria>
- Uploaded images/videos/samples render unmodified original media by default (`DEFAULT_INITIAL_STACK = []`) at capped native aspect ratio and linear-to-sRGB accuracy.
- All 16 shaders (including `vhs` -> `crtVhs`) render authentic, non-muddy, aspect-corrected, anti-aliased visuals and respond immediately to all right-rail sliders, dropdowns, and Tone Curve controls.
- Sequential multi-shader composition (e.g., `dither -> vhs`, `ascii -> vhs`) executes cleanly via `HalfFloatType` ping-pong FBO stages with `env.sampleAt`, and UI supports 1-click auditioning, `+ Stack`, reorder, toggle, duplicate, remove, and `Clear all`.
- `npm --prefix web run build`, `npm --prefix web run test:unit`, and `npm --prefix web run test:e2e` all pass.
</success_criteria>

<output>
After completion, create `.planning/quick/261126-hlm-fix-all-16-shaders-visual-fidelity-media/261126-hlm-SUMMARY.md` summarizing changes and verification results.
</output>
