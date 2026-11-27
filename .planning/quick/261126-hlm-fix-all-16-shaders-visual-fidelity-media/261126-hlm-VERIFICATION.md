---
phase: quick-261126-hlm
verified: 2026-11-27T03:12:00Z
status: passed
score: 4/4 must-haves verified
---

# Quick Task 261126-hlm: Fix All 16 Shaders Visual Fidelity, Media-First Non-ASCII Default & Composable Stack Verification

**Verified:** 2026-11-27T03:12:00Z
**Status:** passed
**Score:** 4/4 must-haves verified

## Goal & Scope

Independent, adversarial verification of quick task `261126-hlm` against `261126-hlm-PLAN.md` must-haves:
- Media-first empty default shader stack (`DEFAULT_INITIAL_STACK = []`) rendering uploaded media in Linear passthrough without ASCII or double sRGB/Linear conversion.
- Visual fidelity overhaul across all 16 stylize shaders plus 4 modulate shaders (`crtVhs`, `grain`, `rgbSplit`, `masks`) and `threeD`.
- Composable sequential multi-pass shader stack (`dither -> vhs`, `ascii -> vhs`, reorder, bypass, duplicate, remove, `Clear all`), `vhs -> crtVhs` canonicalization, Stage-0 pre-tone, and pre-export raster render sync.
- Clean TypeScript/Vite build, Vitest unit suite, and Playwright E2E suite.

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Uploading an image or video defaults to an empty shader stack (`activeStack = []`) and renders the original media faithfully in passthrough mode at capped native aspect and resolution without ASCII applied. | VERIFIED | `web/src/store/useStudioStore.ts` sets `DEFAULT_INITIAL_STACK = []`, `effect: null`, `selectedPassId: null`. `GraphCompiler.ts` (`stages.length === 0`) outputs `sourceNode` directly without `sRGBToLinear`/`linearTosRGB`. `CenterStage.tsx` applies `getCappedDimensions(dims, tier)` consistently across boot, resize, image load, and video metadata/play. `shaderSnapshots.spec.ts` test 1 passes with faithful red (`R > 150`) and cyan (`G > 130, B > 150`) quadrant checks at `320x180`. |
| 2 | Clicking any of the 16 shaders in the left shader list (including `vhs -> crtVhs`) immediately renders that shader on the uploaded media with responsive right-rail parameter sliders and dropdowns. | VERIFIED | `SourceAndShaderPanel.tsx` `EFFECT_LIST` exposes all 16 modes; row click invokes `setSingleEffectFastPath(mode)` which canonicalizes `'vhs'` to `'crtVhs'`, creates a 1-pass stack, and calls `activePipeline?.syncStack([pass], activeTier)`. `EffectInspector.tsx` renders schema-driven `ParameterSlider`, boolean switch, and `<select>` controls wired to `updatePassParam` -> `activePipeline?.updateUniform` (with `select` index mapping and `crtVhs.profile` bundle sync). Stale `setEffect`/`updateEffectParam` overwrites in `CenterStage.tsx` are removed. |
| 3 | Users can stack additional shaders sequentially on top of any active shader (e.g., `dither -> vhs` or `ascii -> vhs`) via `+ Stack` buttons or `Add effect pass`, reorder/bypass/duplicate/remove individual passes, or `Clear all` back to raw media. | VERIFIED | `SourceAndShaderPanel.tsx` provides `+ Stack` per shader row (`addEffect`), `Add effect pass` palette (`grouped.stylize` + `grouped.modulate`), 1-based signal-flow index, Move Up/Down (`reorderStack`), Eye (`toggleEffect`), Copy (`duplicateEffect`), Trash (`removeEffect`), and `Clear all` (`clearStack`). Verified by `stackStore.test.ts` (12 tests) and `shaderSnapshots.spec.ts` test 3 (`dither -> vhs`, `ascii -> vhs`, reorder, toggle, `Clear all`). |
| 4 | All 16 stylize/modulate shaders evaluate perceptual Rec. 601 luminance without double sRGB/Linear conversion, use `env.sampleAt` via `TextureNode.sample` for spatial/multi-tap sampling across `HalfFloatType` ping-pong FBO stages, and apply `fwidth()` anti-aliasing. | VERIFIED | `luminance.ts` defines `rec601PerceptualLuminance`, `hash12Node`, and `hash22Node`. `GraphCompiler.ts` wires `env.sampleAt` via `sourceNode.sample` (Stage 0, wrapped through pointwise prefix) and `inputTextureNode.sample` (Stage > 0), allocates `HalfFloatType` intermediate `targetDescriptor`s (with `UnsignedByteType` fallback in `Pipeline.ts`), and removes double `sRGBToLinear`/`linearTosRGB`. All 20 `EffectRegistry` definitions build valid TSL graphs (`tracerPipeline.test.ts`), and all 20 render non-black, non-NaN frames in Chromium (`shaderSnapshots.spec.ts` test 2). |

