---
phase: quick-261126-hlm
plan: 01
subsystem: gpu-shader-pipeline-and-studio-ui
tags: [three-tsl, webgpu, webgl2, shaders, zustand, react, playwright, vitest]

requires:
  - phase: 02-shader-engine-2-0-advanced-fx
    provides: Dynamic EffectRegistry, GraphCompiler, PassPool, and StudioPipeline architecture
provides:
  - Linear-working-space GraphCompiler with env.sampleAt, select index uniforms, and HalfFloatType ping-pong targets
  - Media-first empty default shader stack (DEFAULT_INITIAL_STACK = []) with passthrough color accuracy
  - Visual fidelity overhaul across all 16 stylize shaders plus crtVhs, rgbSplit, grain, masks, and threeD
  - Composable UI stack workflow (+ Stack, Clear all, Move Up/Down, vhs -> crtVhs canonicalization) and E2E verification
affects: [studio-ui, export-pipeline, shader-registry]

actuals:
  tokens: 57641
  tasks: 3
  commits: 3
  plan_head_before: e4ff76f6ca382ab4202d69efd0099455cb60ed0e
  plan_head_after: b290411e13b680a3d43aca30c5b0522e9be5593a

tech-stack:
  added: []
  patterns:
    - "Single Linear working space across GraphCompiler stages with rec601PerceptualLuminance for perceptual thresholds"
    - "Dave Hoskins integer-free Hash-without-Sine (hash12Node, hash22Node) to prevent diagonal sin() precision banding"
    - "fwidth() hardware-derivative anti-aliasing across glyphs, dots, contours, thresholds, crosshatching, and wave lines"
    - "env.sampleAt closure wiring through TextureNode.sample and pointwise prefix wrappers"

key-files:
  created:
    - web/src/engine/registry/tslHelpers.ts
  modified:
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
    - web/src/tests/masks.test.ts
    - web/src/tests/stackStore.test.ts
    - web/src/tests/audioEngine.test.ts
    - web/src/tests/graphCompiler.test.ts
    - web/src/tests/tracerPipeline.test.ts
    - web/e2e/shaderSnapshots.spec.ts

key-decisions:
  - "Kept ditherEffect spatial: false in stage planning while still sampling env.sampleAt when available so [tone, dither, blockify, threshold] fuses into 1 stage with 0 intermediate RenderTargets"
  - "Added shared tslHelpers.ts (toNode, resolveSelectNode, sampleWithEnv) to avoid duplicating node coercion and select-option resolution across 20 shader files"
  - "Canonicalized 'vhs' -> 'crtVhs' in EffectRegistry.get(), useStudioStore (addEffect/setSingleEffectFastPath), and SourceAndShaderPanel while keeping ALL_EFFECT_DEFINITIONS count at 20"

patterns-established:
  - "Zero-copy media-first passthrough: DEFAULT_INITIAL_STACK = [] with implicit neutral Stage-0 pre-tone bypass"
  - "Idle static-image GPU power guard: continuous rAF loop runs only for video, webcam, live audio, testMode, or animated shaders; static edits trigger immediate single-frame renders"

requirements-completed:
  - SHADER-01
  - SHADER-03
  - FX-01
  - FX-02
  - FX-03
  - FX-04
  - MEDIA-01

coverage:
  - id: D1
    description: "Media-first empty shader stack passthrough (activeStack = []) renders uploaded media faithfully without double sRGB/Linear conversion"
    requirement: MEDIA-01
    verification:
      - kind: unit
        ref: "web/src/tests/stackStore.test.ts#initializes with media-first empty active stack (passthrough default)"
        status: pass
      - kind: unit
        ref: "web/src/tests/graphCompiler.test.ts#compiles empty stack as direct linear passthrough without double color-space wrapping"
        status: pass
      - kind: e2e
        ref: "web/e2e/shaderSnapshots.spec.ts#1. Media upload defaults to empty stack passthrough with faithful source colors (non-ASCII)"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 16 stylize shaders plus crtVhs, rgbSplit, grain, masks, and threeD render distinct, anti-aliased, non-NaN output with env.sampleAt and HalfFloatType FBOs"
    requirement: SHADER-01
    verification:
      - kind: unit
        ref: "web/src/tests/tracerPipeline.test.ts#builds node graphs for all 16 registered effects without error"
        status: pass
      - kind: unit
        ref: "web/src/tests/graphCompiler.test.ts#wires env.sampleAt for fused 1-stage spatial pass and splits multi-stage FBO stacks with HalfFloatType"
        status: pass
      - kind: e2e
        ref: "web/e2e/shaderSnapshots.spec.ts#2. All 16 shaders + crtVhs/rgbSplit/masks/threeD render distinct non-black non-NaN output"
        status: pass
    human_judgment: false
  - id: D3
    description: "Composable shader stack UI (+ Stack, dither -> vhs, ascii -> vhs, reorder, toggle, Clear all) and pre-export raster render sync"
    requirement: FX-01
    verification:
      - kind: unit
        ref: "web/src/tests/stackStore.test.ts#addEffect appends passes sequentially and canonicalizes vhs -> crtVhs"
        status: pass
      - kind: e2e
        ref: "web/e2e/shaderSnapshots.spec.ts#3. UI workflow: click shader, + Stack (dither -> vhs, ascii -> vhs), reorder, toggle, Clear all"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-11-27
