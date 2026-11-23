# Phase 02: Shader Engine 2.0 & Advanced FX - Research

**Researched:** 2026-11-23  
**Domain:** Three.js TSL Composable Node Shaders, Color Science (Rec. 601/709 & Linear-Light), Analog CRT/VHS Simulation, Web Audio FFT Modulation, and 3D ASCII Point Clouds  
**Confidence:** HIGH  

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Effect Stack Model & UI
- **D-01:** All 16 existing modes become ordered, stackable passes. The palette groups them as **stylize** (ascii, dither, halftone, matrix, pixelSort, blockify, threshold, edgeDetect, crosshatch, waveLines, noise, voronoi, dots, contour, tone) and **modulate** (vhs, rgb split, bloom, vignette, masks, grain). Any order is allowed; there are no exclusive generator slots. — **Reversibility:** costly — Undoing this means redesigning the pipeline, palette, store schema, and every preset around a single-active-effect model again.
- **D-02:** The LeftRail becomes the effect stack. It replaces the 16-tile radio group with an ordered list supporting drag reorder, eye toggle, duplicate, delete, and an `+ add effect` palette. The RightRail remains dedicated to parameters. — **Reversibility:** reversible — Confined to layout components and stack store actions.
- **D-03:** Every stack row exposes independent intensity (mix with the previous output) plus a blend mode: normal, multiply, screen, add. Phase 3 layer blend modes remain a separate system. — **Reversibility:** reversible — Per-row UI and a compositing node; no public contract.
- **D-04:** Clicking a stylize tile still builds a one-pass stack, preserving the current fast path. Multi-pass stacks are built manually from the palette. — **Reversibility:** reversible — A store action that replaces the stylize pass.

#### Color, Masks & Analog Look
- **D-05:** Color-standard defaults are context-correct: Rec. 601 for ASCII/luminance (parity with `src/renderer.py` and text export), Rec. 709 for tone and blending. A single luminance-standard toggle in the pre-tone panel lets users force 601 or 709 everywhere. — **Reversibility:** costly — Changing defaults later alters every rendered image and export comparison baseline.
- **D-06:** Compositing happens in linear light between passes: decode sRGB inputs to linear, run effect mixing/blending in linear light, encode to sRGB once at output. — **Reversibility:** costly — Pervasive graph change and affects export parity; reverting to sRGB blending would re-touch every pass.
- **D-07:** Masks support vignette, box, and circular shapes with numeric controls (center X/Y, size/radius, feather, invert, strength) **and** on-canvas drag/resize handles. Numeric controls are the accessible, testable source of truth; handles write back to them. — **Reversibility:** reversible — Handles are additive UI over numeric state.
- **D-08:** RGB channel separation exposes full per-channel X/Y offsets for R, G, and B, plus master amount and direction angle for quick symmetric setups. — **Reversibility:** reversible — Parameter schema and inspector controls only.
- **D-09:** Advanced CRT/VHS ships named profiles (e.g. VHS SP, worn VHS EP, CRT arcade, broadcast monitor) that set a coherent bundle, plus individual sliders for phosphor decay, beam curvature, tracking jitter, bloom, and scanlines. Profiles are starting points, not locked modes. — **Reversibility:** reversible — Profile data plus existing slider bindings.

#### Audio Reactivity
- **D-10:** Audio sources are microphone (`getUserMedia` audio) and the current media's audio, selectable in a small audio panel. Both route through the existing singleton `AudioContext`; default is off with no permission prompt until the user enables it. — **Reversibility:** costly — Adds permission, lifecycle, and source-switching contracts to the shared audio graph.
- **D-11:** Modulation is a hybrid: three global bass/mid/treble macros with sensitivity and smoothing for instant results, plus per-effect modulation rows (target parameter, band, amount) for depth. — **Reversibility:** costly — Store schema, inspector UI, and serialization shape all depend on it.
- **D-12:** One analyser bus: a single `AnalyserNode` on a mixer gain inside the singleton context, `fftSize: 256`, typed arrays allocated once, band values pushed directly to TSL uniforms in the render loop with zero React re-renders. — **Reversibility:** costly — Audio graph architecture and render-loop contract.
- **D-13:** Audio activation is explicit: an `enable audio` control and a status chip (off / waiting for click / live / denied / unavailable). `AudioContext.resume()` runs on that click; the mic never auto-starts. — **Reversibility:** reversible — UI state and a resume call.
- **D-14:** Response shaping uses per-band attack/release with fast attack (~20ms) and slower release (~200ms) defaults, a master sensitivity slider, and an advanced row for per-band tuning. — **Reversibility:** reversible — Smoothing parameters only.

#### 3D ASCII
- **D-15:** Mesh sources are built-in primitives (torus knot, sphere, cube, plane) plus procedural displacement, **and** user-uploaded GLB/glTF meshes. Upload adds a loader, validation, and a second ingestion path alongside image/video. — **Reversibility:** costly — Introduces a loader dependency, file validation, and upload UX that later removal would strand.
- **D-16:** The 3D renderer produces both modes, toggleable and sharing mesh/camera: a surface-sampled ASCII point cloud and a depth-buffer raster mapped to ASCII luminance. — **Reversibility:** costly — Two render paths and two parameter sets.
- **D-17:** Camera control is slow auto-rotate by default, with pointer-drag orbit, wheel zoom, and reset. Orbit input is captured inside the 3D layer so it does not fight the existing HUD pan/zoom. — **Reversibility:** reversible — Input routing in the 3D layer.
- **D-18:** Point shading uses a simple key light, rim light for silhouette, and depth-based size/alpha falloff; the depth buffer handles occlusion. No PBR. — **Reversibility:** reversible — Shader math only.
- **D-19:** 3D ASCII may be inserted anywhere in the stack. To keep that coherent, when placed above other passes it composites with the upstream result via its blend mode and intensity rather than silently discarding earlier passes. — **Reversibility:** costly — Defines generator semantics and compositing order across the graph.

