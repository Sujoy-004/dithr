---
phase: 261124-vhd-harden-video-export-and-remove-gif
plan: 01
subsystem: export-video
tags:
  - export
  - video
  - mp4
  - h264
  - mediarecorder
  - gif-removal
status: complete
requires: []
provides:
  - HARDEN-VIDEO-EXPORT
  - REMOVE-GIF-EXPORT
affects:
  - web/src/export/videoExport.ts
  - web/src/components/panels/ExportDrawer.tsx
  - web/src/components/modals/ServerExportModal.tsx
  - scripts/run_proof_experiments.js
key-files:
  created: []
  modified:
    - web/src/export/videoExport.ts
    - web/src/components/panels/ExportDrawer.tsx
    - web/src/components/modals/ServerExportModal.tsx
    - web/src/tests/exportDrawer.test.tsx
    - web/src/tests/setup.ts
    - web/src/tests/videoExport.test.ts
    - scripts/run_proof_experiments.js
    - .proof/OBSTACLES.md
    - .proof/EXPERIMENT_REPORT.md
decisions:
  - "Hardened in-browser video recording to prioritize native MP4 (video/mp4;codecs=avc1) at 8 Mbps high bitrate to retain high-frequency shader details (dither dots, halftone grids, ASCII characters) without macroblocking artifacts"
  - "Completely removed GIF export functionality across ExportDrawer and ServerExportModal in favor of universal, high-fidelity MP4 video exports"
  - "Maintained recordWebmClip as a compatibility wrapper delegating to recordMp4Clip"
actuals:
  tokens: 45000
  tasks: 3
  commits: 2
  plan_head_before: 208546339968acb7cf37ae1aa0b64bd9a193d34d
  plan_head_after: c7fe5f342e92533a88cd8415dffa44361b4d2dee
---

# Quick Task 261124-vhd: Harden Video Export & Remove GIF Export Summary

**Substantive One-Liner:** Upgraded client video exports to 8 Mbps native MP4 recording preserving high-frequency retro shader details while deprecating and completely removing GIF export across Dithr Studio components and proof suites.

---

## Executive Overview

Per product requirements, animated GIF export has been completely eliminated across Dithr Studio due to file size bloat and quantization limitations on complex shaders. In its place, client video recording has been hardened with `recordMp4Clip`, negotiating native browser MP4 containers (`video/mp4;codecs=avc1`) and enforcing an 8 Mbps (`8_000_000 bps`) high bitrate. This ensures dense, high-frequency shader patterns—such as ordered Bayer dithering, halftone screens, ASCII character glyphs, CRT scanlines, and directional pixel-sorting streaks—record with razor-sharp fidelity directly in-browser.

---

## Key Achievements

### 1. In-Browser 8 Mbps MP4 Video Engine (`videoExport.ts`)
- **Native MIME Negotiation:** Implemented `negotiateVideoMimeType()` checking for `video/mp4;codecs=avc1,mp4a.40.2`, `video/mp4;codecs=avc1`, and `video/mp4` before falling back to `video/webm`.
- **High-Bitrate Preservation:** Configured `videoBitsPerSecond: 8_000_000` (8 Mbps) and `audioBitsPerSecond: 128_000` to prevent compression macroblocking on dense shader patterns.
- **Audio Multiplexing & Leak Prevention:** Maintained full Web Audio Graph and camera microphone cloning, ensuring all tracks are stopped and garbage collected on completion, cancellation, or error.
- **Clean Worker Deprecation:** Removed `recordGifClip` and its `gif.worker.ts` reference, reducing Vite production bundle size.
- **Backwards Compatibility:** Retained `recordWebmClip` as an API wrapper delegating to `recordMp4Clip`.

### 2. Streamlined Studio UI (`ExportDrawer.tsx` & `ServerExportModal.tsx`)
- **ExportDrawer:** Replaced client GIF and WebM triggers with a single, prominent "record MP4 clip" button generating `${base}-clip.mp4` with duration selectors (2s, 3s, 5s, 10s), real-time progress indicators, and cancellation.
- **ExportDrawer Studio Engine:** Removed "export High-Res GIF" button; dedicated Studio Engine section to "export MP4 (H.264 HD)".
- **ServerExportModal:** Eliminated the MP4 vs Animated GIF toggle grid; dedicated the modal to high-resolution MP4 video (up to 1080p, up to 60 FPS, up to 60s video ceiling).
- **Graceful Client Fallback:** Updated offline error copy and instant fallback banner to point directly to in-browser MP4 recording.

### 3. Automated Proof Runner & Matrix Validation
- **Proof Automation:** Updated `scripts/run_proof_experiments.js` to locate and trigger "record MP4 clip", test 8 Mbps canvas recording, and eliminate obsolete GIF verification steps.
- **GIF Artifact Purged:** Deleted `.proof/.vid/00_proof_client_anim.gif` from disk.
- **26 Video Matrix Verified:** All 26 video combinations (16 single shaders + 10 multi-pass stacks) verified as valid, non-blank, 1064×718 MP4 files.
- **Documentation Refreshed:** Updated `.proof/OBSTACLES.md` and `.proof/EXPERIMENT_REPORT.md` reflecting GIF deprecation and hardened MP4 baseline.

---

## Verification & Self-Check

### Self-Check: PASSED

1. **Created Files & File Checks:**
   - `web/src/export/videoExport.ts` FOUND & VERIFIED
   - `web/src/components/panels/ExportDrawer.tsx` FOUND & VERIFIED
   - `web/src/components/modals/ServerExportModal.tsx` FOUND & VERIFIED
   - `web/src/tests/exportDrawer.test.tsx` FOUND & VERIFIED
   - `web/src/tests/videoExport.test.ts` FOUND & VERIFIED
   - `scripts/run_proof_experiments.js` FOUND & VERIFIED
   - `.proof/.vid/00_proof_client_anim.gif` DELETED (verified absent)

2. **Task Commits:**
   - `d4e2685`: `feat(261124-vhd-01): harden video export with 8 Mbps MP4 and remove GIF export`
   - `c7fe5f3`: `feat(261124-vhd-02): update proof automation runner and purge GIF artifact`

3. **CI Gate Validations:**
   - `npm --prefix web run build`: PASS (Vite client build in 2.83s, 0 errors)
   - `npm --prefix web run test:unit`: PASS (12 test suites, 140 passed)
   - `python -m ruff check src tests`: PASS (all checks passed)
   - `python -m mypy src`: PASS (0 issues found in 23 source files)
   - `python -m pytest tests/ -q`: PASS (458 passed in 42s)
   - Automated proof check: PASS (29 valid MP4 files, 0 GIF files)

---

## Deviations from Plan

None — plan executed exactly as specified.
