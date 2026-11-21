# Project Research Summary

**Project:** RGB ASCII & Retro FX Studio
**Domain:** Browser-Based Real-Time Visual Effects & Media Processing Studio (Milestone v2.0 Professional Studio)
**Researched:** 2026-11-21
**Confidence:** HIGH

## Executive Summary

Milestone v2.0 transforms the shipped v1.0 ASCII & Retro FX Studio into a dependable, professional creative workstation operating with zero cloud bills on free-tier infrastructure ($0/month target). The terminal player is retired as a product surface, focusing 100% of product engineering on the browser Web Studio. To achieve professional quality, the application is anchored on Google Chrome's Modern Web Guidance (`https://github.com/GoogleChrome/modern-web-guidance`), adopting native web platform primitives—such as `structuredClone()` for immutable history, `AbortSignal.timeout()` / `AbortSignal.any()` for composite cancellation, `contentvisibilityautostatechange` for GPU throttling, and native Web Audio API `AnalyserNode` for real-time FFT audio reactivity.

The technical architecture pairs client-side Three.js WebGPU / TSL real-time multi-pass rendering (with automated WebGL2 fallback) for 60 FPS viewport interaction with a Python FastAPI backend for low-memory FFmpeg video exports. In v2.0, the rigid 4-stage pipeline evolves into a fully composable multi-effect node graph, backed by a non-destructive undo/redo history stack, local IndexedDB project persistence via `idb`, and URL-compressed preset sharing via `lz-string`.

Key architectural risks include WebGPU VRAM memory leaks during frequent effect toggling, FFmpeg subprocess zombie leaks on export cancellation, MediaRecorder audio/video synchronization drift, and main-thread INP task congestion during audio FFT analysis and client GIF encoding. These risks are mitigated upfront through automated Vitest unit testing, Playwright headless browser E2E verification with WebGPU flags, and property-based API contract testing before advancing into advanced creative features.

## Key Findings

### Recommended Stack

v2.0 expands the existing modern web stack (React 19, Three.js 0.187+, Tailwind CSS v4, FastAPI) with lightweight, high-performance libraries that strictly uphold the $0/month budget:

- **Frontend Testing & Verification**: `vitest` (`^3.0.7`) + `@testing-library/react` (`^16.2.0`) for fast component and unit tests in `web/`; `playwright` (`^1.50.1`) with Chromium `--enable-unsafe-webgpu` flags for real headless browser E2E testing.
- **Client Storage & State**: `idb` (`^8.0.2`) for Promise-based IndexedDB project persistence; native `structuredClone()` and modern non-mutating array operations (`toSpliced`, `with`) for immutable undo/redo history; `lz-string` (`^1.5.0`) for compressed URL hash preset sharing.
- **Audio & Media**: Native Web Audio API (`AudioContext`, `AnalyserNode`, `MediaStreamAudioDestinationNode`) for zero-bundle audio reactivity and audio-video stream multiplexing.
- **Backend & Contracts**: `schemathesis` (`^3.39.11`) and `pytest-asyncio` for FastAPI OpenAPI contract verification; `psutil` (`^7.2.2`) for process group tracking and memory RSS ceilings.
- **Cloud Database (Optional)**: `@neondatabase/serverless` for connection-pooled serverless PostgreSQL syncing without mandatory login gates.

### Expected Features

**Must have (Table Stakes — Phase 1 & 2):**
- P0 Security & Lifecycle: Export cancellation terminating FFmpeg subprocess (`os.killpg`), upload size ceiling (50MB) and magic byte validation, audio/video synchronized WebM recording, multi-frame animated GIF recording.
- Automated Test Suite: Complete Vitest unit suite, Playwright browser E2E suite, and FastAPI contract tests.
- Terminal Player Retirement: Python render loop made test-only; terminal-specific entry points and FFplay runtime dependencies removed.
- Composable Multi-Effect Shader Engine: Stacking, reordering, and toggling multiple retro visual passes dynamically in Three.js TSL.
- Non-Destructive Undo/Redo: Keyboard shortcut (Ctrl+Z / Ctrl+Y) history stack restoring shader parameters and visual state.

