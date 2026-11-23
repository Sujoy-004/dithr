---
phase: 02-shader-engine-2-0-advanced-fx
plan: 03
subsystem: ui/stack
tags: [effect-stack, zustand, drag-and-drop, pointer-capture, inspector, dynamic-schema]
status: complete
requires:
  - 02-02
provides:
  - web/src/store/useStudioStore.ts
  - web/src/types/studio.ts
  - web/src/components/layout/LeftRail.tsx
  - web/src/components/panels/EffectInspector.tsx
  - web/src/tests/stackStore.test.ts
affects:
  - web/src/components/layout/RightRail.tsx
  - web/src/components/layout/CenterStage.tsx
tech-stack:
  added: []
  patterns:
    - ES2024 immutable array transformations (.toSpliced())
    - Dedicated pointer capture drag handles with layout midpoint drop detection
    - Accessible keyboard reordering with aria-live polite screen reader announcements
    - Dynamic schema-driven inspector rendering derived from registry types
    - In-place uniform mutation without pipeline invalidation
key-files:
  created:
    - web/src/tests/stackStore.test.ts
  modified:
    - web/src/types/studio.ts
    - web/src/store/useStudioStore.ts
    - web/src/components/layout/LeftRail.tsx
    - web/src/components/panels/EffectInspector.tsx
    - web/src/components/layout/RightRail.tsx
    - web/src/components/layout/CenterStage.tsx
    - web/tsconfig.json
decisions:
  - "D-02: LeftRail hosts ordered active effect stack with drag reordering, row actions, and add palette; RightRail stays parameter-focused"
  - "D-03: Per-row compositing controls expose independent intensity [0.0, 1.0] and blend mode (normal, multiply, screen, add)"
  - "D-04: Clicking a palette tile builds a one-pass stack via setSingleEffectFastPath preserving fast-path workflow"
  - "D-20: Dynamic EffectInspector rendered from registry parameter schemas with native type-aware input controls"
  - "D-22: Slider adjustments stream directly to TSL uniforms and update store without pipeline recompilation"
metrics:
  duration: 15 min
  completed: "2026-11-23"
actuals:
  tokens: 17347
  tasks: 3
  commits: 3
  plan_head_before: d77d552cd7292e71cc807c07d32f6df1c578550b
  plan_head_after: d5b7d12324d1d342e7e3b7ed6938ad8727a11e24
---

# Phase 02 Plan 03: Interactive Effect Stack and Schema-Driven Inspector Summary

Built the interactive effect stack UI and dynamic schema-driven inspector per D-02, D-03, D-04, D-20, D-22, and FX-01.
Replaced the static 16-tile radio group in `LeftRail.tsx` with an accessible pointer-capture drag-and-drop stack manager, integrated an immutable Zustand stack slice in `useStudioStore.ts`, and converted `EffectInspector.tsx` into a dynamic schema-driven inspector that streams parameter updates directly to TSL uniform nodes.

## Key Changes

1. **Zustand Effect Stack Slice (`web/src/store/useStudioStore.ts`, `web/src/types/studio.ts`)**:
   - Re-exported `ActiveEffectPass`, `EffectDefinition`, and `BlendMode` in `studio.ts`.
   - Added `activeStack: ActiveEffectPass[]` and `selectedPassId: string | null` to `StudioState`.
   - Implemented immutable stack actions:
     - `addEffect(effectId, initialParams?)`: Generates instance ID, populates defaults from `getEffectDefinition(effectId)`, appends to stack, and selects new pass.
     - `removeEffect(instanceId)`: Deletes pass and falls back selection to previous pass or `null`.
     - `reorderStack(fromIndex, toIndex)`: Non-mutating reorder using ES2024 `toSpliced(fromIndex, 1).toSpliced(toIndex, 0, item)`.
     - `toggleEffect(instanceId)`: Flips `enabled` state.
     - `duplicateEffect(instanceId)`: Deep-clones pass using `structuredClone()`, assigns new instance ID, and inserts adjacent.
     - `setEffectIntensity(instanceId, intensity)` and `setEffectBlendMode(instanceId, mode)`: Updates per-row compositing attributes (D-03).
     - `updatePassParam(instanceId, paramKey, value)`: Updates pass parameters and streams to `pipeline.updateUniform`.
     - `setSingleEffectFastPath(effectId)`: Resets stack to exactly 1 pass for fast tile switching (D-04).
   - Added pipeline singleton registration (`registerPipeline`) to sync stack and uniforms without React re-render churn.

