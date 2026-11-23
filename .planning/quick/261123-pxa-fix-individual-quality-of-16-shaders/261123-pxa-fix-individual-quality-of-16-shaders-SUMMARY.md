---
phase: 261123-pxa-fix-individual-quality-of-16-shaders
plan: 01
subsystem: shader-engine
tags: [webgpu, tsl, shaders, sobel, convolution, pixel-sort, rgb-split, quality-tuning]
status: complete
requires:
  - 02-01
  - 02-02
  - 02-03
provides:
  - spatial-coordinate-sampling
  - sobel-3x3-edge-detection
  - multi-tap-pixel-sorting
  - chromatic-rgb-separation
affects:
  - web/src/engine/graph/GraphCompiler.ts
  - web/src/engine/Pipeline.ts
  - web/src/engine/registry/
tech-stack:
  added: []
  patterns:
    - Stage-scoped spatial coordinate sampling callback (EffectEnvironment.sampleAt)
    - Intermediate target stage partitioning on spatial sampling effects
    - 3x3 Sobel luminance convolution kernel
    - 8-tap directional glitch sorting search
key-files:
  created:
    - web/src/tests/spatialShaders.test.ts
  modified:
    - web/src/engine/graph/GraphCompiler.ts
    - web/src/engine/Pipeline.ts
    - web/src/engine/registry/types.ts
    - web/src/engine/registry/stylize/edgeDetect.ts
    - web/src/engine/registry/stylize/pixelSort.ts
    - web/src/engine/registry/modulate/rgbSplit.ts
    - web/src/engine/registry/stylize/blockify.ts
    - web/src/engine/registry/stylize/ascii.ts
    - web/src/engine/registry/stylize/contour.ts
    - web/src/engine/registry/stylize/crosshatch.ts
    - web/src/engine/registry/stylize/dither.ts
    - web/src/engine/registry/stylize/dots.ts
    - web/src/engine/registry/stylize/halftone.ts
    - web/src/engine/registry/stylize/voronoi.ts
    - web/src/engine/registry/stylize/waveLines.ts
    - web/src/tests/graphCompiler.test.ts
decisions:
  - Stage-scoped sampleAt decouples spatial shaders from single-pass uv() limitations without forcing all pointwise shaders into separate passes.
  - Intermediate target partitioning splits execution stages when spatial shaders follow upstream passes, ensuring prior tone/color modifications are rasterized before convolution.
  - All divisor uniforms guarded with .max(1.0) or .max(4.0) to prevent GPU divide-by-zero or infinite loops.
metrics:
  duration: 18m
  completed_date: "2026-11-23"
actuals:
  tokens: 8086
  tasks: 3
  commits: 3
  plan_head_before: 1dbc9f561d0c01842617d4dee308fa33e0e18600
  plan_head_after: c2901c4e014796b91012941e9a2b90aca576a64e
---

# Quick Task 261123-pxa: Fix Individual Quality of 16 Shaders Summary

Stage-scoped spatial sampling engine with 3x3 Sobel edge convolution, directional glitch sorting streaks, chromatic RGB separation, and divisor guards across all 16 registered WebGPU/TSL shaders.

## Overview of Changes

### 1. Spatial Sampling Engine (`GraphCompiler.ts`, `Pipeline.ts`)
- **Stage-scoped `env.sampleAt(coord)` Callback**: Injected into `EffectEnvironment` during `compileGraph`. For Stage 0, samples `sourceNode` with `sRGBToLinear` conversion; for Stage 1+, samples `inputTextureNode` (intermediate RenderTarget) directly in linear light.
- **Stage Partitioning**: `planExecutionStages` detects spatial sampling effects (`edgeDetect`, `pixelSort`, `rgbSplit`, or `requiresSpatialSampling: true`). If preceded by active passes in the current stage, it flushes them into an intermediate target (`requiresTarget: true`), ensuring upstream transformations are rasterized prior to convolution/displaced sampling. Contiguous pointwise passes retain 1-stage fragment fusion.
- **`Pipeline.ts` Compatibility**: Injected `.uv` sample wrappers for `sourceTextureNode`.

