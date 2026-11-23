# Phase 2: Shader Engine 2.0 & Advanced FX - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 replaces the fixed one-effect, four-stage shader pipeline with a composable, typed effect graph, corrects the color pipeline, and adds the advanced FX surface defined by FX-01 through FX-06.

It delivers:
1. An ordered effect stack where all 16 existing modes become stackable passes, with drag reorder, enable/disable, duplicate, delete, per-effect intensity, and blend modes.
2. Corrected color math: Rec. 601 / Rec. 709 luminance, linear-light compositing, and sRGB output encoding.
3. RGB channel separation with full per-channel X/Y offsets, plus vignette/box/circular masks configured numerically and with on-canvas handles.
4. Advanced CRT/VHS emulation: phosphor decay, beam curvature, tracking jitter, bloom, and scanlines, shipped as named profiles plus individual sliders.
5. Audio-reactive modulation from microphone or media audio through the existing singleton `AudioContext`, using bass/mid/treble bands, global macros, and per-effect modulation rows.
6. 3D ASCII rendering from built-in primitives and user-uploaded GLB/glTF meshes, producing both ASCII point clouds and depth-buffer rasters.
7. A typed effect registry, hybrid pointwise/render-target graph, topology-only rebuilds, tier budgets, and pooled render targets.
8. Playwright visual snapshots, cross-backend consistency checks, deterministic time/seed injection, golden color math, and resolution-scaling tests.

**Not in this phase:** multi-layer compositing, keyframes/timeline, undo/redo history, session recovery, export queue, IndexedDB persistence, URL preset sharing, cloud sync, embeddable distribution. Those belong to Phases 3 and 4.

</domain>

<decisions>
## Implementation Decisions

### Effect Stack Model & UI
- **D-01:** All 16 existing modes become ordered, stackable passes. The palette groups them as **stylize** (ascii, dither, halftone, matrix, pixelSort, blockify, threshold, edgeDetect, crosshatch, waveLines, noise, voronoi, dots, contour, tone) and **modulate** (vhs, rgb split, bloom, vignette, masks, grain). Any order is allowed; there are no exclusive generator slots. — **Reversibility:** costly — Undoing this means redesigning the pipeline, palette, store schema, and every preset around a single-active-effect model again.
- **D-02:** The LeftRail becomes the effect stack. It replaces the 16-tile radio group with an ordered list supporting drag reorder, eye toggle, duplicate, delete, and an `+ add effect` palette. The RightRail remains dedicated to parameters. — **Reversibility:** reversible — Confined to layout components and stack store actions.
- **D-03:** Every stack row exposes independent intensity (mix with the previous output) plus a blend mode: normal, multiply, screen, add. Phase 3 layer blend modes remain a separate system. — **Reversibility:** reversible — Per-row UI and a compositing node; no public contract.
- **D-04:** Clicking a stylize tile still builds a one-pass stack, preserving the current fast path. Multi-pass stacks are built manually from the palette. — **Reversibility:** reversible — A store action that replaces the stylize pass.

### Color, Masks & Analog Look
- **D-05:** Color-standard defaults are context-correct: Rec. 601 for ASCII/luminance (parity with `src/renderer.py` and text export), Rec. 709 for tone and blending. A single luminance-standard toggle in the pre-tone panel lets users force 601 or 709 everywhere. — **Reversibility:** costly — Changing defaults later alters every rendered image and export comparison baseline.
- **D-06:** Compositing happens in linear light between passes: decode sRGB inputs to linear, run effect mixing/blending in linear light, encode to sRGB once at output. — **Reversibility:** costly — Pervasive graph change and affects export parity; reverting to sRGB blending would re-touch every pass.
- **D-07:** Masks support vignette, box, and circular shapes with numeric controls (center X/Y, size/radius, feather, invert, strength) **and** on-canvas drag/resize handles. Numeric controls are the accessible, testable source of truth; handles write back to them. — **Reversibility:** reversible — Handles are additive UI over numeric state.
- **D-08:** RGB channel separation exposes full per-channel X/Y offsets for R, G, and B, plus master amount and direction angle for quick symmetric setups. — **Reversibility:** reversible — Parameter schema and inspector controls only.
- **D-09:** Advanced CRT/VHS ships named profiles (e.g. VHS SP, worn VHS EP, CRT arcade, broadcast monitor) that set a coherent bundle, plus individual sliders for phosphor decay, beam curvature, tracking jitter, bloom, and scanlines. Profiles are starting points, not locked modes. — **Reversibility:** reversible — Profile data plus existing slider bindings.

