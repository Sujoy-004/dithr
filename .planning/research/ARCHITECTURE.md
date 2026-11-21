# Architecture Research

**Domain:** Browser-Based Real-Time Visual Effects & Media Processing Studio (Milestone v2.0 Professional Studio)
**Researched:** 2026-11-21
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Client Layer (React 19 / Vite SPA)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ Viewport HUD │  │ Control Dock │  │ Timeline /   │  │ Export Modal │    │
│  │ & Canvas     │  │ & Presets    │  │ Keyframes    │  │ & Drawer     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │            │
├─────────┴─────────────────┴─────────────────┴─────────────────┴────────────┤
│                       Engine & Coordination Subsystems                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌───────────────┐ │
│  │ Three.js TSL Pipeline   │  │ Web Audio Graph & FFT │  │ Client State  │ │
│  │ (WebGPU / WebGL2 Passes)│  │ (AnalyserNode & Mux)  │  │ & History     │ │
│  └───────────┬─────────────┘  └───────────┬───────────┘  └───────┬───────┘ │
│              │                            │                      │         │
├──────────────┴────────────────────────────┴──────────────────────┴─────────┤
│                        Data Storage & Export Adapters                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌───────────────┐ │
│  │ IndexedDB Storage       │  │ Client MediaRecorder  │  │ FastAPI HTTP  │ │
│  │ (`idb` Projects/Presets)│  │ & GIF Encoder Engine  │  │ Export Client │ │
│  └─────────────────────────┘  └───────────────────────┘  └───────┬───────┘ │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │ (HTTP/JSON)
┌──────────────────────────────────────────────────────────────────▼──────────┐
│             Backend Processing Service (FastAPI / Render Free Tier)         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌───────────────┐ │
│  │ Security & Rate Limiter │  │ Job Coordinator       │  │ Async Process │ │
│  │ (Turnstile / CIDR / Slow│  │ (In-Memory Jobs Store)│  │ Supervisor    │ │
│  └─────────────────────────┘  └───────────┬───────────┘  └───────┬───────┘ │
│                                           │                      │         │
│                               ┌───────────▼──────────────────────▼───────┐ │
│                               │ Low-Memory Streaming FFmpeg Subprocess   │ │
│                               │ (Bounded Chunks, RSS Guard <137MB)       │ │
│                               └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **StudioPipeline** (`web/src/engine/Pipeline.ts`) | Orchestrates the multi-pass shader graph; compiles TSL nodes; binds uniforms; executes render loop. | Three.js `WebGPURenderer`, TSL `pass()`, `texture()`, `uniform()`, ping-pong `RenderTarget`s. |
| **AudioGraph** (`web/src/export/audioGraph.ts`) | Singleton audio context manager; decodes audio tracks; computes FFT frequency bands; routes audio to speakers and media stream. | Web Audio API `AudioContext`, `AnalyserNode`, `MediaElementAudioSourceNode`, `MediaStreamAudioDestinationNode`. |
| **Studio Store** (`web/src/store/studioStore.ts`) | Centralized reactive client state: media source, active effect stack, tone settings, and UI toggles. | Zustand store with selective React subscriptions. |
| **HistoryManager** (`web/src/store/history.ts`) | Non-destructive Undo / Redo engine tracking state snapshots with forward/backward cursor. | Command pattern with immutable state deep cloning via native `structuredClone()`. |
| **StorageRepository** (`web/src/services/storage.ts`) | Local persistence for user projects, presets, and temporary autosave recovery. | IndexedDB wrapper (`idb`) with schema migration handlers. |
| **ExportCoordinator** (`web/src/export/`) | Drives client-side recordings (SVG, PNG, WebM with audio, animated GIF) and server transcode chunking. | `canvas.captureStream()`, `MediaRecorder`, `gifenc`, `fetch()` with `AbortSignal.any()`. |
| **Backend Export API** (`src/api/routes/export.py`) | Receives transcode jobs, validates payloads, enforces rate limits, orchestrates FFmpeg subprocess. | FastAPI async route handlers, `psutil` memory tracking, `asyncio.subprocess`. |
| **Subprocess Janitor** (`src/api/janitor.py`) | Cleans up orphaned jobs, expired download files, and killed FFmpeg child processes. | Periodic background asyncio task. |

## Recommended Project Structure

```
ASCII/
├── .planning/                  # GSD planning, research, milestones, and state
│   ├── codebase/               # Codebase maps and conventions
│   ├── milestones/             # Archived milestone records
│   └── research/               # Milestone research documents (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
├── src/                        # Python backend application
│   ├── api/                    # FastAPI microservice
│   │   ├── routes/             # Route handlers (health, export, auth/projects)
│   │   ├── config.py           # Environment and service configuration
│   │   ├── janitor.py          # Temporary file and expired job cleaner
│   │   ├── jobs.py             # In-memory export job registry & status tracking
│   │   ├── limiter.py          # SlowAPI rate limiting configuration
│   │   ├── security.py         # Turnstile, CIDR, and upload security validation
│   │   └── transcode.py        # FFmpeg subprocess coordinator with cancellation
│   ├── config.py               # Shared backend constants & presets
│   ├── renderer.py             # Rec. 601 luminance and ANSI escape math (test-only core)
│   ├── smoothing.py            # Temporal smoothing logic
│   ├── sync.py                 # Playback timeline and clock
│   └── video.py                # Video container inspection utilities
├── tests/                      # Python automated test suite
│   ├── test_api_*.py           # FastAPI integration, security, and contract tests
│   └── test_*.py               # Core unit and regression tests
├── web/                        # React 19 / Vite frontend application
│   ├── src/
│   │   ├── components/         # UI components (Dock, HUD, Modals, Timeline, Canvas)
│   │   ├── engine/             # Three.js WebGPU / TSL rendering engine
│   │   │   ├── shaders/        # Individual TSL effect shader nodes
│   │   │   ├── Pipeline.ts     # Composable multi-pass shader pipeline
│   │   │   ├── Renderer.ts     # WebGPURenderer lifecycle with WebGL2 fallback
│   │   │   └── TextureAtlas.ts # Monospace character font texture atlas
│   │   ├── export/             # Export drivers (image, text, SVG, video, server)
│   │   │   ├── audioGraph.ts   # Web Audio graph and FFT analyzer
│   │   │   ├── videoExport.ts  # WebM (audio+video) and animated GIF recorders
│   │   │   └── serverExport.ts # Chunked backend export client with AbortSignal
│   │   ├── services/           # Storage, API clients, and telemetry
│   │   │   ├── storage.ts      # IndexedDB project repository (`idb`)
│   │   │   └── exportApi.ts    # Backend export HTTP client with timeout & cancellation
│   │   ├── store/              # Zustand state stores & history manager
│   │   │   ├── studioStore.ts  # Main studio state
│   │   │   ├── history.ts      # Undo/Redo stack with structuredClone
│   │   │   └── timeline.ts     # Keyframe and layer state
│   │   └── types/              # TypeScript interfaces and schema types
│   ├── tests/                  # Frontend unit & component tests (Vitest)
│   └── e2e/                    # Headless browser tests (Playwright)
├── docs/                       # Architecture diagrams and SQL schemas
├── render.yaml                 # Render infrastructure configuration
└── wrangler.toml               # Cloudflare Pages configuration
```

### Structure Rationale

- **Clear Separation of Concerns**: Frontend (`web/`) owns all 60fps real-time visual interactions, user controls, and local state. Backend (`src/api/`) owns heavy transcoding and video processing.
- **Dedicated Engine Directory**: `web/src/engine/` encapsulates Three.js WebGPU/TSL code, isolating shader math from React UI components.
- **Centralized Export Subsystem**: `web/src/export/` houses client-side recorders and server export drivers, standardizing stream handling and error chaining.
- **Hermetic Test Directories**: `web/tests/` (Vitest) and `web/e2e/` (Playwright) sit cleanly alongside existing Python `tests/`, ensuring tests are easy to run in CI.

## Architectural Patterns

### Pattern 1: Composable TSL Pass Pipeline

**What:** Multi-effect chain where arbitrary shader nodes can be dynamically inserted, reordered, toggled, or bypassed using Three.js TSL nodes and render-target ping-ponging.
**When to use:** In `web/src/engine/Pipeline.ts` to replace the rigid 4-stage pipeline with flexible user-defined effect stacks.
**Trade-offs:** Slightly higher GPU texture allocation overhead; mitigated by pooling render targets of matching resolution.

**Example:**
```typescript
import * as THREE from 'three/webgpu';
import { pass, uniform, texture } from 'three/tsl';

export interface EffectPass {
  id: string;
  name: string;
  enabled: boolean;
  createNode: (inputTextureNode: any, uniforms: Record<string, any>) => any;
  uniforms: Record<string, any>;
}

export class ComposablePipeline {
  private passes: EffectPass[] = [];

  public compileChain(sourceTextureNode: any): any {
    let currentInput = sourceTextureNode;

    for (const effect of this.passes) {
      if (effect.enabled) {
        // Wrap output in a post-processing pass node
        const effectOutput = effect.createNode(currentInput, effect.uniforms);
        currentInput = pass(effectOutput);
      }
    }

    return currentInput;
  }
}
```

### Pattern 2: Immutable Command History for Undo/Redo

**What:** Non-destructive history stack utilizing modern JavaScript built-in `structuredClone()` to create deep copies of project snapshots, and `.toSpliced()` to trim future history on new actions.
**When to use:** In `web/src/store/history.ts` for instant Ctrl+Z / Ctrl+Y undo/redo.
**Trade-offs:** Memory consumption for large stacks; mitigated by setting a maximum history depth (e.g. 50 snapshots).

**Example:**
```typescript
export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function pushHistory<T>(current: HistoryState<T>, nextPresent: T, maxDepth = 50): HistoryState<T> {
  const clonedCurrent = structuredClone(current.present);
  const newPast = [...current.past, clonedCurrent].slice(-maxDepth);

  return {
    past: newPast,
    present: structuredClone(nextPresent),
    future: [], // New action truncates future redo branch
  };
}

export function undo<T>(current: HistoryState<T>): HistoryState<T> {
  if (current.past.length === 0) return current;

  const previous = current.past[current.past.length - 1];
  const newPast = current.past.toSpliced(-1, 1);

  return {
    past: newPast,
    present: previous,
    future: [current.present, ...current.future],
  };
}
```

### Pattern 3: Subprocess Lifetime & Cancellation Token

**What:** Robust async subprocess supervision where an incoming HTTP cancellation aborts the asyncio task, kills the entire FFmpeg process group via `os.killpg`, and frees disk/memory immediately.
**When to use:** In backend `src/api/transcode.py` to prevent zombie FFmpeg processes on Render free tier.
**Trade-offs:** Requires platform-specific process group creation (`setsid` on POSIX, `CREATE_NEW_PROCESS_GROUP` on Windows).

**Example:**
```python
import asyncio
import os
import signal
import sys

async def run_cancellable_ffmpeg(cmd: list[str], cancel_event: asyncio.Event) -> None:
    # Spawn in a new process group so child processes can be terminated together
    kwargs = {}
    if sys.platform != "win32":
        kwargs["start_new_session"] = True
    else:
        kwargs["creationflags"] = 0x00000200 # CREATE_NEW_PROCESS_GROUP

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        **kwargs
    )

    async def wait_process():
        return await process.communicate()

    task = asyncio.create_task(wait_process())

    # Wait for either process finish or cancel event
    cancel_task = asyncio.create_task(cancel_event.wait())
    done, _ = await asyncio.wait([task, cancel_task], return_when=asyncio.FIRST_COMPLETED)

    if cancel_task in done:
        # Cancel requested: kill entire process group
        try:
            if sys.platform != "win32":
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            else:
                process.terminate()
        except ProcessLookupError:
            pass
        task.cancel()
        raise asyncio.CancelledError("FFmpeg transcode cancelled by user.")

    stdout, stderr = await task
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg failed with code {process.returncode}: {stderr.decode()}")
```

### Pattern 4: Offscreen Background Throttling via Modern Web Guidance

**What:** Using `content-visibility: auto` and listening for `contentvisibilityautostatechange` on the main canvas viewport to automatically pause rendering loops and Web Audio FFT polling when offscreen or occluded.
**When to use:** In `web/src/components/CanvasViewport.tsx` and `web/src/engine/Pipeline.ts`.
**Trade-offs:** None; saves CPU/GPU battery and VRAM across all modern browsers.

**Example:**
```typescript
export function setupViewportVisibilityThrottling(
  containerEl: HTMLElement,
  onPause: () => void,
  onResume: () => void
): () => void {
  const handler = (event: Event) => {
    const skipped = (event as any).skipped;
    if (skipped) {
      onPause(); // Stop RAF render loop and Web Audio polling
    } else {
      onResume(); // Resume rendering just-in-time
    }
  };

  containerEl.addEventListener('contentvisibilityautostatechange', handler);
  return () => containerEl.removeEventListener('contentvisibilityautostatechange', handler);
}
```

## Data Flow

### Request Flow (Export Job Initialization & Cancellation)

```
[User Clicks Cancel]
       ↓
[ServerExportModal] → [exportApi.cancelExport(id)] (AbortSignal.timeout(5000))
       ↓
[FastAPI /api/export/{id}/cancel]
       ↓
[Jobs Registry] → sets job.cancelled = True, triggers cancel_event
       ↓
[Transcode Task] → catches cancel_event, executes os.killpg(pid)
       ↓
[File Janitor] → deletes partial output files from /tmp
       ↓
[FastAPI Response] → 200 OK {"status": "cancelled"}
       ↓
[Client Modal] → Closes with feedback, restores viewport controls
```

### State Management

```
┌────────────────────────────────────────────────────────┐
│                      Zustand Stores                    │
│  ┌────────────────┐ ┌────────────────┐ ┌─────────────┐ │
│  │  studioStore   │ │  historyStore  │ │timelineStore│ │
│  └────────┬───────┘ └────────┬───────┘ └──────┬──────┘ │
└───────────┼──────────────────┼────────────────┼────────┘
            │                  │                │
            ▼                  ▼                ▼
     [React UI HUD]   [Undo/Redo Actions] [Keyframe Sync]
            │                  │                │
            └──────────┬───────┴────────────────┘
                       ▼
       [StudioPipeline.updateUniforms()]
                       │
                       ▼
            [Three.js WebGPU Canvas]
```

### Key Data Flows

1. **Audio-Reactive Real-Time Modulation**:
   `HTMLVideoElement` / `MicrophoneStream` → `AudioContext.createMediaElementSource()` → `AnalyserNode` (`fftSize: 256`) → Render loop calls `analyser.getByteFrequencyData(dataArray)` → Computes normalized `bass`, `mid`, `treble` floats → Dispatches directly to Three.js TSL uniforms → Shaders modulate ASCII cell size, bloom intensity, or scanlines at 60 FPS with zero React re-renders.
2. **Synchronized Client Media Recording**:
   Canvas active render loop → `canvas.captureStream(30)` provides video tracks. `getOrCreateAudioGraph()` provides audio track via `sharedStreamDest.stream.getAudioTracks()`. Both tracks are combined into `new MediaStream([videoTrack, audioTrack])` → `MediaRecorder` encodes WebM stream with continuous audio/video synchronization → User receives a full playback clip.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-1k users (Current)** | Stateless client-heavy architecture. Zero persistent server state. Render Free Web Service handles occasional 1080p video exports. $0/month total cost. |
| **1k-100k users** | Client continues doing 100% of real-time rendering. Cloudflare Pages edge caches static assets and character atlases. Neon Serverless PostgreSQL handles optional user presets with connection pooling. |
| **100k+ users** | Add client-side WebCodecs video encoding via Web Workers to offload 90% of video exports from Render backend to client hardware; backend becomes reserved for high-end batch conversions. |

### Scaling Priorities

1. **First bottleneck (Server RAM OOM during Export)**: Multiple simultaneous FFmpeg exports on Render free tier (512MB RAM cap).
   - *Fix*: Enforce job concurrency limit (max 1 active FFmpeg task per instance), queue excess requests with 429/retry-after headers, enforce strict 60s length cap.
2. **Second bottleneck (Client GPU Context Loss)**: Stacking too many unoptimized post-processing passes on lower-end mobile GPUs.
   - *Fix*: Capability detection query (`navigator.gpu.requestAdapter()`), render target downsampling, and automatic effect quality tier reduction.

## Anti-Patterns

### Anti-Pattern 1: React State Driving 60 FPS Render Loops

**What people do:** Storing FFT audio frequencies or frame time in React `useState` hooks.
**Why it's wrong:** Triggers 60 React reconciliation passes per second across the entire DOM tree, causing catastrophic frame drops and high INP.
**Do this instead:** Keep render loops and uniforms outside React; mutate Three.js uniforms directly in the RAF loop.

### Anti-Pattern 2: Disregarding Subprocess Groups on Cancellation

**What people do:** Calling `process.terminate()` on a shell script or parent wrapper without killing child processes.
**Why it's wrong:** Leaves underlying FFmpeg executable running orphaned in the background, consuming 100% CPU and exceeding memory limits.
**Do this instead:** Launch processes in their own session (`setsid` / process group) and terminate with `os.killpg`.

### Anti-Pattern 3: Storing Heavy Video Blobs in LocalStorage

**What people do:** Attempting to store Base64 video files in `window.localStorage`.
**Why it's wrong:** Synchronously blocks the main thread, hits the 5MB quota immediately, and throws `QuotaExceededError`.
**Do this instead:** Store project recipes (JSON parameters) in `IndexedDB` (`idb`); reference media via blob URLs or browser file handles.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Cloudflare Pages** | Git-driven static hosting via `wrangler.toml` | Serves client SPA, static fonts, and texture atlases with global edge caching. |
| **Render Web Service** | Docker/Python service via `render.yaml` | Hosts FastAPI backend and FFmpeg binary. Ephemeral disk. |
| **Neon PostgreSQL** | Serverless SQL connection pool via `@neondatabase/serverless` | Optional cloud project/preset storage with zero idle cost. |
| **Cloudflare Turnstile** | Client widget + Backend verification token check | Bot protection for export endpoints without intrusive user captchas. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `UI (React)` ↔ `Engine (Three.js)` | Zustand event subscriptions & direct method calls (`pipeline.setUniform(...)`) | Decoupled; UI never owns Three.js meshes. |
| `Audio Graph` ↔ `Engine` | Direct Float32Array / Uint8Array data transfer per RAF tick | Zero allocation in the loop; reuses pre-allocated typed arrays. |
| `Client` ↔ `Backend API` | REST HTTP multipart streaming with `X-Job-Token` authentication | Bounded chunk backpressure (max 5 chunks in flight). |

## Sources

- Three.js WebGPU / TSL Architecture Specification (`https://threejs.org/docs/`).
- Google Chrome Modern Web Guidance (`js`, `performance`, `security`).
- FastAPI and Python `asyncio.subprocess` concurrency patterns.
- Existing v1.0 architecture maps in `.planning/codebase/ARCHITECTURE.md`.

---
*Architecture research for: Browser-Based Real-Time Visual Effects & Media Processing Studio (Milestone v2.0)*
*Researched: 2026-11-21*
