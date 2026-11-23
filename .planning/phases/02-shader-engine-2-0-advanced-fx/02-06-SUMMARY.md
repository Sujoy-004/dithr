---
phase: 02-shader-engine-2-0-advanced-fx
plan: "06"
subsystem: 3d/verification
tags: [3d-ascii, gltf, glb-loader, orbit-controls, point-cloud, depth-raster, tsl, playwright, visual-regression, cross-backend]
status: complete
requires:
  - "02-03"
  - "02-04"
  - "02-05"
provides:
  - web/src/services/meshLoader.ts
  - web/src/engine/3d/PrimitiveFactory.ts
  - web/src/engine/3d/OrbitController.ts
  - web/src/engine/3d/AsciiPointCloud.ts
  - web/src/engine/3d/DepthRaster.ts
  - web/src/engine/registry/stylize/threeD.ts
  - web/src/components/panels/ThreeDPanel.tsx
  - web/src/tests/threeD.test.ts
  - web/e2e/shaderSnapshots.spec.ts
affects:
  - web/src/components/layout/RightRail.tsx
  - web/src/components/layout/CenterStage.tsx
  - web/src/engine/Pipeline.ts
  - web/src/engine/registry/index.ts
  - web/src/store/useStudioStore.ts
  - web/src/types/studio.ts
  - web/src/tests/capabilities.test.ts
  - web/src/tests/tracerPipeline.test.ts
tech-stack:
  added: []
  patterns:
    - Pre-parse binary magic byte validation (0x46546C67 / 'glTF') and 50MB file size ceiling (D-15, T-02-11)
    - AbortSignal timeout protection (10000ms) for client-side GLTF parsing (T-02-11)
    - Unit bounding box centering and normalization to [-1.5, 1.5] (D-15)
    - Procedural primitive generation (torus knot, sphere, cube, plane) with computed vertex normals (D-15)
    - Isolated spherical camera orbit controller with phi clamping [0.01, PI - 0.01] and stopPropagation to isolate from 2D HUD (D-17)
    - Dual-mode 3D ASCII generation: surface point cloud with key+rim lighting and depth-buffer raster representation (D-16, D-18)
    - Linear-light stack compositing allowing 3D pass insertion anywhere in the effect stack (D-19)
    - Deterministic Playwright visual snapshots using injected test uniforms (?testMode=true&freezeTime=1.0&seed=42) (D-25, D-27)
    - Cross-backend validation inspecting canvas readback for zero NaNs, non-black frames, and resolution scaling across 480p/720p/1080p (D-26, D-29)
key-files:
  created:
    - web/src/services/meshLoader.ts
    - web/src/engine/3d/PrimitiveFactory.ts
    - web/src/engine/3d/OrbitController.ts
    - web/src/engine/3d/AsciiPointCloud.ts
    - web/src/engine/3d/DepthRaster.ts
    - web/src/engine/registry/stylize/threeD.ts
    - web/src/components/panels/ThreeDPanel.tsx
    - web/src/tests/threeD.test.ts
    - web/e2e/shaderSnapshots.spec.ts
  modified:
    - web/src/engine/registry/index.ts
    - web/src/engine/Pipeline.ts
    - web/src/components/layout/CenterStage.tsx
    - web/src/components/layout/RightRail.tsx
    - web/src/store/useStudioStore.ts
    - web/src/types/studio.ts
    - web/src/tests/capabilities.test.ts
    - web/src/tests/tracerPipeline.test.ts
    - .gitignore
decisions:
  - "D-15: Mesh sources are built-in primitives (torus knot, sphere, cube, plane) and user-uploaded GLB files validated with 50MB ceiling and 0x46546C67 magic bytes"
  - "D-16: The 3D renderer produces both modes: surface-sampled ASCII point cloud and depth-buffer raster mapped to ASCII luminance"
  - "D-17: Camera control provides auto-rotate, pointer-drag orbit, wheel zoom, and reset, capturing pointer events with stopPropagation so HUD pan/zoom is not triggered"
  - "D-18: Point cloud shading uses key light (normalize(vec3(1.0, 1.5, 2.0))), rim light silhouette (pow(1.0 - dot(N, V), 3.0)), Rec. 601 perceived luminance, and depth-based size/alpha falloff without PBR overhead"
  - "D-19: 3D ASCII pass can be positioned at any stack level, compositing with upstream 2D passes via pass blend mode and intensity"
  - "D-25: Visual snapshots verify registered effects at fixed canvas size (640x360)"
  - "D-26: Cross-backend consistency verified structurally with zero NaNs, non-black frames, and matching dimensions"
  - "D-27: Deterministic playback and snapshots inject frozen time and seed uniforms (?freezeTime=1.0&seed=42)"
  - "D-29: Resolution scaling verified across 480p, 720p, and 1080p tiers"