### 2. Upgraded Spatial Shaders
- **`edgeDetect`**: Upgraded from 1D zebra banding to a true 3x3 Sobel convolution kernel sampling 8 neighboring taps (`tl, t, tr, l, r, bl, b, br`) via Rec. 601 perceived luminance.
- **`pixelSort`**: Upgraded to 8 directional search taps along scanline orientation vectors with row jitter and brightness selection.
- **`rgbSplit`**: Displaces red, green, and blue channel coordinates independently in linear light and recombines cleanly.
- **`blockify` and `ascii`**: Ensured cell-centered coordinates are sampled via `env.sampleAt(cellCenterUV)` to provide solid cell colors and luminance without bleeding.
- **`spatialShaders.test.ts`**: Comprehensive vitest suite verifying 8-tap Sobel sampling, 8-tap pixel sort searches, RGB channel displacement, cell-center block quantization, and graceful fallbacks when `env.sampleAt` is omitted.

### 3. Visual Quality Tuning & Threat Model Defenses
- Enforced `.max(1.0)` / `.max(4.0)` guards on divisor uniforms (`spacing`, `frequency`, `steps`, `blockSize`, `sortSpan`, `resolution`) across `crosshatch`, `contour`, `dots`, `waveLines`, `voronoi`, `halftone`, `dither`.
- Clamped dot matrix radii in `dots.ts` to `min(0.5)` to prevent circular bleeding across adjacent grid cells.
- Clamped all computed sampling coordinates to `[0.0, 1.0]` across all spatial filters.

## Verification Evidence

- `npm --prefix web run test:unit`: 11 test files, 134 passed (0 failed).
- `npm --prefix web run build`: Clean TypeScript check and production bundle in 992ms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest failure in `masks.test.ts` due to `rgbSplit` costWeight expectation**
- **Found during:** Task 2 verification
- **Issue:** Changing `rgbSplit` `costWeight` to 2 conflicted with existing contract test in `masks.test.ts` asserting `costWeight === 1`.
- **Fix:** Retained `costWeight: 1` on `rgbSplit` while maintaining `requiresSpatialSampling: true` and `SPATIAL_INTERMEDIATE_EFFECTS` membership.
- **Files modified:** `web/src/engine/registry/modulate/rgbSplit.ts`
- **Commit:** `407ae21`

**2. [Rule 1 - Bug] Unused `uniforms` parameter in `graphCompiler.test.ts` causing TypeScript compilation failure**
- **Found during:** Task 3 verification
- **Issue:** `tsc --noEmit` failed with error TS6133: `'uniforms' is declared but its value is never read.`
- **Fix:** Renamed to `_uniforms` in mock effect definitions.
- **Files modified:** `web/src/tests/graphCompiler.test.ts`
- **Commit:** `c2901c4`

## Known Stubs

None. All 16 shaders evaluate live mathematical graphs in TSL WebGPU with active uniforms and stage-scoped sampling.

## Self-Check: PASSED
- FOUND: `web/src/engine/graph/GraphCompiler.ts`
- FOUND: `web/src/engine/Pipeline.ts`
- FOUND: `web/src/engine/registry/stylize/edgeDetect.ts`
- FOUND: `web/src/engine/registry/stylize/pixelSort.ts`
- FOUND: `web/src/engine/registry/modulate/rgbSplit.ts`
- FOUND: `web/src/engine/registry/stylize/blockify.ts`
- FOUND: `web/src/engine/registry/stylize/ascii.ts`
- FOUND: `web/src/tests/spatialShaders.test.ts`
- FOUND: `web/src/tests/graphCompiler.test.ts`
- FOUND: Commit `92bf67e`
- FOUND: Commit `407ae21`
- FOUND: Commit `c2901c4`
