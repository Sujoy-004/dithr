---
phase: 02-shader-engine-2-0-advanced-fx
plan: "05"
subsystem: audio/engine
tags: [audio-reactivity, web-audio, fft, analyser-node, attack-release, envelope-filter, uniform-modulation]
status: complete
requires:
  - "02-02"
  - "02-03"
  - "02-04"
provides:
  - web/src/export/audioGraph.ts
  - web/src/engine/audio/AudioReactivityEngine.ts
  - web/src/components/panels/AudioPanel.tsx
  - web/src/tests/audioEngine.test.ts
affects:
  - web/src/components/layout/CenterStage.tsx
  - web/src/components/layout/RightRail.tsx
  - web/src/store/useStudioStore.ts
  - web/src/types/studio.ts
tech-stack:
  added: []
  patterns:
    - Singleton Web Audio graph reuse across audio export and real-time reactivity (D-10)
    - Mixer bus with single AnalyserNode (fftSize 256, 128 bins) and JS-based smoothing (D-12)
    - Explicit user gesture activation and microphone stream ingestion (D-10, D-13, T-02-09)
    - Asymmetric attack (~20ms) and release (~200ms) exponential envelope filter (D-14)
    - Zero-churn RAF uniform modulation pushing modulated values directly to TSL uniforms (D-12)
    - Reversible base uniform restoration on audio disable/pause
key-files:
  created:
    - web/src/engine/audio/AudioReactivityEngine.ts
    - web/src/components/panels/AudioPanel.tsx
    - web/src/tests/audioEngine.test.ts
  modified:
    - web/src/export/audioGraph.ts
    - web/src/components/layout/CenterStage.tsx
    - web/src/components/layout/RightRail.tsx
    - web/src/store/useStudioStore.ts
    - web/src/types/studio.ts
    - web/src/tests/setup.ts
decisions:
  - "D-10: Audio reactivity routes microphone and media audio through the existing singleton AudioContext with zero second context instances"
  - "D-11: Modulation is a hybrid: three global bass/mid/treble macros with sensitivity and smoothing, plus per-effect modulation rows for depth"
  - "D-12: Single AnalyserNode on a mixer gain (fftSize: 256), typed arrays allocated once, band values pushed directly to TSL uniforms in RAF loop with zero React re-renders"
  - "D-13: Audio activation is explicit with opt-in button and status chips (off, waiting for click, live, denied, unavailable)"
  - "D-14: Response shaping uses per-band attack/release with fast attack (~20ms) and slower release (~200ms) defaults, master sensitivity slider, and presets"
  - "T-02-09: Microphone stream requested strictly upon explicit user interaction and connected locally to AnalyserNode, never transmitted over network"
  - "T-02-10: Pre-allocated Uint8Array(128) prevents GC churn and memory leaks"
metrics:
  duration: 16 min
  completed: "2026-11-23"
actuals:
  tokens: 15763
  tasks: 3
  commits: 3
  plan_head_before: b7cf6a282f1eb8d77c44ea6daec2aa8ee2c38210
  plan_head_after: a9a8ed9c1cbdfbfdfcfa9b3df997e08e6783842d
---

# Phase 02 Plan 05: Real-Time Audio-Reactive Modulation Engine Summary

Implemented real-time audio-reactive shader parameter modulation per D-10, D-11, D-12, D-13, D-14, and FX-05.
Extended the singleton `AudioContext` with a mixer bus and `AnalyserNode` (`fftSize: 256`), ingested microphone audio (`getUserMedia`) and HTML5 video soundtracks upon explicit user click, extracted bass/mid/treble bands via an asymmetric attack/release envelope filter (~20ms attack / ~200ms release), and streamed smoothed modulation values directly to TSL shader uniforms inside the RAF loop with zero React state churn.

## Key Changes

1. **Singleton Web Audio Graph Extension (`web/src/export/audioGraph.ts`)**:
   - Preserved existing singleton `AudioContext` without creating any secondary instances (D-10).
   - Added singletons:
     - `sharedMixerGain`: Sums active media audio and microphone input.
     - `sharedMediaInputGain` & `sharedMicInputGain`: Granular input gains for clickless source cross-fading.
     - `sharedAnalyserNode`: Single analyser configured with `fftSize = 256` (128 frequency bins) and `smoothingTimeConstant = 0.0` (D-12).
     - `sharedMicSourceNode` & `sharedMicStream`: Managed microphone media stream.
   - Implemented `getSharedAnalyserNode(): AnalyserNode` connecting `sharedMixerGain -> sharedAnalyserNode`.
   - Implemented `setAudioInputSource(source: 'media' | 'mic' | 'both'): Promise<void>` requesting `getUserMedia({ audio: true })` only upon explicit user gesture (T-02-09), stopping mic tracks when switching back to media.
   - Implemented `resumeAudioContext(): Promise<'live' | 'suspended' | 'denied' | 'unavailable'>` and `cleanupAudioGraph()`.

