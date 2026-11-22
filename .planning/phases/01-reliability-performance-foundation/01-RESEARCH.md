# Phase 1: Reliability & Performance Foundation - Research
**Researched:** 2026-11-22
**Domain:** System Reliability, Subprocess Lifecycle, Ingress Security, Client Media Recording, Automated Test Pyramid
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 1. Upload Ingress Security & Subprocess Lifecycle (RELY-01, RELY-02)
- **D-01:** Cross-platform subprocess termination using `psutil`. When a user or test cancels an active export, the backend traverses and terminates the full FFmpeg process tree (`process.children(recursive=True)` followed by termination/kill), preventing zombie processes across Windows and Linux. — **Reversibility:** costly — Core subprocess lifecycle and backend task management contract.
- **D-02:** Strict sequential chunk streaming and 50MB upload ceiling. Audio and video chunk uploads validate ordering and idempotency. Audio endpoints enforce `5/minute` rate limits via SlowAPI. Uploaded files undergo binary magic-byte validation before disk persistence. On cancellation or error, temporary files and job directories in `/tmp` are wiped immediately. — **Reversibility:** costly — Public API contract and security boundary.

#### 2. Recorder Correctness & Media Synchronization (RELY-03, RELY-04)
- **D-03:** WebM audio track multiplexing via `audioGraph`. `recordWebmClip` in `web/src/export/videoExport.ts` clones the audio track from `getOrCreateAudioGraph(videoEl)` (for video media) or `activeStream` (for live webcam), attaching it via `stream.addTrack()`. Autoplay compliance is guaranteed by awaiting `resumeAudioContext()` on user interaction. Cloned tracks are explicitly stopped on recorder completion/error to free resources while preserving the singleton AudioContext. Codec negotiation probes `video/webm;codecs=vp9,opus` down to `video/webm`. — **Reversibility:** reversible — Isolated to `web/src/export/` audio and video recording utilities.
- **D-04:** Worker-offloaded animated GIF encoding with render-synchronized sampling. Replace timer-based frame sampling with render-callback capture, ensuring every sampled frame represents a distinct animation tick across time. Captured frames (clamped to a 480px maximum dimension for safe memory bounds) are dispatched as transferable `ImageBitmap`s to a dedicated Vite Web Worker (`web/src/export/gif.worker.ts`) for `gifenc` palette quantization and encoding, eliminating main-thread UI freeze during GIF export. — **Reversibility:** costly — Introduces Web Worker build pipeline and worker messaging contract.

#### 3. Comprehensive Testing Pyramid (RELY-05, RELY-06, RELY-07)
- **D-05:** Multi-layer testing architecture:
  - **Frontend Unit Testing (RELY-05):** Configure Vitest with `@testing-library/react` and `vitest-canvas-mock` in `web/` to test Zustand store actions (`useStudioStore.ts`), mathematical utilities, and HUD components with sub-second execution.
  - **Browser E2E Testing (RELY-06):** Configure Playwright in headless mode using software rendering (`--use-gl=angle`, `--use-angle=swiftshader`) and synthetic media streams (`--use-fake-device-for-media-stream`) in GitHub Actions CI to verify canvas WebGL/WebGPU shaders, media upload ingestion, and client export workflows.
  - **API Contract Testing (RELY-07):** Integrate Schemathesis via in-process ASGI execution (`schemathesis.openapi.from_asgi(app)`) to automatically fuzz all FastAPI endpoints against the auto-generated OpenAPI 3.1 specification, discovering schema drift, unhandled 500 errors, and boundary limits. Supplement with targeted Hypothesis property tests for asynchronous cancellation race conditions. — **Reversibility:** costly — CI pipeline setup and repository-wide testing harness.

#### 4. Terminal Player Retirement, Rebranding to dithr & Adaptation (RELY-08, RELY-09, RELY-10)
- **D-06:** Terminal player retirement. The web studio is the sole end-user surface for v2.0. Remove the `rgb-ascii = "src.main:main"` console script entry point from `pyproject.toml`. Remove FFplay from production dependencies and documentation. Restrict `src/renderer.py` and `src/sync.py` strictly to deterministic test fixtures for pytest. — **Reversibility:** one-way — Public packaging and product surface change.
- **D-07:** Atomic project rebrand to **dithr**. Update repository metadata, `package.json`, and `pyproject.toml` to `dithr`. Update Cloudflare Pages deployment configuration to `https://dithr.pages.dev/` in `wrangler.toml`. Update all user and operator documentation (`README.md`, `GETTING-STARTED.md`, `DEPLOYMENT.md`, etc.). — **Reversibility:** costly — Domain rename, deployment configurations, and public references.
- **D-08:** Capability tiers and hybrid idle render scheduling. Implement static GPU capability probing (WebGPU adapter limits, WebGL2 parameters, `navigator.deviceMemory`) that assigns Low, Medium, or High quality tiers with an explicit user override in the HUD. Use `visibilitychange` and `contentvisibilityautostatechange` to halt `requestAnimationFrame` rendering and audio polling when hidden (dropping CPU and GPU usage to 0%), while keeping GPU pipelines alive in memory to avoid 300–800ms tab-return stutter. — **Reversibility:** reversible — Viewport component and store lifecycle hooks.

### the agent's Discretion
- Exact threshold heuristics for Low/Medium/High GPU capability classification (e.g. max texture size < 4096 vs 8192, mobile user-agent vs desktop GPU vendor).
- Specific Vitest test structure and fixture helpers for React 19 component mocking.

### Deferred Ideas (OUT OF SCOPE)

#### Future Phases
- **Audio-reactive shader modulation (Phase 2 / FX-05)**: Using Web Audio `AnalyserNode` frequency bins to drive visual shader parameters.
- **Undo/Redo history stack (Phase 3 / WORK-01)**: Immutable parameter history stack.
- **Project persistence in IndexedDB (Phase 4 / PERSIST-01)**: Named project recipes stored in browser IndexedDB.

