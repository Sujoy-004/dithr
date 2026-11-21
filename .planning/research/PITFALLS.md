# Pitfalls Research

**Domain:** Browser-Based Real-Time Visual Effects & Media Processing Studio (Milestone v2.0 Professional Studio)
**Researched:** 2026-11-21
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: WebGPU Context Loss & VRAM Texture Leaks

**What goes wrong:**
Adding, toggling, or reordering post-processing passes repeatedly in the composable pipeline creates new Three.js textures and render targets without disposing old ones. Eventually, GPU VRAM is exhausted; the browser crashes the GPU process and fires a `webglcontextlost` or WebGPU device loss event, turning the canvas black.

**Why it happens:**
In Three.js WebGPU / TSL, materials, node passes, and render targets are not automatically garbage collected by JavaScript. When effects are deleted or replaced, if `.dispose()` is not explicitly called on the render target, texture, and material, GPU memory remains allocated.

**How to avoid:**
1. Implement an explicit `PassPool` and texture lifecycle manager.
2. When disposing a pass or tearing down the pipeline, traverse all render targets, textures, and geometry, invoking `.dispose()`.
3. Listen for WebGPU device lost events (`device.lost`) and WebGL `webglcontextlost` to trigger a clean pipeline restart rather than failing silently.

**Warning signs:**
Browser memory tab shows steadily increasing GPU process memory; frame rate degrades over time when switching presets; Chrome task manager shows GPU Process climbing past 1GB.

**Phase to address:**
Phase 1 (Reliability & Performance Foundation) and Phase 2 (Shader Engine 2.0).

---

### Pitfall 2: MediaRecorder Audio/Video Track Desync & Silent WebM Clips

**What goes wrong:**
When recording WebM clips client-side from an imported video with sound, the resulting video either has no sound at all, or the audio drifts out of sync by hundreds of milliseconds over a 5-second clip.

**Why it happens:**
`canvas.captureStream(30)` generates a video stream driven by canvas paint ticks, while `AudioContext.createMediaStreamDestination()` generates an independent audio stream driven by the hardware audio clock. If the canvas drops frames due to GPU load or if audio is started before the first video frame renders, timestamps diverge.

**How to avoid:**
1. Combine video and audio tracks explicitly: `new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()])`.
2. Start the `MediaRecorder` only after the `HTMLVideoElement` is playing and the first canvas frame is rendered.
3. Keep canvas dimensions and capture frame rate fixed (e.g. 30 FPS) throughout the recording duration.

**Warning signs:**
Exported `.webm` file plays video but has 0 audio tracks; media player audio timeline is shorter or longer than video track.

**Phase to address:**
Phase 1 (Reliability & Performance Foundation).

---

### Pitfall 3: FFmpeg Subprocess Zombie Leak on Export Cancellation

**What goes wrong:**
When a user cancels an in-progress export from the UI, the FastAPI backend marks the job status as `cancelled`, but the underlying FFmpeg subprocess continues running in the background until the full transcode finishes. Multiple cancellations cause multiple FFmpeg processes to run concurrently, consuming 100% CPU and triggering Render free-tier OOM container termination.

**Why it happens:**
Canceling an async task (`task.cancel()`) or setting a database flag does not automatically send a kill signal to external subprocesses spawned via `asyncio.create_subprocess_exec` unless explicit cancellation cleanup logic is wired to `SIGTERM` / `os.killpg`.

**How to avoid:**
1. Spawn the FFmpeg process with `start_new_session=True` (or `CREATE_NEW_PROCESS_GROUP` on Windows).
2. Wire an `asyncio.Event` or task cancellation handler that explicitly sends `os.killpg(os.getpgid(process.pid), signal.SIGTERM)` followed by `SIGKILL` if it doesn't terminate within 2 seconds.
3. Clean up partial files in the `/tmp` export directory immediately upon process termination.

**Warning signs:**
Server CPU stays at 100% even after jobs are canceled; Render logs report `Container exceeded memory limit (512MB)` minutes after user closed the export modal.

**Phase to address:**
Phase 1 (Reliability & Performance Foundation).

---

### Pitfall 4: IndexedDB Storage Eviction & Quota Exceeded

**What goes wrong:**
Attempting to store large video files, full-resolution frame caches, or huge history snapshots directly inside IndexedDB hits the browser storage quota or triggers automatic browser eviction during low-disk situations, losing all saved user projects.

**Why it happens:**
Developers treat IndexedDB like an unlimited hard drive. Storing decoded video frames or multi-megabyte binary blobs rapidly balloons IndexedDB size.

