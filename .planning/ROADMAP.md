# Roadmap: RGB ASCII & Retro FX Studio

## Milestones

- ✅ **v1.0 RGB ASCII & Retro FX Studio** — Phases 1-3 (shipped 2026-11-18) — [Archive](milestones/v1.0-ROADMAP.md)
- 🚀 **v2.0 Professional Studio** — Phases 1-4 (in planning)

## Phases

<details>
<summary>✅ v1.0 RGB ASCII & Retro FX Studio (Phases 1-3) — SHIPPED 2026-11-18</summary>

- [x] Phase 1: Codebase Modernization & Core Engine Extraction (3/3 plans) — completed 2026-11-17
- [x] Phase 2: Studio UI/UX Redesign & Client Shader Pipeline (5/5 plans) — completed 2026-11-18
- [x] Phase 3: Backend API, High-Res Export & Git-Driven Deployment (4/4 plans) — completed 2026-11-18

</details>

### v2.0 Professional Studio

- [x] **Phase 1: Reliability & Performance Foundation** (5/5 plans) — completed 2026-11-22
- [ ] **Phase 2: Shader Engine 2.0 & Advanced FX** - Composable TSL multi-effect pass pipeline, corrected Rec. 601/709 color math, Web Audio FFT audio reactivity, advanced CRT/VHS analog emulation, and 3D ASCII point cloud rendering.
- [ ] **Phase 3: Creative Workspace & Export Studio** - Non-destructive Undo/Redo history stack, session crash recovery, multi-layer composition, keyframe parameter timeline, before/after split view, and preview-faithful export queue.
- [ ] **Phase 4: Persistence, Community & Distribution** - Named projects in IndexedDB (`idb`) with autosave, compressed URL hash preset sharing (`lz-string`), optional Neon PostgreSQL cloud sync, and embeddable web component package.

## Phase Details

### Phase 1: Reliability & Performance Foundation

**Goal**: Harden system security and subprocess lifecycle, eliminate verified v1.0 gaps (export cancellation, recorder audio sync, animated GIF frames, upload size caps), build automated Vitest + Playwright + API contract testing harnesses, retire the terminal player, and implement intelligent render scheduling.
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: RELY-01, RELY-02, RELY-03, RELY-04, RELY-05, RELY-06, RELY-07, RELY-08, RELY-09, RELY-10
**Success Criteria** (what must be TRUE):
  1. User or test can cancel an active export and verify that the backend FFmpeg subprocess terminates immediately (`os.killpg`) without leaving orphan processes or uncleaned files in `/tmp`.
  2. Uploads exceeding 50MB or with invalid magic bytes are rejected with 413 and 400 status codes, and audio upload endpoints enforce strict rate limits.
  3. Exported client WebM clips from video media include synchronized audio and video tracks, and client animated GIFs capture sequential distinct frames across time.
  4. Vitest unit tests in `web/`, Playwright headless browser E2E tests, and FastAPI property-based contract tests run in CI and pass with zero failures.
  5. Python terminal player entry point is archived; Python render loop is restricted to test fixtures; FFplay is removed from production runtime dependencies.
  6. System detects GPU capabilities and pauses render loop via `contentvisibilityautostatechange` when the viewport is hidden or off-screen.
**Plans:** 5/5 plans executed

Plans:
- [x] 01-01-PLAN.md — Export Cancellation Subprocess Lifecycle & Ingress Security
- [x] 01-02-PLAN.md — Client Recording Synchronization & Web Worker Animated GIF Export
- [x] 01-03-PLAN.md — Client GPU Capability Tiers & Intelligent Idle Render Scheduling
- [x] 01-04-PLAN.md — Automated Testing Pyramid: Vitest, Playwright E2E & Schemathesis Contract Fuzzing
- [x] 01-05-PLAN.md — Terminal Player Retirement & Atomic Rebrand to dithr

---

### Phase 2: Shader Engine 2.0 & Advanced FX

