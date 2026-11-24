---
phase: 261124-vhd-harden-video-export-and-remove-gif
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - web/src/export/videoExport.ts
  - web/src/components/panels/ExportDrawer.tsx
  - web/src/components/modals/ServerExportModal.tsx
  - web/src/tests/exportDrawer.test.tsx
  - web/src/tests/videoExport.test.ts
  - scripts/run_proof_experiments.js
  - .proof/OBSTACLES.md
  - .proof/EXPERIMENT_REPORT.md
  - .planning/STATE.md
autonomous: true
requirements:
  - HARDEN-VIDEO-EXPORT
  - REMOVE-GIF-EXPORT

estimate:
  tokens: 45000
  raw_tokens: 45000
  tasks: 3
  confidence: high

must_haves:
  truths:
    - "GIF export functionality is completely removed from ExportDrawer.tsx and ServerExportModal.tsx"
    - "videoExport.ts provides recordMp4Clip negotiating native browser MP4 recording (video/mp4;codecs=avc1) with high bitrate (8 Mbps) to preserve high-frequency shader details"
    - "ExportDrawer provides in-browser record MP4 clip button generating ${base}-clip.mp4 with audio track multiplexing and cancel support"
    - "ServerExportModal is dedicated exclusively to MP4 video exports without GIF options or tabs"
    - "Obsolete 00_proof_client_anim.gif is purged from .proof/.vid/ and proof suite verifies client MP4 recording"
    - "All 26 video combinations in .proof/.vid/ are validated as rich MP4s (1064x718, non-blank, proper duration and size)"
    - "All unit tests and CI checks (build, test:unit, ruff, mypy, pytest) pass cleanly"
  artifacts:
    - web/src/export/videoExport.ts
    - web/src/components/panels/ExportDrawer.tsx
    - web/src/components/modals/ServerExportModal.tsx
    - web/src/tests/exportDrawer.test.tsx
    - web/src/tests/videoExport.test.ts
    - scripts/run_proof_experiments.js
    - .proof/OBSTACLES.md
    - .proof/EXPERIMENT_REPORT.md
  key_links:
    - from: web/src/components/panels/ExportDrawer.tsx
      to: web/src/export/videoExport.ts
      via: "recordMp4Clip with canvas capture stream and high bitrate options"
    - from: scripts/run_proof_experiments.js
      to: .proof/.vid/00_proof_client_clip.mp4
      via: "browser download trigger on record MP4 clip button"
    - from: scripts/run_proof_experiments.js
      to: .proof/EXPERIMENT_REPORT.md
      via: "video matrix proof logging with MP4 sizes and execution metrics"
---

<objective>
Harden client-side video exports for high-frequency shaders and completely remove GIF export functionality across Dithr Studio.

Purpose: Eliminate GIF export complexity and size bloat per user requirements, while upgrading video clip recording to prioritize native high-bitrate MP4 (H.264 / AVC1 at 8 Mbps) directly in-browser. This ensures dense shader patterns (ordered dither dots, halftone screens, ASCII glyphs, CRT scanlines, and pixel-sort streaks) export with crisp visual fidelity without macroblocking compression artifacts, and maintains a validated 26-combination MP4 video proof baseline.

Output:
- Hardened `videoExport.ts` with `recordMp4Clip` negotiating native MP4 with 8 Mbps bitrate.
- Streamlined `ExportDrawer.tsx` and `ServerExportModal.tsx` dedicated exclusively to MP4 video exports.
- Updated unit test suite (`exportDrawer.test.tsx` and `videoExport.test.ts`).
- Cleaned `.proof/.vid/` (purging `00_proof_client_anim.gif`), updated runner `run_proof_experiments.js`, and refreshed `.proof/OBSTACLES.md` and `.proof/EXPERIMENT_REPORT.md`.
</objective>

<execution_context>
@~/.gemini/antigravity/gsd-core/workflows/execute-plan.md
@~/.gemini/antigravity/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@GEMINI.md
@web/src/export/videoExport.ts
@web/src/components/panels/ExportDrawer.tsx
@web/src/components/modals/ServerExportModal.tsx
@web/src/tests/exportDrawer.test.tsx
@web/src/tests/videoExport.test.ts
@scripts/run_proof_experiments.js
@.proof/OBSTACLES.md
@.proof/EXPERIMENT_REPORT.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Harden Video Export Engine & Remove GIF Export Across Studio Components</name>
  <files>web/src/export/videoExport.ts, web/src/components/panels/ExportDrawer.tsx, web/src/components/modals/ServerExportModal.tsx, web/src/tests/exportDrawer.test.tsx, web/src/tests/videoExport.test.ts</files>
  <behavior>
    - Test 1: recordMp4Clip negotiates native video/mp4 MIME type, configures 8 Mbps high bitrate, multiplexes audio, and returns valid MP4 Blob.
    - Test 2: recordMp4Clip responds to cancelController by stopping tracks, aborting recorder, and rejecting with cancellation error.
    - Test 3: ExportDrawer renders "record MP4 clip" button and "export MP4 (H.264 HD)" under clip tab, and does not contain any GIF buttons or options.
    - Test 4: ServerExportModal presents MP4 video configuration exclusively without GIF selection options.
  </behavior>
  <action>