**How to avoid:**
1. Store only lightweight project recipes and metadata (JSON parameters, custom ASCII ramps, keyframe tracks, layer trees) in IndexedDB.
2. Never store raw source video files in IndexedDB; store references or prompt the user to re-link media if needed.
3. Request persistent storage permission (`navigator.storage.persist()`) so the browser does not evict user projects during disk cleanup.

**Warning signs:**
`QuotaExceededError` thrown during save; user reopens application and finds previously saved projects missing after disk cleanup.

**Phase to address:**
Phase 4 (Persistence, Community & Distribution).

---

### Pitfall 5: Main Thread INP Congestion During FFT Analysis & Export

**What goes wrong:**
While running audio-reactive shaders or encoding a client GIF, the UI freezes completely: buttons cannot be clicked, the HUD does not respond, and Chrome flags an INP (Interaction to Next Paint) violation (>500ms).

**Why it happens:**
Running heavy JavaScript loops synchronously (such as reading 2048 FFT bins, computing complex palette quantization in `gifenc`, or copying huge typed arrays) blocks the browser main thread without yielding.

**How to avoid:**
1. Follow Google Chrome Modern Web Guidance: use `scheduler.yield()` (with fallback) inside loops exceeding 50ms.
2. Downsample FFT size (`fftSize: 256` or `128`) for shader uniforms—only bass, mid, and treble energy bands are needed, not individual frequency bins.
3. Offload GIF frame quantization to a Web Worker or slice encoding across animation frames.

**Warning signs:**
Browser UI feels unresponsive during export; Chrome DevTools Performance panel shows long red task blocks >100ms.

**Phase to address:**
Phase 1 (Performance Foundation) and Phase 2 (Audio-Reactive Shaders).

---

### Pitfall 6: AudioContext Autoplay Policy Blocking

**What goes wrong:**
The audio-reactive visualizer or video audio routing fails silently on page load with a browser console warning: `The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page`.

**Why it happens:**
All modern browsers block Web Audio playback and analysis until the user performs an explicit interaction (click, tap, keypress).

**How to avoid:**
1. Keep `AudioContext` in `suspended` state initially.
2. On any user interaction (clicking play, dragging a media file, selecting a preset), call `await audioContext.resume()`.
3. Display a subtle "Click to enable audio reaction" prompt if the user tries to activate audio-reactive mode before interacting.

**Warning signs:**
Audio-reactive shaders produce static flat output (all frequency uniforms are 0.0); console shows `Autoplay policy prevented AudioContext from starting`.

**Phase to address:**
Phase 1 (Lifecycle) and Phase 2 (Audio-Reactive FX).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Using `JSON.parse(JSON.stringify())` for undo snapshots | Quick to write | Drops typed arrays, dates, throws on circular refs, slow | Never — use native `structuredClone()` per Modern Web Guidance |
| Re-creating new `AudioContext` per video change | Avoids managing graph state | Throws browser error (`max audio contexts exceeded`), memory leaks | Never — use singleton `getOrCreateAudioGraph()` |
| Polling export status with fixed `setInterval` | Easy to implement | Floods server with requests, battery drain | Only with exponential backoff and `AbortSignal.timeout()` |
| Hardcoding shader uniforms in monolithic shader files | Fast initial development | Makes effect reordering impossible; duplicated code | Never in v2.0 — use modular TSL effect nodes |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Web Audio + MediaRecorder** | Connecting `MediaElementAudioSourceNode` multiple times to the same video element | Throws uncatchable `InvalidStateError`; maintain a singleton map of attached elements. |
| **Three.js WebGPU + TSL** | Mixing WebGL1/2 GLSL strings directly into TSL node materials | Breaks WebGPU compilation; write pure TSL node functions (`fn(() => ...)`) that compile to both WGSL and GLSL. |
| **FastAPI + FFmpeg** | Writing chunks to disk without verifying sequence index | Out-of-order chunks corrupt the MP4 container; validate strictly that `chunk_index == expected_index`. |
| **Cloudflare Pages + Turnstile** | Validating Turnstile on every trivial GET request | Slows down static asset loading; enforce Turnstile only on mutating `POST /api/export` endpoints. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| **High-DPI 4K Canvas Without Clamping** | Sluggish 15 FPS on MacBook Retina displays | Clamp `devicePixelRatio` to `Math.min(window.devicePixelRatio, 2.0)` | Any 4K or Retina screen |
| **Allocating New Float32Arrays in Render Loop** | Frequent Garbage Collection pauses / micro-stutters | Allocate FFT and uniform arrays once outside the loop; reuse instances | During 60fps playback |
| **Unbounded In-Memory Export Chunks** | Python backend RAM reaches 512MB and crashes | Use streaming generator that writes directly to disk pipe; limit in-flight chunks to 5 | Multiple concurrent exports |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| **Relying on File Extension for Uploads** | Malicious executable or polyglot uploaded as `.mp4` | Inspect file header magic bytes (`ftypmp42`, `RIFF....WEBM`, `\xFF\xD8\xFF`) in `security.py`. |
| **Missing Rate Limit on Audio Uploads** | Denial of Service attacking disk storage | Apply SlowAPI limiter (`@limiter.limit("5/minute")`) to `POST /api/export/{id}/source-audio`. |
| **Exposing Detailed Stack Traces in API Responses** | Leaking server file paths and internal architecture | Return sanitized error responses while logging full `{ cause: err }` internally. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| **Destructive Preset Application** | User clicks a preset and instantly loses all their customized shader settings with no way back | Push current state to undo history before applying preset; show undo toast. |
| **Silent Export Failures** | Export modal spinner spins forever with no feedback when connection drops | Add declarative timeout (`AbortSignal.timeout(30000)`) with clear retry error messages. |
| **Hidden Audio Autoplay Warnings** | User thinks audio-reactive mode is broken because browser blocked audio | Visual indicator showing "Microphone/Audio muted — click to enable". |