#### Shader Architecture & Performance
- **D-20:** Effects are defined by a typed `EffectDefinition` registry: id, label, category, typed parameter schema (type/min/max/default/step/unit), `build(input, params)`, pass requirements, and cost weight. The registry is the single source of truth for palette, inspector, defaults, presets, and tests. — **Reversibility:** costly — Replaces the switch-based pipeline and hand-written inspector across the engine and UI.
- **D-21:** The render graph is hybrid: consecutive pointwise effects compile into one fragment chain; effects needing neighborhood or feedback (bloom, phosphor decay, blur) get explicit render-target passes. A planner groups pointwise runs to minimize target allocations. — **Reversibility:** costly — Core graph execution model.
- **D-22:** Rebuild the graph only when topology changes (add/remove/reorder/toggle). Parameter edits update uniforms only. Compiled pipelines are cached by topology hash and replaced materials/targets are disposed. — **Reversibility:** costly — Caching and lifecycle contract across the engine.
- **D-23:** Each effect carries a cost weight; quality tiers get pass/VRAM budgets (shape: High ~8 passes @1080p, Medium ~5 @720p, Low ~3 @480p). Exceeding a budget auto-disables the lowest-priority effects with a visible notice and a manual override. — **Reversibility:** costly — Ties the Phase 1 tier contract to effect eligibility.
- **D-24:** Intermediate render targets live in a `PassPool` keyed by width/height/format, are reused across rebuilds, and are disposed on teardown. `device.lost` / `webglcontextlost` triggers one clean rebuild with status surfaced. — **Reversibility:** costly — Resource lifecycle and device-recovery behavior.

#### Shader Verification & Visual Consistency
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

### Deferred Ideas (OUT OF SCOPE)
- **OBJ mesh import** — only GLB/glTF was selected for Phase 2.
- **Stack preset serialization and sharing** — Phase 4 (PERSIST-03 / PERSIST-05).
- **Undo/redo of stack operations** — Phase 3 (WORK-01).
- **Keyframing audio-modulation amounts and 3D camera moves** — Phase 3 (WORK-04).
- **Stack presets / macro chains beyond the four ASCII ramp presets** — future phase.
- **Multi-layer compositing with 3D as a layer** — Phase 3 (WORK-03); Phase 2's 3D generator is single-source with blend compositing, not a full layer system.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FX-01** | User can stack, reorder, toggle, and adjust multiple post-processing effects in a composable node pipeline without fixed-stage restrictions. | Investigated typed `EffectDefinition` registry, hybrid pointwise-fusion node compilation, `PassPool` intermediate render targets, and topology-only graph invalidation. |
| **FX-02** | User sees color conversions and ASCII luminance mapping rendered using standard Rec. 601 / Rec. 709 weighting with gamma-accurate blending to prevent washed-out shadows or clipped highlights. | Investigated Rec. 601 vs Rec. 709 exact weights, linear-light compositing pipeline (sRGB decode -> linear mix -> sRGB encode), and golden math test vectors. |
| **FX-03** | User can apply RGB channel separation (chromatic aberration) and configurable spatial vignette/box masks to any media source. | Researched full per-channel (R, G, B) X/Y offset sampling, procedural vignette/box/circular distance-field masks, and Modern Web Guidance `drag` on-canvas handles. |
| **FX-04** | User can apply advanced analog CRT and VHS emulation featuring phosphor decay, beam curvature, scanline jitter, and bloom. | Researched ping-pong temporal decay feedback, non-linear barrel distortion, scanlines, analog tracking noise, and multi-pass bloom extraction. |
| **FX-05** | User can enable audio-reactive modulation where microphone input or video audio frequency bands (bass, mid, treble) dynamically drive shader parameters in real time. | Investigated singleton `AudioContext` reuse, mixer gain bus, `AnalyserNode` (`fftSize: 256`), attack/release envelope filter (20ms/200ms), and zero-React-churn uniform mutations. |
| **FX-06** | User can render 3D geometry and mesh surfaces into real-time ASCII point clouds and rasterized depth representations. | Investigated built-in primitives + `GLTFLoader` with file validation, dual-mode point cloud with `TextureAtlas` glyph sampling & depth rasterization, key/rim lighting, and camera orbit controls. |
</phase_requirements>

## Summary

Phase 02 transforms dithr from a single-effect 4-stage fixed pipeline into a professional, modular shader engine (Shader Engine 2.0). It replaces hardcoded switch statements in `web/src/engine/Pipeline.ts` with a typed `EffectDefinition` registry and a hybrid execution graph. Consecutive pointwise operations (e.g. tone, dither, invert, color grade) are fused into single fragment shader chains, while neighborhood and temporal feedback operations (bloom, phosphor decay, 3D point cloud generation) allocate intermediate render targets from a pooled `PassPool`. This preserves rock-solid 60 FPS performance while allowing users to stack, reorder, duplicate, toggle, and blend any arbitrary chain of retro visual effects.

Color science and luminance accuracy are unified across the Python and web runtimes. Perceived luminance defaults strictly to ITU-R BT.601 (`0.299*R + 0.587*G + 0.114*B`) for ASCII character selection, maintaining mathematical parity with `src/renderer.py`, while tone curves and compositing default to ITU-R BT.709 (`0.2126*R + 0.7152*G + 0.0722*B`) in linear space. All inter-pass mixing occurs in linear light after decoding sRGB input, with an sRGB transfer function applied once at final display output. Spatial controls (RGB channel split and vignette/box masks) gain accessible numeric controls synchronized with on-canvas pointer handles implemented under Google Chrome Modern Web Guidance standards.

Audio reactivity connects the existing singleton `AudioContext` from `audioGraph.ts` to a single `AnalyserNode` (`fftSize: 256`) via a mixer gain, extracting smoothed bass, mid, and treble frequency energies through an asymmetrical attack/release envelope filter (~20ms attack / ~200ms release). Frequency bands modulate TSL uniform values directly within the RAF loop with zero React state updates. Finally, a 3D generator renders built-in geometry and user-uploaded GLB models as either surface-sampled ASCII point clouds or depth-buffer rasters, compositing seamlessly into any position within the user's effect stack.