1. Refactor web/src/export/videoExport.ts:
   - Implement negotiateVideoMimeType(): prioritize ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']. Return mimeType string and isMp4 boolean.
   - Implement recordMp4Clip(canvas, durationSeconds, onProgress, filename, includeAudio, videoEl, cancelController):
     - Resume AudioContext on user interaction gesture.
     - Capture canvas stream at 30 fps (or matching source video).
     - Multiplex audio tracks from targetVideo (via getOrCreateAudioGraph / getAudioStreamTrack) and active webcam/microphone stream. Keep references to cloned tracks.
     - Pass MediaRecorder options: mimeType (if supported), videoBitsPerSecond: 8_000_000 (8 Mbps high bitrate to preserve high-frequency dither dots, halftone grids, and ASCII character edges), and audioBitsPerSecond: 128_000.
     - Ensure cleanupClonedTracks() cleanly stops all cloned audio tracks on stop, error, or cancellation.
     - Generate output filename with .mp4 extension (or .webm if native MP4 is unsupported by user browser).
     - Retain recordWebmClip as a compatibility wrapper delegating to recordMp4Clip or retaining explicit webm fallback.
     - Remove or deprecate recordGifClip (and remove gif.worker.ts import references if no longer needed).

2. Update web/src/components/panels/ExportDrawer.tsx:
   - Remove recordGifClip import and handleClientGif implementation.
   - Remove "record client GIF" button and subtitle.
   - Remove "export High-Res GIF" button from Studio Engine Export section.
   - Remove serverFormat state (modal is exclusively for MP4 export).
   - Import recordMp4Clip and wire handleClientMp4:
     - Generate filename using getBaseFilename('mp4', 'clip').
     - Button label: "record MP4 clip", subtitle: `${clipDuration}s · HD MP4`.
     - Support clip duration options (2s, 3s, 5s, 10s), live percentage progress bar, and user cancellation.

3. Update web/src/components/modals/ServerExportModal.tsx:
   - Remove 'gif' from format state and defaultFormat prop; fix format to 'mp4'.
   - Remove the two-button format toggle grid (MP4 vs Animated GIF); display dedicated MP4 Video (H.264 HD) panel with up to 1080p resolution and up to 60s video duration ceiling.
   - Update fallback and explanatory copy to refer to in-browser MP4 video recording instead of GIF.

4. Update unit tests:
   - In web/src/tests/exportDrawer.test.tsx: replace GIF button assertions with "record MP4 clip" and verify clicking it calls recordMp4Clip with .mp4 filename.
   - In web/src/tests/videoExport.test.ts: replace GIF worker tests with recordMp4Clip tests asserting high-bitrate options, MIME negotiation, audio track multiplexing, and cancellation.
  </action>
  <verify>
    <automated>npm --prefix web run test:unit -- exportDrawer videoExport</automated>
  </verify>
  <done>ExportDrawer and ServerExportModal are devoid of GIF options, recordMp4Clip negotiates high-bitrate MP4 recording, and all unit tests in exportDrawer.test.tsx and videoExport.test.ts pass.</done>
</task>

<task type="auto">
  <name>Task 2: Update Proof Automation Runner, Purge GIF Artifact, and Validate Video Matrix</name>
  <files>scripts/run_proof_experiments.js, .proof/.vid/00_proof_client_anim.gif, .proof/.vid/00_proof_client_clip.mp4, .proof/OBSTACLES.md, .proof/EXPERIMENT_REPORT.md</files>
  <action>
1. Update scripts/run_proof_experiments.js:
   - Remove all GIF client recording logic:
     - Remove clientExportVerifications.clientGif property and checks.
     - Remove the locator query for 'button:has-text("record client GIF")'.
     - Remove GIF rows and columns from report generation and obstacle logging templates.
   - Update client video export verification:
     - Locate 'button:has-text("record MP4 clip")' under the clip tab in right rail.
     - Click "record MP4 clip" and await browser download event saving directly to .proof/.vid/00_proof_client_clip.mp4.
     - Verify client MP4 export size > 0 and log success.
   - Update recordCanvasClip(page, durationMs):
     - Pass videoBitsPerSecond: 8_000_000 to browser MediaRecorder to guarantee high visual quality during canvas capture.
     - Check MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') / 'video/mp4' and use native MP4 container when supported.
   - Delete obsolete .proof/.vid/00_proof_client_anim.gif file from filesystem.
   - Ensure convertWebmToMp4 handles transcoding seamlessly for all 26 video experiment configurations (16 single shaders + 10 stacked combinations), creating pristine MP4s (1064x718 matching source_video.mp4).
   - Refresh .proof/OBSTACLES.md to record that GIF export was intentionally deprecated and removed per product direction, and client MP4 export was hardened with 8 Mbps recording.
   - Refresh .proof/EXPERIMENT_REPORT.md to document the validated 26 video MP4 outputs and client MP4 recording test.
  </action>
  <verify>
    <automated>node -e "const fs = require('fs'); const vids = fs.readdirSync('.proof/.vid').filter(f => f.endsWith('.mp4')); const hasGif = fs.existsSync('.proof/.vid/00_proof_client_anim.gif'); console.log('Video MP4 count:', vids.length, 'Has GIF:', hasGif); if (vids.length < 26 || hasGif) process.exit(1);"</automated>
  </verify>
  <done>Obsolete GIF proof is removed, scripts/run_proof_experiments.js verifies record MP4 clip button without GIF references, and all 26 video configurations exist as valid non-blank MP4 files.</done>
