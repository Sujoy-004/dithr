# Feature Research

**Domain:** Browser-Based Real-Time Visual Effects & Media Processing Studio (Milestone v2.0 Professional Studio)
**Researched:** 2026-11-21
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in a professional creative tool. Missing these makes the studio feel like an unfinished toy or tech demo.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Export Cancellation with Subprocess Kill** | When an export is canceled, the backend must immediately terminate FFmpeg and free memory; the client must cancel network requests without hanging. | MEDIUM | Connect `AbortController` / `AbortSignal.any()` on client; kill process group (`killpg`) on backend. |
| **Audio/Video Synchronized Media Recording** | Exporting a WebM video clip from a video with audio must contain both video and audio tracks in sync. | MEDIUM | Combine Canvas video stream (`canvas.captureStream(30)`) with Web Audio stream (`sharedStreamDest.stream`) into a unified `MediaStream` for `MediaRecorder`. |
| **Multi-Frame Client GIF Generation** | Recording a client GIF must capture animated changes across time rather than freezing/repeating a single canvas snapshot. | MEDIUM | Sequence canvas render calls with `requestAnimationFrame` and timestamp pacing; feed changing frame data to `gifenc`. |
| **Upload Security & Validation Guardrails** | Uploads to backend must be constrained by file type (magic byte check), strict rate limits, and maximum file size (50MB ceiling). | LOW | Extend `src/api/security.py` and `routes/export.py` with size limits and MIME validation. |
| **Automated Test Suite (Web Unit + E2E + API)** | Regressions in rendering, media loading, or export pipelines must be caught before deployment; code quality must be verifiable. | HIGH | Vitest for unit tests in `web/`, Playwright for browser E2E with WebGPU flags, Schemathesis/pytest for FastAPI contracts. |
| **Terminal Player Codebase Retirement** | Terminal ANSI player is no longer an end-user product; terminal-specific entry points must be retired so maintenance is 100% focused on Web. | LOW | Archive terminal player; make Python render loop test-only; remove FFplay runtime dependency. |
| **Non-Destructive Undo / Redo History** | Creative studio users make mistakes and expect Ctrl+Z / Ctrl+Y to revert adjustments without losing state. | MEDIUM | Immutable command stack utilizing `structuredClone` and modern non-mutating array operations (`toSpliced`, `with`). |
| **Local Project Persistence & Autosave** | Users must not lose their work on browser refresh or accidental tab closure. | MEDIUM | Store project recipes, layer hierarchies, and custom ramps in `IndexedDB` with debounced autosave. |
| **Preview-Faithful High-Res Export** | Exported images and videos must exactly match what was seen in the viewport HUD (aspect ratio, colors, scale, font, DPI). | MEDIUM | Decouple export render target from viewport DOM zoom; apply identical shader uniforms during transcode. |

### Differentiators (Competitive Advantage)

