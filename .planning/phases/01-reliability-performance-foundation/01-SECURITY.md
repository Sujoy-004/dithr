---
phase: "01"
slug: "reliability-performance-foundation"
status: verified
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 01 — Security: Reliability & Performance Foundation

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client Browser → FastAPI ASGI | Untrusted binary chunks, multipart audio files, and cancellation requests | Video/audio binary chunks, form data, HTTP headers |
| FastAPI ASGI → OS Process Subprocesses | Process handles (`pid`), signal dispatch (`SIGTERM`/`SIGKILL`), and file paths in `/tmp` | Process PIDs, subprocess lifecycle commands, system signals |
| Main UI Thread → Web Worker (`gif.worker.ts`) | Transferable `ImageBitmap` handles and structured message payloads | Frame raster data, dimension constraints, encoding events |
| Web Audio Graph → MediaRecorder | Cloned MediaStreamTrack and browser audio hardware buffer allocations | Raw PCM audio streams, track lifecycles |
| Browser Hardware APIs (`navigator.gpu`, WebGL context) → Studio State | Hardware parameter extraction and quality tier classification | GPU driver strings, capabilities flags, max texture limits |
| DOM Lifecycle Events (`visibilitychange`) → Render Loop Engine | Animation frame scheduling and CPU/GPU resource allocation | Visibility state, requestAnimationFrame scheduling |
| Testing Harness → FastAPI ASGI Pipeline | Generated fuzzing payloads, boundary types, and abnormal HTTP methods | Arbitrary HTTP payloads, malformed headers, edge values |
| Public Domain (`dithr.pages.dev`) → Render Backend API (`dithr-api`) | CORS origin validation and cross-site request headers | Cross-origin requests, credentials, preflight OPTIONS |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Denial of Service | `src/api/jobs.py` (Subprocess Lifecycle) | high | mitigate | Cross-platform process tree traversal via `psutil` killing parent and child FFmpeg processes on cancel/timeout (`tests/test_cancellation.py`) | closed |
| T-01-02 | Tampering | `src/api/magic.py` & `src/api/routes/export.py` | high | mitigate | Pure-Python binary magic byte validation checking container signatures (PNG, JPEG, WebM, MP4, WAV, MP3) before disk persistence (`tests/test_ingress_security.py`) | closed |
| T-01-03 | Denial of Service | `src/api/routes/export.py` (`upload_source_audio`) | medium | mitigate | SlowAPI rate limiting `@limiter.limit("5/minute")` per client IP and hard 50MB payload ceiling returning HTTP 413 (`tests/test_ingress_security.py`) | closed |
| T-01-04 | Denial of Service | `web/src/export/gif.worker.ts` & `videoExport.ts` | high | mitigate | Clamp max GIF dimension to 480px, cap duration to 5s, close `ImageBitmap` handles immediately, and terminate worker on cancel (`web/src/tests/videoExport.test.ts`) | closed |
| T-01-05 | Information Disclosure | `web/src/export/videoExport.ts` & `audioGraph.ts` | medium | mitigate | Clone MediaStreamTrack before attaching to MediaRecorder, and explicitly call `.stop()` on cloned tracks upon completion | closed |
| T-01-06 | Denial of Service | `web/src/components/layout/CenterStage.tsx` | high | mitigate | Cancel `requestAnimationFrame` and pause render loop when document is hidden or off-screen, dropping CPU and GPU utilization to 0% | closed |
| T-01-07 | Tampering | `web/src/engine/capabilities.ts` & `useStudioStore.ts` | low | mitigate | Validate tier override against allowlist ('high', 'medium', 'low', null), falling back to safe medium tier on unrecognized inputs | closed |
| T-01-08 | Information Disclosure | `src/api/main.py` & `tests/test_api_contract.py` | medium | mitigate | Schemathesis validates that no endpoint leaks internal Python tracebacks or unhandled 500 stack traces on malformed requests | closed |
| T-01-09 | Denial of Service | `web/playwright.config.ts` & `tests/test_api_contract.py` | low | mitigate | Cap Playwright test timeouts (30s) and bound Hypothesis max_examples (50) to prevent CI timeout exhaustion | closed |
| T-01-10 | Elevation of Privilege | `pyproject.toml` | medium | mitigate | Remove `[project.scripts]` entry point to prevent unintended CLI terminal execution in production environments | closed |
| T-01-11 | Spoofing | `src/api/config.py` & `render.yaml` | medium | mitigate | Update CORS origin matching to strict `https://dithr.pages.dev` and regex `^https:\/\/[a-zA-Z0-9-]+\.dithr\.pages\.dev$`, preventing unauthorized origins | closed |
| T-01-SC | Tampering | npm/pip dependencies | high | mitigate | Package-legitimacy verification gate audited; psutil, gifenc, three.js, zustand verified against public registries | closed |

---

## Accepted Risks Log

No accepted risks. All identified threats are actively mitigated and tested.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-22 | 12 | 12 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-22