**Goal**: Rebuild the fixed 4-stage shader pipeline into a composable multi-effect node graph in Three.js TSL, correct color math and gamma blending, and add audio-reactive, advanced CRT/VHS, and 3D point cloud effects.
**Depends on**: Phase 1
**Requirements**: FX-01, FX-02, FX-03, FX-04, FX-05, FX-06
**Success Criteria** (what must be TRUE):
  1. User can stack, reorder, toggle, and blend multiple retro effects in any arbitrary sequence without shader pipeline breakage.
  2. Luminance mapping and color conversions adhere to Rec. 601 / Rec. 709 standards with gamma-accurate blending, eliminating washed-out shadows and color banding.
  3. User can apply chromatic RGB channel separation and spatial masks (vignette, box, circular) to any active media source.
  4. Analog CRT and VHS emulation renders phosphor decay, scanline curvature, tape tracking jitter, and bloom.
  5. Live microphone input or video audio frequency bands (bass, mid, treble) extracted via Web Audio `AnalyserNode` dynamically modulate shader parameters in real time at 60 FPS.
  6. User can load and render 3D meshes into real-time ASCII point clouds and rasterized depth fields.
**Plans:** 5/6 plans executed

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Color Science, Typed Effect Registry & Tracer Pipeline Slice

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Hybrid Render Graph, PassPool & Engine Pipeline Execution

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — LeftRail Effect Stack UI, Reorder & Schema-Driven Inspector

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — Spatial Masks, RGB Channel Split & Advanced Analog CRT/VHS Emulation

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-05-PLAN.md — Web Audio Reactivity & Zero-Churn RAF Modulation

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 02-06-PLAN.md — 3D ASCII Generator, Mesh Ingestion & Test Harness Verification

---

### Phase 3: Creative Workspace & Export Studio

**Goal**: Empower creators with non-destructive editing history (undo/redo), session crash recovery, multi-layer compositing, keyframe parameter animation along an interactive timeline, before/after comparison, and a preview-faithful export queue.
**Depends on**: Phase 2
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07
**Success Criteria** (what must be TRUE):
  1. User can undo (Ctrl+Z) and redo (Ctrl+Y) parameter adjustments, preset changes, and layer operations without visual glitches or memory leaks using native `structuredClone()`.
  2. Accidental tab refresh or browser crash restores previous project state from temporary local session storage.
  3. User can create, reorder, and composite multiple media layers with independent transform controls, opacity, and standard blend modes.
  4. User can set and animate parameter keyframes along an interactive timeline with smooth linear and eased parameter interpolation.
  5. User can view a split-screen or swipeable before/after comparison between raw media and retro-processed canvas output.
  6. Exported high-resolution media matches the canvas HUD preview exactly across dimensions, aspect ratios, fonts, and colors, managed via a non-blocking export queue with pause/resume controls.
**Plans**: TBD (to be planned via `/gsd-plan-phase 3`)

---

### Phase 4: Persistence, Community & Distribution

**Goal**: Provide durable local and cloud project storage, zero-friction URL preset sharing, optional Neon Serverless PostgreSQL synchronization, and embeddable web distribution.
**Depends on**: Phase 3
**Requirements**: PERSIST-01, PERSIST-02, PERSIST-03, PERSIST-04, PERSIST-05, PERSIST-06
**Success Criteria** (what must be TRUE):
  1. User can create, rename, duplicate, and delete multiple named projects in local browser IndexedDB (`idb`) with automatic schema version migrations.
  2. Project modifications autosave to IndexedDB with debouncing and zero main-thread rendering hiccups.
  3. User can copy and share complete project recipes via compressed URL hash links (`#recipe=...`) that load instantly with zero server infrastructure.
  4. User can optionally connect an anonymous or authenticated Neon Serverless PostgreSQL account to back up and sync project recipes across devices.
  5. User can export and import standalone JSON preset files to share custom ASCII ramps and shader setups.
  6. User can export a self-contained, lightweight embeddable web component package for displaying interactive retro visuals on external websites.
**Plans**: TBD (to be planned via `/gsd-plan-phase 4`)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Reliability & Performance Foundation | 5/5 | Planning complete | - |
| 2. Shader Engine 2.0 & Advanced FX | 5/6 | Planning complete | - |
| 3. Creative Workspace & Export Studio | 0/0 | Not started | - |
| 4. Persistence, Community & Distribution | 0/0 | Not started | - |

---
*For archived milestone details, see .planning/milestones/*
