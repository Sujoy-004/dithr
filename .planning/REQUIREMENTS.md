# Requirements: RGB ASCII & Retro FX Studio

**Defined:** 2026-11-21
**Core Value:** Instant, real-time retro visual transformations and high-fidelity media export across web and video formats, operating reliably at $0/month on free-tier cloud infrastructure.

## v2.0 Requirements

Requirements for Milestone v2.0 Professional Studio. Each maps to roadmap phases.

### Reliability, Security & Testing Foundation

- [x] **RELY-01**: User or operator can cancel an ongoing export job via UI or API and immediately terminate the backend FFmpeg subprocess (`os.killpg`) without leaving zombie processes or uncleaned temporary files.
- [x] **RELY-02**: System rejects media and audio uploads exceeding 50MB, enforces rate limits on audio endpoints (`5/minute`), and validates file magic bytes to prevent malformed or malicious binary injection.
- [x] **RELY-03**: User can export client-side WebM video clips from video media with audio, producing synchronized video and audio tracks in the resulting media file.
- [x] **RELY-04**: User can export client-side animated GIF clips that capture sequential, distinct animated frames across time rather than repeating a single canvas snapshot.
- [x] **RELY-05**: Developer can run automated unit and component tests for `web/` using Vitest with zero failures across UI components, math routines, and export drivers.
- [x] **RELY-06**: Developer can run automated browser E2E tests using Playwright with WebGPU/WebGL flags verifying canvas rendering, media upload, HUD interactions, and export flows.
- [x] **RELY-07**: Developer can run automated property-based API contract tests verifying FastAPI OpenAPI endpoints against schema drifts, boundary values, and unauthorized requests.
- [x] **RELY-08**: Developer can run the test suite and verify that the Python terminal player is completely retired as a product surface, with the render loop restricted to test execution and zero FFplay production dependency.
- [x] **RELY-09**: System detects client GPU capabilities (WebGPU vs WebGL2, max texture size, memory limits) and dynamically adapts render resolution and shader quality tiers.
- [x] **RELY-10**: System pauses canvas render loops and audio polling via `contentvisibilityautostatechange` when the studio viewport is hidden or off-screen, conserving CPU, GPU VRAM, and battery.

### Shader Engine 2.0 & Advanced FX

- [x] **FX-01**: User can stack, reorder, toggle, and adjust multiple post-processing effects in a composable node pipeline without fixed-stage restrictions.
- [x] **FX-02**: User sees color conversions and ASCII luminance mapping rendered using standard Rec. 601 / Rec. 709 weighting with gamma-accurate blending to prevent washed-out shadows or clipped highlights.
- [x] **FX-03**: User can apply RGB channel separation (chromatic aberration) and configurable spatial vignette/box masks to any media source.
- [x] **FX-04**: User can apply advanced analog CRT and VHS emulation featuring phosphor decay, beam curvature, scanline jitter, and bloom.
- [x] **FX-05**: User can enable audio-reactive modulation where microphone input or video audio frequency bands (bass, mid, treble) dynamically drive shader parameters in real time.
- [x] **FX-06**: User can render 3D geometry and mesh surfaces into real-time ASCII point clouds and rasterized depth representations.

### Creative Workspace & Export Studio

- [ ] **WORK-01**: User can undo (Ctrl+Z) and redo (Ctrl+Y / Ctrl+Shift+Z) any parameter adjustment, preset switch, or layer change through a non-destructive immutable history stack.
- [ ] **WORK-02**: User can recover from accidental tab reloads or browser crashes via automatic temporary session state snapshotting.
- [ ] **WORK-03**: User can composite multiple media layers with independent transform controls, opacity, and blend modes (Normal, Multiply, Screen, Add).
- [ ] **WORK-04**: User can create and animate parameter keyframes along an interactive timeline with linear and eased interpolation.
- [ ] **WORK-05**: User can inspect a split-screen or swipeable before/after comparison between original input media and processed retro output.
- [ ] **WORK-06**: User can export high-resolution media where exported dimensions, aspect ratios, fonts, and colors exactly match the real-time viewport preview.
- [ ] **WORK-07**: User can manage multiple exports in a non-blocking export queue with pause, resume, and cancellation controls.