Features that set RGB ASCII Studio apart from basic command-line converters or static ASCII generators.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Composable Multi-Effect Shader Chaining** | Freedom to stack, reorder, toggle, and blend multiple effects (e.g. Halftone -> Edge Detect -> VHS Bloom -> Color Grade) in any order. | HIGH | Rebuild `Pipeline.ts` using Three.js TSL node passes with ping-pong render targets and dynamic graph composition. |
| **Audio-Reactive Real-Time Shaders** | Audio frequency (bass, mid, treble) dynamically modulates ASCII ramp, scanlines, bloom, or noise displacement for live VJing. | MEDIUM | Web Audio API `AnalyserNode` FFT frequency extraction connected to TSL float uniforms in the render loop. |
| **Corrected Color Math & Gamma Blending** | High-fidelity retro conversions using standard Rec. 601 / Rec. 709 luminance weights and gamma-correct color blending. | LOW | Upgrade shader luminance and color mapping functions to prevent washed-out shadows or clipped highlights. |
| **Advanced CRT & VHS Emulation** | Authentic retro analog aesthetics: phosphor decay, tape tracking jitter, chromatic aberration, NTSC composite bleed, scanline curvature. | MEDIUM | Multi-pass TSL post-processing pass with configurable noise, curvature distortion, and chromatic offsets. |
| **Multi-Layer Composition & Keyframes** | Layering media assets (e.g. background video + ASCII text overlay + border overlay) with time-based parameter keyframes. | HIGH | Layer store with blend modes (Normal, Multiply, Screen, Add); timeline keyframe interpolation system. |
| **Zero-Friction Link Sharing ($0 Cost)** | Share customized presets and studio setups via compressed URL hash links without needing a backend database. | LOW | Use `lz-string` to encode project JSON into `#recipe=...` hash fragment. Instant, permanent, zero cloud maintenance. |
| **Optional Neon Cloud Sync** | Seamlessly back up projects to the cloud with anonymous-first design and zero mandatory login walls. | MEDIUM | Neon Serverless PostgreSQL schema (`docs/database-schema.sql`) with stateless JWT auth for opt-in account syncing. |
| **Intelligent Background Throttling** | Conserves laptop battery and GPU VRAM when the studio tab or canvas is off-screen. | LOW | Modern Web Guidance: `contentvisibilityautostatechange` listener to sleep render loop and pause audio. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing on the surface but violate core values, create severe technical debt, or break the $0/month cloud budget.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Mandatory User Accounts / Login Wall** | Common SaaS monetization pattern. | Creates massive user friction, violates the instant $0/month utility promise, and introduces database maintenance burdens. | Anonymous-first local IndexedDB storage; optional cloud sync only for users who explicitly choose it. |
| **Cloud GPU Video Rendering Instances** | Users want 4K 60fps instant server rendering. | Dedicated cloud GPUs (AWS/GCP) cost $300+/month, destroying the strict $0/month budget constraint. | Client-side WebGPU acceleration for instant preview and recording; free-tier CPU FFmpeg with low-memory chunks for heavy exports. |
| **Unbounded Video File Uploads (>60s / 500MB)** | Users want to process full-length 2-hour movies. | Exceeds Render free-tier 512MB RAM ceiling; causes severe OOM restarts and server downtime for all users. | Enforce strict 60-second video duration and 50MB file size limits on backend exports; encourage client recording for longer sessions. |
| **Heavy Non-Linear Video Editor (NLE) Timeline** | Users want multi-track audio trimming, cutting, transitions, and subtitle titling. | Bloats application complexity into a full Premiere/DaVinci clone, losing focus on retro visual transformations. | Keep timeline focused strictly on keyframing shader parameters and loop durations. |
| **Server-Side Project Database Storage by Default** | Wanting to store all uploaded user video files on server disks. | Render free-tier has ephemeral disks (wiped on restart) and Cloudflare Pages cannot store GBs of user blobs for free. | Store project recipes and metadata locally in IndexedDB; re-link local video files or use client-side file handle permissions. |

## Feature Dependencies

```
[Phase 1: Reliability & Performance Foundation]
    │
    ├──provides──> [P0 Security, Subprocess Kill, Sync Audio/Video Recorder]
    ├──provides──> [Capability Detection & Render Scheduling (content-visibility)]
    └──provides──> [Vitest Unit + Playwright E2E Test Suite]
                         │
                         ▼
[Phase 2: Shader Engine 2.0 & Advanced FX]
    │
    ├──requires──> [Reliability Foundation & Benchmark Suite]
    ├──provides──> [Composable TSL Effect Pipeline & Corrected Color Math]
    ├──provides──> [Audio-Reactive AnalyserNode Shaders]
    └──provides──> [Advanced CRT/VHS/Dithering & 3D ASCII point cloud]
                         │
                         ▼
[Phase 3: Creative Workspace & Export Studio]
    │
    ├──requires──> [Composable Shader Pipeline]
    ├──provides──> [Non-Destructive History (Undo/Redo with structuredClone)]
    ├──provides──> [Layers & Keyframe Parameter Animation]
    └──provides──> [Preview-Faithful Production Export Queue]
                         │
                         ▼
[Phase 4: Persistence, Community & Distribution]
    │
    ├──requires──> [Creative Workspace Project State Schema]
    ├──provides──> [IndexedDB Local Project Storage & Autosave]
    ├──provides──> [Compressed URL Preset Hash Sharing]
    └──provides──> [Optional Neon Cloud Sync & Embeddable Web Components]
```

### Dependency Notes

- **Composable Shader Pipeline requires Reliability Foundation:** Before expanding into complex multi-pass shaders and audio-reactive uniforms, resource leaks, WebGPU disposals, and memory limits must be controlled and verified by tests.
- **Layers & Keyframes require Composable Shader Pipeline:** Layering and parameter tweening operate on discrete effect nodes; the pipeline must be modular before keyframes can modulate individual passes.
- **Preview-Faithful Export requires Creative Workspace:** The export coordinator must serialize the complete layer and keyframe state into FFmpeg command arguments or canvas offscreen render passes.
- **Persistence requires Project State Schema:** IndexedDB and cloud sync depend on a finalized, serializable project schema established during Phase 3.

## MVP Definition

### Launch With (v2.0 Phase 1: Reliability Foundation)

Essential fixes and test infrastructure to make the studio stable and verified:

