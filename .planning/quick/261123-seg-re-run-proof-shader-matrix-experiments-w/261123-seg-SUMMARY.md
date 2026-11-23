---
phase: 261123-seg-re-run-proof-shader-matrix-experiments-w
plan: 01
status: complete
date: 2026-11-23
commit: ffae31b
tasks_completed: 3
tasks_total: 3
---

# Quick Task Summary: Re-run Proof Shader Matrix Experiments with Export Drawer Fixes

## Objective Accomplished
Re-executed the full 52-experiment proof matrix (16 individual shaders + 10 stacked combinations across image and video assets) on Dithr Studio (`https://dithr.pages.dev/studio/`), incorporating the client-side WebM/GIF recording triggers, palette `data-effect-id` selectors, and container waking fallback banner introduced in `261123-rvj`.

## Key Deliverables & Verifications
1. **Target Automation & Resiliency (`scripts/run_proof_experiments.js`):**
   - Verified connection against live deployment `https://dithr.pages.dev/studio/` with 32 verified `button[data-effect-id]` selectors.
   - Enhanced `applyStack` with standardized selectors (`data-testid="add-effect-${id}"` and `data-effect-id="${id}"`).
   - Added automatic fallback to local Vite dev server (`http://localhost:5173/studio/`).
   - Integrated client-side export tests for ASCII text (`.txt`), Vector SVG (`.svg`), Client WebM (`.webm`), and Client GIF (`.gif`).
   - Verified `ServerExportModal` container status and instant fallback banner (`Use Instant In-Browser Export →`).

2. **Artifact Generation & Refresh:**
   - **Image Phase (`.proof/.img/`):** 26 freshly rendered PNG screenshots (all >1MB), plus `00_proof_ascii_export.txt` and `00_proof_vector_export.svg`.
   - **Video Phase (`.proof/.vid/`):** 26 rendered `.webm` canvas recordings and 26 `.mp4` universal transcodes via FFmpeg, plus `00_proof_client_clip.webm`, `00_proof_client_clip.mp4`, and `00_proof_client_anim.gif` (1.8 MB).
   - **Obstacles & Reports (`.proof/`):** Updated `.proof/OBSTACLES.md` (cataloging resolutions for OBS-3, OBS-4, OBS-5, OBS-6) and `.proof/EXPERIMENT_REPORT.md` (all 52 runs reporting `✓ PASS`).

3. **CI Standards Verification:**
   - `npm --prefix web run build`: Clean TypeScript check and production bundle in 1.51s.
   - `python -m ruff check src tests`: Clean (All checks passed).
   - `python -m mypy src`: Success (23 files checked, 0 errors).
   - `python -m pytest tests/`: 458 passed in 41.62s.