## "Looks Done But Isn't" Checklist

- [ ] **Export Cancellation:** Often flips UI state to "Cancelled" but leaves FFmpeg running on server — verify subprocess PID terminates with `psutil`.
- [ ] **Audio/Video Sync Recording:** Often plays fine locally but exported WebM has silent audio track — verify exported file has valid Opus/AAC audio track in VLC or media inspector.
- [ ] **Client Animated GIF:** Often exports a valid GIF that only displays a single static frame — verify that changing visual animations (e.g. matrix rain or video playback) animate across GIF frames.
- [ ] **Undo/Redo Stack:** Often restores parameters but fails to update Three.js shader uniforms — verify canvas visual changes when pressing Ctrl+Z.
- [ ] **IndexedDB Persistence:** Often saves project state but fails on page reload due to schema migration errors — verify cold page refresh restores project.
- [ ] **Dialog Accessibility:** Often looks like a modal but allows keyboard focus to tab out onto background canvas — verify focus trap and `Escape` key dismissal.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| **WebGPU Context Lost** | MEDIUM | Listen for context lost event, dispose current renderer instance, instantiate fallback WebGL2 renderer, recompile active passes. |
| **FFmpeg Subprocess Hang** | LOW | Backend janitor background task monitors jobs older than 5 minutes, kills corresponding process groups, and cleans up `/tmp`. |
| **IndexedDB Schema Corruption** | LOW | Catch version upgrade errors; provide exportable JSON rescue dump before resetting database. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| FFmpeg Subprocess Zombie Leak | Phase 1 (Reliability Foundation) | Automated test canceling export and asserting `psutil.pid_exists(pid) == False`. |
| MediaRecorder Audio/Video Desync | Phase 1 (Reliability Foundation) | Browser test asserting exported WebM has `audioTracks.length > 0`. |
| Upload Security & Size Limits | Phase 1 (Reliability Foundation) | Contract tests uploading >50MB files and invalid magic bytes, expecting 413 and 400. |
| WebGPU Context Loss & VRAM Leaks | Phase 2 (Shader Engine 2.0) | Stress test cycling through 50 preset switches while asserting stable GPU memory. |
| Main Thread INP Blocking | Phase 2 & 3 (Engine & Workspace) | Chrome DevTools Lighthouse audit verifying INP < 200ms during audio-reactive playback. |
| IndexedDB Quota Exceeded | Phase 4 (Persistence) | Storage test validating projects serialize only recipes, keeping DB size < 1MB. |

## Sources

- W3C Web Audio API Autoplay Guide (`https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices`).
- Google Chrome Modern Web Guidance (`performance`, `js`, `security`).
- Three.js WebGPU / TSL Resource Management documentation.
- Production incident reports and verified gaps documented in `.planning/PROJECT.md`.

---
*Pitfalls research for: Browser-Based Real-Time Visual Effects & Media Processing Studio (Milestone v2.0)*
*Researched: 2026-11-21*
