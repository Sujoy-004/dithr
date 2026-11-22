# Technology Stack

**Analysis Date:** 2026-11-22

## Languages

**Primary:**
- Python `>=3.10` — core terminal renderer/CLI (`src/*.py`) and FastAPI export backend (`src/api/*.py`). Declared in `pyproject.toml` (`requires-python = ">=3.10"`, classifiers 3.10–3.13).
- TypeScript `7.0.2` — web studio (`web/src/**/*.ts`, `web/src/**/*.tsx`). Declared as a devDependency in `web/package.json`, locked at `7.0.2` in `web/package-lock.json`.

**Secondary:**
- SQL (PostgreSQL dialect) — `docs/database-schema.sql` only; a future-persistence blueprint for Neon Serverless Postgres. Not executed by any runtime code.
- CSS — Tailwind CSS v4 utility layer (`web/src/index.css` uses `@import 'tailwindcss'`) plus hand-authored `web/src/landing.css`.
- HTML — three Vite entry documents: `web/index.html` (landing), `web/studio/index.html` (studio), `web/404.html`.

**Not present:** JavaScript in the Python tree, shell scripts, Rust/Go/C++ sources. No Dockerfile, no `Makefile`, no `tox.ini`, no `setup.cfg`.

## Runtime

**Environment:**
- CPython `>=3.10`. CI exercises `3.10` and `3.13` on `ubuntu-latest` and `windows-latest` (`.github/workflows/ci.yml`).
- Node.js for the web build. Vite `8.3.8` declares engines `^20.19.0 || >=22.12.0`; CI uses `node-version: 20` with `cache: npm` (`.github/workflows/ci.yml`). Root `README.md` and `docs/GETTING-STARTED.md` still say Node `>= 18.0.0` — stale relative to the locked Vite version.
- Browser runtime: WebGPU preferred with WebGL2 fallback (`web/src/engine/Renderer.ts` uses `three/webgpu` `WebGPURenderer`, falling back to `forceWebGL: true`). Uses Web Audio API, `MediaRecorder`, `canvas.captureStream()`, `AbortSignal.timeout`, and Canvas 2D.
- **External executables, not Python deps:** FFmpeg, FFprobe, FFplay resolved through `shutil.which("ffmpeg")`, `shutil.which("ffprobe")`, `shutil.which("ffplay")` in `src/video.py`, `src/audio.py`, `src/sync.py`, `src/api/transcode.py`. There is no FFmpeg Python binding (no `ffmpeg-python`, no `imageio-ffmpeg`).

**Package Manager:**
- Python: `pip` / `setuptools>=61` build backend (`pyproject.toml`). Dependencies are **minimum-pinned, not locked** — `requirements.txt` uses `>=`, and no `requirements.lock`, `constraints.txt`, or `uv.lock` exists.
- Web: `npm`, lockfile `web/package-lock.json` (`lockfileVersion: 3`). CI installs with `npm ci`.
- Deployment CLIs: `wrangler` is invoked via `npx` (not declared in `web/package.json`); Render deploys from `render.yaml` via git.

## Frameworks

**Core (backend, `src/api/`):**
- FastAPI `>=0.135.2` — HTTP API, Pydantic request models, CORS middleware (`src/api/main.py`, `src/api/routes/export.py`).
- Uvicorn `>=0.42.0` — ASGI server; production command `uvicorn src.api.main:app --host 0.0.0.0 --port $PORT --workers 1` (`render.yaml`).
- SlowAPI `>=0.1.9` — per-IP rate limiting with in-memory storage (`src/api/limiter.py`); handler wired in `src/api/main.py`.
- httpx `>=0.28.1` — outbound Turnstile siteverify call (`src/api/security.py`).
- python-multipart `>=0.0.22` — multipart upload parsing for `POST /api/export/{job_id}/source-audio` (`src/api/routes/export.py`).
- psutil `>=7.2.2` — PID liveness checks for the storage janitor (`src/api/janitor.py`).

**Core (frontend, `web/`):**
- React `19.3.1` + React DOM `19.3.1` — studio SPA (`web/src/main.tsx`, `web/src/App.tsx`).
- Three.js `0.187.0` — `three/webgpu` renderer and `three/tsl` shader nodes (`web/src/engine/Pipeline.ts`, `web/src/engine/shaders/*.ts`).
- Zustand `5.1.0` — global studio store (`web/src/store/useStudioStore.ts`).
- Tailwind CSS `4.3.5` via `@tailwindcss/vite` `4.3.5` — integrated as a Vite plugin, no PostCSS config (`web/vite.config.ts`).
- gifenc `1.0.3` — client-side animated GIF encoding (`web/src/export/videoExport.ts`).
- lucide-react `1.74.0` — icon set.

