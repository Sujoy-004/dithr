---
phase: 02-shader-engine-2-0-advanced-fx
plan: 01
subsystem: engine/shaders
tags: [color-science, tsl, webgpu, rec601, rec709, effect-registry, linear-light]
status: complete
requires: []
provides:
  - web/src/engine/color/colorSpace.ts
  - web/src/engine/color/luminance.ts
  - web/src/engine/registry/types.ts
  - web/src/engine/registry/index.ts
  - web/src/engine/registry/stylize/*.ts
  - web/src/engine/registry/modulate/grain.ts
  - web/src/tests/colorMath.test.ts
  - web/src/tests/tracerPipeline.test.ts
affects:
  - web/src/engine/Pipeline.ts
  - web/src/store/useStudioStore.ts
tech-stack:
  added: []
  patterns:
    - piecewise sRGB to Linear and Linear to sRGB color conversion (IEC 61966-2-1)
    - Rec. 601 integer parity for ASCII character mapping matching src/renderer.py:49-51
    - Rec. 709 HDTV perceived luminance for tone adjustment and blending
    - Single-source-of-truth typed EffectDefinition catalog with ParameterSchema
    - Injected time and seed uniforms for deterministic procedural shaders
key-files:
  created:
    - web/src/engine/color/colorSpace.ts
    - web/src/engine/color/luminance.ts
    - web/src/engine/registry/types.ts
    - web/src/engine/registry/index.ts
    - web/src/engine/registry/stylize/ascii.ts
    - web/src/engine/registry/stylize/tone.ts
    - web/src/engine/registry/stylize/dither.ts
    - web/src/engine/registry/stylize/halftone.ts
    - web/src/engine/registry/stylize/matrix.ts
    - web/src/engine/registry/stylize/pixelSort.ts
    - web/src/engine/registry/stylize/blockify.ts
    - web/src/engine/registry/stylize/threshold.ts
    - web/src/engine/registry/stylize/edgeDetect.ts
    - web/src/engine/registry/stylize/crosshatch.ts
    - web/src/engine/registry/stylize/waveLines.ts
    - web/src/engine/registry/stylize/noise.ts
    - web/src/engine/registry/stylize/voronoi.ts
    - web/src/engine/registry/stylize/dots.ts
    - web/src/engine/registry/stylize/contour.ts
    - web/src/engine/registry/modulate/grain.ts
    - web/src/tests/colorMath.test.ts
    - web/src/tests/tracerPipeline.test.ts
  modified: []
decisions:
  - "D-01/D-20: Modular typed EffectDefinition registry established as single source of truth for all 16 Grainrad modes"
  - "D-05: Rec. 601 strictly used for ASCII character selection matching src/renderer.py:49-51 parity (76/149/29), Rec. 709 HDTV used for tone and color compositing"
  - "D-06: Piecewise sRGB <-> Linear color transfer functions implemented with strict [0.0, 1.0] clamping preventing NaN/infinity artifacts"
  - "D-27: Injected time and seed uniforms wired to all procedural shaders (noise, waveLines, matrix, grain) replacing ambient random/clock"
metrics:
  duration: 32 min
  completed: "2026-11-23"
actuals:
  tokens: 16298
  tasks: 3
  commits: 3
  plan_head_before: 36a2812a0a6000f966b4abd9e51c75295cf447af
  plan_head_after: 999f61254b8f19ecb0b14cdb81a9e623ab8dadbe
---

# Phase 02 Plan 01: Color Science and Typed Effect Registry Summary

Established the color science foundation, piecewise sRGB/Linear transfer functions, typed `EffectDefinition` registry, and initial composable tracer pipeline slice per D-01, D-05, D-06, D-20, D-27, D-28, FX-01, and FX-02.

## Key Changes

1. **Color Standards (`web/src/engine/color/luminance.ts`)**:
   - Implemented exact Rec. 601 (`0.299*R + 0.587*G + 0.114*B`) perceived luminance node matching `src/renderer.py:49-51` integer output (R: 76, G: 149, B: 29).
   - Implemented Rec. 709 (`0.2126*R + 0.7152*G + 0.0722*B`) HDTV broadcast luminance node.
   - Added global `getLuminanceNode` selector and CPU reference functions for parity tests.

2. **Piecewise Color Space Transfer Functions (`web/src/engine/color/colorSpace.ts`)**:
   - Implemented exact IEC 61966-2-1 piecewise `sRGBToLinear` and `linearTosRGB` in Three.js TSL and CPU.
   - Handled threshold boundaries ($0.04045$ and $0.0031308$) with $12.92$ linear factor and $2.4$ gamma exponent.
   - Clamped inputs cleanly to $[0.0, 1.0]$, sanitizing negative numbers, NaNs, and infinities.

3. **Typed EffectDefinition Registry (`web/src/engine/registry/`)**:
   - Defined `ParameterSchema`, `EffectDefinition`, `ActiveEffectPass`, `BlendMode`, and `EffectEnvironment` types.
   - Migrated all 16 Grainrad modes into modular typed definitions:
     - **Stylize (15 modes)**: `ascii`, `tone`, `dither`, `halftone`, `matrix`, `pixelSort`, `blockify`, `threshold`, `edgeDetect`, `crosshatch`, `waveLines`, `noise`, `voronoi`, `dots`, `contour`
     - **Modulate (1 mode)**: `grain`
   - Added typed parameter schemas with defaults, min/max bounds, steps, units, and `audioModulatable` flags.
   - Replaced ambient random or clock calls with deterministic injected `time` and `seed` uniforms in `matrix`, `pixelSort`, `waveLines`, `noise`, and `grain`.
   - Exported `effectRegistry`, `getEffectDefinition`, and `getGroupedEffects` (partitioned via `stylize` and `modulate`).

4. **Tracer Pipeline & Golden Math Test Suites (`web/src/tests/`)**:
   - `web/src/tests/tracerPipeline.test.ts`: Verified multi-pass linear-light shader chain (`tone` -> `ascii`) with sRGB decode/encode and blend modes (`normal`, `multiply`, `screen`, `add`). Verified 16-effect catalog and schema completeness.
   - `web/src/tests/colorMath.test.ts`: Validated 256-step sRGB/Linear roundtrip inversion (max delta < 1e-4), Rec. 601 integer parity matching Python, Rec. 709 HDTV SMPTE bars, low-intensity shadow continuity, and out-of-bounds float clamping.

## Verification & Results

- `npm --prefix web run test:unit`: 41 tests passing across 5 test files (`colorMath.test.ts`, `tracerPipeline.test.ts`, `capabilities.test.ts`, `store.test.ts`, `videoExport.test.ts`).
- `npm --prefix web run build`: TypeScript `tsc --noEmit` and Vite build succeeded with zero errors.
- Python test suite: 458 passed, `ruff check` and `mypy` passed with zero errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Floating-point boundary roundtrip in `linearTosRGBCpu`**
- **Found during:** Task 1
- **Issue:** IEEE-754 precision caused `linearTosRGBCpu(1.0)` to evaluate to `0.9999999999999999` rather than `1.0`.
- **Fix:** Explicitly handled boundary values ($c \le 0.0 \to 0.0$, $c \ge 1.0 \to 1.0$).
- **Files modified:** `web/src/engine/color/colorSpace.ts`
- **Commit:** `db14923`

**2. [Rule 1 - Bug] TSL TypeScript overload resolution in `grain.ts` and `halftone.ts`**
- **Found during:** Task 2
- **Issue:** `@types/three` inferred intermediate node expressions as `Node<"vec3">` when passed into `vec3(...)` or `mix(...)`, failing strict TypeScript build.
- **Fix:** Added explicit typing/casts for node arguments.
- **Files modified:** `web/src/engine/registry/modulate/grain.ts`, `web/src/engine/registry/stylize/halftone.ts`
- **Commit:** `9967b8a`

## Self-Check: PASSED
- FOUND: web/src/engine/color/colorSpace.ts
- FOUND: web/src/engine/color/luminance.ts
- FOUND: web/src/engine/registry/types.ts
- FOUND: web/src/engine/registry/index.ts
- FOUND: web/src/engine/registry/stylize/ascii.ts
- FOUND: web/src/engine/registry/stylize/tone.ts
- FOUND: web/src/engine/registry/stylize/dither.ts
- FOUND: web/src/engine/registry/stylize/halftone.ts
- FOUND: web/src/engine/registry/stylize/matrix.ts
- FOUND: web/src/engine/registry/stylize/pixelSort.ts
- FOUND: web/src/engine/registry/stylize/blockify.ts
- FOUND: web/src/engine/registry/stylize/threshold.ts
- FOUND: web/src/engine/registry/stylize/edgeDetect.ts
- FOUND: web/src/engine/registry/stylize/crosshatch.ts
- FOUND: web/src/engine/registry/stylize/waveLines.ts
- FOUND: web/src/engine/registry/stylize/noise.ts
- FOUND: web/src/engine/registry/stylize/voronoi.ts
- FOUND: web/src/engine/registry/stylize/dots.ts
- FOUND: web/src/engine/registry/stylize/contour.ts
- FOUND: web/src/engine/registry/modulate/grain.ts
- FOUND: web/src/tests/colorMath.test.ts
- FOUND: web/src/tests/tracerPipeline.test.ts
- Commit db14923 verified in HEAD history
- Commit 9967b8a verified in HEAD history
- Commit 999f612 verified in HEAD history
