# Stack Research

**Domain:** Browser-Based Real-Time Visual Effects & Media Processing Studio
**Researched:** 2026-11-21
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Three.js (WebGPU / TSL)** | `^0.187.0` | Real-time GPU shader pipeline, multi-pass compositing, post-processing | Already established in v1.0. Three.js Transpiler / Shading Language (`three/tsl`) and `three/webgpu` provide vendor-agnostic WebGPU compute/fragment shaders with automatic, seamless WebGL2 fallback. Enables modular node-based pass composition and uniform reactivity. |
| **Vitest** | `^3.0.7` | Frontend unit & component testing for `web/` | Native Vite integration, instant HMR test execution, ESM first-class support, TypeScript zero-config, compatible with `@testing-library/react`. Replaces missing frontend test runner. |
| **Playwright** | `^1.50.1` | Headless browser End-to-End (E2E) testing | Cross-browser automation with Chromium WebGPU testing flags (`--enable-unsafe-webgpu`, `--use-gl=angle`). Tests canvas rendering, drag-and-drop ingestion, media export workflows, and keyboard/dialog accessibility. |
| **idb** | `^8.0.2` | Minimal IndexedDB Promise wrapper | Lightweight (~1.1KB gzip) idiomatic Promise-based wrapper by Jake Archibald over native browser IndexedDB. Zero dependencies, supports structured cloning, schema version transitions, and transaction management without heavyweight ORM overhead. |
| **Web Audio API** | Native Web Platform | Real-time audio analysis (FFT), track decoding, and recorder stream routing | Native browser capability (`AudioContext`, `AnalyserNode`, `MediaStreamAudioDestinationNode`). Zero runtime bundle footprint. Decoupled frequency/time-domain data extraction for audio-reactive shader uniforms and audio-video muxing. |
| **FastAPI** | `^0.135.2` | High-throughput asynchronous backend microservice | High-performance Python 3.10+ async web framework on Uvicorn. Superintends FFmpeg transcoding, Turnstile token checks, streaming chunk assembly, and cancellation signals under Render free-tier constraints (<512MB RAM). |
| **Schemathesis** | `^3.39.11` | Property-based API contract testing | Automatically validates backend FastAPI OpenAPI contracts against boundary inputs, malformed multipart chunks, and unauthorized headers. |
| **@neondatabase/serverless** | `^0.10.4` | Serverless PostgreSQL driver for cloud backup & presets | Connection-pooling WebSocket/HTTP driver designed for edge runtimes (Cloudflare Pages) and serverless backends connecting to Neon Serverless PostgreSQL ($0/month tier). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@testing-library/react** | `^16.2.0` | React component integration tests | Testing UI components (HUD, drawers, modals, timeline) in Vitest with user-event simulations. |
| **happy-dom** | `^17.1.6` | Lightweight DOM environment for Vitest | Faster than JSDOM for non-canvas React DOM tests in unit suites. |
| **lz-string** | `^1.5.0` | Fast URL-safe string compression | Compressing preset recipes and project shader state into shareable URL hash links (`#preset=...`) without database hits. |
| **PyJWT** | `^2.10.1` | Stateless cryptographic token signing & decoding | Optional anonymous/user account authentication tokens for cloud sync without session state. |
| **psutil** | `^7.2.2` | Process monitoring & memory RSS tracking | Server-side memory guarding (<137MB RSS) and process group cleanup during transcode cancellation. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **GoogleChrome/modern-web-guidance** | Platform pattern compliance & legacy scanner | Run `npx modern-web-guidance legacy-scan web --json` to enforce modern web standards (AbortSignal, error causes, dialogs, ARIA, content-visibility). |
| **Ruff** | Ultra-fast Python linter and formatter | Enforces PEP 8, pyflakes, and code quality in backend `src/`. |
| **Mypy** | Strict static type checker for Python | Validates type safety across `src/` modules. |
| **TypeScript** | Static typing for React & Three.js | Strict null checks and WebGPU/TSL type validation in `web/`. |

## Installation