### Persistence, Community & Distribution

- [ ] **PERSIST-01**: User can save, rename, duplicate, and delete multiple named creative projects in local browser IndexedDB (`idb`) with automatic schema version migrations.
- [ ] **PERSIST-02**: System automatically debounces and autosaves project modifications to IndexedDB without blocking the main rendering thread.
- [ ] **PERSIST-03**: User can share and load complete effect recipes via compressed, URL-safe hash strings (`#recipe=...`) with zero server dependency.
- [ ] **PERSIST-04**: User can optionally connect an anonymous or authenticated Neon Serverless PostgreSQL account to back up and sync projects across devices.
- [ ] **PERSIST-05**: User can export and import standalone JSON preset files to share custom ASCII ramps and shader parameter setups.
- [ ] **PERSIST-06**: User can export a lightweight embeddable web component package to display interactive retro artwork on external websites.

## Future Requirements (v3+)

Deferred to future releases. Tracked but not in current roadmap.

### Advanced Video Editing & Compilation
- **NLE-01**: Multi-track audio and video timeline trimming, cutting, and cross-dissolve transitions.
- **WASM-01**: Custom user-authored WebAssembly fragment shaders compiled directly in the browser.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Terminal Player as a Product Surface | Retired in v2.0. The browser Web Studio is the sole end-user product; the Python render loop is retained exclusively for hermetic tests. |
| Dedicated Paid Cloud GPU Instances | Real-time shaders execute client-side on user WebGPU/Canvas hardware; exports run on free-tier CPU compute to uphold the strict $0/month budget. |
| Mandatory User Authentication & Paywalls | The studio remains an instant, friction-free creative tool with zero barrier to entry. Accounts are strictly optional. |
| Unbounded Video Uploads (>60s) | Server memory ceiling on Render free tier is 512MB; uploads longer than 60 seconds risk OOM restarts. Client recording covers longer sessions. |
| Non-Linear Audio Editing / Multi-Track DAW | ASCII Studio focuses on retro visual aesthetics and audio reactivity, not audio mastering or DAW sequencing. |

## Traceability

Which phases cover which requirements. (Populated during roadmap creation).

| Requirement | Phase | Status |
|-------------|-------|--------|
| RELY-01 | Phase 1 | Complete |
| RELY-02 | Phase 1 | Complete |
| RELY-03 | Phase 1 | Complete |
| RELY-04 | Phase 1 | Complete |
| RELY-05 | Phase 1 | Complete |
| RELY-06 | Phase 1 | Complete |
| RELY-07 | Phase 1 | Complete |
| RELY-08 | Phase 1 | Complete |
| RELY-09 | Phase 1 | Complete |
| RELY-10 | Phase 1 | Complete |
| FX-01 | Phase 2 | Complete |
| FX-02 | Phase 2 | Complete |
| FX-03 | Phase 2 | Complete |
| FX-04 | Phase 2 | Complete |
| FX-05 | Phase 2 | Complete |
| FX-06 | Phase 2 | Complete |
| WORK-01 | Phase 3 | Pending |
| WORK-02 | Phase 3 | Pending |
| WORK-03 | Phase 3 | Pending |
| WORK-04 | Phase 3 | Pending |
| WORK-05 | Phase 3 | Pending |
| WORK-06 | Phase 3 | Pending |
| WORK-07 | Phase 3 | Pending |
| PERSIST-01 | Phase 4 | Pending |
| PERSIST-02 | Phase 4 | Pending |
| PERSIST-03 | Phase 4 | Pending |
| PERSIST-04 | Phase 4 | Pending |
| PERSIST-05 | Phase 4 | Pending |
| PERSIST-06 | Phase 4 | Pending |

**Coverage:**
- v2.0 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-21*
*Last updated: 2026-11-21 after research completion*