2. **Audio Reactivity Engine (`web/src/engine/audio/AudioReactivityEngine.ts`)**:
   - Pre-allocated a single `Uint8Array(128)` for FFT frequency bins with zero per-frame allocation overhead (D-12, T-02-10).
   - Partitioned 128 bins into 3 bands:
     - Bass: bins 0-2 (~0-375Hz)
     - Mid: bins 3-14 (~560-2600Hz)
     - Treble: bins 15-63 (~2.8-11.8kHz)
   - Implemented asymmetric attack/release exponential envelope filter:
     - Fast attack (~20ms, step-up reaches ~63.2% in 20ms)
     - Slower release (~200ms, step-down decays over 200ms)
     - Formula: `coeff = 1.0 - Math.exp(-deltaMs / timeConstantMs)`
   - Applied master `sensitivity` [0.1, 3.0] with strict `[0.0, 1.0]` output clamping.
   - Added presets: `punchy` (10/100ms), `standard` (20/200ms), and `smooth` (40/400ms).

3. **AudioPanel UI & Store State (`web/src/components/panels/AudioPanel.tsx`, `useStudioStore.ts`, `RightRail.tsx`)**:
   - Extended `useStudioStore` with `audioState` slice (`enabled`, `source`, `status`, `sensitivity`, `envelopePreset`, `mappings`) and actions (`setAudioEnabled`, `setAudioSource`, `setAudioSensitivity`, `addAudioMapping`, `removeAudioMapping`, `updateAudioMapping`).
   - `removeEffect` in store automatically prunes orphaned modulation mappings targeting deleted passes.
   - Built `AudioPanel.tsx` in `RightRail.tsx`:
     - Explicit `Enable Audio` / `Disable Audio` action button.
     - Status chip: `off` (neutral), `waiting for click` (amber), `live` (emerald pulse), `denied` (red), `unavailable` (muted) per D-13.
     - Radio selector for `Video Audio` vs `Microphone` (D-10).
     - Master Sensitivity slider and smoothing presets.
     - Modulation mapping rows: target effect pass, target parameter, frequency band (bass/mid/treble), and modulation depth slider (-100% to +100%).

4. **Zero-Churn RAF Render Loop Modulation (`web/src/components/layout/CenterStage.tsx`)**:
   - Maintained single `AudioReactivityEngine` instance in `useRef` outside React lifecycle.
   - In RAF render loop:
     - If audio is enabled and live, sampled analyser into pre-allocated buffer with elapsed `deltaMs`.
     - Computed modulated values: `baseValue + bandEnergy * amount * range`, clamped to parameter schema `[min, max]`.
     - Pushed modulated parameter values directly to pipeline uniforms via `pipeline.updateUniform(...)`.
     - Executed with ZERO React component re-renders during the 60 FPS animation loop (D-12).
   - Added `useEffect` restoring base parameters whenever audio reactivity is disabled or paused.

5. **Automated Unit Tests (`web/src/tests/audioEngine.test.ts`)**:
   - 18 comprehensive tests verifying:
     - Singleton `AudioContext` and `AnalyserNode` reuse without duplicate instances.
     - `fftSize = 256` and 128-element buffer allocation.
     - Source toggling and microphone track lifecycle stopping.
     - FFT bin partitioning into Bass (0-2), Mid (3-14), and Treble (15-63).
     - Asymmetric attack/release envelope mathematical curves (1-1/e attack, 1/e release decay).
     - Sensitivity scaling and strict `[0.0, 1.0]` clamping.
     - `useStudioStore` audioState actions and orphan mapping cleanup.
     - `AudioPanel` rendering, activation click handling, and mapping row additions.

## Verification & Results

- `npm --prefix web run test:unit`: 103 tests passing across 9 test suites (`audioEngine.test.ts`, `colorMath.test.ts`, `masks.test.ts`, `tracerPipeline.test.ts`, `stackStore.test.ts`, `graphCompiler.test.ts`, `capabilities.test.ts`, `store.test.ts`, `videoExport.test.ts`).
- `npm --prefix web run build`: Production bundle built in 1.95s with zero TypeScript compilation errors.
- Python tests: `ruff check src tests` passed with 0 errors; `mypy src` passed with 0 issues across 23 source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ParameterType comparison and type casting in CenterStage & AudioPanel**
- **Found during:** Task 3 verification (`npm --prefix web run build`)
- **Issue:** TypeScript error TS2367 indicated comparison of `ParameterType` to `'number'` had no overlap (registry defines `ParameterType = 'float' | 'int' | 'boolean' | 'select'`), and `pass.parameters` is typed `string | number | boolean`.
- **Fix:** Updated type checks to `schema.type === 'float' || schema.type === 'int'` and cast base values with `Number(...)`.
- **Files modified:** `web/src/components/layout/CenterStage.tsx`, `web/src/components/panels/AudioPanel.tsx`
- **Commit:** `a9a8ed9`

**2. [Rule 1 - Bug] JSX syntax inside .ts test file**
- **Found during:** Task 3 test run
- **Issue:** Vitest oxc parser threw error parsing `<AudioPanel />` JSX inside `web/src/tests/audioEngine.test.ts`.
- **Fix:** Used `React.createElement(AudioPanel)` to preserve `.ts` file naming while maintaining full test coverage.
- **Files modified:** `web/src/tests/audioEngine.test.ts`
- **Commit:** `a9a8ed9`

## Self-Check: PASSED
- FOUND: web/src/export/audioGraph.ts
- FOUND: web/src/engine/audio/AudioReactivityEngine.ts
- FOUND: web/src/components/panels/AudioPanel.tsx
- FOUND: web/src/tests/audioEngine.test.ts
- Commit ffab91d verified in HEAD history
- Commit 2ec1f86 verified in HEAD history
- Commit a9a8ed9 verified in HEAD history
