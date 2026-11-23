---
phase: 261123-rvj-fix-export-drawer-and-obstacles
plan: 01
subsystem: export-engine
tags: [export, webm, gif, client-recording, media-recorder, palette-a11y, fallback]
status: complete
requires:
  - 261123-rbc-proof-shader-matrix-experiments
provides:
  - client-side-webm-export
  - client-side-gif-export
  - server-export-fallback-banner
  - palette-data-effect-ids
affects:
  - web/src/components/panels/ExportDrawer.tsx
  - web/src/components/modals/ServerExportModal.tsx
  - web/src/components/layout/LeftRail.tsx
  - web/vitest.config.ts
tech-stack:
  added: []
  patterns:
    - In-browser MediaRecorder canvas capture stream with duration & progress bar
    - Web Worker client-side GIF encoding with dimension clamping
    - Descriptive filename generator using current mediaName
    - One-click client export fallback in ServerExportModal when container is warming
key-files:
  created:
    - web/src/tests/exportDrawer.test.tsx
    - scripts/verify_export_fixes.js
  modified:
    - web/src/components/panels/ExportDrawer.tsx
    - web/src/components/modals/ServerExportModal.tsx
    - web/src/components/layout/LeftRail.tsx
    - web/vitest.config.ts
decisions:
  - "Provided prominent in-browser WebM and GIF recording triggers directly inside ExportDrawer so users on static hosts (Cloudflare Pages) or offline never encounter 404/waking blockers."
  - "Preserved Studio Engine Export (Cloud MP4/GIF) alongside in-browser export, wiring an actionable fallback banner in ServerExportModal."
---

# Quick Task Summary: Resolve Export Drawer Deficiencies & Deployment Obstacles

## 1. Overview
Resolved all export obstacles and UI accessibility friction points identified in `.proof/OBSTACLES.md` and `.proof/EXPERIMENT_REPORT.md`:
- ExportDrawer now provides instant in-browser recording for **WebM clips** and **animated GIFs** alongside the Studio Engine cloud tier.
- Users no longer depend solely on the backend container for video/clip exports.
- Output filenames now intelligently inherit the uploaded media name (e.g. `source_video-clip.webm`, `source_image-render.png`) instead of generic numeric timestamps.
- Palette effect buttons now expose `data-effect-id` and `data-testid` attributes.
- ServerExportModal displays an immediate 1-click fallback to in-browser export while the cloud container pre-warms.

## 2. Key Code Changes
1. **`web/src/components/panels/ExportDrawer.tsx`**:
   - Integrated `recordWebmClip` and `recordGifClip` with live percentage progress and user cancel support.
   - Added interactive duration selector chips (2s, 3s, 5s, 10s).
   - Implemented `getBaseFilename(ext, suffix)` using `mediaName` for all exports (PNG, JPEG, TXT, SVG, WebM, GIF).
2. **`web/src/components/modals/ServerExportModal.tsx`**:
   - Added `onFallbackToClient` callback prop.
   - Rendered an actionable banner when container is waking or in standby: *"Prefer instant download? Use Instant In-Browser Export →"*.
   - Added fallback action in `phase === 'error'`.
3. **`web/src/components/layout/LeftRail.tsx`**:
   - Added `data-effect-id={mode}`, `data-testid={`add-effect-${mode}`}`, and `data-testid={`set-effect-${mode}`}` for every effect button.
4. **`web/src/tests/exportDrawer.test.tsx` & `web/vitest.config.ts`**:
   - Enabled `.test.{ts,tsx}` pattern in Vitest configuration.
   - Added 5 component test cases verifying subtab rendering, clip tab auto-selection, dual in-browser/cloud options, WebM trigger execution, and duration adjustment.

## 3. Verification
- `npm --prefix web run build`: 100% clean production bundle (1.54s).
- `npm --prefix web run test:unit`: 12 test suites, 139 tests passed (100% PASS).
- `node scripts/verify_export_fixes.js`: Full automated browser verification passed, downloading `source_video-clip.webm` and confirming fallback modal controls.
- Python CI: `ruff check src tests` (pass), `mypy src` (pass), `pytest tests/` (458 passed).