**Should have (Competitive Differentiators — Phase 2 & 3):**
- Audio-Reactive Shaders: Live microphone and audio track FFT frequency spectrum driving shader uniforms (bass, mid, treble).
- Advanced CRT & VHS Emulation: Authentic phosphor decay, chromatic aberration, tape tracking jitter, and blooming.
- Multi-Layer Composition & Keyframes: Overlaying multiple visual layers with time-interpolated parameter keyframes.
- Local Project Persistence & Autosave: Named projects saved to browser IndexedDB with zero-friction restore.
- Zero-Cost Preset Sharing: Compressed URL hash links (`#recipe=...`) for instant setup sharing.

**Defer (v2+ / Future):**
- Complex multi-track NLE timeline video editing (audio trimming, multi-track transitions).
- Mandatory user accounts and paid cloud storage tiers.

### Architecture Approach

The architecture maintains a strict separation between real-time client interaction and heavy asynchronous media transcoding:
1. **Frontend Engine**: Three.js WebGPU / TSL composable pass pipeline managing ping-pong render targets, controlled by Zustand reactive stores and an immutable command history manager.
2. **Audio Subsystem**: Web Audio API singleton maintaining continuous audio graphs for speaker output, frequency spectrum analysis, and MediaRecorder stream capture.
3. **Storage Subsystem**: Local IndexedDB repository storing project parameter recipes and custom character ramps, with optional cloud backup to Neon Serverless PostgreSQL.
4. **Backend Export Service**: Async FastAPI microservice executing FFmpeg in dedicated process groups with bounded chunk backpressure and active cancellation monitoring.

### Critical Pitfalls

1. **FFmpeg Subprocess Zombie Leaks**: Canceling an export job without killing the process group leaves FFmpeg running indefinitely on the Render free tier, consuming 100% CPU and triggering 512MB RAM OOM crashes. *Mitigation:* Spawn with `start_new_session=True` and kill via `os.killpg(pid, SIGTERM)`.
2. **MediaRecorder Audio/Video Track Desync**: Capturing canvas streams without synchronizing Web Audio destination timestamps produces silent or lagging WebM exports. *Mitigation:* Multiplex canvas video tracks with Web Audio destination tracks into a unified `MediaStream`.
3. **WebGPU Context Loss & VRAM Leaks**: Dynamically compiling and destroying TSL passes without invoking `.dispose()` on underlying textures and render targets exhausts GPU memory. *Mitigation:* Implement explicit pass pooling and resource disposal lifecycles.
4. **Main Thread INP Freezing During Analysis**: Running synchronous 2048-bin FFT loops or GIF frame quantization freezes the browser UI. *Mitigation:* Follow Modern Web Guidance: use `scheduler.yield()` task slicing and downsample FFT bands to bass/mid/treble floats.
5. **IndexedDB Quota Exceeded**: Storing raw video files in IndexedDB triggers browser quota rejection. *Mitigation:* Store lightweight parameter recipes and custom ASCII ramps; reference video files via blob URLs.

## Implications for Roadmap

The research reinforces and validates the four-phase milestone structure planned for Milestone v2.0:

### Phase 1: Reliability & Performance Foundation
- **Rationale:** The v1.0 studio has verified gaps (uncancelled FFmpeg processes, silent WebM recording, single-frame GIFs, unhardened uploads, zero frontend tests). Building advanced shaders or workspace features on top of an unstable, untested core would multiply defects.
- **Delivers:** P0 security and cancellation fixes, synchronized audio/video recorder, animated GIF recorder, Vitest unit testing, Playwright browser E2E test suite, API contract tests, terminal player retirement, capability detection, and render scheduling via `content-visibility: auto`.
- **Addresses:** Export cancellation, media recorder sync, upload security, test coverage.
- **Avoids:** FFmpeg zombie leaks, audio/video desync, CI/deployment regressions.

### Phase 2: Shader Engine 2.0 & Advanced FX
- **Rationale:** A modular, composable effect pipeline is required before creative workspace features (like layers, keyframes, and history) can operate on discrete effect nodes.
- **Delivers:** Composable Three.js TSL multi-pass pipeline, corrected Rec. 601 / Rec. 709 color math and gamma blending, RGB separation and masking, advanced CRT/VHS analog emulation, Web Audio API FFT audio-reactive uniforms, and 3D ASCII point cloud rendering.
- **Addresses:** Composable shader chaining, audio-reactive visualizer, retro analog FX.
- **Avoids:** WebGPU context loss, rigid monolithic shader coupling, incorrect color banding.

