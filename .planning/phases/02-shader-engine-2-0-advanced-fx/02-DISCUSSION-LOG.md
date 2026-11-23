# Phase 2: Shader Engine 2.0 & Advanced FX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-23
**Phase:** 02-Shader Engine 2.0 & Advanced FX
**Areas discussed:** Stack Model & UI, Color/Masks/Analog Look, Audio Reactivity, 3D ASCII Scope, Shader Architecture & Performance, Shader Verification & Visual Consistency

---

## Stack Model & UI

### How should the 16 existing modes fit into the stack?

| Option | Description | Selected |
|--------|-------------|----------|
| All stackable, grouped | All 16 become ordered passes; palette groups stylize vs modulate; any order allowed; no exclusive slots. | ✓ |
| Generator + modifier split | One stylizer active at a time; modifiers stack on top. | |
| Flat unrestricted list | All passes in one flat list, no categories. | |

**User's choice:** All stackable, grouped.
**Notes:** Matches FX-01's "arbitrary sequence" requirement.

### Where should the effect stack live?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace LeftRail tiles | LeftRail becomes the ordered stack with drag reorder, eye toggle, duplicate, delete, and add palette. | ✓ |
| Stack in RightRail | Keep the 16-tile radio; add a stack panel above the inspector. | |
| Bottom dock | Horizontal stack strip under the canvas. | |

**User's choice:** Replace LeftRail tiles.
**Notes:** RightRail stays parameter-focused; no new layout column.

### What per-effect blend controls should each stack row expose?

| Option | Description | Selected |
|--------|-------------|----------|
| Intensity + blend modes | Per-effect opacity plus normal/multiply/screen/add. | ✓ |
| Intensity only | Opacity mix only. | |
| Blend modes only | Mode selector, no intensity. | |

**User's choice:** Intensity + blend modes.
**Notes:** Phase 3 layer blend modes remain a separate system.

### What happens to today's one-click mode selection?

| Option | Description | Selected |
|--------|-------------|----------|
| Tile click builds 1-pass stack | Clicking a stylize tile replaces the stack's stylize pass; multi-pass stacks remain manual. | ✓ |
| Remove one-click modes | Users always build stacks. | |
| Separate quick/stack switch | Two mental models. | |

**User's choice:** Tile click builds a one-pass stack.
**Notes:** Preserves the current fast path for casual use.

---

## Color, Masks & Analog Look

### How should Rec. 601 vs Rec. 709 be exposed?

| Option | Description | Selected |
|--------|-------------|----------|
| Context defaults + override | 601 for ASCII/luminance, 709 for tone/blending, plus a single luminance-standard toggle. | ✓ |
| Fixed, no toggle | Hardcode context defaults. | |
| Always Rec. 709 | Use 709 everywhere. | |

**User's choice:** Context defaults + override.
**Notes:** Preserves parity with `src/renderer.py` and Rec. 601 text export.

### Where should gamma correction happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Linear-light between passes | Decode sRGB, blend in linear, encode once at output. | ✓ |
| Stay in sRGB space | Blend on encoded values, fix known math errors. | |
| Linear only for blend ops | Convert around mix/blend nodes only. | |

**User's choice:** Linear-light between passes.
**Notes:** Satisfies FX-02's gamma-accurate blending.

### How should masks be configured?

| Option | Description | Selected |
|--------|-------------|----------|
| Numeric controls | Shape + center/size/feather/invert/strength in the inspector. | |
| On-canvas handles | Drag/resize directly on the viewport. | |
| Both | Numeric controls plus on-canvas handles. | ✓ |

**User's choice:** Both.
**Notes:** Numeric state is the source of truth; handles write back to it.

### What level of RGB separation control?

| Option | Description | Selected |
|--------|-------------|----------|
| Amount + angle + channel multipliers | Master amount/angle plus independent R/G/B multipliers. | |
| Amount only | Single slider. | |
| Full per-channel X/Y offsets | Six offsets for R/G/B horizontal and vertical shift. | ✓ |

**User's choice:** Full per-channel X/Y offsets.
**Notes:** Master amount/angle still provided for quick symmetric setups.

### How should advanced CRT/VHS be presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Profiles + sliders | Named starting points plus individual sliders for decay, curvature, jitter, bloom, scanlines. | ✓ |
| Sliders only | Every phenomenon individually. | |
| Profiles only | Named looks with intensity only. | |

