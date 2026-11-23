---
phase: 261123-rbc-proof-shader-matrix-experiments
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .gitignore
  - .proof/OBSTACLES.md
  - .proof/EXPERIMENT_REPORT.md
autonomous: true
requirements:
  - SHADER-PROOF-EXPERIMENTS

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - ".proof folder created with .gitignore entry and subdirectories .img and .vid containing uploaded source media"
    - "Every individual shader (16 total) executed and exported for both source image and source video"
    - "Multi-shader stacking combinations executed and exported for both source image and source video"
    - "Every exported file stored in .proof/.img and .proof/.vid with proper structured naming"
    - "All observed obstacles, runtime bugs, and deployment issues cataloged in .proof/OBSTACLES.md without fixing"
---

# Quick Task: Systematic Shader & Multi-Pass Stacking Matrix Experiments

## Objective
Execute a comprehensive matrix of individual and stacked shader experiments on the deployed studio application (`https://dithr.pages.dev/studio/`), using both user-provided image and video assets. Export all rendered results to `.proof/.img/` and `.proof/.vid/` with structured naming, and document all obstacles and behavioral discrepancies in `.proof/OBSTACLES.md`.

## Tasks

<task id="1" name="Asset Staging & Infrastructure Verification">
Verify that `.proof/` is created, ignored in `.gitignore`, and subdirectories `.proof/.vid` and `.proof/.img` contain `source_video.mp4` and `source_image.jpg`.
</task>

<task id="2" name="Automated Browser Experiment Matrix Execution">
Run systematic matrix of 16 individual shaders and 10 representative multi-pass combinations against `https://dithr.pages.dev/studio/`:
- Individual shaders: ascii, dither, halftone, vhs, matrix, dots, contour, pixelSort, blockify, threshold, edgeDetect, crosshatch, waveLines, noise, voronoi, tone.
- Stacked combinations:
  1. stack_01_retro_dither: Tone + Dither
  2. stack_02_textured_ascii: ASCII + Dither
  3. stack_03_quantized_ascii: Blockify + ASCII
  4. stack_04_comic_ink: EdgeDetect + Halftone
  5. stack_05_analog_glitch: PixelSort + VHS
  6. stack_06_topo_sketch: Crosshatch + Contour
  7. stack_07_contrast_waveform: WaveLines + Threshold
  8. stack_08_cellular_stipple: Voronoi + Dots
  9. stack_09_cyberpunk_destruction: Blockify + PixelSort + EdgeDetect
  10. stack_10_full_retro_pipeline: Tone + ASCII + Dither + VHS
Execute each experiment for both the image asset (`.proof/.img/`) and video asset (`.proof/.vid/`), exporting clean raster images and high-fidelity video clips.
</task>

<task id="3" name="Catalog Obstacles, Artifacts & Summary">
Collect and detail every obstacle encountered (e.g. static Cloudflare Pages 404 on server export routes, video duration handling, canvas stream capturing, audio graph behavior) in `.proof/OBSTACLES.md`. Verify all exported files, create SUMMARY.md, and update STATE.md.
</task>