---

## Required Artifacts

| Artifact | Exists | Substantive | Wired | Status | Notes |
|----------|--------|-------------|-------|--------|-------|
| `web/src/engine/graph/GraphCompiler.ts` | Yes | Yes (360 lines) | Yes | VERIFIED | `planExecutionStages`, `compileGraph`, `env.sampleAt` closure + pointwise prefix wrapping, `resolveUniformValue` for `select`, `HalfFloatType` target descriptors, `preToneDef` Stage-0 hook. |
| `web/src/engine/Pipeline.ts` | Yes | Yes (447 lines) | Yes | VERIFIED | Single `activeStack` source of truth (`syncLegacyStack` removed), Stage-0 `updateTone`, `updateAscii` `rampLength` propagation across `ascii`/`matrix`/`threeD`, `select` index `updateUniform`, `PassPool.acquire` `UnsignedByteType` fallback. |
| `web/src/engine/TextureAtlas.ts` | Yes | Yes (118 lines) | Yes | VERIFIED | `fontSize = 64`, `bold` font, `padding = 4`, `LinearFilter`, `generateMipmaps = false`, `NoColorSpace`, `getSlotPaddingRatio()`. |
| `web/src/engine/color/luminance.ts` | Yes | Yes (103 lines) | Yes | VERIFIED | Preserves all existing exports; adds `rec601PerceptualLuminance`, `hash12Node`, `hash22Node`. |
| `web/src/engine/registry/index.ts` & `types.ts` | Yes | Yes (189 + 53 lines) | Yes | VERIFIED | 20 registered definitions (16 stylize + 4 modulate), `'vhs'` alias in `EffectRegistry.get`, `spatial?: boolean`, `sampleAt` wired in `compileLinearEffectStack`. |
| `web/src/engine/registry/tslHelpers.ts` | Yes | Yes (51 lines) | Yes | VERIFIED | Shared `toNode`, `resolveSelectNode`, and `sampleWithEnv` helpers used across the 20 shader files. |
| `web/src/engine/registry/stylize/*.ts` (16 files) & `modulate/*.ts` (4 files) | Yes | Yes | Yes | VERIFIED | All 20 shaders updated with perceptual luma / `sampleWithEnv` / `fwidth()` AA / Dave Hoskins hashing / `resolveSelectNode`. (`ditherEffect.spatial = false` preserved intentionally so `[tone, dither, blockify, threshold]` fuses into 1 stage.) |
| `web/src/store/useStudioStore.ts` & `web/src/types/studio.ts` | Yes | Yes (1055 + 129 lines) | Yes | VERIFIED | `DEFAULT_INITIAL_STACK = []`, `effect: EffectMode | null`, `canonicalizeEffectId('vhs' -> 'crtVhs')`, `clearStack()`, `crtVhs.profile` bundle sync, `updateTone`/`updateAscii` pipeline calls. |
| `web/src/components/panels/SourceAndShaderPanel.tsx` | Yes | Yes (588 lines) | Yes | VERIFIED | Empty stack copy, `Clear all`, 1-based index + Move Up/Down, `+ Stack` per shader row, `vhs -> crtVhs` highlighting, conditional `ASCII ramp presets`. |
| `web/src/components/layout/CenterStage.tsx` | Yes | Yes (643 lines) | Yes | VERIFIED | Removed legacy `setEffect` hooks; unified `getCappedDimensions`; `shouldRunContinuousLoop()` pauses idle `rAF` on static images and renders on-demand. |
| `web/src/components/panels/EffectInspector.tsx` & `ExportDrawer.tsx` | Yes | Yes (223 + 301 lines) | Yes | VERIFIED | Updated empty inspector prompt; `ExportDrawer.handleRaster` calls `getActivePipeline()?.render(...)` prior to `exportRasterImage`. |
| `web/src/engine/shaders/*.ts` (deleted) | Deleted | N/A | N/A | VERIFIED | `Test-Path web/src/engine/shaders` returned `False`; 0 references to `syncLegacyStack` in `web/src`. |