**User's choice:** Profiles + sliders.
**Notes:** Profiles are starting points, not locked modes.

---

## Audio Reactivity

### Which audio inputs should drive reactivity?

| Option | Description | Selected |
|--------|-------------|----------|
| Mic + media audio | Both selectable, routed through the singleton AudioContext. | ✓ |
| Mic only | Microphone only. | |
| Media audio only | Current video's audio only. | |

**User's choice:** Mic + media audio.
**Notes:** Default off; no permission prompt until enabled.

### How should users assign bands to parameters?

| Option | Description | Selected |
|--------|-------------|----------|
| Global macros + per-effect mod | Bass/mid/treble macros plus per-effect modulation rows. | ✓ |
| Global macros only | Curated parameter set. | |
| Per-effect matrix only | Explicit assignments only. | |

**User's choice:** Global macros + per-effect modulation.
**Notes:** Macros give instant results; per-effect rows give depth.

### How should FFT analysis be wired?

| Option | Description | Selected |
|--------|-------------|----------|
| One analyser bus, zero React | One AnalyserNode on a mixer gain, fftSize 256, arrays allocated once, values to TSL uniforms. | ✓ |
| Per-source analysers | Separate analyser per source. | |
| Worker-computed bands | AudioWorklet/worker analysis. | |

**User's choice:** One analyser bus, zero React.
**Notes:** Matches research ARCHITECTURE.md and PITFALLS.md #5.

### How should permission and autoplay failures be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Enable + status chip | Explicit enable, status chip, resume on click, mic never auto-starts. | ✓ |
| Auto-prompt on effect select | Immediate permission prompt. | |
| Silent fallback + toast | Flat output with transient toast. | |

**User's choice:** Enable + status chip.
**Notes:** Avoids PITFALLS.md #6 silent failure.

### What smoothing and sensitivity controls?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-band attack/release + sensitivity | Fast attack, slower release, master sensitivity, advanced per-band tuning. | ✓ |
| Sensitivity only | Fixed smoothing, one slider. | |
| Full per-band controls | Sensitivity, attack, release, gain, curve per band. | |

**User's choice:** Per-band attack/release + sensitivity.
**Notes:** Defaults ~20ms attack / ~200ms release.

---

## 3D ASCII Scope

### Where do 3D meshes come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Built-in primitives only | Torus knot, sphere, cube, plane, procedural displacement. | |
| Built-ins + GLB upload | Primitives plus user-uploaded GLB/glTF meshes. | ✓ |
| GLB/OBJ upload only | User must supply a mesh. | |

**User's choice:** Built-ins + GLB upload.
**Notes:** Adds loader, validation, and a second ingestion path; OBJ deferred.

### What should the 3D renderer produce?

| Option | Description | Selected |
|--------|-------------|----------|
| Point cloud + depth raster | Both toggleable, shared mesh/camera. | ✓ |
| Point cloud only | Surface points as glyphs. | |
| Depth raster only | Depth buffer to ASCII luminance. | |

**User's choice:** Point cloud + depth raster.

### How should the camera be controlled?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-rotate + orbit/zoom | Slow auto-rotate, drag orbit, wheel zoom, reset. | ✓ |
| Auto-rotate only | Fixed path with speed control. | |
| Orbit/zoom only | Manual only. | |

**User's choice:** Auto-rotate + orbit/zoom.
**Notes:** Orbit input captured inside the 3D layer to avoid fighting HUD pan/zoom.

### How should point brightness and depth be computed?

| Option | Description | Selected |
|--------|-------------|----------|
| Lambert + rim + depth attenuation | Key light, rim light, depth-based size/alpha, depth test. | ✓ |
| Unlit luminance | Depth or flat ramp only. | |
| Full PBR | Physically based lighting. | |

**User's choice:** Lambert + rim + depth attenuation.

### How does 3D ASCII participate in the stack?

| Option | Description | Selected |
|--------|-------------|----------|
| Source node at stack base | 3D generator at the bottom; modifiers apply downstream. | |
| Separate 3D mode | Dedicated mode outside the stack. | |
| Anywhere in the stack | Insertable at any position. | ✓ |

**User's choice:** Anywhere in the stack.
**Notes:** To keep this coherent, the 3D generator composites with upstream output via its blend mode/intensity rather than discarding earlier passes.

---

## Shader Architecture & Performance

### How should effects be defined?