### Phase 3: Creative Workspace & Export Studio
- **Rationale:** Once the shader engine is composable and capable of advanced FX, artists need professional tools to experiment non-destructively, animate parameters, and export high-resolution media.
- **Delivers:** Non-destructive Undo/Redo history stack (`structuredClone`), temporary crash recovery, multi-layer composition, keyframe parameter animation timeline, before/after split view, and preview-faithful export queue.
- **Addresses:** Undo/Redo history, layer compositing, parameter keyframing, production exports.
- **Avoids:** Accidental state loss, export discrepancy between preview and final video.

### Phase 4: Persistence, Community & Distribution
- **Rationale:** Projects created in the workspace must be durable across sessions and shareable with other digital artists without requiring expensive servers.
- **Delivers:** Permanent named project storage in browser IndexedDB (`idb`) with schema migrations and autosave, compressed URL hash preset sharing (`lz-string`), optional Neon Serverless PostgreSQL cloud backup with stateless JWT auth, and embeddable web component player.
- **Addresses:** Project persistence, preset sharing, cloud sync, community distribution.
- **Avoids:** IndexedDB quota exhaustion, user account friction, cloud infrastructure costs.

### Phase Ordering Rationale

- **Phase 1 before Phase 2**: Automated tests and cancellation supervision must be in place to detect regressions and handle compute-intensive shaders safely.
- **Phase 2 before Phase 3**: Keyframe animation and layers directly manipulate individual effect passes in the composable pipeline; the pipeline must be modular before keyframes can modulate parameters.
- **Phase 3 before Phase 4**: The project schema, layer structure, and keyframe format must be finalized before building the IndexedDB storage layer and cloud backup tables.

### Research Flags

- **Phase 1 (Standard Patterns):** Subprocess cancellation, Vitest, Playwright, and upload validation follow well-documented industry patterns. Skip extra research-phase; plan directly.
- **Phase 2 (Deeper Research Needed):** Three.js WebGPU / TSL node-based pass compositing (`three/tsl` `PassNode` & `postProcessing`) is rapidly evolving in Three.js 0.187+. Flag for targeted research on exact TSL pass chaining and texture pooling during Phase 2 planning.
- **Phase 3 (Standard Patterns):** Undo/Redo with `structuredClone()` and timeline keyframing are well-understood client patterns.
- **Phase 4 (Standard Patterns):** `idb` IndexedDB integration and Neon serverless connection pooling have established documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core libraries verified in live project or via Context7; versions compatible with React 19, Three.js 0.187, and Vite 8. |
| Features | HIGH | Table stakes and differentiators directly derived from verified v1.0 gaps and user roadmap requirements. |
| Architecture | HIGH | Hybrid client-side WebGPU + backend FFmpeg transcode proven in v1.0; composable node pipeline is natural evolution. |
| Pitfalls | HIGH | Subprocess leaks, MediaRecorder track desync, and audio autoplay policies verified directly in codebase audit. |

**Overall confidence:** HIGH

### Gaps to Address

- **Three.js TSL Multi-Pass API Nuances:** Three.js `three/tsl` post-processing pass composition syntax continues to be refined in recent releases. Address by validating exact TSL ping-pong pass nodes during Phase 2 planning.
- **Playwright WebGPU in Headless CI:** Headless Chromium requires `--enable-unsafe-webgpu` and `--use-gl=angle` flags to run WebGPU in containerized environments. Address during Phase 1 test harness setup.

## Sources

### Primary (HIGH confidence)
- Google Chrome Modern Web Guidance (`https://github.com/GoogleChrome/modern-web-guidance`) — Web platform standards: `performance`, `js`, `security`, `accessibility`.
- Three.js WebGPU & TSL Specification (`https://threejs.org/docs/`) — Node-based shading language and WebGPU renderer.
- W3C Media Capture and Streams / Web Audio API specifications — Synchronized audio/video track recording and FFT analysis.
- Live codebase audit of `ASCII/` (`web/src/engine/Pipeline.ts`, `src/api/transcode.py`, `web/src/export/videoExport.ts`).

### Secondary (MEDIUM confidence)
- Jake Archibald's `idb` IndexedDB Promise wrapper documentation.
- Vitest 3 and Playwright 1.50 official documentation for Vite 8 and React 19 test harnesses.

---
*Research completed: 2026-11-21*
*Ready for roadmap: yes*
