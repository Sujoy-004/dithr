# Phase 1: Reliability & Performance Foundation - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 hardens system security, process management, and media export correctness across the entire stack, while establishing automated testing and retiring the terminal player from the product surface. It delivers:
1. P0 upload ingress security (50MB size ceiling, rate limits, magic-byte checks) and cross-platform FFmpeg process tree termination on export cancellation.
2. Client-side media recording correctness: synchronized audio/video in WebM clips and render-synchronized distinct frames in animated GIFs via offloaded Web Worker encoding.
3. A complete hermetic testing pyramid: Vitest unit tests in `web/`, Playwright browser E2E tests, and Schemathesis API contract fuzzing against FastAPI.
4. Formal retirement of the Python terminal player as a product surface, restricting the Python render loop to test fixtures and removing FFplay production dependencies.
5. Atomic rebranding of the project and repository configs to **dithr**, targeting Cloudflare Pages at `https://dithr.pages.dev/`.
6. Client GPU capability detection (Low/Medium/High quality tiers) and intelligent render scheduling (0% CPU/GPU idle when hidden).

</domain>

<decisions>
## Implementation Decisions

### 1. Upload Ingress Security & Subprocess Lifecycle (RELY-01, RELY-02)
- **D-01:** Cross-platform subprocess termination using `psutil`. When a user or test cancels an active export, the backend traverses and terminates the full FFmpeg process tree (`process.children(recursive=True)` followed by termination/kill), preventing zombie processes across Windows and Linux. — **Reversibility:** costly — Core subprocess lifecycle and backend task management contract.
- **D-02:** Strict sequential chunk streaming and 50MB upload ceiling. Audio and video chunk uploads validate ordering and idempotency. Audio endpoints enforce `5/minute` rate limits via SlowAPI. Uploaded files undergo binary magic-byte validation before disk persistence. On cancellation or error, temporary files and job directories in `/tmp` are wiped immediately. — **Reversibility:** costly — Public API contract and security boundary.

### 2. Recorder Correctness & Media Synchronization (RELY-03, RELY-04)
- **D-03:** WebM audio track multiplexing via `audioGraph`. `recordWebmClip` in `web/src/export/videoExport.ts` clones the audio track from `getOrCreateAudioGraph(videoEl)` (for video media) or `activeStream` (for live webcam), attaching it via `stream.addTrack()`. Autoplay compliance is guaranteed by awaiting `resumeAudioContext()` on user interaction. Cloned tracks are explicitly stopped on recorder completion/error to free resources while preserving the singleton AudioContext. Codec negotiation probes `video/webm;codecs=vp9,opus` down to `video/webm`. — **Reversibility:** reversible — Isolated to `web/src/export/` audio and video recording utilities.
- **D-04:** Worker-offloaded animated GIF encoding with render-synchronized sampling. Replace timer-based frame sampling with render-callback capture, ensuring every sampled frame represents a distinct animation tick across time. Captured frames (clamped to a 480px maximum dimension for safe memory bounds) are dispatched as transferable `ImageBitmap`s to a dedicated Vite Web Worker (`web/src/export/gif.worker.ts`) for `gifenc` palette quantization and encoding, eliminating main-thread UI freeze during GIF export. — **Reversibility:** costly — Introduces Web Worker build pipeline and worker messaging contract.

### 3. Comprehensive Testing Pyramid (RELY-05, RELY-06, RELY-07)
- **D-05:** Multi-layer testing architecture:
  - **Frontend Unit Testing (RELY-05):** Configure Vitest with `@testing-library/react` and `vitest-canvas-mock` in `web/` to test Zustand store actions (`useStudioStore.ts`), mathematical utilities, and HUD components with sub-second execution.
  - **Browser E2E Testing (RELY-06):** Configure Playwright in headless mode using software rendering (`--use-gl=angle`, `--use-angle=swiftshader`) and synthetic media streams (`--use-fake-device-for-media-stream`) in GitHub Actions CI to verify canvas WebGL/WebGPU shaders, media upload ingestion, and client export workflows.
  - **API Contract Testing (RELY-07):** Integrate Schemathesis via in-process ASGI execution (`schemathesis.openapi.from_asgi(app)`) to automatically fuzz all FastAPI endpoints against the auto-generated OpenAPI 3.1 specification, discovering schema drift, unhandled 500 errors, and boundary limits. Supplement with targeted Hypothesis property tests for asynchronous cancellation race conditions. — **Reversibility:** costly — CI pipeline setup and repository-wide testing harness.