| Option | Description | Selected |
|--------|-------------|----------|
| Typed effect registry | EffectDefinition with id, category, typed params, build(), pass requirements, cost weight. | ✓ |
| Keep switch-based functions | Extend Pipeline.ts switch. | |
| Registry for new only | Two systems. | |

**User's choice:** Typed effect registry.

### How should the render graph handle neighborhood/feedback effects?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid pointwise + RT passes | Pointwise effects compile into one chain; RT passes for bloom/phosphor/blur. | ✓ |
| One RT pass per effect | Uniform but expensive. | |
| Single shader chain only | No bloom/feedback. | |

**User's choice:** Hybrid pointwise + RT passes.

### When should the shader graph rebuild?

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild on topology only | Rebuild on add/remove/reorder/toggle; uniforms for params; topology-hash cache. | ✓ |
| Rebuild on every change | Current behavior. | |
| Precompile fixed combos | Impossible for arbitrary stacks. | |

**User's choice:** Rebuild on topology only.

### How should pass-count and performance budgets work?

| Option | Description | Selected |
|--------|-------------|----------|
| Cost weights + tier budgets | Per-effect cost, tier budgets, auto-disable with notice and override. | ✓ |
| Hard cap with error | Fixed count limit. | |
| No limits | Let FPS degrade. | |

**User's choice:** Cost weights + tier budgets.

### How should render targets and device loss be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| PassPool + device-loss recovery | Pooled targets by size/format, reuse, dispose; rebuild once on device loss. | ✓ |
| Allocate per rebuild | Rely on GC; high VRAM-leak risk. | |
| Fixed ping-pong pair | Two targets only. | |

**User's choice:** PassPool + device-loss recovery.

---

## Shader Verification & Visual Consistency

### How should shaders get visual regression coverage?

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright snapshot suite | Fixed canvas/time/seed/input, pixel-diff tolerance, committed baselines, WebGL2/SwiftShader in CI. | ✓ |
| JS math unit tests only | Numeric tests, no pixels. | |
| Manual review only | No automated pixel coverage. | |

**User's choice:** Playwright snapshot suite.

### How should WebGPU vs WebGL2 consistency be verified?

| Option | Description | Selected |
|--------|-------------|----------|
| Structural + perceptual tolerance | Same uniforms/dimensions/no NaN or black frames, loose MAE threshold. | ✓ |
| Exact pixel match | Flaky across drivers. | |
| WebGL2 only | Trust WebGPU. | |

**User's choice:** Structural + perceptual tolerance.

### How should time-based and random effects be testable?

| Option | Description | Selected |
|--------|-------------|----------|
| Inject time + seed | Uniforms, no Date.now()/Math.random(), frozen time, seeded hash. | ✓ |
| Snapshot live frames | Flaky. | |
| No animation tests | Misses animation regressions. | |

**User's choice:** Inject time + seed.

### What color-accuracy and edge-case coverage?

| Option | Description | Selected |
|--------|-------------|----------|
| Golden math + edge cases | Known RGB triples, gamma round-trip, clamping, black/white, odd sizes/aspects. | ✓ |
| Visual snapshots only | Misses numeric drift. | |
| Manual only | Weakest. | |

**User's choice:** Golden math + edge cases.

### How should resolution-scaling behavior be verified?

| Option | Description | Selected |
|--------|-------------|----------|
| Test 480p/720p/1080p | All three tiers, downscaled structural similarity, size-dependent params. | ✓ |
| One resolution only | Misses tier bugs. | |
| Manual only | Tier regressions ship. | |

**User's choice:** Test 480p/720p/1080p.

---

## the agent's Discretion

- Exact CRT/VHS profile names and parameter bundles.
- Palette ordering, labels, and icon choices.
- Which numeric parameters are exposed to audio modulation.
- GLB/glTF size cap, supported extensions, validation messages, and upload UX.
- Mask-handle interaction details (drag vs resize, snapping, keyboard nudging).
- Exact tier budget numbers and cost weights.
- Whether the luminance-standard toggle lives in pre-tone or a global settings popover.
- Exact snapshot diff tolerance and cross-backend MAE threshold.

## Deferred Ideas

- OBJ mesh import (only GLB/glTF selected).
- Stack preset serialization and sharing (Phase 4).
- Undo/redo of stack operations (Phase 3).
- Keyframing audio modulation and 3D camera moves (Phase 3).
- Stack presets / macro chains beyond the four ASCII ramp presets (future).
- Multi-layer compositing with 3D as a layer (Phase 3).