**Testing:**
- pytest `>=7.0` with `pytest-asyncio` (unpinned) — `pyproject.toml` `[project.optional-dependencies].dev`; async tests use explicit `@pytest.mark.asyncio`.
- PyYAML (unpinned) — test-only, imported by `tests/test_infra_bench.py`.
- No JavaScript/TypeScript test runner is configured: `web/package.json` scripts are only `dev`, `build`, `preview`.

**Build/Dev:**
- Vite `8.3.8` (Rolldown bundler `1.2.19` resolved) with `@vitejs/plugin-react` `6.3.0` (`web/vite.config.ts`).
- TypeScript `7.0.2` type-checking only (`tsc --noEmit`) as part of `npm run build` (`web/package.json`).
- Ruff `>=0.1` — lint gate `select = ["E4", "E7", "E9", "F"]`, `line-length = 100`, `target-version = "py310"` (`pyproject.toml`).
- Mypy `>=1.0` — type-check `files = ["src"]`, `python_version = "3.10"`, not strict (`pyproject.toml`).
- Benchmark harnesses: `bench.py` (stdlib-only renderer benchmark) and `bench_export.py` (imports `psutil` and `src.api.transcode` for transcode throughput/RSS).

## Key Dependencies

**Critical:**
- `fastapi>=0.135.2` — entire HTTP surface; pulls Starlette/Pydantic as transitive deps.
- `slowapi>=0.1.9` — ingress abuse defense; base-limiter in-memory per process.
- `three@0.187.0` — all 16 studio shader modes and the WebGPU/WebGL2 renderer.
- `react@19.3.1` / `react-dom@19.3.1` — studio UI.
- `vite@8.3.8` — multi-page build (`main`, `studio`, `notFound` inputs) with manual chunks `vendor-three` and `vendor-react`.
- `gifenc@1.0.3` — GIF export path; imported with a `@ts-expect-error` because the package ships ESM without types (`web/src/export/videoExport.ts`).

**Infrastructure:**
- `psutil>=7.2.2` — only third-party import in `src/api` beyond web/HTTP stack; guarded by a mypy override (`[[tool.mypy.overrides]] module = ["psutil", "psutil.*"]`).
- `httpx>=0.28.1` — Turnstile verification only.
- `python-multipart>=0.0.22` — required by FastAPI `UploadFile`/`File(...)` handling.
- `@types/react@19.3.0`, `@types/react-dom@19.3.0`, `@types/three@0.187.0` — type definitions, dev-only.

**Declared vs locked (frontend):**

| Package | `web/package.json` | `web/package-lock.json` |
|---|---|---|
| react / react-dom | `^19.3.1` | `19.3.1` |
| three | `^0.187.0` | `0.187.0` |
| zustand | `^5.1.0` | `5.1.0` |
| gifenc | `^1.0.3` | `1.0.3` |
| lucide-react | `^1.74.0` | `1.74.0` |
| vite | `^8.3.8` | `8.3.8` (rolldown `1.2.19`) |
| typescript | `^7.0.2` | `7.0.2` |
| tailwindcss / @tailwindcss/vite | `^4.3.5` | `4.3.5` |
| @vitejs/plugin-react | `^6.3.0` | `6.3.0` |
| @types/react / @types/react-dom | `^19.3.0` | `19.3.0` |
| @types/three | `^0.187.0` | `0.187.0` |

**Python dependency posture:** core package declares `dependencies = []` in `pyproject.toml`; all third-party Python packages are backend-only and listed in `requirements.txt`. There is no lockfile, so a Render build resolves the newest versions satisfying the floors at deploy time.

## Configuration