2. **Accessible LeftRail Effect Stack Manager (`web/src/components/layout/LeftRail.tsx`)**:
   - Built active stack list (`role="list"`) displaying pass status, effect icons, and selection highlights.
   - Implemented Modern Web Guidance drag-and-drop:
     - Dedicated grab handle button with `touch-action: none` and `handle.setPointerCapture(pointerId)`.
     - Drop slot computed from vertical layout midpoints (`offsetTop + offsetHeight / 2`).
     - Keyboard reordering: `Space` grabs/drops, `ArrowUp`/`ArrowDown` moves slots, `Escape` cancels grab, with `aria-pressed`.
     - Screen reader announcements via debounced `<div aria-live="polite">` region.
   - Built row actions: eye toggle (`aria-label="Toggle effect"`), duplicate (`aria-label="Duplicate effect"`), and trash delete (`aria-label="Delete effect"`).
   - Built palette section: `+ Add Effect` button opening grouped `Stylize` and `Modulate` popover, plus direct fast-path tile buttons (D-04).

3. **Dynamic Schema-Driven Effect Inspector (`web/src/components/panels/EffectInspector.tsx`, `RightRail.tsx`, `CenterStage.tsx`)**:
   - Inspector queries `getEffectDefinition(selectedPass.effectId)` for typed parameter schema.
   - Displays pass header with category badge and cost weight.
   - Displays Compositing card (D-03): intensity slider [0%, 100%] and blend mode selector (`normal`, `multiply`, `screen`, `add`).
   - Dynamically iterates over parameter schema dictionary, rendering:
     - Numeric sliders for `float` / `int` with tabular figures, min/max/step, and unit formatting (px, deg, %, lpi).
     - Accessible switch buttons (`role="switch"`, `aria-checked`) for `boolean` parameters.
     - Semantic dropdown selectors for `select` parameters with options.
   - Connected `RightRail.tsx` to display active effect title and `CenterStage.tsx` to register pipeline and synchronize `activeStack`.

4. **Automated Unit Test Suite (`web/src/tests/stackStore.test.ts`)**:
   - 11 unit tests verifying:
     - Initial stack initialization.
     - `addEffect` default parameter population and custom override.
     - `removeEffect` with previous-pass selection fallback and empty-stack handling.
     - `reorderStack` non-mutating ES2024 array immutability.
     - `toggleEffect` enabling and disabling.
     - `duplicateEffect` deep-cloning with unique ID and adjacent placement.
     - `setEffectIntensity` clamping [0.0, 1.0].
     - `setEffectBlendMode` updating all 4 blend modes.
     - `updatePassParam` updating parameter keys.
     - `setSingleEffectFastPath` fast-path replacement preserving D-04.

## Verification & Results

- `npm --prefix web run test:unit`: 67 tests passing across 7 test suites (`stackStore.test.ts`, `graphCompiler.test.ts`, `colorMath.test.ts`, `tracerPipeline.test.ts`, `capabilities.test.ts`, `store.test.ts`, `videoExport.test.ts`).
- `npm --prefix web run build`: TypeScript `tsc --noEmit` and Vite bundle build succeeded with zero errors.
- Python test suite: 458 passed, `ruff check` and `mypy` passed with zero errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Parameter schema key naming mismatch in initial stack unit tests**
- **Found during:** Task 1 test run (`vitest run src/tests/stackStore.test.ts`)
- **Issue:** Unit tests referenced legacy names (`ditherSteps`, `halftoneFreq`, `matrixSpeed`) instead of schema keys (`colorSteps`, `spread`, `frequency`, `speed`).
- **Fix:** Updated test assertions to match canonical typed definitions in `EffectRegistry`.
- **Files modified:** `web/src/tests/stackStore.test.ts`
- **Commit:** `613580e`

**2. [Rule 3 - Auto-fix blocking issue] TypeScript ES2023 lib configuration for ES2024 array operations**
- **Found during:** Task 1 setup
- **Issue:** `tsconfig.json` had `"lib": ["ES2022"]`, which did not recognize `.toSpliced()` without compile error.
- **Fix:** Added `"ES2023"` to `lib` array in `web/tsconfig.json`.
- **Files modified:** `web/tsconfig.json`
- **Commit:** `613580e`

## Self-Check: PASSED
- FOUND: web/src/store/useStudioStore.ts
- FOUND: web/src/types/studio.ts
- FOUND: web/src/components/layout/LeftRail.tsx
- FOUND: web/src/components/panels/EffectInspector.tsx
- FOUND: web/src/tests/stackStore.test.ts
- Commit 613580e verified in HEAD history
- Commit 68d7ac6 verified in HEAD history
- Commit d5b7d12 verified in HEAD history
