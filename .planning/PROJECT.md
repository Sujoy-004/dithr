# RGB ASCII & Retro FX Studio

## What This Is

A modern, high-performance browser-based retro visual effects and ASCII studio for images, videos, and live webcam streams. It delivers instant, GPU-accelerated client-side previews (ASCII, dithering, halftone, CRT/VHS, matrix rain, and color grading) alongside a Python FastAPI backend for high-fidelity FFmpeg-driven exports and processing. Built for digital artists, designers, and terminal enthusiasts seeking versatile retro graphics in a responsive studio interface. As of v2.0, the browser Studio is the sole end-user product surface; the Python terminal player is retired.

## Core Value

Instant, real-time retro visual transformations and high-fidelity media export across web and video formats, operating reliably at $0/month on free-tier cloud infrastructure.

## Current Milestone: v2.0 Professional Studio

**Goal:** Turn the shipped v1.0 studio into a dependable, professional creative application — retire the terminal player as a product surface, make performance measurable, rebuild rendering as a composable engine, add real editing and export workflows, then make work durable and shareable.

**Target features:**

- **Phase 1 — Reliability & Performance Foundation**: P0 security and lifecycle fixes (upload hardening, export cancellation, recorder/audio synchronization, GPU resource cleanup, backend lifecycle), frontend unit tests + browser E2E + API contract verification, terminal player retirement, capability detection, intelligent render scheduling, GPU memory monitoring, pipeline caching, and a benchmark suite.
- **Phase 2 — Shader Engine 2.0 & Advanced FX**: composable multi-effect pipeline first, then corrected existing shader algorithms, RGB separation / color grading / masking, advanced CRT/VHS/dithering, audio-reactive and procedural effects, then 3D ASCII and AI assistance.
- **Phase 3 — Creative Workspace & Export Studio**: non-destructive editing history, undo/redo, temporary session recovery, layers, keyframes, before/after comparison, preview-faithful production exports, and an export queue.
- **Phase 4 — Persistence, Community & Distribution**: permanent named projects, IndexedDB storage, autosave, optional Neon accounts and cloud sync, preset marketplace, share links, and embeddable distribution.

**Phase completion gates:** A phase is complete only when its observable behavior is verified by automated tests — never because the code compiles. Phase 1 specifically requires passing coverage for export cancellation, media lifecycle, upload security, and browser workflows.

## Requirements

### Validated

- ✓ RGB24 pixel to Rec. 601 perceived luminance mapping — existing (`src/renderer.py`)
- ✓ 24-bit True Color ANSI escape generation and half-block (`\u2580`) color packing — existing (`src/renderer.py`)
- ✓ Area-averaging (`resize_rgb24_area`) and nearest-neighbor resampling — existing (`src/renderer.py`)
- ✓ Subprocess FFmpeg video decoding with stream error and container diagnostics — existing (`src/video.py`)
- ✓ Temporal smoothing (`TemporalSmoother`) exponential RGB24 blending — existing (`src/smoothing.py`)
- ✓ Frame pacing and deadline scheduling models (`FrameClock`, `PlaybackTimeline`) — existing (`src/timing.py`, `src/sync.py`)
- ✓ Codebase Modernization: headless frame sink protocol, 36-symbol public facade, 100% type/lint health — v1.0 (`src/__init__.py`)
- ✓ Stitch MCP UI/UX Redesign: monochrome Grainrad-inspired theme tokens, three-column docked studio layout, responsive Viewport HUD — v1.0 (`web/src/`)
- ✓ Client-Side FX Pipeline: 60 FPS Three.js WebGPU / TSL engine with automatic WebGL2 fallback, dynamic monospace atlas, and 16 retro shaders — v1.0 (`web/src/engine/`)
- ✓ Multi-Format Media Ingestion: Drag-and-drop local image/video files at native aspect ratios, plus live browser webcam stream via `getUserMedia` — v1.0 (`web/src/components/`)
- ✓ Client-Side Multi-Format Export: Instant raster PNG/JPEG, monochrome/TrueColor vector SVG, Rec. 601 plain text (`.txt`), and quick WebM/GIF clips — v1.0 (`web/src/export/`)
- ✓ Production FastAPI Microservice: Turnstile bot protection, Cloudflare CIDR validation, constant-time `X-Job-Token` checks, single-use download tokens, and SlowAPI rate limiting — v1.0 (`src/api/`)
- ✓ Low-Memory Server Transcoding: Bounded chunk sequencer, Web Audio graph persistence, DPI decoupling (1080p/720p), and low-memory FFmpeg video/GIF transcode (<137MB RSS) — v1.0 (`src/api/transcode.py`)
- ✓ Git-Driven $0/Month Infrastructure: Cloudflare Pages edge hosting (`wrangler.toml`), Render Python Web Service (`render.yaml`), and Neon PostgreSQL schema scaffolding (`docs/database-schema.sql`) — v1.0

### Active (v2.0 Professional Studio)

- [ ] **Phase 1 — Reliability & Performance Foundation**: Every existing feature is dependable, measured, and covered by frontend unit, browser E2E, and API contract tests; the terminal player is retired from the product surface.
- [ ] **Phase 2 — Shader Engine 2.0 & Advanced FX**: A composable effect pipeline built on corrected algorithms, with RGB separation, color grading, masking, advanced retro effects, audio-reactive/procedural effects, 3D ASCII, and AI assistance.
- [ ] **Phase 3 — Creative Workspace & Export Studio**: Non-destructive editing history, undo/redo, temporary session recovery, layers, keyframes, and preview-faithful production exports.
- [ ] **Phase 4 — Persistence, Community & Distribution**: Permanent named projects, IndexedDB storage, autosave, optional accounts and cloud sync, preset marketplace, share links, and embeddable distribution.

