# Phase 1: Reliability & Performance Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-22
**Phase:** 01-reliability-performance-foundation
**Areas discussed:** Upload Ingress Security & Export Lifecycle Cancellation, Recorder Correctness & Media Synchronization, Comprehensive Test Harness Strategy, Terminal Player Retirement, Rebranding to dithr & Adaptive Performance

---

## Upload Ingress Security & Export Lifecycle Cancellation (RELY-01, RELY-02)

| Option | Description | Selected |
|--------|-------------|:--------:|
| psutil Process-Tree Teardown with Strict Streaming Ingress | Unified cross-platform termination via psutil, zero disk overhead, immediate RAM and /tmp reclaim | ✓ |
| OS-Native Session Groups (setsid/taskkill) with Disk Part Staging | Kernel-level process groups with disk part staging for out-of-order chunks | |
| Cooperative Signal Protocol (SIGINT to SIGKILL) with puremagic | 2-second graceful shutdown for inspectable partial files, deep MIME database validation | |

**User's choice:** psutil Process-Tree Teardown with Strict Streaming Ingress
**Notes:** Guaranteed orphan elimination uniformly across local Windows development and Linux production containers without fragile platform branching. Immediate /tmp cleanup releases locks under 512MB RAM ceiling.

---

## Recorder Correctness & Media Synchronization (RELY-03, RELY-04)

| Option | Description | Selected |
|--------|-------------|:--------:|
| Two-Phase Decoupled Capture with Cloned Track Multiplexing | Synchronized audio track multiplexing, render-driven distinct GIF frame capture (max 480px), non-blocking chunked palette encoding | |
| Worker-Offloaded Web Worker Pipeline with Transferable ImageBitmaps | Background Web Worker encoding for higher resolutions/frame rates without main-thread UI lag | ✓ |
| Deterministic Virtual-Clock Frame-Stepped Offline Renderer | Frame-by-frame exact timeline seeking for uploaded video files (incompatible with live webcam) | |

**User's choice:** Worker-Offloaded Web Worker Pipeline with Transferable ImageBitmaps
**Notes:** Offloading `gifenc` to a dedicated Web Worker via transferable `ImageBitmap`s guarantees zero UI hitching. For RELY-03, audio tracks are cloned from `audioGraph` / webcam feeds and multiplexed into the WebM stream with clean lifecycle cleanup on stop/error.

---

## Comprehensive Test Harness Strategy (RELY-05, RELY-06, RELY-07)

| Option | Description | Selected |
|--------|-------------|:--------:|
| Schemathesis-Led Automated Contract & E2E Pyramid | Vitest for web unit tests, Playwright headless browser E2E, and automated Schemathesis contract fuzzing via FastAPI OpenAPI | ✓ |
| Hypothesis Custom Stateful Pyramid & Decoupled E2E | Handcrafted Hypothesis state machines for cancellation races and Playwright with mocked network routes | |
| Passive Conformance (pytest-openapi) with Targeted Hypothesis Invariants | Passive response schema validation over existing 435 pytest tests plus basic Vitest/Playwright tests | |

**User's choice:** Schemathesis-Led Automated Contract & E2E Pyramid
**Notes:** Automated OpenAPI fuzzing via ASGI in-process execution prevents schema drift without writing hundreds of manual endpoint tests. Supplemented by Vitest in `web/` and Playwright headless in CI.

---

## Terminal Player Retirement, Rebranding to dithr & Adaptive Performance (RELY-08, RELY-09, RELY-10)

| Option | Description | Selected |
|--------|-------------|:--------:|
| Tiered Capability Matrix with Hybrid Idle Scheduling & Clean Fixture Isolation | Low/Med/High tiers with manual override, 0% CPU/GPU idle when hidden without reload stutter, atomic rebrand to dithr across configs/docs and Cloudflare to dithr.pages.dev | ✓ |
| Conservative Cutover with RAF Pause | Simple RAF suspension on hidden tab and basic WebGPU/WebGL toggle, full rebrand to dithr across configs and docs | |
| Dynamic Frame-Budget Profiler with Aggressive GPU Hibernation | Dynamic FPS-based downscaling and complete GPU context release on backgrounding (incurs 300-800ms tab-return stutter), full rebrand to dithr | |

**User's choice:** Tiered Capability Matrix with Hybrid Idle Scheduling & Clean Fixture Isolation
**Notes:** User explicitly instructed renaming the project/repo to "dithr" and updating the Cloudflare Pages domain to `https://dithr.pages.dev/`. Terminal player CLI script is archived; Python render loop is restricted to test fixtures.

---

## the agent's Discretion
- Heuristics for Low/Medium/High capability tier detection based on WebGPU and WebGL2 capabilities.
- Mocking setup for React 19 in Vitest.

## Deferred Ideas
- Phase 2: Audio-reactive shader modulation (FX-05).
- Phase 3: Undo/Redo parameter history stack (WORK-01).
- Phase 4: IndexedDB project recipes and cloud synchronization (PERSIST-01).