metrics:
  duration: 25 min
  completed: "2026-11-23"
actuals:
  tokens: 17398
  tasks: 3
  commits: 3
  plan_head_before: a60b459caef3b434341e59897777587dbddec907
  plan_head_after: 51d0112497f7e112bc9d200b9f44948cc0c4d015
---

# Phase 02 Plan 06: 3D ASCII Rendering & Visual Verification Harness Summary

Delivered real-time 3D ASCII rendering, secure client-side GLB mesh ingestion, isolated camera orbit controls, and the comprehensive automated visual verification harness across resolutions and GPU backends per D-15, D-16, D-17, D-18, D-19, D-25, D-26, D-27, D-29, and FX-06.

## Key Changes

1. **3D Mesh Ingestion & Primitive Factory (`web/src/services/meshLoader.ts`, `PrimitiveFactory.ts`)**:
   - `meshLoader.ts` strictly enforces a 50MB file size ceiling and validates binary glTF container magic bytes `0x46546C67` (`glTF`) before parsing (D-15, T-02-11).
   - Wraps `GLTFLoader.parse` in `AbortSignal.timeout(10000)` to guard against browser tab hangs on pathological assets.
   - Computes object bounding boxes and scales/centers loaded meshes to fit within unit bounds `[-1.5, 1.5]` (max dimension 3.0).
   - `PrimitiveFactory.ts` generates centered `BufferGeometry` primitives (`torusKnot`, `sphere`, `cube`, `plane`) with computed vertex normals.

2. **Isolated Camera Orbit Controller (`web/src/engine/3d/OrbitController.ts`)**:
   - Implements spherical coordinate camera navigation (`radius`, `theta`, `phi`) with auto-rotation (default 1.0x).
   - Clamps polar angle `phi` to `[0.01, Math.PI - 0.01]` and zoom `radius` to `[1.0, 10.0]`.
   - Calls `e.stopPropagation()` on captured pointer and wheel events to prevent conflicting with CenterStage's 2D canvas pan/zoom HUD (D-17).
   - Includes camera view reset restoring default orientation.

3. **Dual-Mode 3D ASCII Generation & Stack Compositing (`AsciiPointCloud.ts`, `DepthRaster.ts`, `threeD.ts`)**:
   - `AsciiPointCloud.ts`: TSL `PointsNodeMaterial` with point size scaled by inverse depth, illuminated with key directional light (`normalize(vec3(1.0, 1.5, 2.0))`) and rim light silhouette highlight (`pow(1.0 - dot(N, V), 3.0)`). Quantizes Rec. 601 perceived luminance to sample character glyphs from the shared horizontal `TextureAtlas` strip (D-16, D-18).
   - `DepthRaster.ts`: Generates linearized normalized depth ($Z_{\text{linear}} = (2.0 \cdot \text{near}) / (\text{far} + \text{near} - z \cdot (\text{far} - \text{near}))$), downsamples depth to ASCII character grid dimensions, and maps depth to the ASCII luminance ramp.
   - `threeD.ts`: Registered under `stylize` category with `costWeight: 3` and `requiresPass: true`. Exposes parameter schema (`renderMode`, `pointSize`, `density`, `keyLightIntensity`, `rimLightIntensity`, `depthFalloff`, `primitive`).
   - Supports stack compositing: 3D pass can be inserted anywhere in the effect stack, blending with upstream passes via pass `blendMode` and `intensity` (D-19).

4. **3D UI Panel & Store State (`ThreeDPanel.tsx`, `useStudioStore.ts`, `RightRail.tsx`)**:
   - Added `ThreeDState` slice to `useStudioStore` managing active primitive, custom mesh reference, auto-rotate toggle/speed, and camera reset triggers.
   - Built `ThreeDPanel.tsx` in `RightRail`: primitive buttons (Torus Knot, Sphere, Cube, Plane), custom GLB upload picker with validation error display, auto-rotate switch, rotation speed slider, and Reset Camera button.