status: complete
---

# Quick Task 261126-hlm: Fix All 16 Shaders Visual Fidelity, Media-First Non-ASCII Default & Composable Shader Stack Summary

**Overhauled the Three.js TSL WebGPU/WebGL2 post-processing pipeline (`GraphCompiler`, `Pipeline`, `TextureAtlas`, perceptual Rec. 601 luminance), upgraded all 20 shader definitions (`16 stylize + 4 modulate`), and wired media-first passthrough (`DEFAULT_INITIAL_STACK = []`) with composable multi-pass UI controls.**

## Performance

- **Duration:** ~18 min (resumed run completing Task 1 commit, Task 2, and Task 3)
- **Started:** 2026-11-27T02:48:22Z
- **Completed:** 2026-11-27T03:06:30Z
- **Tasks:** 3
- **Files modified:** 38 created/modified (+ 8 dead legacy shader files deleted)

## Accomplishments

- **Pipeline & Color-Space Repair:** Removed double `sRGBToLinear`/`linearTosRGB` wrapping in `GraphCompiler.ts`, added `rec601PerceptualLuminance` and Dave Hoskins Hash-without-Sine (`hash12Node`, `hash22Node`) in `luminance.ts`, wired `env.sampleAt` via `TextureNode.sample` and pointwise prefix closures, allocated `HalfFloatType` intermediate FBOs (with `UnsignedByteType` fallback), upgraded `TextureAtlas.ts` to 64px bold padded monospace glyphs with `LinearFilter`, bound `'select'` parameters as numeric uniform indices, and deleted `syncLegacyStack()` plus 8 unused `web/src/engine/shaders/*.ts` files.
- **20-Shader Visual Fidelity Upgrade:** Rebuilt `ascii`, `dither`, `halftone`, `crtVhs`, `matrix`, `dots`, `contour`, `pixelSort`, `blockify`, `threshold`, `edgeDetect`, `crosshatch`, `waveLines`, `noise`, `voronoi`, `tone`, `threeD`, `grain`, `rgbSplit`, and `masks` using perceptual Rec. 601 luminance, `env.sampleAt` multi-tap/cell sampling, aspect-ratio correction, and `fwidth()` derivative anti-aliasing.
- **Media-First Passthrough & Composable Stack UX:** Defaulted `DEFAULT_INITIAL_STACK = []` (`effect: null`, `selectedPassId: null`), canonicalized `'vhs'` -> `'crtVhs'`, synced `crtVhs.profile` bundles and live `tone`/`ascii` uniforms, capped image/video resizes via `getCappedDimensions`, paused idle 60fps `rAF` on static images with immediate on-demand renders, added `+ Stack`, `Clear all`, Move Up/Down, and conditional ASCII ramp presets in `SourceAndShaderPanel.tsx`, and synced `getActivePipeline()?.render()` before raster export in `ExportDrawer.tsx`.

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Overhaul GraphCompiler, Pipeline, TextureAtlas, and Color/Luminance Foundation** - `b91da7c` (`feat(261126-hlm): overhaul GraphCompiler, Pipeline, TextureAtlas, and luminance foundation`)
2. **Task 2: Upgrade Visual Fidelity and Parameter Controls Across All 16 Shaders (+ Modulate & 3D)** - `2139e25` (`feat(261126-hlm): upgrade visual fidelity across all 16 stylize shaders and modulate FX`)
3. **Task 3: Wire Media-First Non-ASCII Default, Composable Stack UI/Export, and Expand Unit + Playwright E2E Tests** - `b290411` (`feat(261126-hlm): wire media-first passthrough default, composable stack UI, and E2E tests`)

## Files Created/Modified

