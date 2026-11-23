---
phase: 261123-pxa-fix-individual-quality-of-16-shaders
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/engine/graph/GraphCompiler.ts
  - web/src/engine/Pipeline.ts
  - web/src/engine/registry/stylize/ascii.ts
  - web/src/engine/registry/stylize/blockify.ts
  - web/src/engine/registry/stylize/pixelSort.ts
  - web/src/engine/registry/stylize/edgeDetect.ts
  - web/src/engine/registry/modulate/rgbSplit.ts
  - web/src/engine/registry/stylize/crosshatch.ts
  - web/src/engine/registry/stylize/contour.ts
  - web/src/engine/registry/stylize/dots.ts
  - web/src/engine/registry/stylize/waveLines.ts
  - web/src/engine/registry/stylize/voronoi.ts
  - web/src/engine/registry/stylize/halftone.ts
  - web/src/engine/registry/stylize/matrix.ts
  - web/src/engine/registry/stylize/dither.ts
  - web/src/engine/registry/stylize/noise.ts
  - web/src/engine/registry/stylize/threshold.ts
  - web/src/engine/registry/modulate/grain.ts
  - web/src/tests/graphCompiler.test.ts
  - web/src/tests/spatialShaders.test.ts
autonomous: true
requirements:
  - QUICK-SHADERS-FIX

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "GraphCompiler and StudioPipeline provide a stage-scoped env.sampleAt callback that samples the source texture or stage intermediate render target at arbitrary UV coordinates"
    - "Spatial shaders (blockify, pixelSort, edgeDetect, rgbSplit, ascii) evaluate at sampled coordinates rather than falling back to unshifted uv()"
    - "Edge detect implements a 3x3 Sobel convolution kernel over neighboring luminance taps with no zebra banding"
    - "Pixel sort directional search taps sample displaced scanline coordinates over 8 steps producing glitch smears"
    - "RGB split samples independent red, green, and blue displaced coordinates in linear light"
    - "All 16 registered shaders compile cleanly and pass vitest unit test suites"
  artifacts:
    - "web/src/engine/graph/GraphCompiler.ts"
    - "web/src/engine/Pipeline.ts"
    - "web/src/engine/registry/stylize/ascii.ts"
    - "web/src/engine/registry/stylize/blockify.ts"
    - "web/src/engine/registry/stylize/pixelSort.ts"
    - "web/src/engine/registry/stylize/edgeDetect.ts"
    - "web/src/engine/registry/modulate/rgbSplit.ts"
    - "web/src/tests/spatialShaders.test.ts"
  key_links:
    - from: "web/src/engine/graph/GraphCompiler.ts"
      to: "web/src/engine/registry/types.ts"
      via: "EffectEnvironment.sampleAt"
    - from: "web/src/engine/registry/stylize/edgeDetect.ts"
      to: "web/src/engine/graph/GraphCompiler.ts"
      via: "env.sampleAt"
---

<objective>
Restore and elevate the visual quality of all 16 registered shaders in the modular WebGPU/TSL pipeline.
Fix the spatial coordinate sampling breakdown where `env.sampleAt` was missing in `GraphCompiler.ts` and `Pipeline.ts`, implement Sobel 3x3 edge convolution, enable directional multi-tap pixel sorting streaks, restore chromatic RGB separation, and tune parameter defaults, luminance conversions, and dynamic ranges across all 16 shaders.

Purpose: Eliminate visual artifacts (zebra bands, missing pixelation, zero chromatic split, non-sorting streaks) introduced during the Phase 2 modular registry refactor and ensure every shader matches or exceeds Phase 1 aesthetic fidelity.
Output: Fixed `GraphCompiler.ts` with stage-scoped `sampleAt`, upgraded spatial shaders, tuned shaders across Stylize and Modulate categories, and comprehensive unit tests.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@web/src/engine/graph/GraphCompiler.ts
@web/src/engine/Pipeline.ts
@web/src/engine/registry/types.ts
@web/src/engine/registry/index.ts
@web/src/engine/registry/stylize/edgeDetect.ts
@web/src/engine/registry/stylize/pixelSort.ts
@web/src/engine/registry/modulate/rgbSplit.ts
@web/src/engine/registry/stylize/blockify.ts
@web/src/engine/registry/stylize/ascii.ts
</context>

<tasks>