### Out of Scope

- Terminal player as an end-user product — Retired in v2.0. The browser Studio is the only supported product surface; the Python render loop survives only where the automated test suite requires it, and FFplay audio is test-only.
- Terminal interactive playback engine — Pivoted entirely to Web platform; terminal-only components (`src/terminal.py`) archived.
- Proprietary Grainrad source code or branding duplication — Clean-room functional reproduction of retro shader and export features.
- Mandatory user auth or paid cloud databases — Anonymous use remains fully supported. v2.0 adds optional accounts, never a login wall; all persistence targets free-tier storage.
- Dedicated cloud GPU instances — Real-time processing runs on client hardware (WebGPU/Canvas), exports run on free CPU compute.
- Unbounded video file uploads — Enforced 60-second video length limit on video exports to guarantee stability within 512MB RAM.

## Context

- Shipped Milestone v1.0 with 18,162 lines of code across Python (12,780 LOC) and TypeScript (5,382 LOC).
- Frontend: React 19, Vite 8, Tailwind CSS v4, Three.js WebGPU / TSL, deployed on Cloudflare Pages (`https://rgb-ascii.pages.dev`).
- Backend: Python 3.10+, FastAPI, Uvicorn, FFmpeg, deployed on Render Free Web Service (`render.yaml`).
- Database Scaffolding: Neon Serverless PostgreSQL schema (`docs/database-schema.sql`) prepared for v2.0 project and preset persistence.
- Complete suite of 435 automated tests passing with zero regressions, strict type safety (`mypy`), and fast linting (`ruff`).
- v2.0 consolidates the eight-phase wishlist into four roadmap phases by engineering concern: reliability + performance, rendering engine + advanced FX, editing + export, persistence + community. All wishlist content is retained; only ordering changes.
- Verified v1.0 gaps driving Phase 1: `POST /api/export/{id}/source-audio` has no rate limit, size ceiling, or safe extension handling; chunk `chunk_index` is never validated for order or idempotency; cancellation flips job state without stopping the FFmpeg task; client WebM recording captures video only; client GIF recording repeats one canvas frame instead of re-rendering; `web/` has no test runner at all.

## Constraints

- **Budget**: $0/month strict target across all cloud services (Cloudflare Pages free tier, Render free tier web service, Neon free tier).
- **Tech Stack (Frontend)**: Modern SPA (Vite / React / TypeScript / Tailwind CSS / WebGPU / Canvas) deployed to Cloudflare Pages.
- **Tech Stack (Backend)**: Python 3.10+ with FastAPI, Uvicorn, and FFmpeg deployed to Render via `render.yaml`.
- **Product Surface**: Browser Studio is the only end-user surface as of v2.0. Python terminal playback is retired; the render loop is test-only and FFplay audio is never a production dependency.
- **UI Approval Gate**: All Stitch MCP visual designs must be reviewed and explicitly approved by the user before frontend code implementation begins.
- **Hermetic Testing**: Comprehensive unit and integration test coverage maintained throughout modernization and expansion. Browser E2E and API contract tests are required for unreliable surfaces, not optional.
- **Phase Completion**: Behavioral verification is mandatory — a phase cannot close on compile success alone.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid Client FX + Backend Export | Client-side shaders provide 60fps interactive parameter adjustments; backend provides heavy FFmpeg video rendering | ✓ Good (60fps preview with 0 server CPU; transcode peak RSS 136.29 MB < 512 MB ceiling) |
| Pivot Entirely to Web Application | Maximizes user accessibility and aligns with modern creative workflow; terminal player archived | ✓ Good (Web studio deployed to Cloudflare Pages; live at rgb-ascii.pages.dev) |
| Stateless v1 Utility Mode | Eliminates authentication hurdles and database runtime costs, achieving instant $0/month deployment | ✓ Good (Zero cloud bills, instant friction-free access) |
| Git-Driven Deployment (`render.yaml` & `wrangler.toml`) | Infrastructure-as-code enables reproducible single-push deployments to Cloudflare and Render | ✓ Good (Automated deployment directly from main branch) |
| Client-Side WebGPU Shaders with TSL | Next-generation WebGPU performance with clean WebGL2 fallback via Three.js node system | ✓ Good (60 FPS rendering across WebGPU and WebGL2 hardware) |
| DPI Decoupling & Bounded Backpressure | Protects export render quality from viewport zoom and client memory bloat | ✓ Good (Predictable 1080p/720p output with max 5 chunks in flight) |
| Consolidate v2.0 into four phases | Retains all eight wishlist areas while reducing milestone overhead; pairs work by engineering concern and dependency order | — Pending |
| Retire terminal player as a product | Web Studio is the sole product; terminal playback adds maintenance surface and FFplay runtime dependencies with no user base | — Pending |
| Performance foundation before engine rebuild | Benchmarks, render scheduling, and capability detection must exist before Phases 2–3 so regressions are detectable rather than assumed | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-21 after starting v2.0 milestone*