5. **Playwright Visual Verification Suite (`web/e2e/shaderSnapshots.spec.ts`, `capabilities.test.ts`)**:
   - `shaderSnapshots.spec.ts`: E2E test suite running on headless Chromium with `--use-angle=swiftshader` and `--enable-unsafe-webgpu`:
     - Test 1 (All Pass Snapshots): verifies registered effects render at fixed canvas size (640x360) under deterministic frozen uniforms (`?freezeTime=1.0&seed=42`) (D-25, D-27).
     - Test 2 (Multi-Pass Stack Snapshot): compiles and verifies 3-pass stack (`tone` -> `ascii` -> `crtVhs`) composites cleanly without visual clipping or black frames (D-01, FX-01).
     - Test 3 (Backend Consistency Check): verifies canvas pixel readback contains zero NaNs and valid non-zero content across backends (D-26).
     - Test 4 (Resolution Scaling): verifies rendering and scaling across 480p, 720p, and 1080p (D-29).
   - `capabilities.test.ts`: Expanded unit tests asserting tier budgets enforce maximum dimensions (1080p/720p/480p), target FPS (60/30), pass budgets (8/5/3), and intermediate render target limits (4/2/1) across quality tiers (D-23, D-29).

## Verification & Results

- Unit Tests: `npm --prefix web run test:unit`: 122 tests passing across 10 test files (`threeD.test.ts`, `capabilities.test.ts`, `tracerPipeline.test.ts`, `masks.test.ts`, `colorMath.test.ts`, `stackStore.test.ts`, `graphCompiler.test.ts`, `audioEngine.test.ts`, `store.test.ts`, `videoExport.test.ts`).
- E2E Playwright Tests: `npx playwright test e2e/shaderSnapshots.spec.ts`: 4/4 tests passed in Chromium SwiftShader with WebGPU.
- Production Build: `npm --prefix web run build`: Bundled cleanly in 2.85s with 0 TypeScript compilation errors.
- Python Code Quality: `ruff check src tests` passed with 0 errors; `mypy src` passed with 0 issues across 23 source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused exhaustive check and variable warnings under strict tsconfig**
- **Found during:** Task 1 & Task 2 verification (`npm --prefix web run build`)
- **Issue:** TypeScript error TS6133 indicated unused variables `_exhaustive`, `min`, `normalize`, `linearizeDepth`, `float` with `noUnusedLocals: true`.
- **Fix:** Removed unused imports and clean default switch branch.
- **Files modified:** `web/src/engine/3d/PrimitiveFactory.ts`, `web/src/engine/3d/AsciiPointCloud.ts`, `web/src/tests/threeD.test.ts`
- **Commit:** `b640624`, `c11dfea`

**2. [Rule 1 - Bug] Three.js TSL vec4 / vec2 overload type resolution**
- **Found during:** Task 2 verification (`npm --prefix web run build`)
- **Issue:** `@types/three` TSL constructor for `vec4` gave overload type mismatches when combining `Node<"vec3">` and `Node<"float">`.
- **Fix:** Used scalar component constructors and type casting helpers `(vec4 as any)(...)` and `(vec2 as any)(...)`.
- **Files modified:** `web/src/engine/3d/AsciiPointCloud.ts`, `web/src/engine/3d/DepthRaster.ts`
- **Commit:** `c11dfea`

**3. [Rule 1 - Bug] EffectRegistry count assertion in tracer test**
- **Found during:** Task 2 verification (`npm --prefix web run test:unit`)
- **Issue:** `tracerPipeline.test.ts` hardcoded expected total effects to 19 and stylize to 15.
- **Fix:** Added `threeD` to `EXPECTED_STYLIZE_IDS`, updating expected total to 20 and stylize to 16.
- **Files modified:** `web/src/tests/tracerPipeline.test.ts`
- **Commit:** `c11dfea`

## Self-Check: PASSED
- FOUND: web/src/services/meshLoader.ts
- FOUND: web/src/engine/3d/PrimitiveFactory.ts
- FOUND: web/src/engine/3d/OrbitController.ts
- FOUND: web/src/engine/3d/AsciiPointCloud.ts
- FOUND: web/src/engine/3d/DepthRaster.ts
- FOUND: web/src/engine/registry/stylize/threeD.ts
- FOUND: web/src/components/panels/ThreeDPanel.tsx
- FOUND: web/src/tests/threeD.test.ts
- FOUND: web/e2e/shaderSnapshots.spec.ts
- Commit b640624 verified in HEAD history
- Commit c11dfea verified in HEAD history
- Commit 51d0112 verified in HEAD history