- [ ] P0 Fix: Export cancellation with immediate FFmpeg subprocess termination (`os.killpg`).
- [ ] P0 Fix: Audio/video synchronized client recording in `videoExport.ts` via combined `MediaStream`.
- [ ] P0 Fix: Client animated GIF export capturing sequential distinct frames.
- [ ] P0 Fix: Upload hardening with size ceiling (50MB) and magic byte validation.
- [ ] Automated Test Suite: Vitest unit tests in `web/` + Playwright browser E2E test suite.
- [ ] Terminal player retirement: Python CLI/terminal player code archived; Python render loop made test-only.
- [ ] Intelligent render scheduling: `contentvisibilityautostatechange` and `scheduler.yield()` integrations.

### Add After Validation (v2.0 Phases 2 & 3: Engine & Workspace)

Features to transform the tool into a professional creative workstation:

- [ ] Composable TSL multi-effect pipeline with node pass chaining and ping-pong render targets.
- [ ] Corrected color math (Rec. 601 / Rec. 709 luminance, gamma-accurate blending).
- [ ] Audio-reactive shader uniforms connected to Web Audio `AnalyserNode`.
- [ ] Advanced CRT, VHS tape glitch, and spatial dithering modes.
- [ ] Non-destructive Undo/Redo history stack with `structuredClone()`.
- [ ] Multi-layer canvas compositing and parameter keyframe interpolation.
- [ ] Before/after split view comparison.
- [ ] Preview-faithful production export queue.

### Future Consideration (v2.0 Phase 4 & v2.x: Persistence & Community)

Features for sharing and ecosystem durability:

- [ ] Permanent named project storage in browser IndexedDB with autosave.
- [ ] Compressed URL hash sharing (`lz-string`) for zero-cost preset distribution.
- [ ] Optional Neon Serverless PostgreSQL cloud sync with stateless JWT.
- [ ] Embeddable web component / iframe player for digital art portfolios.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Export cancellation subprocess termination | HIGH | MEDIUM | P1 |
| Audio/video synchronized client recording | HIGH | MEDIUM | P1 |
| Upload security & size limits | HIGH | LOW | P1 |
| Web Vitest unit + Playwright E2E suite | HIGH | HIGH | P1 |
| Composable multi-effect shader engine | HIGH | HIGH | P1 |
| Undo / Redo history stack | HIGH | MEDIUM | P1 |
| IndexedDB project persistence & autosave | HIGH | MEDIUM | P1 |
| Audio-reactive shaders (Web Audio FFT) | HIGH | MEDIUM | P2 |
| Advanced CRT / VHS emulation | MEDIUM | MEDIUM | P2 |
| Layers & keyframe parameter animation | HIGH | HIGH | P2 |
| Preview-faithful export queue | HIGH | MEDIUM | P2 |
| URL hash preset link sharing | MEDIUM | LOW | P2 |
| Optional Neon cloud sync | MEDIUM | MEDIUM | P3 |
| Embeddable player widget | LOW | MEDIUM | P3 |

## Competitor Feature Analysis

| Feature | Monolith CLI Converters | Web ASCII Toys | Grainrad (Commercial) | ASCII Studio v2.0 |
|---------|-------------------------|----------------|-----------------------|-------------------|
| **Platform** | Terminal only | Web Canvas | Web (Paid SaaS) | Web Studio ($0/month, free-tier cloud) |
| **Shader Engine** | CPU software render | Simple single-pass WebGL | WebGL/WebGPU shaders | Composable Three.js WebGPU / TSL with WebGL2 fallback |
| **Audio-Reactivity** | None | Rare / none | Preset only | Live microphone or audio file FFT spectrum uniforms |
| **History / Undo** | None | None | Basic undo | Full non-destructive history (`structuredClone`, immutable snapshots) |
| **Export Formats** | Plain text / ANSI | Low-res PNG | Video / GIF export | Vector SVG, ANSI, PNG, WebM (with audio), Animated GIF, 1080p FFmpeg |
| **Persistence** | File system | LocalStorage (limited) | Cloud database (paid) | Local IndexedDB + URL hash sharing + optional Neon sync |

## Sources

- User requirements and feedback documented in `.planning/PROJECT.md` and `.planning/STATE.md`.
- W3C Web Audio API & Media Capture and Streams specifications.
- Google Chrome Modern Web Guidance (`performance`, `js`, `security`, `accessibility`).
- Three.js WebGPU Node system and TSL documentation.

---
*Feature research for: Browser-Based Real-Time Visual Effects & Media Processing Studio (Milestone v2.0)*
*Researched: 2026-11-21*