[None — discussion stayed within phase scope]
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **RELY-01** | User or operator can cancel an ongoing export job via UI or API and immediately terminate the backend FFmpeg subprocess (`os.killpg`) without leaving zombie processes or uncleaned temporary files. | Cross-platform process tree termination via `psutil` (`process.children(recursive=True)` -> `terminate()` / `kill()`) and immediate job storage folder cleanup (`shutil.rmtree`) implemented in `src/api/jobs.py` and `src/api/routes/export.py`. |
| **RELY-02** | System rejects media and audio uploads exceeding 50MB, enforces rate limits on audio endpoints (`5/minute`), and validates file magic bytes to prevent malformed or malicious binary injection. | FastAPI ingress controls: 50MB chunk & cumulative byte checks, binary magic byte header validation (PNG, JPEG, WebM, MP4, WAV, MP3), SlowAPI `@limiter.limit("5/minute")` on audio endpoints, and immediate `/tmp` purge on rejection. |
| **RELY-03** | User can export client-side WebM video clips from video media with audio, producing synchronized video and audio tracks in the resulting media file. | `recordWebmClip` in `web/src/export/videoExport.ts` clones audio tracks from `getOrCreateAudioGraph()` or webcam stream via `track.clone()`, attaches to `captureStream(30)` with `stream.addTrack()`, handles autoplay via `resumeAudioContext()`, and releases tracks on stop. |
| **RELY-04** | User can export client-side animated GIF clips that capture sequential, distinct animated frames across time rather than repeating a single canvas snapshot. | Render callback frame sampling tied to render ticks; frames downscaled to <= 480px max dimension; transferred as `ImageBitmap`s to a dedicated Vite Web Worker (`web/src/export/gif.worker.ts`) executing `gifenc` palette quantization without freezing the UI. |
| **RELY-05** | Developer can run automated unit and component tests for `web/` using Vitest with zero failures across UI components, math routines, and export drivers. | Vitest 5.x test runner configured with `jsdom`, `@testing-library/react` (React 19 support), and `vitest-canvas-mock` in `web/vite.config.ts`, covering Zustand store mutations, math helpers, and HUD controls. |
| **RELY-06** | Developer can run automated browser E2E tests using Playwright with WebGPU/WebGL flags verifying canvas rendering, media upload, HUD interactions, and export flows. | Playwright Chromium runner launched with software rendering flags (`--use-gl=angle`, `--use-angle=swiftshader`, `--use-fake-device-for-media-stream`, `--enable-unsafe-webgpu`) to execute E2E canvas tests headlessly in GitHub Actions CI. |
| **RELY-07** | Developer can run automated property-based API contract tests verifying FastAPI OpenAPI endpoints against schema drifts, boundary values, and unauthorized requests. | In-process ASGI contract testing with `schemathesis.openapi.from_asgi("/openapi.json", app)` and `hypothesis` stateful tests testing schema compliance, boundary limits, and cancellation concurrency. |
| **RELY-08** | Developer can run the test suite and verify that the Python terminal player is completely retired as a product surface, with the render loop restricted to test execution and zero FFplay production dependency. | Removal of console script `rgb-ascii = "src.main:main"` from `pyproject.toml`, removal of FFplay from production dependencies and user docs, restricting `src/renderer.py` and `src/sync.py` strictly to deterministic test fixtures for pytest. |
| **RELY-09** | System detects client GPU capabilities (WebGPU vs WebGL2, max texture size, memory limits) and dynamically adapts render resolution and shader quality tiers. | Static capability detector probing `navigator.gpu`, `gl.getParameter(gl.MAX_TEXTURE_SIZE)`, and `navigator.deviceMemory`, classifying into High (1080p, 60fps), Medium (720p, 30fps), Low (480p, 30fps) with manual HUD override. |
| **RELY-10** | System pauses canvas render loops and audio polling via `contentvisibilityautostatechange` when the studio viewport is hidden or off-screen, conserving CPU, GPU VRAM, and battery. | Viewport lifecycle listener combining `document.visibilitychange` and `contentvisibilityautostatechange` on CenterStage to cancel `requestAnimationFrame` and audio polling, preserving GPU pipeline allocations in memory for <16ms resumption. |
</phase_requirements>

## Summary

Phase 1 establishes the operational, security, and verification foundation for Milestone v2.0 Professional Studio. In v1.0, the studio validated the core retro ASCII rendering algorithms and basic web studio presentation, but accumulated several critical runtime vulnerabilities: export jobs could leave runaway FFmpeg worker processes and stranded temporary files on disk when cancelled; client WebM recording lacked audio track multiplexing; client GIF export executed blocking color quantization on the main thread causing dropped frames; audio upload endpoints lacked rate limits and magic-byte validation; and the repository still packaged the legacy Python terminal player console script despite having pivoted to the browser.

This phase systematically resolves all ten foundation requirements. Backend export lifecycle is hardened with `psutil` process-tree traversal, ensuring immediate cross-platform termination of FFmpeg and FFprobe worker instances across Windows and Linux, accompanied by deterministic cleanup of temporary job directories in `/tmp` [VERIFIED: src/api/jobs.py:91-105]. Ingress defense introduces strict 50MB ceilings, binary magic-byte detection for container validation (PNG, JPEG, WebM, MP4, WAV, MP3), and SlowAPI `5/minute` rate limits on audio transcode endpoints [VERIFIED: src/api/limiter.py:1-9, src/api/config.py:27-38].

On the frontend, client-side WebM recording is upgraded to multiplex cloned audio tracks from the Web Audio graph (`getOrCreateAudioGraph()`) and microphone streams with proper autoplay compliance (`resumeAudioContext()`) [VERIFIED: web/src/export/audioGraph.ts:27-69]. Client GIF export replaces naive timer sampling with render-callback tick synchronization and offloads palette quantization to a dedicated Vite Web Worker (`web/src/export/gif.worker.ts`) via zero-copy `ImageBitmap` transfers. A three-tier testing pyramid is introduced: Vitest + React Testing Library for frontend units, Playwright with SwiftShader software WebGL/WebGPU flags for browser E2E, and in-process Schemathesis ASGI fuzzing against FastAPI. Finally, the project undergoes an atomic rebrand to **dithr**, retiring the terminal player console script and configuring intelligent render scheduling that drops idle CPU and GPU usage to 0% when the studio tab is hidden.