### 4. Terminal Player Retirement, Rebranding to dithr & Adaptation (RELY-08, RELY-09, RELY-10)
- **D-06:** Terminal player retirement. The web studio is the sole end-user surface for v2.0. Remove the `rgb-ascii = "src.main:main"` console script entry point from `pyproject.toml`. Remove FFplay from production dependencies and documentation. Restrict `src/renderer.py` and `src/sync.py` strictly to deterministic test fixtures for pytest. — **Reversibility:** one-way — Public packaging and product surface change.
- **D-07:** Atomic project rebrand to **dithr**. Update repository metadata, `package.json`, and `pyproject.toml` to `dithr`. Update Cloudflare Pages deployment configuration to `https://dithr.pages.dev/` in `wrangler.toml`. Update all user and operator documentation (`README.md`, `GETTING-STARTED.md`, `DEPLOYMENT.md`, etc.). — **Reversibility:** costly — Domain rename, deployment configurations, and public references.
- **D-08:** Capability tiers and hybrid idle render scheduling. Implement static GPU capability probing (WebGPU adapter limits, WebGL2 parameters, `navigator.deviceMemory`) that assigns Low, Medium, or High quality tiers with an explicit user override in the HUD. Use `visibilitychange` and `contentvisibilityautostatechange` to halt `requestAnimationFrame` rendering and audio polling when hidden (dropping CPU and GPU usage to 0%), while keeping GPU pipelines alive in memory to avoid 300–800ms tab-return stutter. — **Reversibility:** reversible — Viewport component and store lifecycle hooks.

### the agent's Discretion
- Exact threshold heuristics for Low/Medium/High GPU capability classification (e.g. max texture size < 4096 vs 8192, mobile user-agent vs desktop GPU vendor).
- Specific Vitest test structure and fixture helpers for React 19 component mocking.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Roadmap & Requirements
- `.planning/ROADMAP.md` — v2.0 milestone plan and Phase 1 scope (RELY-01 through RELY-10).
- `.planning/REQUIREMENTS.md` — Specific requirement definitions and success criteria for RELY-01 to RELY-10.
- `.planning/PROJECT.md` — Core value, constraints, $0/month budget ceiling, and architecture decisions.

### Media & Audio Graph
- `web/src/export/audioGraph.ts` — Web Audio singleton graph, `getOrCreateAudioGraph()`, `getAudioStreamTrack()`, and `resumeAudioContext()`.
- `web/src/export/videoExport.ts` — `recordWebmClip()` and `recordGifClip()` client export routines.

### Backend Export & Lifecycle
- `src/api/jobs.py` — `ExportJobManager`, job state machine, temporary directory resolution.
- `src/api/routes/export.py` — FastAPI export routes, cancellation endpoints, chunk upload validation.
- `src/api/transcode.py` — FFmpeg subprocess execution and media validation.

### Packaging & Infrastructure Configuration
- `wrangler.toml` — Cloudflare Pages deployment configuration (to be updated to `dithr.pages.dev`).
- `pyproject.toml` — Python package metadata and console scripts (removal of `rgb-ascii`).
- `web/package.json` — Frontend package metadata and dependencies.
- `render.yaml` — Render free web service deployment specification.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/export/audioGraph.ts`: Contains the singleton `AudioContext` and `MediaStreamDestination` necessary for multiplexing audio into `recordWebmClip`.
- `src/api/limiter.py`: Pre-configured SlowAPI rate limiter ready to be attached to audio upload endpoints.
- `src/api/jobs.py`: Existing `ExportJobManager` singleton with job state tracking and storage directory resolution.

### Established Patterns
- **Zustand Store**: `web/src/store/useStudioStore.ts` manages all active media, resolution settings, and effect parameters.
- **Three.js Pipeline**: `web/src/engine/Pipeline.ts` and `Renderer.ts` execute WebGPU shaders with automatic WebGL2 fallback.
- **API Security**: `src/api/security.py` enforces Turnstile token verification, CIDR checks, and job authorization.

### Integration Points
- `web/src/export/videoExport.ts` & `web/src/export/gif.worker.ts`: Entry points for client recording synchronization and worker offloading.
- `src/api/routes/export.py`: Ingress security validation, rate limiting, and cancellation endpoint handlers.
- `web/src/components/studio/CenterStage.tsx`: Viewport observer hooks for `contentvisibilityautostatechange` and RAF pause.
- `web/src/components/studio/Header.tsx` / HUD: Quality tier display and manual override toggle.

</code_context>

<specifics>
## Specific Ideas
- **Rebrand**: The user explicitly requested renaming the repository and project to **"dithr"** and updating the deployment URL to **`https://dithr.pages.dev/`**.
- **RELY-03**: Audio tracks must be cloned before attaching to `MediaRecorder` so that track disposal on export completion does not close or invalidate the shared singleton `AudioContext`.
- **RELY-04**: Dedicated Vite Web Worker with transferable `ImageBitmap`s ensures zero main-thread dropped frames during 256-color palette generation.

</specifics>

<deferred>
## Deferred Ideas

### Future Phases
- **Audio-reactive shader modulation (Phase 2 / FX-05)**: Using Web Audio `AnalyserNode` frequency bins to drive visual shader parameters.
- **Undo/Redo history stack (Phase 3 / WORK-01)**: Immutable parameter history stack.
- **Project persistence in IndexedDB (Phase 4 / PERSIST-01)**: Named project recipes stored in browser IndexedDB.

[None — discussion stayed within phase scope]

</deferred>

---

*Phase: 01-Reliability & Performance Foundation*
*Context gathered: 2026-11-22*
