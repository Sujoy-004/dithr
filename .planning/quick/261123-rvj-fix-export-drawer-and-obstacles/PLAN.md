---
phase: 261123-rvj-fix-export-drawer-and-obstacles
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/components/panels/ExportDrawer.tsx
  - web/src/components/modals/ServerExportModal.tsx
  - web/src/components/layout/LeftRail.tsx
  - web/src/tests/exportDrawer.test.tsx
autonomous: true
requirements:
  - FIX-EXPORT-OBSTACLES

estimate:
  tokens: 35000
  raw_tokens: 35000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "ExportDrawer provides direct in-browser client-side WebM and GIF recording buttons with progress feedback alongside Studio Engine export"
    - "ServerExportModal provides clear diagnostic status and seamless fallback to client-side recording when backend container is waking or offline"
    - "Palette buttons in LeftRail expose data-effect-id and standardized accessible labels matching both mode ID and label"
    - "All unit tests and CI checks pass cleanly"
---

# Quick Task: Resolve Export Drawer Deficiencies & Deployment Obstacles

## Objective
Address the obstacles and export gaps cataloged in `.proof/OBSTACLES.md` and `.proof/EXPERIMENT_REPORT.md`:
1. Provide first-class client-side WebM and GIF clip exports in `ExportDrawer.tsx` utilizing existing `recordWebmClip` and `recordGifClip` engines.
2. Enhance `ServerExportModal.tsx` with instant client-side fallback when the cloud container is waking, offline, or on static deployments.
3. Standardize effect palette button accessibility and test selectors (`data-effect-id`, `data-testid`, multi-target aria-labels) in `LeftRail.tsx`.
4. Ensure robust filename generation using loaded asset basenames.

## Tasks

<task id="1" name="ExportDrawer Client-Side Clip Recording & Formatting">
Update `web/src/components/panels/ExportDrawer.tsx`:
- Import `recordWebmClip` and `recordGifClip` from `../../export/videoExport`.
- Add client-side clip recording triggers under the `clip` tab (Instant WebM Clip and Animated GIF).
- Add clip duration selector (2s, 3s, 5s, 10s) and progress indicator with cancel support.
- Refine output filename generation using the loaded asset's base name.
</task>

<task id="2" name="ServerExportModal Container Waking Fallback & Palette Selectors">
Update `web/src/components/modals/ServerExportModal.tsx` and `web/src/components/layout/LeftRail.tsx`:
- Add a graceful fallback option in `ServerExportModal.tsx` when container is waking or taking time, enabling 1-click fallback to client-side WebM/GIF recording.
- In `LeftRail.tsx`, add `data-effect-id={mode}`, `data-testid={`add-${mode}`}`, and dual-accessible label formatting.
</task>

<task id="3" name="Verification, Tests & State Update">
- Extend or create unit tests verifying ExportDrawer's client-side clip triggers.
- Run `npm --prefix web run build`, `python -m ruff check src tests`, `python -m mypy src`, and `python -m pytest tests/`.
- Create SUMMARY.md and append quick task to STATE.md.
</task>