### Audio Reactivity
- **D-10:** Audio sources are microphone (`getUserMedia` audio) and the current media's audio, selectable in a small audio panel. Both route through the existing singleton `AudioContext`; default is off with no permission prompt until the user enables it. — **Reversibility:** costly — Adds permission, lifecycle, and source-switching contracts to the shared audio graph.
- **D-11:** Modulation is a hybrid: three global bass/mid/treble macros with sensitivity and smoothing for instant results, plus per-effect modulation rows (target parameter, band, amount) for depth. — **Reversibility:** costly — Store schema, inspector UI, and serialization shape all depend on it.
- **D-12:** One analyser bus: a single `AnalyserNode` on a mixer gain inside the singleton context, `fftSize: 256`, typed arrays allocated once, band values pushed directly to TSL uniforms in the render loop with zero React re-renders. — **Reversibility:** costly — Audio graph architecture and render-loop contract.
- **D-13:** Audio activation is explicit: an `enable audio` control and a status chip (off / waiting for click / live / denied / unavailable). `AudioContext.resume()` runs on that click; the mic never auto-starts. — **Reversibility:** reversible — UI state and a resume call.
- **D-14:** Response shaping uses per-band attack/release with fast attack (~20ms) and slower release (~200ms) defaults, a master sensitivity slider, and an advanced row for per-band tuning. — **Reversibility:** reversible — Smoothing parameters only.

### 3D ASCII
- **D-15:** Mesh sources are built-in primitives (torus knot, sphere, cube, plane) plus procedural displacement, **and** user-uploaded GLB/glTF meshes. Upload adds a loader, validation, and a second ingestion path alongside image/video. — **Reversibility:** costly — Introduces a loader dependency, file validation, and upload UX that later removal would strand.
- **D-16:** The 3D renderer produces both modes, toggleable and sharing mesh/camera: a surface-sampled ASCII point cloud and a depth-buffer raster mapped to ASCII luminance. — **Reversibility:** costly — Two render paths and two parameter sets.
- **D-17:** Camera control is slow auto-rotate by default, with pointer-drag orbit, wheel zoom, and reset. Orbit input is captured inside the 3D layer so it does not fight the existing HUD pan/zoom. — **Reversibility:** reversible — Input routing in the 3D layer.
- **D-18:** Point shading uses a simple key light, rim light for silhouette, and depth-based size/alpha falloff; the depth buffer handles occlusion. No PBR. — **Reversibility:** reversible — Shader math only.
- **D-19:** 3D ASCII may be inserted anywhere in the stack. To keep that coherent, when placed above other passes it composites with the upstream result via its blend mode and intensity rather than silently discarding earlier passes. — **Reversibility:** costly — Defines generator semantics and compositing order across the graph.

### Shader Architecture & Performance
- **D-20:** Effects are defined by a typed `EffectDefinition` registry: id, label, category, typed parameter schema (type/min/max/default/step/unit), `build(input, params)`, pass requirements, and cost weight. The registry is the single source of truth for palette, inspector, defaults, presets, and tests. — **Reversibility:** costly — Replaces the switch-based pipeline and hand-written inspector across the engine and UI.
- **D-21:** The render graph is hybrid: consecutive pointwise effects compile into one fragment chain; effects needing neighborhood or feedback (bloom, phosphor decay, blur) get explicit render-target passes. A planner groups pointwise runs to minimize target allocations. — **Reversibility:** costly — Core graph execution model.
- **D-22:** Rebuild the graph only when topology changes (add/remove/reorder/toggle). Parameter edits update uniforms only. Compiled pipelines are cached by topology hash and replaced materials/targets are disposed. — **Reversibility:** costly — Caching and lifecycle contract across the engine.
- **D-23:** Each effect carries a cost weight; quality tiers get pass/VRAM budgets (shape: High ~8 passes @1080p, Medium ~5 @720p, Low ~3 @480p). Exceeding a budget auto-disables the lowest-priority effects with a visible notice and a manual override. — **Reversibility:** costly — Ties the Phase 1 tier contract to effect eligibility.
- **D-24:** Intermediate render targets live in a `PassPool` keyed by width/height/format, are reused across rebuilds, and are disposed on teardown. `device.lost` / `webglcontextlost` triggers one clean rebuild with status surfaced. — **Reversibility:** costly — Resource lifecycle and device-recovery behavior.

