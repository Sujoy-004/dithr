---
phase: 261123-seg-re-run-proof-shader-matrix-experiments-w
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/run_proof_experiments.js
  - .proof/OBSTACLES.md
  - .proof/EXPERIMENT_REPORT.md
  - .planning/STATE.md
autonomous: true
requirements:
  - RE-RUN-PROOF-SHADER-MATRIX
estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: high
must_haves:
  truths:
    - "scripts/run_proof_experiments.js targets https://dithr.pages.dev/studio/ with automatic fallback to local Vite preview if remote is unreachable or outdated"
    - "LeftRail palette effects are selected using data-effect-id and standardized test selectors"
    - "All 16 single shaders and 10 stacked combinations are executed for both image and video assets (52 total matrix runs)"
    - "Client-side WebM recording, GIF recording, and ServerExportModal waking fallback banner are exercised and verified"
    - "Outputs in .proof/.img/ and .proof/.vid/ are freshly regenerated and non-empty"
    - ".proof/OBSTACLES.md and .proof/EXPERIMENT_REPORT.md are refreshed with live results, obstacle mitigations, and execution metrics"
  artifacts:
    - scripts/run_proof_experiments.js
    - .proof/OBSTACLES.md
    - .proof/EXPERIMENT_REPORT.md
  key_links:
    - from: scripts/run_proof_experiments.js
      to: .proof/OBSTACLES.md
      via: logObstacle and markdown ledger generation
    - from: scripts/run_proof_experiments.js
      to: .proof/EXPERIMENT_REPORT.md
      via: matrix execution report generation
---

<objective>
Re-run the full 52-experiment proof matrix (16 individual shaders + 10 stacked combinations across image and video assets) on Dithr Studio incorporating the export drawer and palette fixes introduced in 261123-rvj. Verify client-side WebM/GIF recording triggers, palette data-effect-id selection, and ServerExportModal container fallback, regenerating all artifacts in .proof/.img/ and .proof/.vid/ and updating .proof/OBSTACLES.md and .proof/EXPERIMENT_REPORT.md.

Purpose: Validate that the recent export drawer and modal fixes solve prior operational obstacles, prove visual rendering stability across all 52 configurations, and maintain an up-to-date proof baseline.
Output: Refreshed .proof/ media assets, updated OBSTACLES.md and EXPERIMENT_REPORT.md, and upgraded run_proof_experiments.js script.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@GEMINI.md
@.proof/OBSTACLES.md
@.proof/EXPERIMENT_REPORT.md
@scripts/run_proof_experiments.js
@scripts/verify_export_fixes.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Upgrade Experiment Automation Runner for URL Fallback, New Selectors & Client Exports</name>
  <files>scripts/run_proof_experiments.js</files>
  <action>
Update scripts/run_proof_experiments.js to integrate recent improvements and support resilient execution:
1. Target URL Resolution: Add automatic detection and fallback logic. Attempt to connect to deployed studio at https://dithr.pages.dev/studio/. Verify the page loads and inspect whether updated elements (such as button[data-effect-id] or client recording buttons) are present. If the remote URL is unreachable, times out, or reflects an outdated deployment, automatically fall back to local Vite preview at http://localhost:5173/studio/ (launching local preview/dev server if not already running).
2. Standardized Palette Selectors: Update applyStack() to select effects using button[data-effect-id="${id}"] and button[data-testid="add-effect-${id}"], retaining fallback to button[aria-label="Add ${id} to stack"] and button[aria-label="Add ${label} to stack"].
3. Client-Side Export & Fallback Verification:
   - In image phase: Verify ASCII text (.txt) and Vector SVG (.svg) export download triggers.
   - In video phase: In addition to direct canvas stream recording, test ExportDrawer's clip tab client-side buttons: "record WebM clip" and "record client GIF" to confirm client-side recording triggers fire.
   - Test ServerExportModal: Trigger "export MP4", check that the container status displays properly, and verify that the fallback banner ("Use Instant In-Browser Export") is present and operational.
4. Report & Obstacle Generation: Update markdown generation so that .proof/OBSTACLES.md explicitly records resolved obstacles (OBS-3 and OBS-4 mitigated by client-side WebM/GIF recording and instant fallback banner; LeftRail effect selection resolved via data-effect-id attributes), while documenting any ongoing environmental constraints (such as Cloudflare Pages static hosting vs FastAPI backend container). Ensure .proof/EXPERIMENT_REPORT.md is refreshed with live run status, file sizes, and elapsed times.
  </action>
  <verify>
    <automated>node -c scripts/run_proof_experiments.js</automated>
  </verify>
  <done>scripts/run_proof_experiments.js compiles with zero syntax errors and includes target URL fallback, data-effect-id selectors, client export triggers, and updated documentation templates.</done>
</task>

<task type="auto">
  <name>Task 2: Execute 52-Run Proof Matrix & Regenerate Media Artifacts</name>
  <files>.proof/OBSTACLES.md, .proof/EXPERIMENT_REPORT.md</files>
  <action>