<task type="tracer">
  <name>Task 1: End-to-end spatial coordinate sampling engine in GraphCompiler and Pipeline</name>
  <files>web/src/engine/graph/GraphCompiler.ts, web/src/engine/Pipeline.ts, web/src/tests/graphCompiler.test.ts</files>
  <action>
    Wire `env.sampleAt` and multi-pass spatial stage partitioning in `web/src/engine/graph/GraphCompiler.ts` and `web/src/engine/Pipeline.ts`:
    1. In `GraphCompiler.ts` (`planExecutionStages`):
       When a pass requires spatial sampling (e.g. `edgeDetect`, `pixelSort`, `rgbSplit`, or `def.requiresPass === true`) and is preceded by active passes in the current stage (`currentPasses.length > 0`), flush `currentPasses` into an intermediate target stage (`requiresTarget: true`). This ensures upstream color/tone transformations are rasterized into a texture before spatial convolutions or offsets execute.
    2. In `GraphCompiler.ts` (`compileGraph`):
       For each execution stage (`stageIdx`), construct a stage-scoped environment `stageEnv: EffectEnvironment`:
       - If `stageIdx === 0`: `sampleAt(uvCoord)` evaluates `sRGBToLinear(sourceNode.uv(uvCoord))` when `sourceNode` has `.uv`, or `sRGBToLinear(texture(sourceNode.value, uvCoord))` if `sourceNode.value instanceof THREE.Texture`, falling back to `currentInput`.
       - If `stageIdx > 0`: `sampleAt(uvCoord)` evaluates `inputTextureNode.uv(uvCoord)` (sampling the intermediate render target which is already linear light).
       - Pass `stageEnv` into `def.buildNode(current, passUniforms, stageEnv)`.
    3. In `Pipeline.ts`:
       Ensure `syncStack` populates `resolution`, `time`, `seed`, and `textureAtlas` in `env` passed to `compileGraph`.
    4. In `web/src/tests/graphCompiler.test.ts`:
       Add test cases verifying:
       - `compileGraph` provides `env.sampleAt` to effect definitions for both Stage 0 and Stage 1+.
       - `planExecutionStages` flushes preceding passes into an intermediate target stage when a spatial shader follows upstream passes (e.g. `[tone, edgeDetect]`), while preserving 1-stage fusion when contiguous passes are purely pointwise.
  </action>
  <verify>
    <automated>npm --prefix web test -- src/tests/graphCompiler.test.ts</automated>
  </verify>
  <done>GraphCompiler provides stage-scoped sampleAt callbacks and correctly splits execution stages into intermediate render targets when spatial shaders follow upstream passes.</done>
</task>

<task type="auto">
  <name>Task 2: Fix and upgrade the 5 spatial sampling shaders (edgeDetect, pixelSort, rgbSplit, blockify, ascii)</name>
  <files>web/src/engine/registry/stylize/edgeDetect.ts, web/src/engine/registry/stylize/pixelSort.ts, web/src/engine/registry/modulate/rgbSplit.ts, web/src/engine/registry/stylize/blockify.ts, web/src/engine/registry/stylize/ascii.ts, web/src/tests/spatialShaders.test.ts</files>
  <action>
    Fix spatial coordinate evaluation and elevate filter math across all 5 spatial sampling shaders:
    1. In `web/src/engine/registry/stylize/edgeDetect.ts`:
       - Upgrade from 1D zebra banding to a true 3x3 Sobel convolution kernel using `env.sampleAt`.
       - Compute normalized pixel step `vec2(thickness.div(resolution.x), thickness.div(resolution.y))`.
       - Sample 8 surrounding taps: `tl, t, tr, l, r, bl, b, br` at `st + offset`.
       - Compute Rec. 601 luminance for all taps.
       - Horizontal gradient: `gx = (tr + r*2.0 + br) - (tl + l*2.0 + bl)`.
       - Vertical gradient: `gy = (bl + b*2.0 + br) - (tl + t*2.0 + tr)`.
       - Gradient magnitude: `sqrt(gx*gx + gy*gy) * sensitivity`, clamped to [0.0, 1.0].
       - Set `costWeight: 2`.
    2. In `web/src/engine/registry/stylize/pixelSort.ts`:
       - Update `sampleFn` to call `env.sampleAt(coord)` when available.
       - Implement 8 directional search taps along scanline orientation vector `dir` (`vec2(1, 0)` or `vec2(0, 1)`) with `effSpan` jitter.
       - For each step `i = 1..8`, compute `samplePx = px.sub(dir.mul(stepOffset))`, clamp to [0.0, 1.0], and sample via `sampleFn(sampleUV)`.
       - Compare luminance against `effThresh` and select brightest upstream pixel to form smooth glitch sorting streaks.
       - Set `costWeight: 2`.
    3. In `web/src/engine/registry/modulate/rgbSplit.ts`:
       - Ensure `sampleFn` calls `env.sampleAt(coord)` for `uvR`, `uvG`, `uvB`, and `st`.
       - Displace Red channel by `+masterVec + redOffset`, Green by `greenOffset`, and Blue by `-masterVec + blueOffset`.
       - Recombine channels into `vec3(rSample.r, gSample.g, bSample.b)`.
    4. In `web/src/engine/registry/stylize/blockify.ts`:
       - Ensure `cellCenterUV` is sampled via `env.sampleAt(cellCenterUV)`, giving each quantized block a solid pixelated color before grid line borders are applied.
    5. In `web/src/engine/registry/stylize/ascii.ts`:
       - Ensure `cellCenterUV` is sampled via `env.sampleAt(cellCenterUV)` to extract solid cell color and uniform cell luminance for picking glyphs from the horizontal texture atlas strip.
    6. Create `web/src/tests/spatialShaders.test.ts`:
       Test all 5 spatial shaders verifying that:
       - When `env.sampleAt` is supplied, each shader executes its respective spatial sampling logic with distinct UV offsets.
       - Shaders gracefully fall back if `env.sampleAt` is omitted without throwing GPU/TSL compilation exceptions.
  </action>
  <verify>
    <automated>npm --prefix web test -- src/tests/spatialShaders.test.ts</automated>
  </verify>
  <done>All 5 spatial shaders correctly invoke sampleAt with calculated coordinates, yielding 3x3 Sobel edge detection, directional pixel sorting streaks, chromatic separation, blockify pixelation, and solid-cell ASCII glyph mapping.</done>