---

## Key Link Verification

| From | To | Via | Status | Verification Evidence |
|------|----|-----|--------|-----------------------|
| `web/src/engine/graph/GraphCompiler.ts` | `web/src/engine/Pipeline.ts` | `compileGraph` and `planExecutionStages` with `env.sampleAt` and `HalfFloatType` `stageDescriptors` | WIRED | `Pipeline.ts` lines 177-193 call `planExecutionStages` and `compileGraph` with `textureAtlas`, `atlasPadding`, `preToneActive`, `preToneUniforms`; `render()` passes `stageDesc.targetDescriptor` into `passPool.acquire` and binds `nextStage.inputTextureNode.value = target.texture`. |
| `web/src/engine/Pipeline.ts` | `web/src/components/layout/CenterStage.tsx` | `syncStack`, `updateTone`, `updateAscii`, and `resize` without `syncLegacyStack` overwrite | WIRED | `CenterStage.tsx` lines 211-221 and 328-373 invoke `syncStack`, `updateTone`, `updateAscii`, and `resize`; `git grep syncLegacyStack web/src` returned 0 matches. |
| `web/src/store/useStudioStore.ts` | `web/src/components/panels/SourceAndShaderPanel.tsx` | `setSingleEffectFastPath`, `addEffect`, `clearStack`, `removeEffect`, `reorderStack`, `toggleEffect` | WIRED | `SourceAndShaderPanel.tsx` binds all 6 store actions to shader list rows, `+ Stack` buttons, stack row controls, and `Clear all` button. |
| `web/src/components/panels/ExportDrawer.tsx` | `web/src/export/imageExport.ts` | `getActivePipeline().render()` prior to `exportRasterImage` `canvas.toBlob` | WIRED | `ExportDrawer.tsx` lines 78-79 execute `getActivePipeline()?.render(useStudioStore.getState().playbackTime || 0)` immediately before `await exportRasterImage(canvas, format)`. |

---

## Behavioral Spot-Checks

Executed directly after inspecting all repository files (`HEAD` at `b290411`):

| Check | Command | Outcome | Exact Observed Output |
|-------|---------|---------|-----------------------|
| Type-check & production bundle | `npm --prefix web run build` | PASSED | `tsc --noEmit && vite build` exited 0; `2197 modules transformed`, built in `4.39s`. |
| Unit & shader graph suite | `npm --prefix web run test:unit` | PASSED | `vitest run`: `10` test files passed (`colorMath.test.ts` 18, `stackStore.test.ts` 12, `store.test.ts` 5, `tracerPipeline.test.ts` 12, `masks.test.ts` 18, `threeD.test.ts` 15, `capabilities.test.ts` 7, `graphCompiler.test.ts` 17, `audioEngine.test.ts` 18, `videoExport.test.ts` 3) — `125` tests passed (`0` skipped). |
| Playwright E2E visual & stack suite | `npm --prefix web run test:e2e` | PASSED | `playwright test` (`chromium-swiftshader`): `7` passed in `1.2m` (`canvas.spec.ts` 1, `tier.spec.ts` 1, `export.spec.ts` 1, `shaderSnapshots.spec.ts` 4 covering passthrough fidelity, all 20 shaders, stacked `dither -> vhs` and `ascii -> vhs` UI workflows, and 480p/720p/1080p scaling). |

---

## Anti-Patterns Found

| Severity | File | Finding | Impact |
|----------|------|---------|--------|
| Info | `web/src/components/panels/SourceAndShaderPanel.tsx#L461` vs `#L477` | Inside the `Add effect pass` popover, Stylize items render `{item.id}` (e.g., `edgeDetect`) while Modulate items render `{item.label}` (e.g., `CRT / VHS Emulation`). | Cosmetic label inconsistency only; clicking either adds the canonical `item.id` pass cleanly. |

No `TODO`/`FIXME` placeholders, no stubbed event handlers, no double `sRGBToLinear`/`linearTosRGB` conversions in `GraphCompiler.ts` or `registry/index.ts`, and no legacy `syncLegacyStack` callers remain.

---

## Gaps

None. All plan must-haves, artifacts, key links, and automated build/unit/E2E gates verified as passing.
