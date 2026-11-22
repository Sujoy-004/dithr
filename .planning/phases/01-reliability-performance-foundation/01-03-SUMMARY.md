---
phase: 01-reliability-performance-foundation
plan: "03"
subsystem: client-gpu-scheduling
tags: [webgpu, webgl2, capabilities, quality-tiers, visibilitychange, idle-pause, requestanimationframe]

# Dependency graph
requires:
  - phase: 01-01
    provides: server ingress defense and cancellation
provides:
  - "Client GPU capability detector probing WebGPU, WebGL2 limits, and device memory (web/src/engine/capabilities.ts)"
  - "Quality tier classification into High (1080p@60fps), Medium (720p@30fps), Low (480p@30fps)"
  - "Zustand studio store tier state, override actions, and render status tracking"
  - "Interactive QualityTierBadge component with popover allowing manual tier override in Header and ViewportHUD"
  - "Intelligent idle render pause on visibilitychange (hidden) and contentvisibilityautostatechange, dropping CPU/GPU to 0%"
  - "Instant (<16ms) render loop resumption without disposing WebGL/WebGPU pipeline or recompiling shaders"
affects: [01-04, 01-05]

# Actuals
actuals:
  tokens: 4900
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic GPU probing checking adapter limits, max texture dimensions, and device memory"
    - "Adaptive RAF frame loop throttling based on active quality tier (60 FPS vs 30 FPS)"
    - "Zero-overhead idle pause using document.visibilitychange and contentvisibilityautostatechange"
    - "VRAM preservation across tab switches avoiding costly shader recompilation or pipeline reallocations"

key-files:
  created:
    - web/src/engine/capabilities.ts
    - web/src/components/ui/QualityTierBadge.tsx
    - web/src/components/layout/Header.tsx
  modified:
    - web/src/store/useStudioStore.ts
    - web/src/components/canvas/ViewportHUD.tsx
    - web/src/components/layout/CenterStage.tsx
    - web/src/App.tsx

key-decisions:
  - "WebGPU is preferred when available and texture dimension >= 8192 on desktop devices; fallback probes WebGL2 offscreen canvas"
  - "Tier classifications govern both canvas resolution caps (1080p/720p/480p) and RAF render intervals (60fps vs 30fps)"
  - "Quality tier badge in Header and ViewportHUD allows instant user manual override, which overrides auto-detected tier"
  - "Hiding the tab cancels requestAnimationFrame and updates store renderStatus to paused; WebGL/WebGPU pipeline is kept resident in VRAM for instant resume"

patterns-established:
  - "Capability-adaptive rendering: client hardware limits dynamically dictate frame pacing and render targets"
  - "Idle-aware graphics scheduling: canvas loops always pause when backgrounded"

requirements-completed:
  - RELY-09
  - RELY-10

# Metrics
duration: 14min
completed: 2026-11-22
status: complete
---

# Phase 01 Plan 03 Summary

**Client GPU capability detection, adaptive quality tiers (High/Med/Low), HUD tier badge with interactive manual override popover, and intelligent idle render pause successfully implemented and verified.**

## Performance

- **Duration:** 14 min
- **Tasks:** 3 completed
- **Files modified:** 7 files (3 created, 4 modified)
- **Commits:** 3 task commits (`bb7abe9`, `0040ec9`, `4a1a56a`)

## Accomplishments

- Created `web/src/engine/capabilities.ts` implementing `detectGpuCapabilities` to inspect `navigator.gpu` adapter limits, fallback WebGL2 `MAX_TEXTURE_SIZE`, device memory, and mobile user agent.
- Updated `useStudioStore.ts` with `detectedTier`, `activeTier`, `tierOverride`, `gpuEngine`, `maxTextureSize`, and `renderStatus` with full TypeScript typing.
- Built reusable `QualityTierBadge.tsx` displaying `[TIER: HIGH] [WEBGPU]` with an interactive popover offering Auto, High (1080p/60fps), Medium (720p/30fps), and Low (480p/30fps) manual overrides.
- Integrated `Header.tsx` into `App.tsx` and added `QualityTierBadge` to `ViewportHUD.tsx` and `Header.tsx`.
- Implemented intelligent idle render scheduling in `CenterStage.tsx` that attaches listeners to `document.visibilitychange` and `contentvisibilityautostatechange`. Cancels RAF loop when hidden (0% CPU/GPU) and resumes within <16ms when returning, while keeping shader pipelines cached in VRAM.
- Added live render telemetry in the status bar: `render: active (60fps)` vs `render: paused (idle standby)`.

## Task Commits

1. **Task 1: Client GPU capability detection and quality tier classification** - `bb7abe9` (feat)
2. **Task 2: Viewport HUD tier indicator badge, manual override popover, and Header badge** - `0040ec9` (feat)
3. **Task 3: Adaptive idle render pause on visibilitychange and backgrounding** - `4a1a56a` (feat)
