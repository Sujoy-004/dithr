---
phase: 02-shader-engine-2-0-advanced-fx
plan: 02
subsystem: engine/graph
tags: [pass-fusion, render-targets, passpool, graph-compiler, tier-budgets, webgpu]
status: complete
requires:
  - 02-01
provides:
  - web/src/engine/graph/PassPool.ts
  - web/src/engine/graph/GraphCompiler.ts
  - web/src/engine/capabilities.ts
  - web/src/engine/Pipeline.ts
  - web/src/tests/graphCompiler.test.ts
affects:
  - web/src/components/layout/CenterStage.tsx
  - web/src/store/useStudioStore.ts
tech-stack:
  added: []
  patterns:
    - Pointwise fragment pass fusion into unified TSL fragment shader stages
    - Keyed RenderTarget pooling with automatic frame recycling
    - Topology-hash pipeline caching (rebuild ONLY on structural changes)
    - In-place TSL uniform mutation with zero pipeline recompilation
    - Quality tier pass budget enforcement (High ~8, Medium ~5, Low ~3)
    - WebGL2/WebGPU context loss and restoration lifecycle handling
key-files:
  created:
    - web/src/engine/graph/PassPool.ts
    - web/src/engine/graph/GraphCompiler.ts
    - web/src/tests/graphCompiler.test.ts
  modified:
    - web/src/engine/capabilities.ts
    - web/src/engine/Pipeline.ts
decisions:
  - "D-21: Consecutive pointwise passes compiled into single TSL FusedFragmentStage, intermediate targets pooled via PassPool only when spatial/temporal passes require boundaries"
  - "D-22: Pipeline caching keyed by topology hash (effect IDs + blend modes); uniform parameter adjustments mutate TSL UniformNode.value directly without recompilation"
  - "D-23: Quality tier budgets (High: 8, Medium: 5, Low: 3 passes) enforced with evaluateTierBudget auto-disabling lowest priority passes on budget overflow"
  - "D-24: PassPool caches RenderTargets by dimension/format/type, disposes all GPU textures cleanly on context loss, and triggers safe graph reconstruction"
metrics:
  duration: 15 min
  completed: "2026-11-23"
actuals:
  tokens: 12859
  tasks: 3
  commits: 3
  plan_head_before: 56d31c3b8cb7e7b2f4ca16cf2e8bbb5f60904662
  plan_head_after: cde62b11b6ca41662526506e531357aa3ecd2d62
---

# Phase 02 Plan 02: Hybrid Graph Compiler and PassPool Summary

Built the hybrid render graph compiler, intermediate `PassPool`, and budget-managed execution pipeline per D-21, D-22, D-23, D-24, and FX-01.
Replaced the legacy 4-stage fixed switch pipeline in `Pipeline.ts` with a dynamic cached execution graph that fuses contiguous pointwise operations into unified TSL fragment shaders, recycles intermediate offscreen render targets, and updates shader uniforms in-place without recompilation stutter.

## Key Changes

1. **Pooled RenderTargets & GPU Context Lifecycle (`web/src/engine/graph/PassPool.ts`)**:
   - Implemented `PassPool` caching `THREE.RenderTarget` instances keyed by `${width}:${height}:${format}:${type}`.
   - Built `acquire`, `release`, `resetFrame`, and `prune` methods to eliminate VRAM allocation thrashing and leaks during real-time rendering.
   - Wired WebGL2 context loss (`webglcontextlost`, `webglcontextrestored`) and WebGPU `device.lost` hooks to purge stale textures and trigger clean reconstruction.

2. **Hybrid Graph Compiler with Pass Fusion (`web/src/engine/graph/GraphCompiler.ts`)**:
   - Implemented `computeTopologyHash(stack)` returning a stable topology hash based on enabled effect IDs and row blend modes, completely independent of parameter values.
   - Implemented `planExecutionStages(stack, registry)`: contiguous pointwise passes (`requiresPass === false`) fuse into a single `FusedFragmentStage`. Boundary passes (`requiresPass === true`) schedule an `IntermediateTargetStage` backed by `PassPool`.
   - Implemented `compileGraph(...)`: decodes source to linear light (`sRGBToLinear`), composes TSL `Fn` nodes with linear blend modes and intensity, and applies sRGB encoding (`linearTosRGB`) at final display output.
   - Binds TSL `UniformNode` references into a uniform lookup map for zero-recompile slider edits.