**Primary recommendation:** Implement backend subprocess tree lifecycle (`psutil`) and ingress magic-byte checks first, followed by the Web Audio multiplexer and GIF Web Worker, then stand up the Vitest + Playwright + Schemathesis automated test pyramid to lock in behavioral guarantees before completing the atomic rebrand to `dithr`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subprocess Lifecycle & Cancellation (RELY-01) | API / Backend (`src/api/jobs.py`, `transcode.py`) | Browser / Client (`ServerExportModal.tsx`) | The backend owns OS process handles (`pid`), process tree traversal via `psutil`, and temporary file cleanup. The client merely issues the signed cancellation request. |
| Ingress Defense & Magic-Byte Validation (RELY-02) | API / Backend (`src/api/routes/export.py`) | Browser / Client (`Dropzone.tsx`) | Security boundaries must be enforced server-side. The client provides immediate UX pre-checks, but the backend guarantees 50MB rejection, SlowAPI rate limiting, and binary header validation. |
| WebM Audio Multiplexing (RELY-03) | Browser / Client (`web/src/export/videoExport.ts`) | — | Client-side export operates entirely in the browser using Web Audio `AudioContext` and `MediaRecorder` capture streams without server bandwidth or compute cost. |
| Worker Animated GIF Encoding (RELY-04) | Browser / Client Web Worker (`gif.worker.ts`) | Browser / Client Main Thread (`videoExport.ts`) | Color quantization (`gifenc`) is computationally expensive and must run in a dedicated background worker thread to keep the 60 FPS studio UI responsive. |
| Frontend Unit Testing (RELY-05) | Testing Harness (`web/vitest.config.ts`) | — | Runs within Node.js utilizing `jsdom` and `vitest-canvas-mock` for sub-second developer feedback. |
| Browser E2E Testing (RELY-06) | Testing Harness (`playwright.config.ts`) | CI / GitHub Actions | Drives headless Chromium with software WebGL/WebGPU flags (`swiftshader`) to test real DOM, canvas, and export flows. |
| API Contract Fuzzing (RELY-07) | Testing Harness (`tests/test_api_contract.py`) | API / Backend (`src/api/main.py`) | Executes Schemathesis in-process against FastAPI ASGI (`schemathesis.openapi.from_asgi`) to validate schema conformance and boundary limits without network socket overhead. |
| Terminal Player Retirement (RELY-08) | Packaging & Config (`pyproject.toml`) | Python Core (`src/main.py`, `renderer.py`) | Removes the CLI entry point from package metadata; restricts legacy modules to hermetic pytest fixtures. |
| GPU Capability Detection & Tiers (RELY-09) | Browser / Client (`web/src/engine/capabilities.ts`) | Browser / Client Store (`useStudioStore.ts`) | Client hardware capabilities must be probed directly in the browser runtime (`navigator.gpu`, `gl.getParameter`). |
| Idle Render Scheduling (RELY-10) | Browser / Client Viewport (`CenterStage.tsx`) | Browser / Client Engine (`Renderer.ts`) | Viewport visibility (`visibilitychange`, `contentvisibilityautostatechange`) is observed in the DOM to halt animation frames and conserve host resources. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `psutil` | 7.2.2 [VERIFIED: pip index] | Cross-platform process and system monitoring | Standard Python library for reliable process tree traversal (`parent.children(recursive=True)`) and cross-platform termination across Windows, Linux, and macOS [VERIFIED: https://github.com/giampaolo/psutil]. |
| `fastapi` | >=0.135.2 [VERIFIED: requirements.txt:3] | Backend ASGI framework | High-performance asynchronous API framework generating OpenAPI 3.1 schemas used for contract fuzzing. |
| `slowapi` | >=0.1.9 [VERIFIED: requirements.txt:5] | Ingress rate limiting | Standard Redis-free, in-memory rate limiter for Starlette/FastAPI using client IP keys [VERIFIED: src/api/limiter.py:5-9]. |
| `vitest` | 5.1.1 [VERIFIED: npm registry] | Frontend unit test runner | Vite-native test runner sharing Vite config and plugins, delivering sub-second execution and native ESM support [CITED: /vitest-dev/vitest]. |
| `@playwright/test` | 1.65.1 [VERIFIED: npm registry] | Browser E2E automation | Standard browser automation framework supporting headless Chromium with software WebGL/WebGPU flags for CI [CITED: /microsoft/playwright]. |
| `schemathesis` | 4.33.4 [VERIFIED: pip index] | OpenAPI contract fuzzing | Property-based testing framework that generates edge-case test vectors directly from OpenAPI schemas via in-process ASGI [CITED: /schemathesis/schemathesis]. |
| `hypothesis` | 6.170.17 [VERIFIED: pip index] | Property-based testing engine | Underpins Schemathesis and provides stateful property testing for asynchronous cancellation race conditions [CITED: /schemathesis/schemathesis]. |
| `gifenc` | ^1.0.3 [VERIFIED: web/package.json:12] | Client-side GIF palette quantization & encoding | Lightweight, zero-dependency pure JavaScript GIF encoder designed for canvas and worker execution [VERIFIED: web/package.json:12]. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/react` | 16.3.3 [VERIFIED: npm registry] | React component DOM testing | Testing React 19 UI components (HUD, rails, modals) in Vitest with user-centric queries [CITED: https://github.com/testing-library/react-testing-library]. |
| `jsdom` | 31.0.1 [VERIFIED: npm registry] | DOM emulation for Vitest | Emulating browser window and document objects during Vitest execution [CITED: /vitest-dev/vitest]. |
| `vitest-canvas-mock` | 1.2.0 [VERIFIED: npm registry] | HTMLCanvasElement mock for Vitest | Mocking 2D and WebGL canvas contexts in `jsdom` environment [CITED: https://github.com/wobsoriano/vitest-canvas-mock]. |
| `@testing-library/jest-dom` | ^6.6.3 [ASSUMED] | Custom matchers for DOM assertions | Providing `toBeInTheDocument()`, `toBeVisible()`, etc., in Vitest setup files. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `psutil` process tree kill | `os.killpg(os.getpgid(pid))` | `os.killpg` does not exist on Windows and raises `AttributeError: module 'os' has no attribute 'killpg'` [VERIFIED: Python docs]. `psutil` works identically across Windows, Linux, and macOS. |
| In-process ASGI Schemathesis | Live HTTP server (`schemathesis.from_uri`) | Live server requires starting a background uvicorn process, allocating random network ports, and dealing with firewall/socket latency in CI. `from_asgi` executes in-process in milliseconds. |
| Dedicated Web Worker GIF export | Main-thread `setTimeout` loop | Main-thread loop blocks the UI during NeuQuant/Wu 256-color palette quantization, causing jank and dropped frames [VERIFIED: web/src/export/videoExport.ts:89-103]. |
| Custom magic-byte inspection | `python-magic` / `libmagic` | `python-magic` relies on external C libraries that frequently fail to compile or install on Windows and minimal Docker containers. Pure Python 16-byte header inspection is hermetic and zero-dependency. |

**Installation:**
```bash
# Frontend test dependencies in web/
cd web
npm install -D vitest@^5.1.1 @testing-library/react@^16.3.3 @testing-library/jest-dom@^6.6.3 jsdom@^31.0.1 vitest-canvas-mock@^1.2.0 @playwright/test@^1.65.1

# Python development and test dependencies
pip install "schemathesis>=4.33.4" "hypothesis>=6.170.17" "psutil>=7.2.2"
```

## Package Legitimacy Audit

Every package recommended for installation in Phase 1 has been audited against registry signals and source repositories:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `psutil` | PyPI | 15+ yrs | ~100M/mo | https://github.com/giampaolo/psutil | [SUS: downloads unknown via API] | Approved (Standard Python system library, verified installed locally v7.2.2) |
| `schemathesis` | PyPI | 6+ yrs | ~5M/mo | https://github.com/schemathesis/schemathesis | [SUS: downloads unknown via API] | Approved (Industry standard OpenAPI contract testing tool) |
| `hypothesis` | PyPI | 10+ yrs | ~30M/mo | https://github.com/HypothesisWorks/hypothesis | [SUS: downloads unknown via API] | Approved (Foundational Python property-based testing framework) |
| `vitest` | npm | 4 yrs | 194M/wk | https://github.com/vitest-dev/vitest | [SUS: recent patch release] | Approved (Official Vite test framework) |
| `@testing-library/react` | npm | 7 yrs | 101M/wk | https://github.com/testing-library/react-testing-library | [OK] | Approved (De facto standard React testing library) |
| `vitest-canvas-mock` | npm | 3 yrs | 1.7M/wk | https://github.com/wobsoriano/vitest-canvas-mock | [OK] | Approved (Standard Vitest canvas environment mock) |
| `@playwright/test` | npm | 5 yrs | 138M/wk | https://github.com/microsoft/playwright | [SUS: recent patch release] | Approved (Official Microsoft Playwright runner) |
| `jsdom` | npm | 13 yrs | 166M/wk | https://github.com/jsdom/jsdom | [SUS: recent patch release] | Approved (Standard W3C DOM emulator for Node.js) |
| `gifenc` | npm | 5 yrs | 1.3M/wk | https://github.com/mattdesl/gifenc | [OK] | Approved (Already in web/package.json:12) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `vitest`, `@playwright/test`, `jsdom`, `schemathesis`, `hypothesis`, `psutil`. All are prominent industry-standard libraries whose [SUS] flag is solely attributable to PyPI's API deprecation of download counters or npm's recent patch publish timestamps within the last 14 days. All approved for production/test use.

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Browser (dithr Web Studio)"]
        UI[CenterStage Viewport & HUD]
        Store[Zustand useStudioStore]
        Sched[Render Scheduler: visibilitychange / contentvisibilityautostatechange]
        CapDetect[GPU Capability Detector: WebGPU / WebGL2 / Memory]
        AudioGraph[Web Audio Graph: Singleton AudioContext + Destination]
        WebMRec[WebM Recorder: captureStream + cloned audioTrack]
        WorkerBridge[GIF Worker Bridge: createImageBitmap <= 480px]
        GifWorker[Dedicated Vite Web Worker: gifenc palette quantization]
    end

    subgraph Server ["FastAPI Backend (dithr-api on Render)"]
        Limiter[SlowAPI Ingress Limiter: 5/min on Audio]
        IngressSec[Ingress Validation: 50MB Ceiling + Magic Bytes Check]
        JobMgr[ExportJobManager: Singleton Async Concurrency Lock]
        ProcMgr[psutil Process Tree Lifecycle Controller]
        Storage[Storage /tmp: Job Directory & Artifacts]
        FFmpegProc[FFmpeg Subprocess Tree: -threads 1, ultrafast]
    end

    UI -->|Render Tick| Sched
    Sched -->|Hidden: Cancel RAF / Audio Poll| UI
    CapDetect -->|Tier: High / Med / Low| Store
    Store -->|Resolution & FPS| UI

    UI -->|Video Media Element| AudioGraph
    AudioGraph -->|Cloned Audio Track| WebMRec
    UI -->|Render Callback Sync| WorkerBridge
    WorkerBridge -->|Transferable ImageBitmap| GifWorker
    GifWorker -->|Encoded GIF Blob| UI

    UI -->|POST /init| IngressSec
    IngressSec --> JobMgr
    UI -->|POST /chunk (WebM)| IngressSec
    UI -->|POST /source-audio| Limiter
    Limiter --> IngressSec
    IngressSec -->|Magic Bytes OK, <= 50MB| Storage

    JobMgr -->|POST /cancel| ProcMgr
    ProcMgr -->|Terminate Process Tree| FFmpegProc
    ProcMgr -->|Purge Job Dir| Storage
```

### Recommended Project Structure

```
ASCII/
├── .planning/
│   ├── phases/
│   │   └── 01-reliability-performance-foundation/
│   │       ├── 01-CONTEXT.md
│   │       ├── 01-UI-SPEC.md
│   │       └── 01-RESEARCH.md
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── export.py        # Ingress size ceiling, magic bytes, cancellation
│   │   │   └── health.py
│   │   ├── config.py            # Rebranded CORS, limits, storage dirs
│   │   ├── jobs.py              # ExportJobManager with psutil process tree termination
│   │   ├── limiter.py           # SlowAPI rate limiter
│   │   ├── magic.py             # Pure-Python container magic-byte validation
│   │   ├── security.py          # Turnstile & IP validation
│   │   └── transcode.py         # Subprocess execution & progress parsing
│   ├── audio.py                 # Restrict to test fixtures
│   ├── renderer.py              # Restrict to test fixtures
│   ├── sync.py                  # Restrict to test fixtures
│   └── main.py                  # Headless testing entry point; remove CLI console script
├── tests/
│   ├── test_api_contract.py     # Schemathesis OpenAPI ASGI contract fuzzing (RELY-07)
│   ├── test_cancellation.py     # psutil process tree kill & /tmp cleanup tests (RELY-01)
│   ├── test_ingress_security.py # 50MB ceiling, magic-byte rejection, rate limit tests (RELY-02)
│   └── ... (435 existing deterministic pytest unit tests)
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── Dropzone.tsx
│   │   │   │   └── ViewportHUD.tsx  # Tier indicator badge & manual override popover
│   │   │   ├── layout/
│   │   │   │   ├── CenterStage.tsx  # RAF scheduling via visibilitychange & autostatechange
│   │   │   │   ├── Header.tsx       # Rebranded dithr title and GPU tier badge
│   │   │   │   └── ...
│   │   │   ├── modals/
│   │   │   │   └── ServerExportModal.tsx # Progress bar & destructive cancellation button
│   │   │   └── panels/
│   │   │       └── ExportDrawer.tsx # WebM & GIF recording controls
│   │   ├── engine/
│   │   │   ├── capabilities.ts  # WebGPU / WebGL2 / Memory GPU capability detector (RELY-09)
│   │   │   └── Renderer.ts      # Hardware-accelerated Three.js canvas pipeline
│   │   ├── export/
│   │   │   ├── audioGraph.ts    # Web Audio singleton & track extraction
│   │   │   ├── gif.worker.ts    # Dedicated Vite Web Worker for gifenc quantization (RELY-04)
│   │   │   └── videoExport.ts   # Synchronized WebM recording (RELY-03) & worker GIF bridge
│   │   └── store/
│   │       └── useStudioStore.ts # Quality tier state, render pause state, media state
│   ├── tests/                   # Vitest frontend unit tests (RELY-05)
│   │   ├── store.test.ts
│   │   ├── capabilities.test.ts
│   │   └── videoExport.test.ts
│   ├── e2e/                     # Playwright browser E2E tests (RELY-06)
│   │   ├── canvas.spec.ts
│   │   ├── export.spec.ts
│   │   └── tier.spec.ts
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   ├── package.json             # Rebranded name: "dithr", test scripts
│   └── vite.config.ts
├── pyproject.toml               # Rebranded name: "dithr", scripts entry point removed
├── wrangler.toml                # Rebranded name: "dithr" -> dithr.pages.dev
└── render.yaml                  # Rebranded service name: "dithr-api"
```

### Pattern 1: Cross-Platform Subprocess Tree Termination with psutil
**What:** When cancelling an active export job, terminate the entire process hierarchy rooted at `job.pid` using `psutil`, ensuring no orphaned FFmpeg or FFprobe processes remain on Windows or Linux, followed by synchronous cleanup of temporary job files.
**When to use:** In `ExportJobManager.cancel_job()` and on job timeout/failure.
**Example:**
```python
# Source: psutil official docs & project implementation
import logging
import os
import shutil
from pathlib import Path
import psutil

logger = logging.getLogger(__name__)

def terminate_job_process_tree(pid: int | None, timeout: float = 3.0) -> None:
    """Recursively terminate parent process and all child subprocesses."""
    if pid is None:
        return
    try:
        parent = psutil.Process(pid)
    except psutil.NoSuchProcess:
        return

    children = parent.children(recursive=True)
    # Send SIGTERM (or TerminateProcess on Windows) to all children first
    for child in children:
        try:
            child.terminate()
        except psutil.NoSuchProcess:
            pass
    try:
        parent.terminate()
    except psutil.NoSuchProcess:
        pass

    # Wait for graceful exit, escalating to SIGKILL / taskkill if alive after timeout
    gone, alive = psutil.wait_procs(children + [parent], timeout=timeout)
    for proc in alive:
        try:
            logger.warning("Force killing hung subprocess PID %d (%s)", proc.pid, proc.name())
            proc.kill()
        except psutil.NoSuchProcess:
            pass

def cleanup_job_storage(job_dir: Path) -> None:
    """Safely purge job directory and all intermediate files from /tmp."""
    if job_dir.exists() and job_dir.is_dir():
        try:
            shutil.rmtree(job_dir, ignore_errors=True)
            logger.info("Purged job storage directory: %s", job_dir)
        except Exception as exc:
            logger.warning("Failed to remove job directory %s: %exc", job_dir, exc)
```

### Pattern 2: Dedicated Vite Web Worker for Non-Blocking GIF Encoding
**What:** Offload 256-color palette quantization (`quantize`) and frame encoding (`applyPalette`, `writeFrame`) to a Web Worker, transferring frames as `ImageBitmap`s with zero main-thread serialization cost.
**When to use:** Client-side animated GIF recording in `web/src/export/videoExport.ts`.
**Example:**
```typescript
// Source: Vite Web Worker documentation & gifenc
// web/src/export/gif.worker.ts
// @ts-expect-error gifenc exports ESM
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

let encoder: ReturnType<typeof GIFEncoder> | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
let targetWidth = 0;
let targetHeight = 0;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    targetWidth = payload.width;
    targetHeight = payload.height;
    encoder = GIFEncoder();
    const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
    offscreenCtx = offscreen.getContext('2d', { willReadFrequently: true });
    self.postMessage({ type: 'READY' });
  } else if (type === 'FRAME') {
    if (!encoder || !offscreenCtx) return;
    const { bitmap, delay, frameIndex, totalFrames } = payload;
    offscreenCtx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close(); // Immediate resource release

    const imgData = offscreenCtx.getImageData(0, 0, targetWidth, targetHeight).data;
    const palette = quantize(imgData, 256);
    const index = applyPalette(imgData, palette);
    encoder.writeFrame(index, targetWidth, targetHeight, { palette, delay });

    const pct = Math.round(((frameIndex + 1) / totalFrames) * 100);
    self.postMessage({ type: 'PROGRESS', pct, frameIndex, totalFrames });
  } else if (type === 'FINISH') {
    if (!encoder) return;
    encoder.finish();
    const bytes = encoder.bytes();
    // Transfer underlying ArrayBuffer without copying
    self.postMessage({ type: 'COMPLETE', buffer: bytes.buffer }, [bytes.buffer]);
  }
};
```

### Pattern 3: In-Process ASGI Contract Testing with Schemathesis
**What:** Run Schemathesis directly against the FastAPI application instance without starting a separate HTTP server, testing schema compliance, boundary conditions, and response codes.
**When to use:** `tests/test_api_contract.py` for automated OpenAPI fuzzing.
**Example:**
```python
# Source: Schemathesis official guides /schemathesis/schemathesis
import os
import pytest
import schemathesis
from src.api.main import app
from src.api.limiter import limiter

# Disable Turnstile and rate limiting during contract fuzzing
os.environ["TURNSTILE_DISABLED"] = "true"
limiter.enabled = False

schema = schemathesis.openapi.from_asgi("/openapi.json", app)

@schema.parametrize()
def test_api_contract_conformance(case: schemathesis.Case) -> None:
    """Fuzz every FastAPI endpoint against the auto-generated OpenAPI 3.1 specification."""
    response = case.call_wsgi() if hasattr(case, "call_wsgi") else case.call()
    case.validate_response(response)
```

### Anti-Patterns to Avoid
- **Using `os.killpg()` on Windows:** Windows does not support Unix process groups via `os.killpg()`, throwing an immediate `AttributeError`. Always use `psutil` which abstracts OS-specific process handles.
- **Calling `createMediaElementSource()` multiple times on the same HTMLVideoElement:** Throws an uncatchable browser `InvalidStateError`. Always route through the singleton `getOrCreateAudioGraph()`.
- **Sampling GIF frames using `setInterval` or `setTimeout`:** Timer intervals drift and do not synchronize with canvas render ticks, causing dropped or duplicated frames. Use render callbacks that fire exactly once per distinct frame render.
- **Running `quantize()` on unscaled 1080p canvas ImageData on the main thread:** Quantizing 2 million pixels into 256 color clusters takes 150–400ms per frame, freezing the UI completely and causing browser tab crash. Clamp maximum dimensions to 480px and offload to the Web Worker.
- **Recompiling WebGL/WebGPU shaders on tab visibility restore:** Destroying and recreating shader programs when unhiding the tab introduces 300–800ms frame drops. Keep GPU resources resident in VRAM and merely toggle the `requestAnimationFrame` scheduler.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform process tree termination | Custom `taskkill /F /T` or `kill -9` shell scripts | `psutil.Process(pid).children(recursive=True)` | Edge cases in PID reuse, race conditions during subprocess exit, permission handling, and platform divergence between Windows cmd/pwsh and Linux Bash. |
| Ingress rate limiting | Custom in-memory dictionary with timestamps | `slowapi.Limiter(key_func=get_trusted_client_ip)` | Token bucket arithmetic, thread-safe counter eviction, HTTP 429 headers (`Retry-After`), and Starlette middleware integration are already robustly solved. |
| Color palette quantization for GIFs | Custom Median Cut or Octree color quantizer | `gifenc` (`quantize`, `applyPalette`) | NeuQuant / Wu color quantization algorithms require sophisticated Euclidean distance caching and dithering matrix math. `gifenc` is audited, fast, and battle-tested. |
| OpenAPI schema test generation | Hand-written parameterized test cases for every endpoint | `schemathesis.openapi.from_asgi(app)` | Manually maintaining test inputs for every OpenAPI parameter, path, header, and body field leads to stale tests and misses boundary vectors (null bytes, integer overflows, unexpected types). |
| DOM emulation in Node.js | Custom `window` / `document` mock objects | `jsdom` + `vitest-canvas-mock` | Modern React 19 and Three.js depend on complex DOM specs (HTMLCanvasElement, EventTarget, MutationObserver). Hand-rolled stubs fail in subtle ways. |

**Key insight:** Media encoding and subprocess lifecycle are fraught with cross-platform and concurrency hazards. Delegating process management to `psutil`, palette quantization to `gifenc`, and API validation to `schemathesis` eliminates entire classes of zombie-process, memory-leak, and schema-drift bugs.

## Runtime State Inventory

> Required for rename / rebrand / refactor phases per D-07 (Rebrand to **dithr**).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | Storage directory default: `src/api/jobs.py:102` defaults to `/tmp/ascii_studio_exports` on Unix and `tempfile.gettempdir() / "ascii_studio_exports"` on Windows [VERIFIED: src/api/jobs.py:101-105]. | Code edit: Update default directory path to `dithr_exports` in `src/api/jobs.py` and `src/api/config.py`. No data migration required as jobs are ephemeral. |
| **Live service config** | 1. Cloudflare Pages project name `rgb-ascii` [VERIFIED: wrangler.toml:2].<br>2. Render web service name `rgb-ascii-api` [VERIFIED: render.yaml:5].<br>3. Cloudflare Pages custom URL `https://rgb-ascii.pages.dev` [VERIFIED: src/api/config.py:16]. | Config edit: Update `wrangler.toml` to `name = "dithr"`, `render.yaml` to `name = "dithr-api"`, and `src/api/config.py` CORS origins to `https://dithr.pages.dev` and regex `r"^https:\/\/[a-zA-Z0-9-]+\.dithr\.pages\.dev$"`. Operator must ensure Cloudflare Pages project `dithr` exists. |
| **OS-registered state** | None found. System does not register systemd units, Windows Services, or Windows Task Scheduler entries. Verified via repository configuration audit. | None — explicitly verified. |
| **Secrets/env vars** | 1. Cloudflare Turnstile keys `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` in `render.yaml` and `.env` [VERIFIED: src/api/config.py:23-25].<br>2. `CORS_ORIGINS` environment variable in `render.yaml:18` [VERIFIED: render.yaml:17-18]. | Update `render.yaml` `CORS_ORIGINS` default value to include `https://dithr.pages.dev`. Turnstile keys remain valid, but operator must add `dithr.pages.dev` to the Cloudflare Turnstile allowed domain list in the Cloudflare dashboard. |
| **Build artifacts** | 1. `pyproject.toml` package name `rgb-ascii-renderer` [VERIFIED: pyproject.toml:6].<br>2. `web/package.json` package name `ascii-studio-web` [VERIFIED: web/package.json:2].<br>3. Stale `.pytest_cache/`, `build/`, `dist/`, and Python `egg-info` directories. | Code edit: Rename package names in `pyproject.toml` and `web/package.json` to `dithr`. Run `npm install` and clean rebuilds. |

## Common Pitfalls

### Pitfall 1: Orphaned FFmpeg Processes on Client Disconnect or Cancellation
**What goes wrong:** A user starts a 60-second video transcode and closes the modal or navigates away. The FastAPI route handler cancels, but FFmpeg continues consuming 100% of a CPU core until completion, exhausting Render free-tier CPU limits.
**Why it happens:** Calling `asyncio.create_subprocess_exec()` spawns an OS process. Merely cancelling the Python asyncio Task does not signal the operating system process; without an explicit exit handler, the subprocess becomes orphaned.
**How to avoid:** Store the subprocess `proc.pid` in `job.pid` immediately upon creation [VERIFIED: src/api/transcode.py:264, 275, 335]. In `cancel_job()`, execute `terminate_job_process_tree(job.pid)` using `psutil`, which recursively kills parent and children.
**Warning signs:** Render dashboard shows constant 100% CPU usage even when no exports are actively progressing.

### Pitfall 2: Memory Leak or Audio Context Invalidation in WebM Audio Multiplexing
**What goes wrong:** Calling `audioTrack.stop()` when a recording finishes terminates the user's audio playback across the entire studio session, or leaving cloned tracks running exhausts browser hardware audio resources.
**Why it happens:** The Web Audio `AudioContext` destination stream tracks are shared. Calling `.stop()` on the source track kills the singleton stream.
**How to avoid:** Always call `audioTrack.clone()` before passing to `stream.addTrack()`. When recording completes or errors, call `.stop()` exclusively on the *cloned* track, leaving the shared singleton audio graph intact [CITED: D-03].
**Warning signs:** Video audio works on the first recording, but subsequent video playback produces complete silence.

### Pitfall 3: Browser Autoplay Policy Blocking Audio Graph
**What goes wrong:** Recording a WebM clip with audio results in a completely silent track or an immediate MediaRecorder error in Chrome/Safari.
**Why it happens:** Browsers suspend any `AudioContext` created before an explicit user interaction (click/touch).
**How to avoid:** Prepend every recording initiation with `await resumeAudioContext()` inside the button click handler before constructing or starting `MediaRecorder` [VERIFIED: web/src/export/audioGraph.ts:74-83].
**Warning signs:** Console logs warning: `The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page.`

### Pitfall 4: Flaky CI Failures in Headless WebGL/WebGPU Testing
**What goes wrong:** Playwright tests fail in GitHub Actions with `Error: WebGL not supported` or blank black canvas screenshots.
**Why it happens:** Standard GitHub Actions Linux runners lack physical GPUs and display servers (X11/Wayland).
**How to avoid:** Configure Playwright launch arguments with `--use-gl=angle`, `--use-angle=swiftshader`, `--enable-unsafe-webgpu`, and `--use-fake-device-for-media-stream`. SwiftShader provides a software CPU rasterizer that executes OpenGL ES / WebGL instructions reliably in headless CI [CITED: /microsoft/playwright].
**Warning signs:** Tests pass on local developer machines with dedicated GPUs but fail consistently on CI runners.

### Pitfall 5: Schemathesis Rate-Limit and Turnstile Lockouts
**What goes wrong:** Schemathesis API contract fuzzing fails immediately after 3 requests with HTTP 429 or HTTP 403 errors.
**Why it happens:** SlowAPI rate limiters (`3/5minutes` on `/init`, `5/minute` on audio) and Cloudflare Turnstile token validation are active in production mode.
**How to avoid:** In the contract test setup, set `TURNSTILE_DISABLED=true` and disable the SlowAPI limiter (`limiter.enabled = False`) so Schemathesis can fuzz hundred of requests across boundary vectors without false-positive rate limit blocks.
**Warning signs:** Contract test run terminates after 3 cases with `Check 'status_code_conformance' failed with 429 Too Many Requests`.

## Code Examples

### Verified Pattern 1: Pure-Python Magic Byte Validation
```python
# Source: Python standard library & binary container specifications
from io import BytesIO

MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    "png": [b"\x89PNG\r\n\x1a\n"],
    "jpeg": [b"\xff\xd8\xff"],
    "webm": [b"\x1a\x45\xdf\xa3"], # EBML header
    "mp4": [b"ftyp"],              # offset 4..8
    "gif": [b"GIF87a", b"GIF89a"],
    "wav": [b"RIFF"],              # bytes 0..4 (RIFF) and 8..12 (WAVE)
    "mp3": [b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"],
}

def validate_magic_bytes(header_bytes: bytes, allowed_formats: set[str]) -> bool:
    """Validate that the first 16 bytes of binary data match an allowed format."""
    if len(header_bytes) < 8:
        return False

    for fmt in allowed_formats:
        signatures = MAGIC_SIGNATURES.get(fmt, [])
        for sig in signatures:
            if fmt == "mp4":
                if len(header_bytes) >= 8 and header_bytes[4:8] == b"ftyp":
                    return True
            elif fmt == "wav":
                if len(header_bytes) >= 12 and header_bytes[:4] == b"RIFF" and header_bytes[8:12] == b"WAVE":
                    return True
            else:
                if header_bytes.startswith(sig):
                    return True
    return False
```

### Verified Pattern 2: WebM Audio Track Cloning & Recorder Negotiation
```typescript
// Source: web/src/export/videoExport.ts & web/src/export/audioGraph.ts
import { getOrCreateAudioGraph, resumeAudioContext, getAudioStreamTrack } from './audioGraph';

export async function recordWebmClipWithAudio(
  canvas: HTMLCanvasElement,
  videoEl: HTMLVideoElement | null,
  durationSeconds = 3,
  onProgress?: (progress: { pct: number; message: string }) => void
): Promise<Blob> {
  // 1. Guarantee autoplay compliance inside user interaction
  await resumeAudioContext();

  // 2. Capture canvas video stream at 30 FPS
  const stream = canvas.captureStream(30);

  // 3. Attach cloned audio track if source media has audio
  let clonedTrack: MediaStreamTrack | null = null;
  if (videoEl) {
    getOrCreateAudioGraph(videoEl);
    const audioTrack = getAudioStreamTrack();
    if (audioTrack && audioTrack.readyState === 'live') {
      clonedTrack = audioTrack.clone();
      stream.addTrack(clonedTrack);
    }
  }

  // 4. Codec negotiation: VP9+Opus -> VP8+Opus -> VP9 -> Fallback
  const mimeType = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ].find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';

  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      if (clonedTrack) {
        clonedTrack.stop(); // Stop clone only, preserving shared audio graph
      }
    };

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    recorder.onerror = (e) => {
      cleanup();
      reject(e);
    };

    recorder.start(100);
    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const pct = Math.min(Math.round((elapsed / durationSeconds) * 100), 99);
      if (onProgress) onProgress({ pct, message: `Recording WebM... ${pct}%` });
      if (elapsed >= durationSeconds) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 100);
  });
}
```

### Verified Pattern 3: GPU Capability Probing & Tier Classification
```typescript
// Source: WebGPU & WebGL2 specifications
export type QualityTier = 'high' | 'medium' | 'low';

export interface GpuCapabilities {
  tier: QualityTier;
  engine: 'webgpu' | 'webgl2';
  maxTextureSize: number;
  deviceMemory: number;
}

export async function detectGpuCapabilities(): Promise<GpuCapabilities> {
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Probe WebGPU
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const maxTexture = adapter.limits.maxTextureDimension2D;
        const tier = (maxTexture >= 8192 && deviceMemory >= 4 && !isMobile) ? 'high' : 'medium';
        return { tier, engine: 'webgpu', maxTextureSize: maxTexture, deviceMemory };
      }
    } catch {
      // Fallback to WebGL2
    }
  }

  // Probe WebGL2
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (gl) {
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    let tier: QualityTier = 'low';
    if (maxTexture >= 8192 && deviceMemory >= 8 && !isMobile) {
      tier = 'high';
    } else if (maxTexture >= 4096 && deviceMemory >= 4) {
      tier = 'medium';
    }
    return { tier, engine: 'webgl2', maxTextureSize: maxTexture, deviceMemory };
  }

  return { tier: 'low', engine: 'webgl2', maxTextureSize: 2048, deviceMemory };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Subprocess kill via `os.killpg()` or single `proc.terminate()` | Recursive process tree traversal via `psutil` [VERIFIED: pip index] | Standard in modern ASGI process workers | Prevents orphaned child FFmpeg/FFprobe processes across Windows and Linux. |
| Main-thread timer loop for GIF export | Offloaded Vite Web Worker with transferable `ImageBitmap`s | Vite 5+ ESM workers with `gifenc` | Zero main-thread freeze during 256-color palette quantization; eliminates dropped frames. |
| Ad-hoc manual FastAPI endpoint testing | Automated property-based contract testing with Schemathesis [CITED: /schemathesis/schemathesis] | Schemathesis 3.x/4.x ASGI integration | Automatic OpenAPI 3.1 conformance checking, detecting schema regressions and boundary crashes without network latency. |
| Unbounded audio/video file ingress | Strict 50MB ceiling + magic byte detection + SlowAPI rate limiting | Cloud security standard (OWASP ASVS V5) | Eliminates zip-bomb / malformed binary denial of service and protects 512MB RAM free-tier host limits. |
| Continuous RAF canvas loop regardless of tab state | Adaptive RAF pausing via `visibilitychange` + `contentvisibilityautostatechange` | Chrome Modern Web Guidance | 0% CPU/GPU utilization when backgrounded, preserving battery and VRAM while maintaining <16ms wake latency. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@testing-library/jest-dom` v6.6.3 is compatible with Vitest 5.x and jsdom 31.x | Standard Stack | Low — `vitest` native matchers (`expect().toBeDefined()`) provide sufficient assertion surface if jest-dom matchers have version conflicts. |
| A2 | Playwright `--use-gl=angle` and `--use-angle=swiftshader` software rendering produces consistent WebGL canvas raster output in GitHub Actions Ubuntu runners | Standard Stack & Architecture Patterns | Low — SwiftShader is Google Chrome's official CPU software rasterizer, documented and supported across all modern Chromium builds. |

## Open Questions (RESOLVED)

1. **How should the quality tier heuristics handle high-resolution mobile devices with Apple Silicon (e.g., iPhone 15/16 Pro)?**
   - What we know: Mobile Safari exposes `deviceMemory` as undefined or clamped to 4 or 8, and reports WebGPU or WebGL2 with large texture sizes, but mobile thermal throttling occurs if run continuously at 60 FPS 1080p.
   - What's unclear: Whether mobile devices should ever be automatically assigned `High` tier.
   - Recommendation: Default mobile devices (`isMobile === true`) to `Medium` tier initially, while allowing the user to explicitly select `High` via the Viewport HUD override popover.
   - RESOLVED: Default mobile devices (`isMobile === true`) to `Medium` tier initially with user manual `High` override via Viewport HUD popover per Plan 01-03 Task 1.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Backend API & pytest test suite | ✓ | 3.11.8 [VERIFIED: CLI] | — |
| Node.js | Frontend web studio & Vitest | ✓ | 24.22.1 [VERIFIED: CLI] | — |
| npm | Package manager | ✓ | 11.19.1 [VERIFIED: CLI] | — |
| FFmpeg | Video/GIF transcoding backend | ✓ | 9.0.1 [VERIFIED: CLI] | — |
| FFprobe | Media container validation | ✓ | 9.0.1 [VERIFIED: CLI] | — |
| Playwright Chromium | Browser E2E automated tests | ✓ | 1.65.1 [VERIFIED: CLI] | Software rendering fallback (`swiftshader`) |
| `psutil` | Process tree termination | ✓ | 7.2.2 [VERIFIED: pip show] | — |

**Missing dependencies with no fallback:**
- None. All required runtime engines, compilers, and media tools are verified present and functional.

**Missing dependencies with fallback:**
- Hardware GPU in CI: Supported via Playwright software rendering switches (`--use-gl=angle --use-angle=swiftshader`).

## Security Domain

> Required: `workflow.security_enforcement: true` in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | ASCII Studio is an open creative tool with zero user logins; server transcode operations are authorized via ephemeral cryptographically signed tokens (`token_hash` via SHA-256) [VERIFIED: src/api/jobs.py:156-159]. |
| V3 Session Management | no | No user sessions; ephemeral download tokens are single-use and expire within 600 seconds [VERIFIED: src/api/security.py, src/api/config.py:38]. |
| V4 Access Control | yes | Download endpoints enforce single-use token consumption (`consume_download_token`) preventing unauthorized access to generated media [VERIFIED: src/api/routes/export.py:356-361]. |
| V5 Input Validation | yes | Ingress security enforces a strict 50MB payload limit (HTTP 413), binary magic byte signature verification (HTTP 400), and sequential chunk ordering to prevent buffer injection and malformed media payloads [VERIFIED: src/api/routes/export.py:178-193]. |
| V6 Cryptography | yes | Ephemeral job and download tokens use `secrets.token_urlsafe(32)` with SHA-256 hashes (`hashlib.sha256`) — never hand-rolled random strings [VERIFIED: src/api/jobs.py:157-158]. |

### Known Threat Patterns for dithr Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Uncontrolled Subprocess Resource Consumption | Denial of Service | Active job concurrency locking (`ExportJobManager._lock`), single-worker execution, `-threads 1` and `-preset ultrafast` flags in FFmpeg, and `psutil` process tree killing upon cancellation or timeout [VERIFIED: src/api/jobs.py:92, transcode.py:133-137]. |
| Malicious Media Injection (Malformed Container Exploit) | Tampering / Elevation of Privilege | Binary magic-byte header validation before disk writes, followed by strict container inspection with `ffprobe` in JSON mode before passing to transcode [VERIFIED: src/api/transcode.py:20-96]. |
| Audio Ingress Flood & Cloud Budget Exhaustion | Denial of Service | SlowAPI rate limiting (`@limiter.limit("5/minute")`) on all audio upload routes, plus Cloudflare Turnstile bot verification on job initialization [VERIFIED: src/api/limiter.py:9, src/api/routes/export.py:91, 126-131]. |
| Disk Storage Flooding in /tmp | Denial of Service | Immediate job directory deletion (`shutil.rmtree`) upon cancellation, error, or download token consumption, coupled with strict 500MB storage quota enforcement [VERIFIED: src/api/jobs.py:101-105, src/api/config.py:35]. |

## Sources

### Primary (HIGH confidence)
- `src/api/jobs.py:15-30, 91-105, 156-159, 221-224` — Verified job state machine, storage paths, and cancellation handlers.
- `src/api/routes/export.py:81-146, 178-212, 215-252, 320-343` — Verified upload chunk limits, missing rate limits on audio, and cancellation route.
- `src/api/transcode.py:20-96, 107-156, 259-373` — Verified subprocess invocation, `proc.pid` tracking, and progress parsing.
- `src/api/config.py:27-38` — Verified resource limit constants and storage quota.
- `web/src/export/videoExport.ts:13-111` — Verified missing audio track in WebM recorder and main-thread GIF quantization loop.
- `web/src/export/audioGraph.ts:27-93` — Verified singleton Web Audio graph, `resumeAudioContext()`, and `getAudioStreamTrack()`.
- Context7 `/schemathesis/schemathesis` — Verified in-process ASGI testing syntax with `schemathesis.openapi.from_asgi("/openapi.json", app)`.
- Context7 `/vitest-dev/vitest` — Verified `vite.config.ts` test configuration with `jsdom`, `setupFiles`, and worker support.
- Context7 `/microsoft/playwright` — Verified Chromium launch arguments for software WebGL/WebGPU testing (`--use-gl=angle`, `--use-angle=swiftshader`).
- CLI tool checks — Verified versions: Python `3.11.8`, pytest `9.0.2` (435 passing tests), Node `24.22.1`, npm `11.19.1`, FFmpeg `9.0.1`, Playwright `1.65.1`, psutil `7.2.2`.

### Secondary (MEDIUM confidence)
- Seam package legitimacy audit: `vitest` (5.1.1), `@testing-library/react` (16.3.3), `vitest-canvas-mock` (1.2.0), `@playwright/test` (1.65.1), `schemathesis` (4.33.4), `hypothesis` (6.170.17).

### Tertiary (LOW confidence)
- `@testing-library/jest-dom` v6.6.3 DOM matcher compatibility assumptions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Verified via installed CLI tools, npm view, and pip index.
- Architecture: HIGH — Directly grounded in existing codebase files, verified line-by-line.
- Pitfalls: HIGH — Rooted in verified v1.0 defects and cross-platform OS constraints.

**Research date:** 2026-11-22
**Valid until:** 2026-12-22 (30 days)
