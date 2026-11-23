---
phase: 02-shader-engine-2-0-advanced-fx
plan: "04"
subsystem: engine/fx
tags: [chromatic-aberration, spatial-masks, crt-vhs, analog-emulation, on-canvas-handles, pointer-capture]
status: complete
requires:
  - "02-02"
  - "02-03"
provides:
  - web/src/engine/registry/modulate/rgbSplit.ts
  - web/src/engine/registry/modulate/masks.ts
  - web/src/engine/registry/modulate/crtVhs.ts
  - web/src/components/canvas/MaskHandles.tsx
  - web/src/tests/masks.test.ts
affects:
  - web/src/components/layout/CenterStage.tsx
  - web/src/engine/registry/index.ts
tech-stack:
  added: []
  patterns:
    - Chromatic channel separation with symmetric master vector and granular per-channel X/Y offsets
    - Procedural distance field masks (vignette, box, circle) with smoothstep feather falloff
    - On-canvas pointer capture handles with SVG guide overlay and accessible keyboard nudging
    - Non-linear barrel distortion ($uv' = uv \cdot (1 + k \cdot r^2)$) maintaining center coordinate and odd symmetry
    - Bounded temporal phosphor decay with strict safety clamping (< 0.98) preventing luminance runaway
    - Highlight threshold bloom extraction and additive combine in linear space
key-files:
  created:
    - web/src/engine/registry/modulate/rgbSplit.ts
    - web/src/engine/registry/modulate/masks.ts
    - web/src/engine/registry/modulate/crtVhs.ts
    - web/src/components/canvas/MaskHandles.tsx
    - web/src/tests/masks.test.ts
  modified:
    - web/src/components/layout/CenterStage.tsx
    - web/src/engine/registry/index.ts
    - web/src/tests/tracerPipeline.test.ts
decisions:
  - "D-07: Masks support vignette, box, and circular shapes with numeric controls and on-canvas pointer handles with keyboard nudging"
  - "D-08: RGB channel separation exposes full per-channel X/Y offsets plus master amount and angle for symmetric setups"
  - "D-09: Advanced CRT/VHS ships named profiles (VHS SP, worn VHS EP, CRT arcade, broadcast monitor) plus individual sliders"
  - "T-02-07: Phosphor decay feedback multiplier strictly clamped to < 0.98 to prevent runaway luminance accumulation"
  - "T-02-08: On-canvas handle drag coordinates clamped to normalized [0.0, 1.0] canvas space"
metrics:
  duration: 18 min
  completed: "2026-11-23"
actuals:
  tokens: 14200
  tasks: 3
  commits: 3
  plan_head_before: 5ee214539c9c3d29175e3cd00c5dec5b9db2f2d1
  plan_head_after: d9c0b5224773e0143de516a14ebc7fb0de614769
---

# Phase 02 Plan 04: Spatial Masks, Chromatic RGB Split, and Analog CRT/VHS Emulation Summary

Delivered advanced spatial masks, chromatic aberration, and analog CRT/VHS emulation per D-07, D-08, D-09, FX-03, and FX-04.
Implemented chromatic RGB channel separation with independent per-channel X/Y offsets plus master amount/angle controls, procedural spatial masks (vignette, box, circle) synchronized with on-canvas pointer handles, and advanced CRT/VHS emulation with named starting profiles, barrel distortion, scanlines with tracking jitter, highlight bloom, and bounded phosphor decay feedback.

## Key Changes

1. **Chromatic RGB Channel Separation (`web/src/engine/registry/modulate/rgbSplit.ts`)**:
   - Registered `rgbSplit` in `EffectRegistry` under `modulate` category (`costWeight: 1`, `requiresPass: false`).
   - Parameter schema exposes:
     - Master symmetric controls: `masterAmount` [0, 50] px and `masterAngle` [0, 360] deg.
     - Granular per-channel offsets: `redOffsetX`, `redOffsetY`, `greenOffsetX`, `greenOffsetY`, `blueOffsetX`, `blueOffsetY` (each [-50, 50] px).
   - TSL shader samples red, green, and blue taps with independent displaced coordinates, combining them in linear space.
   - Zero offset produces exact identity sampling without color fringing.
   - Exported pure TS helper `computeChannelOffsets` for offset math verification.

2. **Procedural Spatial Masks & On-Canvas Handles (`web/src/engine/registry/modulate/masks.ts`, `MaskHandles.tsx`, `CenterStage.tsx`)**:
   - Registered `masks` in `EffectRegistry` under `modulate` category (`costWeight: 1`, `requiresPass: false`).
   - Supports shape modes: `vignette`, `box`, and `circle`.
   - Numeric parameter schema: `centerX`, `centerY`, `width`, `height`, `radius`, `feather`, `invert`, `strength`.
   - Built TSL distance field nodes for all shapes with smoothstep feather falloff and background attenuation.
   - Built `MaskHandles.tsx` on-canvas overlay component mounted inside `CenterStage.tsx`'s canvas transform wrapper:
     - Center Handle: draggable crosshair button with pointer capture (`setPointerCapture`), clamping coordinates to `[0.0, 1.0]` (T-02-08), and keyboard arrow navigation (0.01 step / 0.05 with Shift).
     - Size/Radius Handle: draggable sizing ring/corner handle with pointer capture and keyboard arrow navigation.
     - SVG guide overlay rendering dashed shape outlines synchronized with pan/zoom.

3. **Advanced CRT and VHS Emulation (`web/src/engine/registry/modulate/crtVhs.ts`)**:
   - Registered `crtVhs` under `modulate` category with `costWeight: 3` and `requiresPass: true`.
   - Named profiles: `vhsSp` (clean tape), `vhsEp` (worn tape), `crtArcade` (shadow mask & curvature), `broadcastMonitor` (crisp aperture grille).
   - Granular slider controls: `curvature` [0, 0.5], `scanlineIntensity` [0, 1], `scanlineCount` [100, 1200], `phosphorDecay` [0, 0.95], `trackingJitter` [0, 1], `bloomIntensity` [0, 1], `vignette` [0, 1], `noiseIntensity` [0, 1].
   - TSL shader modules:
     - Non-linear barrel distortion ($uv' = uv \cdot (1 + k \cdot r^2)$) preserving center $(0.5, 0.5)$ and odd symmetry.
     - Horizontal tracking jitter perturbation across scanline frequency.
     - Phosphor decay ping-pong feedback strictly clamped to `< 0.98` (T-02-07 mitigation).
     - Highlight bloom extraction (>0.7 luminance) and additive combine.
   - Exported helper `applyCrtProfile` and pure TS `computeBarrelDistortion`.

4. **Automated Unit Tests (`web/src/tests/masks.test.ts`, `tracerPipeline.test.ts`)**:
   - 18 comprehensive tests in `masks.test.ts` verifying:
     - `rgbSplit` registry metadata, schema, zero-offset identity, and symmetric angle vector math.
     - `masks` registry metadata, schema, circle/box/vignette distance fields, feathering, invert, and strength attenuation.
     - `crtVhs` registry metadata, schema, all 4 profile parameter bundles, barrel distortion center preservation and symmetry, out-of-bounds detection, and safe phosphor decay clamping.
   - Updated `tracerPipeline.test.ts` expectations for registry expansion from 16 to 19 modes (15 stylize, 4 modulate).

## Verification & Results

- `npm --prefix web run test:unit`: 85 tests passing across 8 test suites (`masks.test.ts`, `tracerPipeline.test.ts`, `colorMath.test.ts`, `stackStore.test.ts`, `graphCompiler.test.ts`, `capabilities.test.ts`, `store.test.ts`, `videoExport.test.ts`).
- `npm --prefix web run build`: Vite production bundle built in 1.38s with zero TypeScript errors.
- Python tests: `ruff check src tests` passed with 0 errors; `mypy src` passed with 0 issues across 23 source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused variable warnings during build**
- **Found during:** Task 1 & Task 3 verification (`npm --prefix web run build`)
- **Issue:** TypeScript strict build flagged unused imports/parameters (`effectRegistry` and `coord` in test file).
- **Fix:** Removed unused import and prefixed unused mock parameter with underscore.
- **Files modified:** `web/src/tests/masks.test.ts`
- **Commits:** `ebc44b7`, `d9c0b52`

**2. [Rule 1 - Bug] Tracer pipeline registry count assertion update**
- **Found during:** Task 3 full test run
- **Issue:** `tracerPipeline.test.ts` hardcoded the wave 1 initial mode count (16 modes, 1 modulate) which failed when `rgbSplit`, `masks`, and `crtVhs` were added to the registry.
- **Fix:** Updated `EXPECTED_MODULATE_IDS` to include `'grain', 'rgbSplit', 'masks', 'crtVhs'` and asserted 19 total modes (15 stylize, 4 modulate) per D-01.
- **Files modified:** `web/src/tests/tracerPipeline.test.ts`
- **Commit:** `d9c0b52`

## Self-Check: PASSED
- FOUND: web/src/engine/registry/modulate/rgbSplit.ts
- FOUND: web/src/engine/registry/modulate/masks.ts
- FOUND: web/src/engine/registry/modulate/crtVhs.ts
- FOUND: web/src/components/canvas/MaskHandles.tsx
- FOUND: web/src/tests/masks.test.ts
- Commit ebc44b7 verified in HEAD history
- Commit 8a07407 verified in HEAD history
- Commit d9c0b52 verified in HEAD history