3. **Tier Budget Enforcement & Pipeline Integration (`web/src/engine/capabilities.ts`, `web/src/engine/Pipeline.ts`)**:
   - Extended `TierConfig` and `TIER_CONFIGS` with `maxPassBudget` (High: 8, Medium: 5, Low: 3) and `maxIntermediateTargets` (High: 4, Medium: 2, Low: 1) per D-23.
   - Implemented `evaluateTierBudget` to calculate total cost weight and auto-disable lowest-priority passes on budget overflow.
   - Refactored `StudioPipeline` to use `GraphCompiler` and `PassPool`, caching compiled pipelines by topology hash.
   - Implemented `updateUniform(instanceId, paramKey, value)` mutating `UniformNode.value` directly in-place.
   - Implemented multi-stage offscreen execution in `render()`, rendering intermediate passes into pooled targets and final pass to display quad.
   - Maintained full backwards compatibility with existing UI (`CenterStage.tsx`) and store methods (`setEffect`, `updateTone`, `updateAscii`, `updateEffectParam`).

4. **Automated Unit Test Suite (`web/src/tests/graphCompiler.test.ts`)**:
   - 15 automated test cases validating:
     - Target caching, reuse, recycling, pruning, and context loss recovery in `PassPool`.
     - Topology hash stability against parameter tweaks.
     - 4-pass pointwise stack (`tone`, `dither`, `blockify`, `threshold`) compiling to exactly 1 stage and 0 intermediate targets.
     - Multi-pass boundary splitting into 2 stages with 1 intermediate render target.
     - Uniform in-place mutations without pipeline invalidation.
     - Budget enforcement auto-disabling lowest priority passes on Low tier.

## Verification & Results

- `npm --prefix web run test:unit`: 56 unit tests passing across 6 test suites (`graphCompiler.test.ts`, `colorMath.test.ts`, `tracerPipeline.test.ts`, `capabilities.test.ts`, `store.test.ts`, `videoExport.test.ts`).
- `npm --prefix web run build`: TypeScript `tsc --noEmit` and Vite production build succeeded with zero errors.
- Python test suite: 458 passed, `ruff check` and `mypy` passed with zero errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused TypeScript imports and unread variable in `GraphCompiler.ts`**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `EffectDefinition` and `previousStageOutputNode` were unused, failing strict `tsc --noEmit`.
- **Fix:** Removed unused import and variable.
- **Files modified:** `web/src/engine/graph/GraphCompiler.ts`
- **Commit:** `a6f499b`

**2. [Rule 1 - Bug] Parameter type handling for non-numeric uniform values in `GraphCompiler.ts`**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** `uniform(paramValue)` threw type error when `paramValue` was string/boolean.
- **Fix:** Added type branching to convert booleans to float (1.0/0.0) and handle string values cleanly.
- **Files modified:** `web/src/engine/graph/GraphCompiler.ts`
- **Commit:** `a6f499b`

**3. [Rule 1 - Bug] Missing `customChars` property in legacy ASCII defaults in `Pipeline.ts`**
- **Found during:** Task 3 verification (`npm run build`)
- **Issue:** `legacyAscii` lacked `customChars: ''`, failing strict `AsciiSettings` type check.
- **Fix:** Added `customChars: ''` default to `legacyAscii`.
- **Files modified:** `web/src/engine/Pipeline.ts`
- **Commit:** `cde62b1`

## Self-Check: PASSED
- FOUND: web/src/engine/graph/PassPool.ts
- FOUND: web/src/engine/graph/GraphCompiler.ts
- FOUND: web/src/engine/capabilities.ts
- FOUND: web/src/engine/Pipeline.ts
- FOUND: web/src/tests/graphCompiler.test.ts
- Commit 57480ec verified in HEAD history
- Commit a6f499b verified in HEAD history
- Commit cde62b1 verified in HEAD history