Execute the automated experiment runner to re-render all 52 runs:
1. Run node scripts/run_proof_experiments.js.
2. Phase A (26 Image Runs): Execute all 16 individual shaders (ascii, dither, halftone, vhs, matrix, dots, contour, pixelSort, blockify, threshold, edgeDetect, crosshatch, waveLines, noise, voronoi, tone) and 10 stacked combinations (retro_dither, textured_ascii, quantized_ascii, comic_ink, analog_glitch, topo_sketch, contrast_waveform, cellular_stipple, cyberpunk_destruction, full_retro_pipeline) against .proof/.img/source_image.jpg. Write freshly rendered screenshots to .proof/.img/*.png. Verify ASCII text and SVG downloads.
3. Phase B (26 Video Runs): Execute the same 26 configurations against .proof/.vid/source_video.mp4. Capture live canvas recordings, save WebM files to .proof/.vid/*.webm, and transcode to MP4 via FFmpeg (.proof/.vid/*.mp4).
4. Verify export drawer client triggers (record WebM clip, record client GIF) and modal fallback banner during the video test run.
5. Continuously update and write the refreshed .proof/OBSTACLES.md and .proof/EXPERIMENT_REPORT.md.
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const imgs = fs.readdirSync('.proof/.img').filter(f => f.endsWith('.png') && f !== 'source_image.png'); const vids = fs.readdirSync('.proof/.vid').filter(f => f.endsWith('.mp4') && f !== 'source_video.mp4'); console.log('Image PNGs:', imgs.length, 'Video MP4s:', vids.length); if (imgs.length < 26 || vids.length < 26) process.exit(1);"</automated>
  </verify>
  <done>All 26 image PNGs and 26 video MP4s (along with WebM sources) are regenerated in .proof/.img/ and .proof/.vid/, with non-zero file sizes and corresponding entries in .proof/EXPERIMENT_REPORT.md.</done>
</task>

<task type="auto">
  <name>Task 3: Audit Documentation, CI Standards & Update State</name>
  <files>.proof/OBSTACLES.md, .proof/EXPERIMENT_REPORT.md, .planning/STATE.md</files>
  <action>
Finalize the proof rerun and verify repository health:
1. Review .proof/OBSTACLES.md to ensure the obstacle ledger accurately reflects both resolved items (client-side export bypass, palette selectors, modal fallback) and remaining environment observations (backend API container proxy).
2. Review .proof/EXPERIMENT_REPORT.md to verify that all 52 runs report SUCCESS, with accurate file sizes and elapsed execution times.
3. Run project verification suite:
   - TypeScript bundle check: npm --prefix web run build
   - Python linting: ruff check src tests
   - Python static typing: mypy src
   - Python unit tests: pytest tests/ -q
4. Create quick task summary at .planning/quick/261123-seg-re-run-proof-shader-matrix-experiments-w/261123-seg-SUMMARY.md and update .planning/STATE.md with the completed quick task details.
  </action>
  <verify>
    <automated>npm --prefix web run build && ruff check src tests && mypy src && pytest tests/ -q</automated>
  </verify>
  <done>Documentation is accurate, all 52 runs are validated, all CI checks pass cleanly, and STATE.md is updated.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Automation Script -> Web Browser | Playwright controls local Chromium instance executing WebGPU/WebGL shader graph |
| Script -> Network / Server | Automation fetches either remote Cloudflare Pages or local Vite dev server |
| Script -> Local File System & FFmpeg | Node script writes image/video blobs to .proof/ and executes ffmpeg CLI child processes |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261123-seg-01 | Denial of Service | scripts/run_proof_experiments.js | medium | mitigate | Add strict timeouts (e.g. 5000ms max per download/render event) and sequential execution to prevent memory leakage or browser crashes across 52 heavy shader runs |
| T-261123-seg-02 | Information Disclosure | Target URL resolver | low | mitigate | Restrict target navigation strictly to whitelisted hosts (https://dithr.pages.dev/studio/ and http://localhost:5173/studio/) to prevent SSRF or untrusted redirects |
| T-261123-seg-03 | Tampering | FFmpeg transcoding in convertWebmToMp4 | medium | mitigate | Enforce validated fixed path parameters and avoid shell injection by keeping input/output filenames within controlled .proof directories |
| T-261123-seg-SC | Tampering | npm/pip installs | high | mitigate | Use existing installed dependencies without adding unvetted third-party packages |
</threat_model>

<verification>
Execute the full matrix runner and verify outputs:
1. `node scripts/run_proof_experiments.js` runs to completion.
2. `node -e "const fs = require('fs'); const imgs = fs.readdirSync('.proof/.img').filter(f => f.endsWith('.png')); const vids = fs.readdirSync('.proof/.vid').filter(f => f.endsWith('.mp4')); if (imgs.length < 26 || vids.length < 26) process.exit(1);"` verifies all 52 media outputs exist.
3. Check .proof/OBSTACLES.md and .proof/EXPERIMENT_REPORT.md for updated timestamps and valid markdown tables.
4. `npm --prefix web run build && ruff check src tests && mypy src && pytest tests/` passes.
</verification>

<success_criteria>
- 52 proof runs (16 single + 10 stack for both image and video) executed and exported to .proof/.img/ and .proof/.vid/.
- Target URL supports remote https://dithr.pages.dev/studio/ with automatic fallback to local preview.
- Client-side WebM/GIF recording triggers and ServerExportModal waking fallback banner tested and verified.
- .proof/OBSTACLES.md and .proof/EXPERIMENT_REPORT.md refreshed and accurate.
- All Python and Web CI standards pass cleanly.
</success_criteria>

<output>
Create .planning/quick/261123-seg-re-run-proof-shader-matrix-experiments-w/261123-seg-SUMMARY.md when complete.
</output>