### Shader Verification & Visual Consistency
- **D-25:** Every shader gets Playwright visual snapshots at a fixed canvas size, fixed time/seed, and a fixed input image, with a small pixel-diff tolerance and committed baselines. CI runs the suite on WebGL2/SwiftShader for determinism. — **Reversibility:** costly — Baseline corpus and CI snapshot infrastructure.
- **D-26:** WebGPU vs WebGL2 consistency is verified structurally (same uniforms, output dimensions, no NaN or all-black frames) plus a loose mean-absolute-error threshold; known divergences are documented. Exact pixel equality is not required. — **Reversibility:** reversible — Test thresholds and documentation.
- **D-27:** Time and seed are injected uniforms. No `Date.now()` or `Math.random()` inside shaders; Playwright freezes time through a test hook; noise uses a seeded hash. Snapshots are taken at fixed `t` values. — **Reversibility:** costly — Every time-varying shader must accept the uniforms and remove ambient randomness.
- **D-28:** Color verification uses golden math tests (known RGB triples for 601/709 luminance, gamma round-trip, 0/1 clamping, black/white frames, 1x1 and odd resolutions, extreme aspect ratios) in addition to visual snapshots. — **Reversibility:** reversible — Test-only additions.
- **D-29:** Resolution-scaling tests render each effect at 480p/720p/1080p, compare downscaled structural similarity, and assert size-dependent parameters (cell size, line frequency) scale as designed. — **Reversibility:** reversible — Test-only additions.

### the agent's Discretion
- Exact CRT/VHS profile names and parameter bundles.
- Palette ordering, labels, and icon choices for the stylize/modulate groups.
- Which numeric parameters are exposed to audio modulation (all vs a curated subset).
- GLB/glTF size cap, supported extensions, validation messages, and upload UX.
- Mask-handle interaction details (drag vs resize, snapping, keyboard nudging).
- Exact tier budget numbers and cost weights (the shape is locked; values are planning discretion).
- Whether the luminance-standard toggle lives in the pre-tone panel or a global settings popover.
- Exact snapshot diff tolerance and cross-backend MAE threshold.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap, Requirements & Project
- `.planning/ROADMAP.md` — v2.0 milestone plan and Phase 2 scope (FX-01 through FX-06).
- `.planning/REQUIREMENTS.md` — Requirement definitions and success criteria for FX-01 to FX-06.
- `.planning/PROJECT.md` — Core value, $0/month constraint, UI approval gate, and architecture decisions.

### Prior Phase Context
- `.planning/phases/01-reliability-performance-foundation/01-CONTEXT.md` — D-05 audio singleton contract, D-08 quality tiers and idle scheduling, testing pyramid decisions.