**Environment:**
- Backend config is environment-variable driven in `src/api/config.py`: `ENVIRONMENT`, `CORS_ORIGINS`, `TURNSTILE_DISABLED`, `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`; storage override `EXPORT_STORAGE_DIR` is read in `src/api/jobs.py`.
- Production startup validation: when `ENVIRONMENT=production` and Turnstile is not disabled, missing site/secret keys raise `ValueError` (`src/api/config.py`).
- CLI config is environment-variable driven in `src/main.py`: `RGB_ASCII_NO_ADAPTIVE`, `RGB_ASCII_HALF_BLOCK`, `RGB_ASCII_NO_COLOR`, `RGB_ASCII_NO_AUDIO`, `RGB_ASCII_SMOOTHING`, `RGB_ASCII_FPS`, `RGB_ASCII_PRESET`, `RGB_ASCII_CHARS`, `RGB_ASCII_DEBUG`.
- Frontend env vars actually read by code: `VITE_API_URL` (`web/src/services/exportApi.ts`) and `VITE_TURNSTILE_SITE_KEY` (`web/src/components/ui/TurnstileWidget.tsx`). `docs/DEPLOYMENT.md`/`docs/CONFIGURATION.md` mention `VITE_API_BASE_URL`, which no source file reads.
- No `.env` files exist in the working tree; secrets are provisioned in the Render dashboard (marked `sync: false` in `render.yaml`) and Cloudflare Pages project settings.

**Build:**
- Python packaging: `pyproject.toml` — `packages = ["src"]`, console script `rgb-ascii = "src.main:main"`, pytest `pythonpath = ["."]`, `testpaths = ["tests"]`.
- Web build: `tsc --noEmit && vite build` (`web/package.json`); Vite multi-page input and chunk splitting in `web/vite.config.ts`; TypeScript strict flags in `web/tsconfig.json` (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `noEmit`).
- Deployment specs: `render.yaml` (Render free web service, `oregon`, `numInstances: 1`, `buildCommand: pip install -r requirements.txt`, `startCommand` with `--workers 1`, `healthCheckPath: /api/health`) and `wrangler.toml` (Cloudflare Pages `name = "rgb-ascii"`, `compatibility_date = "2026-11-18"`, `pages_build_output_dir = "./web/dist"`).
- CI: `.github/workflows/ci.yml` — Python matrix installs `pip install -e ".[dev]"` + `pip install -r requirements.txt`, runs `ruff check src tests`, `mypy src`, `pytest`; Ubuntu job installs system FFmpeg via `apt-get`. Web job runs `npm ci` and `npm run build` in `web/`.
- Dependency automation: `.github/dependabot.yml` — weekly npm (`/web`) and pip (`/`) updates, max 5 open PRs each.

**Repository assets (not build inputs):**
- `assets/demo/` — `rgb-ascii-studio-demo.gif`, `fixture-retro-synth.png`; referenced by `README.md` and docs.
- `assets/videos/test.mp4` — documented manual smoke-test input (`docs/GETTING-STARTED.md`).
- `verification_evidence/` — captured PNG screenshots (landing, 404, studio, social preview); not consumed by builds or tests.
- `tests/` — 24 `test_*.py` files (~394 test functions); `docs/` — operator guides and the SQL blueprint.

## Platform Requirements

**Development:**
- Python `>=3.10` with `pip`; `pip install -e ".[dev]"` plus `pip install -r requirements.txt` for backend work.
- Node.js satisfying Vite 8 engines (`^20.19.0 || >=22.12.0`) and npm; `npm install` inside `web/`.
- FFmpeg, FFprobe, and FFplay on `PATH` for CLI playback and backend transcoding. FFmpeg `>=4.4` is the documented floor (`docs/GETTING-STARTED.md`); the error text points Windows users at gyan.dev builds (`src/video.py`, `src/audio.py`).
- Verified local toolchain on this machine: Python `3.11.8`, Node `24.22.1`, npm `11.19.1`, FFmpeg/FFplay `9.0.1` (gyan.dev essentials build).
- Cross-platform code paths: Windows uses `tempfile.gettempdir()` for export storage, POSIX prefers `/tmp/ascii_studio_exports` (`src/api/jobs.py`); CI covers Ubuntu and Windows.

**Production:**
- Frontend: Cloudflare Pages static hosting at `https://rgb-ascii.pages.dev` and `https://rgb-ascii.pages.dev/studio/`, built output `web/dist` with `web/public/_redirects` rewrite rules.
- Backend: Render free Python web service `rgb-ascii-api` in `oregon`, single instance/worker, public URL default `https://rgb-ascii-api.onrender.com` hard-coded as the production fallback in `web/src/services/exportApi.ts`.
- No container images, no serverless Functions directory, no database server: the backend is stateless with ephemeral local disk.

---

*Stack analysis: 2026-11-22*