- `web/src/engine/registry/tslHelpers.ts` - Created shared `toNode`, `resolveSelectNode`, and `sampleWithEnv` helpers across all 20 shaders.
- `web/src/engine/color/luminance.ts` - Added `rec601PerceptualLuminance`, `hash12Node`, and `hash22Node`.
- `web/src/engine/TextureAtlas.ts` - Upgraded to 64px bold monospace atlas with 4px slot padding, `LinearFilter`, `NoColorSpace`, and `getSlotPaddingRatio()`.
- `web/src/engine/graph/GraphCompiler.ts` - Removed double sRGB/Linear conversions, added `env.sampleAt` wiring, `HalfFloatType` FBO descriptors, Stage-0 pre-tone support, and `'select'` index uniforms.
- `web/src/engine/Pipeline.ts` - Removed legacy stack overrides, added Stage-0 pre-tone uniforms, propagated `rampLength` to active glyph passes, and guarded `HalfFloatType` target acquisition.
- `web/src/engine/registry/{stylize,modulate}/*.ts` - Upgraded all 20 shader definitions for visual fidelity and live uniform responsiveness.
- `web/src/store/useStudioStore.ts`, `CenterStage.tsx`, `SourceAndShaderPanel.tsx`, `EffectInspector.tsx`, `ExportDrawer.tsx` - Wired media-first passthrough (`[]`), `clearStack()`, `+ Stack`, Move Up/Down, `vhs` canonicalization, capped dimensions, idle static-image pause, and pre-export render sync.
- `web/src/tests/*.ts` & `web/e2e/shaderSnapshots.spec.ts` - Updated unit tests (`125` tests across `10` files) and Playwright E2E suite (`7` specs).

## Decisions Made

- Kept `ditherEffect.spatial = false` in stage planning while still utilizing `env.sampleAt` when available so `[tone, dither, blockify, threshold]` preserves 1-stage, 0-intermediate-target fusion while standalone/leading `dither` still performs `pixelSize` sampling.
- Extracted `web/src/engine/registry/tslHelpers.ts` to keep select-index resolution and `env.sampleAt` fallback logic DRY across all 20 shader modules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved 1-stage fusion for `[tone, dither, blockify, threshold]`**
- **Found during:** Task 2 (`npm --prefix web run test:unit`)
- **Issue:** Marking both `dither` and `blockify` as `spatial: true` caused `planExecutionStages` to split `[tone, dither, blockify, threshold]` into 2 stages, violating the plan's explicit 1-stage 0-target fusion requirement in `graphCompiler.test.ts`.
- **Fix:** Set `ditherEffect.spatial = false` (dither still uses `env.sampleAt` when in Stage 0 before a spatial pass, and falls back to `inputNode` cleanly if preceded by a spatial pass).
- **Files modified:** `web/src/engine/registry/stylize/dither.ts`
- **Verification:** `graphCompiler.test.ts` passes all 17 tests.
- **Committed in:** `2139e25` (part of Task 2 commit)

**2. [Rule 1 - Bug] Fixed lazy TSL `Fn` evaluation in `graphCompiler.test.ts` spy test**
- **Found during:** Task 3 (`npm --prefix web run test:unit`)
- **Issue:** `Three.js` `Fn(...)()` constructs a lazy `ShaderCallNodeInternal` without invoking its JS callback until shader node compilation, so spying directly on `sourceNode.sample` after `compileGraph` saw 0 calls.
- **Fix:** Tested `env.sampleAt` wiring in `graphCompiler.test.ts` via a spy `EffectDefinition` asserting `stage0SampleAt` and `stage1SampleAt` functions are injected and `stage0SampleAt(uv())` invokes `sourceNode.sample`.
- **Files modified:** `web/src/tests/graphCompiler.test.ts`
- **Verification:** `npm --prefix web run test:unit` passes all 10 files (125 tests).
- **Committed in:** `b290411` (part of Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both fixes preserved exact architectural constraints and test invariants with zero scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `npm --prefix web run build` (`tsc --noEmit && vite build`): **PASSED** (0 errors)
- `npm --prefix web run test:unit` (`vitest run`): **PASSED** (10 test files, 125 tests)
- `npm --prefix web run test:e2e` (`playwright test` on Chromium SwiftShader): **PASSED** (7 E2E tests including passthrough color fidelity, all 16 shaders + `crtVhs`/`rgbSplit`/`masks`/`threeD`, stacked `dither -> vhs` and `ascii -> vhs`, reorder, toggle, `Clear all`, and 480p/720p/1080p scaling)

## Self-Check: PASSED

- Verified created/modified key files exist on disk (`tslHelpers.ts`, `GraphCompiler.ts`, `Pipeline.ts`, `TextureAtlas.ts`, `useStudioStore.ts`, `SourceAndShaderPanel.tsx`, `shaderSnapshots.spec.ts`).
- Verified all 3 task commits (`b91da7c`, `2139e25`, `b290411`) exist in `git log` on `main`.
- Verified `web/` working tree is clean (`git status --short` shows only untracked `.planning/quick/261126-hlm-fix-all-16-shaders-visual-fidelity-media/`).