### v2.0 Research
- `.planning/research/ARCHITECTURE.md` — Composable TSL pass pipeline, ping-pong render targets, `AnalyserNode` integration (`fftSize: 256`), engine directory boundaries.
- `.planning/research/FEATURES.md` — Feature landscape, dependencies, and the composable pipeline requirement.
- `.planning/research/PITFALLS.md` — VRAM leaks/device loss (#1), main-thread INP blocking (#5), autoplay policy (#6), integration gotchas.
- `.planning/research/STACK.md` — Three.js 0.187, TSL, Web Audio, React 19, Zustand 5, Vite 8.

### Engine
- `web/src/engine/Pipeline.ts` — Current fixed 4-stage pipeline and one-effect switch; primary refactor target.
- `web/src/engine/Renderer.ts` — WebGPU renderer with WebGL2 fallback; single renderer owner.
- `web/src/engine/TextureAtlas.ts` — Dynamic monospace glyph atlas; reuse for ASCII and 3D point glyphs.
- `web/src/engine/capabilities.ts` — Quality tiers and `TIER_CONFIGS`; extend for pass/VRAM budgets.
- `web/src/engine/shaders/preTone.ts` — Hardcoded Rec. 601 tone math; refactor for 601/709 and linear-light.
- `web/src/engine/shaders/ascii.ts` — Rec. 601 luminance and atlas sampling; refactor for the registry.
- `web/src/engine/shaders/vhs.ts` — Existing VHS overlay; extend for advanced CRT/VHS.
- `web/src/engine/shaders/effects.ts` — Nine generic effects; migrate into typed definitions.

### State & UI
- `web/src/store/useStudioStore.ts` — Zustand store; extend for stack, audio, and 3D state.
- `web/src/types/studio.ts` — `EffectMode`, `EffectParams`, `ToneSettings`, `AsciiSettings`; replace with registry-derived types.
- `web/src/components/layout/LeftRail.tsx` — 16-tile radio group; becomes the effect stack.
- `web/src/components/layout/RightRail.tsx` — Inspector host; stays parameter-focused.
- `web/src/components/layout/CenterStage.tsx` — RAF loop, tier FPS throttle, idle pause, HUD pan/zoom; integrate stack rendering and 3D input.
- `web/src/components/panels/EffectInspector.tsx` — Hand-written per-effect controls; becomes schema-driven.

### Audio & Export
- `web/src/export/audioGraph.ts` — Singleton `AudioContext`, source/gain/stream destination; extend with analyser and mixer bus.
- `web/src/export/videoExport.ts` — Existing audio track multiplexing; reference for track lifecycle.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StudioRenderer`: owns WebGPU initialization and WebGL2 fallback. Reuse as the single renderer rather than instantiating another.
- `TextureAtlas`: already generates the monospace glyph strip used by ASCII; reuse it for 3D point-cloud glyphs.
- `TIER_CONFIGS`: High/Medium/Low max dimensions and target FPS; extend with pass/VRAM budgets instead of inventing a second tier system.
- `getOrCreateAudioGraph()`: singleton `AudioContext`, `MediaElementAudioSourceNode`, gain, and `MediaStreamDestination`; add a mixer gain and `AnalyserNode` here.
- `EffectInspector`'s `SliderRow`: consistent control styling (hairline track, tabular value); reuse inside schema-driven parameter rendering.
- `LeftRail`'s `EFFECT_LIST` and lucide icons: migrate into the registry palette.
- Phase 1 Vitest + Playwright harness: extend with snapshot and shader tests rather than adding a new runner.

### Established Patterns
- Zustand single-store pattern: UI reads state; Three.js objects stay in refs and module-level singletons, never in reactive state.
- TSL-only shader nodes compiled to both WGSL and GLSL. No raw GLSL strings (research integration gotcha).
- `CenterStage` owns the RAF loop, tier-based FPS throttle, and visibility/content-visibility pause; new rendering must hook into this loop.
- `Pipeline` owns uniforms and rebuilds on effect/color-grade changes; this is the pattern being replaced by the registry + graph.
- Effect parameters are currently a flat keyed object (`EffectParams`); the registry replaces it with per-effect typed schemas.
- Accessibility conventions already in place: `aria-label`, `role="radiogroup"`/`radio`, `aria-checked`, `aria-pressed`, keyboard-reachable buttons.

### Integration Points
- `Pipeline.ts`: replace `rebuildPipeline()` with registry-driven graph construction and uniform updates.
- `LeftRail.tsx`: replace the radio grid with the stack list and add-effect palette.
- `RightRail.tsx` / `EffectInspector.tsx`: render controls from the selected stack row's schema.
- `CenterStage.tsx`: sync stack/audio/3D state to the pipeline; add 3D orbit input that does not conflict with HUD pan/zoom.
- `audioGraph.ts`: add mixer gain + analyser; expose band values without React state churn.
- `useStudioStore.ts`: add stack entries, audio settings, modulation assignments, mask state, and 3D settings.
- `capabilities.ts`: add effect cost weights and tier budget evaluation.
- `web/src/tests/` and Playwright specs: add shader snapshots, golden color math, cross-backend and resolution tests.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly added two discussion areas beyond the roadmap: **Shader Architecture & Performance** and **Shader Verification & Visual Consistency**. Both are first-class scope, not afterthoughts.
- The user chose maximum control for RGB separation: full per-channel X/Y offsets, not just a master amount.
- Masks must support both numeric controls and on-canvas handles.
- 3D ASCII must accept uploaded GLB/glTF meshes, not just built-in primitives.
- 3D ASCII must be insertable anywhere in the stack; it composites with upstream output via blend mode/intensity.
- Color defaults preserve Rec. 601 parity for ASCII (`src/renderer.py`) while using Rec. 709 for tone/blending, with a user override.
- The four existing ASCII ramp presets (`standard`, `dense`, `simple`, `blocks`) remain; stack presets are not part of this phase.
- Audio reactivity must reuse the singleton `AudioContext` from `audioGraph.ts`; never create a second context.
- No React re-renders for audio-driven uniforms; values flow through TSL uniforms in the render loop.

</specifics>

<deferred>
## Deferred Ideas

### Future Phases
- **OBJ mesh import** — only GLB/glTF was selected for Phase 2.
- **Stack preset serialization and sharing** — Phase 4 (PERSIST-03 / PERSIST-05).
- **Undo/redo of stack operations** — Phase 3 (WORK-01).
- **Keyframing audio-modulation amounts and 3D camera moves** — Phase 3 (WORK-04).
- **Stack presets / macro chains beyond the four ASCII ramp presets** — future phase.
- **Multi-layer compositing with 3D as a layer** — Phase 3 (WORK-03); Phase 2's 3D generator is single-source with blend compositing, not a full layer system.

</deferred>

---

*Phase: 02-Shader Engine 2.0 & Advanced FX*
*Context gathered: 2026-11-23*