**Primary recommendation:** Build a typed `EffectDefinition` registry as the single source of truth for both shader TSL nodes and UI inspector schemas, compile pointwise runs into unified TSL fragment nodes, pool render targets for feedback passes in `PassPool`, and drive audio modulation by directly mutating TSL `UniformNode.value` in the animation frame loop.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| **Effect Stack Compilation & Render Loop** | Engine (`web/src/engine/`) | Store (`web/src/store/`) | Three.js TSL node compilation, render target allocation, and WebGPU/WebGL2 execution must run outside React lifecycle. Store only owns stack descriptors. |
| **Stack UI & Reorder Interaction** | UI (`web/src/components/layout/LeftRail.tsx`) | Store (`web/src/store/`) | LeftRail renders effect rows, drag handles, duplicate/delete buttons; communicates stack mutations via Zustand actions. |
| **Inspector Controls & Schema Mapping** | UI (`web/src/components/panels/EffectInspector.tsx`) | Engine Registry (`web/src/engine/registry/`) | Inspector dynamically generates slider/toggle rows based on the selected effect's typed parameter schema. |
| **Linear Light & Color Pipeline** | Engine (`web/src/engine/shaders/`) | Engine (`src/renderer.py`) | sRGB decode/encode and Rec. 601 / 709 luminance math must be calculated GPU-side in TSL for real-time rendering, matching Python test parity. |
| **Mask Canvas Handles** | UI (`web/src/components/canvas/`) | Engine (`web/src/engine/`) | Pointer capture handles run in the DOM canvas overlay per Modern Web Guidance; coordinates write back to store parameters. |
| **Audio FFT & Modulation** | Export/Audio (`web/src/export/audioGraph.ts`) | Engine (`web/src/engine/Pipeline.ts`) | Singleton `AudioContext` and `AnalyserNode` live in the audio subsystem; raw float uniforms are pushed directly into `Pipeline` uniforms in RAF loop. |
| **3D Mesh Loading & Validation** | Services / Ingestion (`web/src/services/meshLoader.ts`) | Engine (`web/src/engine/3d/`) | File validation, magic byte checks, and `GLTFLoader` execute before instantiating Three.js scene meshes and point cloud materials. |
| **Quality Tier Budgeting** | Engine (`web/src/engine/capabilities.ts`) | UI / Notifications | Calculates active stack cost weights against GPU capabilities; triggers auto-disable warnings when limits are exceeded. |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **three** [VERIFIED: npm registry] | `^0.187.0` | GPU rendering, TSL node shaders, WebGPU/WebGL2 pipeline, `GLTFLoader`, `OrbitControls` | Official foundation of dithr. `three/tsl` and `three/webgpu` provide backend-agnostic node compilation into WGSL and GLSL. Includes `three/addons/loaders/GLTFLoader.js` and `three/addons/controls/OrbitControls.js`. Verified installed at `0.187.0`. |
| **Web Audio API** [VERIFIED: web platform standard] | Native | Real-time audio analysis, FFT spectrum extraction, microphone ingestion | Built into modern web platform. `AnalyserNode` with `fftSize: 256` gives fast, zero-dependency frequency domain data without third-party bundle bloat. |
| **zustand** [VERIFIED: npm registry] | `^5.1.0` | Client state management for effect stack, audio settings, and 3D state | Lightweight, un-opinionated reactive store. Supports selective subscriptions, shallow diffing, and zero-overhead actions outside React render cycles. |
| **react** / **react-dom** [VERIFIED: npm registry] | `^19.3.1` | UI presentation layer | Host application framework for LeftRail stack, EffectInspector, and CenterStage HUD. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **lucide-react** [VERIFIED: npm registry] | `^1.74.0` | Icons for effect stack, palette categories, audio chips, and drag handles | UI iconography in LeftRail, RightRail inspector, and audio status indicator. |
| **vitest** [VERIFIED: npm registry] | `^5.1.1` | Unit testing color math, audio envelope shaping, and pipeline topology | Fast, native ESM unit test runner configured in `web/vitest.config.ts`. Verified passing 11/11 tests. |
| **@playwright/test** [VERIFIED: npm registry] | `^1.65.1` | Visual regression snapshots and cross-backend validation | Headless browser testing with `--use-angle=swiftshader` and `--enable-unsafe-webgpu`. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **Native Web Audio `AnalyserNode`** | Tone.js / Meyda | Tone.js adds >150KB bundle weight and complex graph abstractions. Native `AnalyserNode` with `fftSize: 256` gives immediate access to raw `Uint8Array` bins with 0 bundle overhead. |
| **Three.js `GLTFLoader` (built-in)** | `@loaders.gl/gltf` | Loaders.gl adds external dependencies and bundle complexity. `three/addons/loaders/GLTFLoader.js` is already bundled inside `three@0.187.0` and directly produces Three.js `BufferGeometry` and `Group` nodes. |
| **Native Pointer Events Drag** | `@dnd-kit/core` / `react-beautiful-dnd` | External drag libraries add 20–40KB and frequently struggle with React 19 concurrent features. Modern Web Guidance native single-axis drag-and-drop provides pointer capture, layout midpoints, and keyboard accessibility in <100 lines. |

**Installation:**
No new npm dependencies required! All core rendering (`three`), icons (`lucide-react`), state (`zustand`), and testing (`vitest`, `@playwright/test`) are already installed in `web/package.json`.

---

## Package Legitimacy Audit