```bash
# Frontend Testing & Storage (web/)
cd web
npm install idb lz-string
npm install -D vitest @testing-library/react @testing-library/jest-dom happy-dom @playwright/test

# Install Playwright browser binaries
npx playwright install chromium

# Backend Testing & Contract Verification (root)
pip install "schemathesis>=3.39.11" "pytest-asyncio>=0.23.0" "pyjwt>=2.10.1"
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **idb** (~1.1KB) | Dexie.js (~30KB) / LocalForage | Use Dexie only if complex multi-table indexing and SQL-like relational queries are required. For ASCII Studio's document-like project structure, `idb` offers pure native promise ergonomics with zero bloat. |
| **Native Web Audio API** | Tone.js (~150KB) / Howler.js | Use Tone.js for complex musical synthesis or sequencer sequencing. For reactive shader FFT spectrum and stream muxing, native `AnalyserNode` and `AudioContext` have zero bundle penalty and direct typed array outputs. |
| **Vitest** | Jest | Use Jest only in legacy Node CommonJS codebases. Vitest shares Vite configuration, plugins, and transform pipeline with instant startup. |
| **Playwright** | Cypress / Selenium | Use Cypress for basic web apps; Playwright is strictly required here for headless WebGPU flag emulation (`--enable-unsafe-webgpu`) and multi-context worker isolation. |
| **lz-string (Client hash)** | Backend URL Shortener Database | Use a database URL shortener if URLs must be under 30 characters. Client-side lz-string compression in hash fragments enables 100% serverless, zero-maintenance sharing with $0 cloud cost. |
| **Native structuredClone()** | lodash.cloneDeep | Modern Web Guidance rule: `structuredClone` is built into all modern browsers; zero bundle weight, handles circular references and typed arrays natively. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Redux / Redux Toolkit / MobX** | Adds massive boilerplate and complex action dispatchers for a real-time 60fps canvas app where state mutations need minimal overhead. | Zustand stores with selective subscriptions and native shallow diffing. |
| **lodash / underscore** | Bloats client bundle with legacy polyfills for tasks now native in standard JavaScript. | Native ES2024 features: `structuredClone()`, `.toSorted()`, `.toSpliced()`, `.with()`, `Object.groupBy()`. |
| **html2canvas / dom-to-image** | Cannot capture WebGPU or WebGL2 contexts reliably; attempts to re-render DOM to SVG, resulting in black frames or severe lag. | Direct WebGL/WebGPU render target readback or `canvas.toBlob()` / `canvas.captureStream()`. |
| **Dedicated GPU Cloud Instances (AWS EC2 G4, etc.)** | Violates the strict $0/month budget constraint; requires persistent expensive instances. | Client-side WebGPU/Canvas rendering for real-time interaction; Render Free Web Service (CPU FFmpeg) for export. |
| **Tone.js** | Unnecessary abstraction layer that wraps Web Audio and increases JS bundle size by >150KB. | Native Web Audio `AudioContext` + `AnalyserNode` + typed array `getByteFrequencyData`. |
| **Raw JSON.parse(JSON.stringify()) for State Snapshots** | Drops typed arrays, dates, maps, sets, and throws on cyclic references. Corrupts performance on undo/redo. | Native `structuredClone()`. |

## Stack Patterns by Variant

**If Client Environment supports WebGPU (`navigator.gpu` available):**
- Use Three.js `WebGPURenderer` with compute/TSL shader nodes.
- Maximum performance, direct storage buffer bindings, 60+ FPS at 4K canvas resolutions.

**If Client Environment lacks WebGPU (Mobile / older browsers / Firefox standard):**
- Use Three.js `WebGPURenderer({ forceWebGL: true })` fallback.
- Transparently executes compiled GLSL passes via TSL node translator without code changes.

**If User is Anonymous ($0/month default):**
- Store all projects, custom ramps, presets, and history in local `IndexedDB`.
- Share projects via compressed URL hash (`#project=...`) via `lz-string`. Zero server footprint.

**If User opts into Cloud Sync (Optional):**
- Authenticate via stateless JWT; store encrypted project metadata and recipes in Neon Serverless PostgreSQL ($0 free tier).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `three@^0.187.0` | `@types/three@^0.187.0` | TSL imports from `three/tsl` and WebGPU renderer from `three/webgpu`. |
| `react@^19.3.1` | `@testing-library/react@^16.2.0` | Requires Testing Library v16+ for React 19 support. |
| `vitest@^3.0.7` | `vite@^8.3.8` | Vitest 3+ seamlessly integrates with Vite 8. |
| `tailwindcss@^4.3.5` | `@tailwindcss/vite@^4.3.5` | Pure Vite plugin with zero PostCSS configuration file. |
| `fastapi@^0.135.2` | `pydantic>=2.0` | Strict async schema validation. |

## Sources

- Context7 / npm Registry — Pinned latest verified package versions (`three`, `vitest`, `playwright`, `idb`, `fastapi`).
- Google Chrome Modern Web Guidance (`https://github.com/GoogleChrome/modern-web-guidance`) — Web platform standards: `content-visibility`, `structuredClone`, `AbortSignal.timeout`, `AbortSignal.any`, error causes.
- WebGPU Working Group / Three.js Documentation — TSL (`three/tsl`) node-based composable post-processing architecture.

---
*Stack research for: Browser-Based Real-Time Visual Effects & Media Processing Studio*
*Researched: 2026-11-21*