</task>

<task type="auto">
  <name>Task 3: Full CI Standards Verification, State Ledger & Summary</name>
  <files>.planning/STATE.md, .planning/quick/261124-vhd-harden-video-export-and-remove-gif/261124-vhd-harden-video-export-and-remove-gif-SUMMARY.md</files>
  <action>
1. Execute full CI validation suite to guarantee zero regressions across the codebase:
   - TypeScript build: npm --prefix web run build
   - Unit test suite: npm --prefix web run test:unit
   - Python linter: python -m ruff check src tests
   - Python static typing: python -m mypy src
   - Python test suite: python -m pytest tests/ -q
2. Create .planning/quick/261124-vhd-harden-video-export-and-remove-gif/261124-vhd-harden-video-export-and-remove-gif-SUMMARY.md summarizing:
   - Complete removal of GIF export triggers, worker utilities, and modal tabs.
   - Hardened in-browser MP4 recording with 8 Mbps bitrate preserving high-frequency shader details.
   - Validated 26 video MP4 configurations and verified client MP4 download in .proof/.vid/.
   - All CI gates passing.
3. Update .planning/STATE.md to record this quick task under quick tasks history and current position.
  </action>
  <verify>
    <automated>npm --prefix web run build && npm --prefix web run test:unit && python -m ruff check src tests && python -m mypy src && python -m pytest tests/ -q</automated>
  </verify>
  <done>All CI gates pass cleanly, SUMMARY.md is generated, and STATE.md is updated with the completed quick task.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client Browser -> Canvas Recording API | In-browser MediaRecorder captures stream from canvas and audio tracks |
| Client -> Local File System Download | Exported MP4 blob downloaded via browser synthetic <a> click |
| Test Automation Script -> FFmpeg Process | Node child_process invokes ffmpeg CLI for proof transcoding |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261124-vhd-01 | Denial of Service | web/src/export/videoExport.ts | medium | mitigate | Enforce duration ceilings (e.g. 10s default max) and cancellation controller to abort MediaRecorder and prevent browser memory exhaustion on long runs |
| T-261124-vhd-02 | Information Disclosure | web/src/export/videoExport.ts | low | mitigate | Scope audio capture strictly to registered video element or active user-authorized microphone stream, ensuring tracks are stopped and garbage collected on completion or abort |
| T-261124-vhd-03 | Tampering | scripts/run_proof_experiments.js | medium | mitigate | Sanitize filenames and target paths passed to execSync/ffmpeg to prevent shell injection vulnerabilities |
| T-261124-vhd-SC | Tampering | npm/pip installs | high | mitigate | Use strictly existing dependencies (MediaRecorder, Playwright, ffmpeg); no unvetted third-party npm or pip packages added |
</threat_model>

<verification>
1. Run `npm --prefix web run test:unit` to verify all 12 test suites pass with updated MP4 tests and GIF removal.
2. Run `npm --prefix web run build` to confirm TypeScript compiles and Vite produces client bundles without errors.
3. Verify obsolete GIF removal: `node -e "if (require('fs').existsSync('.proof/.vid/00_proof_client_anim.gif')) process.exit(1);"`
4. Verify video MP4 matrix: `node -e "const fs = require('fs'); const vids = fs.readdirSync('.proof/.vid').filter(f => f.endsWith('.mp4')); if (vids.length < 26) process.exit(1);"`
5. Run Python CI standards: `python -m ruff check src tests && python -m mypy src && python -m pytest tests/ -q`
</verification>

<success_criteria>
- GIF export feature is completely removed from ExportDrawer.tsx, ServerExportModal.tsx, and unit tests.
- Client video recording upgraded to "record MP4 clip" utilizing recordMp4Clip with 8 Mbps bitrate for high-frequency shader fidelity.
- ServerExportModal dedicated exclusively to MP4 export without GIF toggles.
- Obsolete 00_proof_client_anim.gif deleted; proof runner scripts/run_proof_experiments.js updated and verified.
- All 26 video combinations in .proof/.vid/ confirmed as valid MP4 files (1064x718).
- Zero regressions in CI: npm run build, vitest unit tests, ruff, mypy, and pytest all pass.
</success_criteria>

<output>
Create .planning/quick/261124-vhd-harden-video-export-and-remove-gif/261124-vhd-harden-video-export-and-remove-gif-SUMMARY.md when complete.
</output>