Verified against npm registry using the GSD package legitimacy seam (`gsd-tools query package-legitimacy check`):

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `three` | npm | 14 yrs | 38.0M/wk | [github.com/mrdoob/three.js](https://github.com/mrdoob/three.js) | [OK] | Approved (Primary 3D & TSL engine) |
| `zustand` | npm | 6 yrs | 7.8M/wk | [github.com/pmndrs/zustand](https://github.com/pmndrs/zustand) | [OK] | Approved (State store) |
| `lucide-react` | npm | 4 yrs | 4.1M/wk | [github.com/lucide-icons/lucide](https://github.com/lucide-icons/lucide) | [OK] | Approved (UI icons) |
| `vitest` | npm | 3 yrs | 9.2M/wk | [github.com/vitest-dev/vitest](https://github.com/vitest-dev/vitest) | [OK] | Approved (Unit test harness) |
| `@playwright/test` | npm | 5 yrs | 8.9M/wk | [github.com/microsoft/playwright](https://github.com/microsoft/playwright) | [OK] | Approved (E2E snapshot harness) |

**Packages removed due to [SLOP] verdict:** None.  
**Packages flagged as suspicious [SUS]:** None. All required packages are industry-standard, high-download, verified packages.

---

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TD
    subgraph UI_Layer ["Client UI Layer (React 19)"]
        LR["LeftRail: Effect Stack (Drag Reorder, Toggle, Add)"]
        RR["RightRail: EffectInspector (Schema-Driven Sliders)"]
        AP["Audio Panel: Source (Media/Mic) & Enable Button"]
        CH["Canvas Overlay: On-Canvas Mask & 3D Orbit Handles"]
    end

    subgraph Store_Layer ["State Layer (Zustand)"]
        SS["StudioStore: stack[], audioState, maskState, 3dState"]
    end

    subgraph Audio_Subsystem ["Web Audio Subsystem"]
        AC["Singleton AudioContext (sharedAudioCtx)"]
        SRC_MEDIA["MediaElementAudioSourceNode"]
        SRC_MIC["MediaStreamAudioSourceNode (getUserMedia)"]
        MG["Mixer Gain Node"]
        AN["AnalyserNode (fftSize: 256, Uint8Array)"]
        ENV["Attack/Release Filter (~20ms / ~200ms)"]
    end

    subgraph Engine_Layer ["Shader Engine 2.0 (Three.js WebGPU / TSL)"]
        REG["EffectDefinition Registry (Schemas, Cost, TSL Builders)"]
        COMP["Pass Compiler / Graph Planner"]
        PP["PassPool (Keyed RenderTargets: w/h/format)"]
        
        subgraph Pipeline_Execution ["Pipeline Render Loop (60 FPS RAF)"]
            DEC["Stage 0: sRGB Decode -> Linear Light"]
            PW1["Fused Fragment Pass 1: Pointwise Chain (Tone + Dither)"]
            RT1["Intermediate RenderTarget 1 (PassPool)"]
            NB1["Neighborhood Pass: Bloom / Phosphor Decay"]
            RT2["Intermediate RenderTarget 2 (PassPool)"]
            PW2["Fused Fragment Pass 2: Masks + RGB Split"]
            ENC["Stage Final: Linear -> sRGB Encode & Dither"]
            CANVAS["Canvas Display Quad"]
        end
    end

    LR -->|Topology Change (Add/Reorder/Delete)| SS
    RR -->|Parameter Edits (Uniform Value Only)| SS
    AP -->|User Gesture: resume() & Opt-in| AC
    CH -->|Pointer Move| SS

    SS -->|Topology Hash Drift| COMP
    SS -.->|Direct Uniform Value Sync| Pipeline_Execution

    COMP -->|Lookup Pass Reqs & Fuse Pointwise| REG
    COMP -->|Acquire/Release Targets| PP
    COMP -->|Compile Material Pipelines| Pipeline_Execution

    SRC_MEDIA --> MG
    SRC_MIC --> MG
    MG --> AN
    AN --> ENV
    ENV -->|Direct Uniform Push (No React Churn)| Pipeline_Execution

    DEC --> PW1 --> RT1 --> NB1 --> RT2 --> PW2 --> ENC --> CANVAS
```

### Recommended Project Structure
```
web/src/
├── engine/
│   ├── 3d/                     # 3D ASCII generation & camera controls
│   │   ├── AsciiPointCloud.ts  # Surface-sampled ASCII PointsNodeMaterial
│   │   ├── DepthRaster.ts      # Offscreen depth-buffer to ASCII shader
│   │   ├── PrimitiveFactory.ts # Torus knot, sphere, cube, plane generators
│   │   └── OrbitController.ts  # Isolated pointer drag orbit & wheel zoom
│   ├── color/                  # Color science & transfer standards
│   │   ├── colorSpace.ts       # Exact sRGB <-> Linear piecewise math
│   │   └── luminance.ts        # Rec. 601 and Rec. 709 TSL luminance functions
│   ├── registry/               # Typed EffectDefinition single source of truth
│   │   ├── index.ts            # Registry catalog, lookup, and category groupings
│   │   ├── types.ts            # EffectDefinition, ParameterSchema, BlendMode types
│   │   ├── stylize/            # ascii, dither, halftone, matrix, pixelSort, etc.
│   │   └── modulate/           # crtVhs, rgbSplit, masks, bloom, phosphorDecay
│   ├── graph/                  # Hybrid pass compiler & target pool
│   │   ├── PassPool.ts         # Width/height/format keyed RenderTarget cache
│   │   ├── GraphCompiler.ts    # Pointwise run fusion & topology hashing
│   │   └── TierBudget.ts       # Cost weight evaluation & budget enforcement
│   ├── Pipeline.ts             # Composable multi-pass shader pipeline
│   ├── Renderer.ts             # WebGPURenderer with WebGL2 fallback
│   ├── TextureAtlas.ts         # Shared monospace ASCII glyph atlas
│   └── capabilities.ts         # GPU capabilities & tier budgets
├── export/
│   └── audioGraph.ts           # Singleton AudioContext, AnalyserNode, and envelope
├── services/
│   └── meshLoader.ts           # GLB/glTF loader, file validation, and bound sanitization
├── store/
│   └── useStudioStore.ts       # Zustand store with stack, audio, and 3D slices
└── components/
    ├── canvas/
    │   ├── CenterStage.tsx     # RAF render loop and direct uniform updates
    │   └── MaskHandles.tsx     # On-canvas accessible pointer drag handles
    ├── layout/
    │   ├── LeftRail.tsx        # Stack view, drag reorder, and add palette
    │   └── RightRail.tsx       # Inspector host
    └── panels/
        ├── EffectInspector.tsx # Schema-driven dynamic parameter sliders
        ├── AudioPanel.tsx      # Audio activation, source select, and status chip
        └── ThreeDPanel.tsx     # 3D mesh source, primitives, and camera reset
```

---

### Pattern 1: Composable Hybrid TSL Node Graph & Pointwise Fusion
**What:** Rather than allocating a heavy offscreen `RenderTarget` for every single effect in the stack, the graph compiler inspects the `EffectDefinition.requiresPass` flag. Consecutive pointwise effects (such as tone adjustment, dither, threshold, tone grade) are composed into a single TSL `Fn` fragment shader. Intermediate render targets from `PassPool` are allocated only when an effect requires spatial neighborhood sampling (bloom, blur) or temporal feedback (phosphor decay).  
**When to use:** Whenever the effect stack topology changes (D-21).  
**Benefit:** Compiles 5 stacked stylize/modulate effects into 1 or 2 GPU passes instead of 5, sustaining 60 FPS at 1080p and staying well within GPU memory budgets.

### Pattern 2: Typed EffectDefinition Registry & Dynamic Schema Inspector
**What:** Single source of truth defining effect metadata, cost weight, whether an intermediate pass is required, parameter schemas with min/max/default/step, audio-modulatable tags, and the TSL node builder function.  
**When to use:** In `web/src/engine/registry/` to replace the rigid 4-stage switch in `Pipeline.ts` and hand-coded slider lists in `EffectInspector.tsx`.  
**Benefit:** Adding a new effect requires creating exactly one definition file; LeftRail palette, RightRail inspector, default presets, serialization, and test suites automatically reflect the new effect with zero UI boilerplate.

### Pattern 3: Dual-Mode 3D ASCII Generator (Point Cloud & Depth Raster)
**What:** A 3D generator pass (D-15, D-16) that renders 3D geometry into either:
1. *ASCII Point Cloud*: Surface-sampled vertices rendered using `PointsNodeMaterial`, sampling glyphs from `TextureAtlas` modulated by key/rim lighting.
2. *Depth-Buffer Raster*: 3D scene rasterized into an offscreen depth buffer, where linearized depth $Z_{\text{linear}}$ maps to ASCII luminance.  
**When to use:** When the 3D generator is enabled in the stack. Can be placed at any position; when placed above 2D media passes, it composites via linear blend modes (D-19).

### Pattern 4: Zero-Churn Web Audio Reactivity Loop
**What:** An audio-reactive loop that avoids triggering React re-renders. A single `AnalyserNode` (`fftSize: 256`) updates a pre-allocated `Uint8Array(128)` once per frame. Values are smoothed via an asymmetric attack (~20ms) and release (~200ms) exponential filter, scaled by sensitivity, and written directly into TSL `UniformNode.value` inside `CenterStage.tsx`'s RAF loop.  
**When to use:** For real-time audio modulation of shader parameters (D-11, D-12, D-14).  
**Benefit:** 60 FPS continuous modulation with zero React component re-renders, zero garbage collector thrashing, and zero INP lag.

### Pattern 5: Linear-Light Compositing & Dual Rec. 601 / Rec. 709 Standards
**What:** Input sRGB textures are decoded to linear light before effect processing. All inter-pass mixing, additions, and blending execute in linear light. Rec. 601 weights (`0.299*R + 0.587*G + 0.114*B`) are strictly used for ASCII character quantization to preserve parity with Python backend text exports, while Rec. 709 weights (`0.2126*R + 0.7152*G + 0.0722*B`) are used for tone grading and blending. A single sRGB encode transfer function is evaluated at canvas output.  
**When to use:** Across the entire shader graph (D-05, D-06).  
**Benefit:** Eliminates dark haloing, washed-out shadows, and hue shifts during multi-effect blending.

### Anti-Patterns to Avoid
- **Recompiling TSL Node Graphs on Slider Changes:** TSL graph compilation triggers WGSL/GLSL shader compilation and pipeline layout recreation, which causes 50–200ms frame drops. Rebuild the graph ONLY when topology changes (add/remove/reorder/toggle). Parameter slider tweaks must exclusively mutate existing `UniformNode.value`.
- **Allocating New RenderTargets Every Frame:** Creating new `new THREE.RenderTarget()` during render loops causes catastrophic VRAM leaks and crashes the browser GPU process (`webglcontextlost`). All intermediate targets must be fetched from and returned to a reusable `PassPool`.
- **Dispatching React State from the Audio Analyser:** Calling `setAudioBands({ bass, mid, treble })` in `requestAnimationFrame` forces React to re-render the entire component tree at 60 FPS, destroying INP performance. Audio values must flow directly to TSL uniforms.
- **Raw `Math.random()` or `Date.now()` inside Shaders:** Breaks Playwright visual snapshot determinism and automated testing (D-27). Shaders must accept injected `time` and `seed` uniforms.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| **3D Camera Orbit & Pan** | Custom mouse/pointer raycasting and quaternion math | `three/addons/controls/OrbitControls.js` or standard orbit spherical coordinate math | Edge cases: gimbal lock, trackpad pinch-zoom sensitivity, inertia damping, touch gestures, HUD event isolation. |
| **GLB / glTF Parsing** | Custom binary parser for glTF JSON chunks and binary buffers | `three/addons/loaders/GLTFLoader.js` (bundled in `three`) | GLB files have complex chunk hierarchies, sparse accessors, Drac compression, and buffer views. Hand-rolling risks binary corruption and security exploits. |
| **Audio FFT Analysis** | Custom Fast Fourier Transform in JavaScript / WASM | Native Web Audio `AnalyserNode` (`fftSize: 256`) | Browser native implementation runs in high-priority audio threads with SIMD hardware acceleration and zero JS overhead. |
| **Color Space Transforms** | Ad-hoc pow(rgb, 2.2) approximations | Exact piecewise sRGB transfer function and ITU-R Rec. 601/709 matrix math | Simple power-of-2.2 curves crush deep shadows (<0.04045) and produce visible color banding in dark retro scenes. |
| **List Reorder State** | Custom splice/copy loops | ES2024 `.toSpliced()` and `.with()` per Modern Web Guidance | Non-mutating built-in primitives guarantee immutability in Zustand stores without prototype pollution or shallow copy bugs. |

---

## Common Pitfalls

### Pitfall 1: WebGL2/WebGPU Ping-Pong Target Leaks & VRAM Exhaustion
**What goes wrong:** Adding, deleting, or reordering post-processing passes creates new Three.js render targets without releasing old ones. Eventually GPU VRAM is exhausted, triggering `device.lost` or `webglcontextlost`, turning the canvas black.  
**Why it happens:** WebGPU and WebGL textures are unmanaged GPU resources; JavaScript garbage collection does not free GPU textures automatically.  
**How to avoid:** Implement `PassPool` keyed by `width:height:format`. On graph rebuild, return unused targets to the pool; call `.dispose()` on all pooled targets when tearing down or when resolution shrinks. Wire `device.lost` and `webglcontextlost` listeners to re-initialize the pipeline cleanly.  
**Warning signs:** Chrome Task Manager shows "GPU Process" memory steadily increasing beyond 1GB when adjusting effect stacks.

### Pitfall 2: Browser Autoplay Policy & AudioContext Suspension
**What goes wrong:** Audio reactivity fails silently on page load, frequency bands remain at 0.0, and console logs report: `The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page`.  
**Why it happens:** Modern browsers prohibit audio graph execution and microphone streaming until an explicit user interaction (click or tap) occurs.  
**How to avoid:** Audio reactivity must remain disabled by default (D-10, D-13). When the user clicks the explicit "Enable Audio" button in the UI, call `await audioContext.resume()`. Display status chips (`off`, `waiting`, `live`, `denied`).

### Pitfall 3: Malformed GLB Uploads & Memory Denial of Service
**What goes wrong:** A user uploads a 500MB malformed GLB model containing millions of polygons, freezing the browser tab or causing out-of-memory crashes.  
**Why it happens:** Client-side 3D loaders will attempt to parse and allocate whatever buffer data is supplied without upfront verification.  
**How to avoid:** Enforce strict file size limits (<50MB). Check magic header bytes `0x46546C67` (`glTF`) before passing to `GLTFLoader`. Wrap loading in `AbortSignal.timeout(10000)` per Modern Web Guidance. Normalize geometry bounds to a unit bounding box (`[-1.5, 1.5]`) and center at origin.

### Pitfall 4: 3D Orbit Controls Conflicting with Studio Viewport HUD Pan/Zoom
**What goes wrong:** Dragging to rotate the 3D model also pans the 2D stage canvas, causing erratic movement and fighting between 3D camera and 2D HUD.  
**Why it happens:** Event listeners on the canvas bubble up to the parent `CenterStage` pan/zoom handler.  
**How to avoid:** Isolate 3D pointer events. When 3D mode is active and pointer is over the 3D object/canvas handle, call `event.stopPropagation()` on pointer events so the HUD pan handler is bypassed (D-17).

### Pitfall 5: Shader Stutter from Uniform Recompilation
**What goes wrong:** Dragging a slider (e.g. scanline frequency or brightness) causes visible stutter and frame drops.  
**Why it happens:** The application was calling `rebuildPipeline()` inside slider `onChange` handlers instead of mutating existing TSL `UniformNode.value`.  
**How to avoid:** Separate topology changes from parameter changes. `rebuildPipeline()` is called ONLY when passes are added, removed, reordered, or toggled. Slider changes update `uniform.value = newValue` directly.

---

## Modern Web Guidance Applied

The following standardized web platform patterns from Google Chrome Modern Web Guidance (`https://github.com/GoogleChrome/modern-web-guidance`) are integrated into Phase 02:

### `drag-and-drop` (LeftRail Effect Stack Reordering)
- **DOM Alignment:** Reorders real DOM children in `LeftRail` (not via CSS `order`), maintaining visual, focus, and reading order alignment.
- **Dedicated Handle:** Reordering begins only from a dedicated drag handle with `cursor: grab`/`grabbing`, `touch-action: none`, and `-webkit-user-select: none; user-select: none`.
- **Pointer Capture:** Uses `handle.setPointerCapture(event.pointerId)` on `pointerdown` to track movement outside the element; ignores extraneous secondary touch pointers.
- **Layout Midpoints:** Destination drop slot is calculated from layout midpoints (`offsetTop + offsetHeight / 2`) rather than volatile `document.elementFromPoint()`.
- **Keyboard Reordering:** Full grab-move-drop mode (`Space` to grab, `ArrowUp`/`ArrowDown` to move along vertical axis, `Space` to drop, `Escape` to cancel) with `aria-pressed` toggling on the handle.
- **Polite Live Announcements:** Live updates announced via a debounced (`~500ms`) `<div aria-live="polite">` region so screen readers announce slot changes without interrupting focus.
- **Reduced Motion:** Bypasses FLIP transition animations when `prefers-reduced-motion: reduce` is detected.

### `drag` (Spatial Mask On-Canvas Handles)
- **Dedicated Canvas Handles:** Mask center and radius controls feature dedicated on-canvas button handles with `role="button"` and accessible names (`aria-label="Mask center handle. Use arrow keys to adjust."`).
- **Bounded Clamping:** Pointer coordinates are clamped to normalized canvas space `[0.0, 1.0]` with pointer capture on `pointerdown`.
- **Keyboard Nudging:** Supports arrow key navigation with `preventDefault()` (15px / 0.01 step) for fine-grained mask positioning without dragging.

### `dialog` (Native `<dialog>` for 3D Mesh Upload & Errors)
- **Native Semantic Element:** Uses `<dialog>` opened via `.showModal()`, eliminating hand-rolled focus traps and manual `aria-modal` attributes.
- **Scroll Containment:** Enforces scroll isolation using Modern Web Guidance CSS:
  ```css
  dialog:modal { overscroll-behavior: contain; }
  dialog::backdrop { overflow: hidden; overscroll-behavior: contain; }
  ```
- **Light Dismiss:** Implements `closedby="any"` with fallback pointer listeners checking bounds to dismiss when clicking the backdrop.
- **Autofocus Safe Action:** Places `autofocus` on the safe action (Cancel) to prevent accidental destructive dismissals.

### `js` (Asynchronous Coordination & Immutable Operations)
- **Declarative Timeouts:** Uses `AbortSignal.timeout(10_000)` and `AbortSignal.any()` when loading external GLB models and binary assets.
- **Structured Error Chaining:** Re-throws wrapped asset loading errors using `new Error(message, { cause: err })` to preserve underlying stack traces without polluting public error messages.
- **Deep State Cloning:** Uses native `structuredClone()` for snapshotting pipeline configurations.
- **Non-Mutating Array Operations:** Uses ES2024 `.toSpliced()` and `.with()` for immutable stack reordering in Zustand.
- **Collection Grouping:** Uses `Object.groupBy(effects, e => e.category)` to partition registry items into `stylize` and `modulate` palette groups.

### `security` (Client-Side Asset Validation)
- **glTF/GLB Validation:** Strictly validates file size (<50MB) and checks magic header bytes `0x46546C67` before passing buffers to `GLTFLoader`.
- **Sanitization:** Strips unsupported script extensions from uploaded 3D scenes to prevent XSS.

---

## Code Examples

### 1. Composable TSL Pass Pipeline with Pointwise Fusion (D-01, D-20, D-21)
```typescript
import * as THREE from 'three/webgpu';
import { Fn, uniform, vec4 } from 'three/tsl';
import type { EffectDefinition, ActiveEffectPass } from './registry/types';

/**
 * Compiles an ordered stack of active effect passes into a hybrid TSL execution graph.
 * Fuses consecutive pointwise operations into a single fragment node.
 */
export function compileEffectGraph(
  sourceTextureNode: any,
  activeStack: ActiveEffectPass[],
  registry: Map<string, EffectDefinition>
): any {
  let currentInput = sourceTextureNode;

  for (const passConfig of activeStack) {
    if (!passConfig.enabled) continue;

    const def = registry.get(passConfig.effectId);
    if (!def) continue;

    // Build the TSL shader node for this effect
    const effectOutputNode = def.buildNode(currentInput, passConfig.uniforms);

    // Apply per-row blend mode and intensity in Linear Light (D-03, D-06)
    const blendedNode = Fn(() => {
      const upstream = currentInput;
      const effectCol = effectOutputNode;
      const intensity = passConfig.uniforms.intensity;

      let resultRgb = effectCol.rgb;

      if (passConfig.blendMode === 'multiply') {
        resultRgb = upstream.rgb.mul(effectCol.rgb);
      } else if (passConfig.blendMode === 'screen') {
        resultRgb = vec4(1.0).sub(vec4(1.0).sub(upstream.rgb).mul(vec4(1.0).sub(effectCol.rgb))).rgb;
      } else if (passConfig.blendMode === 'add') {
        resultRgb = upstream.rgb.add(effectCol.rgb).min(1.0);
      }

      // Linear mix with upstream based on row intensity
      return vec4(upstream.rgb.mix(resultRgb, intensity), upstream.a);
    })();

    currentInput = blendedNode;
  }

  return currentInput;
}
```

### 2. Audio-Reactive Envelope Shaping & Direct Uniform Push (D-12, D-14)
```typescript
/**
 * Audio reactivity filter with asymmetric attack and release envelope.
 * Pushes smoothed bass, mid, and treble values directly to TSL Uniforms without React churn.
 */
export class AudioReactivityEngine {
  private freqData = new Uint8Array(128); // fftSize: 256 -> 128 bins
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedTreble = 0;

  public update(
    analyser: AnalyserNode,
    deltaMs: number,
    sensitivity: number,
    uniforms: { bass: any; mid: any; treble: any }
  ): void {
    analyser.getByteFrequencyData(this.freqData);

    // Band bin extraction: ~187.5Hz per bin at 48kHz
    // Bass: bins 0-2 (0-375Hz)
    let rawBass = (this.freqData[0] + this.freqData[1] + this.freqData[2]) / (3 * 255);
    // Mid: bins 3-14 (560Hz-2.6kHz)
    let sumMid = 0;
    for (let i = 3; i <= 14; i++) sumMid += this.freqData[i];
    let rawMid = sumMid / (12 * 255);
    // Treble: bins 15-63 (2.8kHz-11.8kHz)
    let sumTreble = 0;
    for (let i = 15; i <= 63; i++) sumTreble += this.freqData[i];
    let rawTreble = sumTreble / (49 * 255);

    // Asymmetric Attack/Release (D-14): Attack ~20ms, Release ~200ms
    const attackCoeff = 1.0 - Math.exp(-deltaMs / 20.0);
    const releaseCoeff = 1.0 - Math.exp(-deltaMs / 200.0);

    const smooth = (current: number, target: number) => {
      const coeff = target > current ? attackCoeff : releaseCoeff;
      return current + (target - current) * coeff;
    };

    this.smoothedBass = smooth(this.smoothedBass, rawBass);
    this.smoothedMid = smooth(this.smoothedMid, rawMid);
    this.smoothedTreble = smooth(this.smoothedTreble, rawTreble);

    // Push directly to TSL uniforms (zero React re-renders)
    uniforms.bass.value = Math.min(1.0, this.smoothedBass * sensitivity);
    uniforms.mid.value = Math.min(1.0, this.smoothedMid * sensitivity);
    uniforms.treble.value = Math.min(1.0, this.smoothedTreble * sensitivity);
  }
}
```

### 3. Rec. 601 vs Rec. 709 Luminance & Linear Light Transfer (D-05, D-06)
```typescript
import { Fn, vec3, vec4, clamp, pow, mix } from 'three/tsl';

/**
 * Rec. 601 Perceived Luminance (Parity with src/renderer.py:49-51).
 * [VERIFIED: src/renderer.py:49-51]
 * `return int(0.299 * r + 0.587 * g + 0.114 * b)`
 */
export const rec601Luminance = (rgb: any) =>
  rgb.r.mul(0.299).add(rgb.g.mul(0.587)).add(rgb.b.mul(0.114));

/**
 * Rec. 709 HDTV / sRGB Perceived Luminance.
 */
export const rec709Luminance = (rgb: any) =>
  rgb.r.mul(0.2126).add(rgb.g.mul(0.7152)).add(rgb.b.mul(0.0722));

/**
 * Exact sRGB Decode to Linear Light.
 */
export const sRGBToLinear = (colorNode: any) =>
  Fn(() => {
    const col = colorNode.rgb;
    const isLow = col.lessThanEqual(0.04045);
    const low = col.div(12.92);
    const high = pow(col.add(0.055).div(1.055), vec3(2.4));
    return vec4(mix(high, low, isLow), colorNode.a);
  })();

/**
 * Exact Linear Light Encode to sRGB Output.
 */
export const linearTosRGB = (colorNode: any) =>
  Fn(() => {
    const col = colorNode.rgb;
    const isLow = col.lessThanEqual(0.0031308);
    const low = col.mul(12.92);
    const high = pow(col, vec3(1.0 / 2.4)).mul(1.055).sub(0.055);
    return vec4(clamp(mix(high, low, isLow), 0.0, 1.0), colorNode.a);
  })();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rigid 4-stage pipeline with hardcoded switch statement | Composable node graph with typed `EffectDefinition` registry | Phase 02 (Current) | Enables arbitrary stacking, reordering, duplicate effects, and unified inspector schema generation. |
| Gamma-space blending and hardcoded 601 luminance | Linear-light compositing with context-correct 601 (ASCII) / 709 (Tone) standards | Phase 02 (Current) | Eliminates washed-out shadows, color halos, and banding; preserves mathematical parity with Python renderer. |
| Single global active effect radio group | Vertical effect stack in LeftRail with drag reorder, enable/disable, and blend modes | Phase 02 (Current) | Elevates dithr into a professional non-destructive multi-effect studio tool. |
| Static shader parameters without reactivity | Real-time audio-reactive modulation via native `AnalyserNode` | Phase 02 (Current) | Shaders react dynamically to microphone audio or video soundtracks at 60 FPS without React churn. |
| 2D-only media processing | 3D mesh rendering into ASCII point clouds and depth rasters | Phase 02 (Current) | Expands dithr beyond 2D video/images to full 3D retro ASCII visualization. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Built-in Three.js `GLTFLoader` can parse all standard user-uploaded binary GLB files without requiring extra external loaders. | Standard Stack & 3D ASCII | Low. Three.js `GLTFLoader` is the industry reference parser. Drac-compressed models may require DRACOLoader if users upload Drac-compressed files (can display informative error). |
| A2 | Pointwise fusion of up to 8 passes maintains 60 FPS on typical client GPUs without hitting WebGL2 instruction limits. | Architecture Patterns | Low. Modern WebGL2/WebGPU fragment shaders routinely execute hundreds of arithmetic instructions per fragment. Tiers (D-23) enforce fallbacks for low-end hardware. |

---

## Open Questions

1. **Draco-Compressed GLB Uploads**
   - *What we know:* Standard GLB files load natively via `GLTFLoader`. Draco-compressed models require initializing `DRACOLoader` and loading ~1MB of WASM worker files.
   - *Recommendation:* Support standard GLB/glTF out-of-the-box in Phase 2; detect Draco extension and show a clear notice: "Draco-compressed GLB not supported in Phase 2; please upload standard GLB."

2. **On-Canvas Mask Handle Positioning during HUD Pan/Zoom**
   - *What we know:* CenterStage has HUD pan and zoom transforms. On-canvas overlay handles must transform in sync with the canvas display.
   - *Recommendation:* Place the `MaskHandles` overlay inside the same CSS transformed container (`scale(zoom) translate(pan.x, pan.y)`) as the canvas, ensuring pixel-perfect handle alignment.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **Node.js** | Web build & unit tests | ✓ | v24.22.1 | — |
| **npm** | Package execution & scripts | ✓ | 11.19.1 | — |
| **Python** | Backend API & contract tests | ✓ | 3.11.8 | — |
| **Git** | Planning docs & commits | ✓ | 2.50.1 | — |
| **Playwright** | E2E & visual snapshot tests | ✓ | 1.65.1 | Run with `--use-angle=swiftshader` in headless Chromium |
| **WebGPU** | Canvas hardware acceleration | ✓ (Conditional) | WebGPU with WebGL2 fallback | `StudioRenderer` automatically falls back to WebGL2 |

**Missing dependencies with no fallback:** None.  
**Missing dependencies with fallback:** WebGPU is hardware-dependent; `StudioRenderer` contains an existing WebGL2 fallback.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Unit Test Framework | Vitest `^5.1.1` (`web/vitest.config.ts`) |
| E2E / Snapshot Framework | Playwright `^1.65.1` (`web/playwright.config.ts`) |
| Quick Run Command | `npm --prefix web run test:unit` |
| Full Suite Command | `npm --prefix web run test:unit && npm --prefix web run test:e2e && pytest tests/test_renderer.py` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **FX-01** | Stackable passes, drag reorder, toggle, blend modes | Unit / Component | `npm --prefix web run test:unit -- src/tests/stack.test.ts` | ❌ Wave 0 Gap |
| **FX-02** | Rec. 601 / 709 golden luminance math & sRGB linear roundtrip | Unit | `npm --prefix web run test:unit -- src/tests/colorMath.test.ts` | ❌ Wave 0 Gap |
| **FX-03** | RGB channel offsets & spatial vignette/box/circular masks | Unit / Visual | `npm --prefix web run test:unit -- src/tests/masks.test.ts` | ❌ Wave 0 Gap |
| **FX-04** | CRT/VHS profiles, scanlines, curvature, and bloom passes | Unit / Snapshot | `npx --prefix web playwright test e2e/crtVhs.spec.ts` | ❌ Wave 0 Gap |
| **FX-05** | Audio analyser FFT band extraction & attack/release filter | Unit | `npm --prefix web run test:unit -- src/tests/audioEngine.test.ts` | ❌ Wave 0 Gap |
| **FX-06** | 3D ASCII point cloud generation & GLB mesh loading | Unit / E2E | `npm --prefix web run test:unit -- src/tests/threeD.test.ts` | ❌ Wave 0 Gap |

### Sampling Rate
- **Per task commit:** `npm --prefix web run test:unit` (< 5 seconds)
- **Per wave merge:** `npm --prefix web run test:unit && pytest tests/test_renderer.py`
- **Phase gate:** Full Vitest suite, Playwright visual snapshot tests, and Python regression suite green.

### Wave 0 Gaps
- [ ] `web/src/tests/colorMath.test.ts` — Tests Rec. 601/709 weights and sRGB <-> linear conversion roundtrips.
- [ ] `web/src/tests/stack.test.ts` — Tests effect registry lookup, stack addition, reordering, and budget limits.
- [ ] `web/src/tests/audioEngine.test.ts` — Tests attack/release envelope math and band partitioning.
- [ ] `web/src/tests/threeD.test.ts` — Tests GLB file validation (header check, size limit) and primitive generation.
- [ ] `web/e2e/shaderSnapshots.spec.ts` — Playwright visual snapshots for each registered effect pass.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| **V5 Input Validation** | Yes | Validate uploaded GLB meshes (<50MB, binary header `glTF` / `0x46546C67`). Reject invalid or oversized files. |
| **V14 Build & Client Security** | Yes | Sanitize glTF extensions; prohibit execution of un-sandboxed script nodes in 3D assets. |
| **V4 Access Control / Privacy** | Yes | Microphone audio stream must only be requested upon explicit user click (`getUserMedia`); never prompt on page load. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Malicious GLB Buffer Overflow / OOM** | Denial of Service | Pre-validate file size (<50MB), verify magic bytes, wrap in `AbortSignal.timeout(10000)`, normalize scene geometry bounds to `[-1.5, 1.5]`. |
| **Microphone Snooping / Privacy Violation** | Information Disclosure | Explicit opt-in button (D-10, D-13); microphone is never auto-started; audio stream is routed only to local `AnalyserNode` and never sent across the network. |
| **VRAM Exhaustion via Infinite Passes** | Denial of Service | Tier pass budgets (D-23: High ~8, Medium ~5, Low ~3) and effect cost weights auto-disable passes before GPU memory allocation failure. |

---

## Sources

### Primary (HIGH confidence)
- `C:/Users/KIIT0001/Documents/projects/dithr/.planning/phases/02-shader-engine-2-0-advanced-fx/02-CONTEXT.md` - Locked user decisions D-01 through D-29 and phase boundary.
- `src/renderer.py:49-51` - Source of truth for Rec. 601 perceived luminance math (`0.299 * r + 0.587 * g + 0.114 * b`).
- `web/src/engine/capabilities.ts:21-37` - Quality tier configurations (`TIER_CONFIGS`).
- `web/src/types/studio.ts:12-28` - 16 Grainrad effect modes (`EffectMode`).
- `web/src/export/audioGraph.ts:11-22` - Singleton `AudioContext` and Web Audio routing.
- Google Chrome Modern Web Guidance (`modern-web-guidance` CLI) - Standard patterns for `drag-and-drop`, `drag`, `dialog`, `js`, and `security`.

### Secondary (MEDIUM confidence)
- Three.js r187 documentation & TSL examples (`three/tsl`, `three/webgpu`, `three/addons`).
- ITU-R BT.601 & ITU-R BT.709 international television colorimetry standards.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - Verified installed versions in `web/package.json` (`three@0.187.0`, `react@19.3.1`, `zustand@5.1.0`, `vitest@5.1.1`).
- Architecture: HIGH - Composable TSL graph and pointwise fusion patterns directly derived from Three.js TSL engine capabilities.
- Color & Math Standards: HIGH - Verified exact formula parity with `src/renderer.py` and ITU-R specifications.
- Modern Web Guidance: HIGH - Retrieved official guides from Chrome modern-web-guidance.

**Research date:** 2026-11-23  
**Valid until:** 2026-12-31 (Stable architecture; relies on established Three.js and web platform standards)