</task>

<task type="auto">
  <name>Task 3: Visual quality tuning and verification across all 16 registered shaders</name>
  <files>web/src/engine/registry/stylize/crosshatch.ts, web/src/engine/registry/stylize/contour.ts, web/src/engine/registry/stylize/dots.ts, web/src/engine/registry/stylize/waveLines.ts, web/src/engine/registry/stylize/voronoi.ts, web/src/engine/registry/stylize/halftone.ts, web/src/engine/registry/stylize/matrix.ts, web/src/engine/registry/stylize/dither.ts, web/src/engine/registry/stylize/noise.ts, web/src/engine/registry/stylize/threshold.ts, web/src/engine/registry/modulate/grain.ts</files>
  <action>
    Audit and tune the remaining 11 shaders to ensure Phase 1 aesthetic fidelity, dynamic range, and consistent parameter behavior:
    1. `crosshatch.ts`: Review dual diagonal line thresholds (0.7, 0.4) and ensure crisp line rendering against light and dark media backgrounds.
    2. `contour.ts`: Ensure clean isolines with smooth line mask thresholding (`stepVal.lessThan(lineWidth)`).
    3. `dots.ts`: Ensure dot matrix circles don't bleed across cell borders (`spacing.max(4.0)` and `dotR`).
    4. `waveLines.ts`: Polish raster wave frequency, amplitude, and time-driven movement.
    5. `voronoi.ts`: Review cellular mosaic distance metric and contrast scaling.
    6. `halftone.ts`: Verify rotational transform matrix (45 deg default) and dot radius clamping (`[0.0, 0.7]`).
    7. `matrix.ts`: Verify falling streams phosphor green coloring `vec3(0.0, 1.0, 0.4)` with glowing white heads.
    8. `dither.ts`: Verify Bayer 4x4 matrix threshold quantization math across color levels [2..16].
    9. `noise.ts`: Tune pseudorandom noise distribution and scale.
    10. `threshold.ts`: Verify 1-bit high-contrast black/white binary slicing with inversion toggle.
    11. `grain.ts`: Verify 35mm film grain distribution and monochrome vs color blending.
    Run the complete unit test suite and verify frontend build passes cleanly:
    - Run `npm --prefix web run test:unit`
    - Run `npm --prefix web run build`
  </action>
  <verify>
    <automated>npm --prefix web run test:unit && npm --prefix web run build</automated>
  </verify>
  <done>All 16 registered shaders are aesthetically tuned, pass all unit tests, and the web studio compiles without TypeScript errors.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client -> Shader Pipeline | User parameters and media dimensions passed from web UI into TSL shader uniforms |
| UV Coordinate -> Texture Sampler | Displaced sampling coordinates generated by convolution/glitch algorithms |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261123-01 | Denial of Service | GraphCompiler / Shaders | medium | mitigate | Enforce `.max(1.0)` / `.max(2.0)` guards on divisor uniforms (`spacing`, `blockSize`, `resolution`, `sortSpan`) to prevent GPU divide-by-zero or infinite loops |
| T-261123-02 | Tampering | Spatial Shaders (`pixelSort`, `edgeDetect`, `rgbSplit`) | low | mitigate | Clamp all calculated UV sample coordinates to `[0.0, 1.0]` before calling `sampleAt` to prevent out-of-bounds texture lookup anomalies |
| T-261123-SC | Tampering | npm/pip/cargo installs | high | mitigate | Package-legitimacy gate + blocking human checkpoint for assumed/sus packages |
</threat_model>

<verification>
1. `npm --prefix web test -- src/tests/graphCompiler.test.ts` passes.
2. `npm --prefix web test -- src/tests/spatialShaders.test.ts` passes.
3. `npm --prefix web run test:unit` passes completely (10+ test files).
4. `npm --prefix web run build` compiles without type or bundling errors.
</verification>

<success_criteria>
- `env.sampleAt` is fully operational in `GraphCompiler` across all execution stages.
- `edgeDetect` renders 3x3 Sobel gradient edges with zero zebra banding.
- `pixelSort` produces directional glitch streaks with 8-tap search.
- `rgbSplit` separates red, green, and blue color channels with configurable offsets.
- `blockify` and `ascii` correctly sample cell-centered UV coordinates.
- All 16 registered shaders achieve high visual fidelity matching or exceeding Phase 1.
- All unit tests and frontend production builds pass.
</success_criteria>

<output>
Create `.planning/quick/261123-pxa-fix-individual-quality-of-16-shaders/PLAN.md` when done
</output>
