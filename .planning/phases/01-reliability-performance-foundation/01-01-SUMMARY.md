---
phase: 01-reliability-performance-foundation
plan: "01"
subsystem: api-security
tags: [fastapi, psutil, cancellation, subprocess, magic-bytes, slowapi, rate-limiting]

# Dependency graph
requires:
  - phase: none
    provides: existing FastAPI export routes and job manager
provides:
  - "Cross-platform recursive subprocess termination (terminate_job_process_tree) via psutil"
  - "Automatic job storage purge (cleanup_job_storage) upon export cancellation"
  - "Pure-Python container magic byte validation (validate_magic_bytes) in src/api/magic.py"
  - "Ingress defense in src/api/routes/export.py with 50MB payload limits and SlowAPI 5/min rate limits"
  - "Updated ServerExportModal cancellation UI with destructive border and progress feedback"
  - "Comprehensive automated test suites in tests/test_cancellation.py and tests/test_ingress_security.py"
affects: [01-02, 01-03, 01-04]

# Actuals
actuals:
  tokens: 4100
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: [psutil, slowapi]
  patterns:
    - "Recursive subprocess tree termination using psutil.Process and psutil.wait_procs"
    - "Pure-Python container magic-byte verification before saving untrusted binary uploads"
    - "Strict 50MB payload boundaries on chunked and multipart upload endpoints"

key-files:
  created:
    - src/api/magic.py
    - tests/test_cancellation.py
    - tests/test_ingress_security.py
  modified:
    - src/api/jobs.py
    - src/api/routes/export.py
    - tests/test_api_tracer.py
    - web/src/components/modals/ServerExportModal.tsx

key-decisions:
  - "Subprocess termination collects all children recursively via psutil before terminating parent, waiting up to 3 seconds before escalating to SIGKILL"
  - "Canceling an export wipes the specific job storage folder immediately from disk to prevent /tmp bloat"
  - "Pure-Python binary magic byte checking validates PNG, JPEG, WebM, MP4, WAV, and MP3 signatures without external dependencies"
  - "Uploads exceeding 50MB return HTTP 413, invalid container headers return HTTP 400, and audio uploads enforce 5 requests per minute with HTTP 429"

patterns-established:
  - "Process tree termination: terminate_job_process_tree safely handles missing PIDs and reaps orphan child processes"
  - "Container validation: validate_magic_bytes guards against malicious payload header spoofing at ingress"

requirements-completed:
  - RELY-01
  - RELY-02

coverage:
  - id: D1
    description: "Subprocess tree termination and temporary file cleanup on export cancellation"
    requirement: RELY-01
    verification:
      - kind: integration
        ref: "tests/test_cancellation.py#test_manager_cancel_job_terminates_process_and_cleans_storage"
        status: pass
      - kind: integration
        ref: "tests/test_cancellation.py#test_api_cancel_export_route"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ingress security enforcing 50MB upload ceiling, magic-byte checking, and audio rate limits"
    requirement: RELY-02
    verification:
      - kind: unit
        ref: "tests/test_ingress_security.py#test_validate_magic_bytes_pure_unit"
        status: pass
      - kind: integration
        ref: "tests/test_ingress_security.py#test_chunk_upload_magic_bytes_enforcement"
        status: pass
      - kind: integration
        ref: "tests/test_ingress_security.py#test_chunk_upload_50mb_ceiling"
        status: pass
      - kind: integration
        ref: "tests/test_ingress_security.py#test_audio_upload_rate_limiting"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-11-22
status: complete
---

# Phase 01 Plan 01 Summary

**Subprocess lifecycle cancellation, recursive process-tree termination with psutil, 50MB payload limits, magic-byte container validation, and audio endpoint rate limiting successfully implemented and verified.**

## Performance

- **Duration:** 12 min
- **Tasks:** 2 completed
- **Files modified:** 7 files (3 created, 4 modified)
- **Commits:** 2 task commits

## Accomplishments

- Implemented `terminate_job_process_tree` and `cleanup_job_storage` in `src/api/jobs.py` to recursively terminate FFmpeg parent/child processes and delete `/tmp` job artifacts upon cancellation.
- Created `src/api/magic.py` with pure-Python `validate_magic_bytes` supporting PNG, JPEG, WebM, MP4, WAV, and MP3 signatures.
- Enforced 50MB upload limits (HTTP 413), magic-byte validation (HTTP 400), and SlowAPI audio endpoint rate limiting (HTTP 429) in `src/api/routes/export.py`.
- Updated `ServerExportModal.tsx` cancellation UX with `#ff4444` destructive styling, `Canceling Export Job...` state, and cleanup confirmation.
- Added comprehensive automated test suites `tests/test_cancellation.py` and `tests/test_ingress_security.py` passing 11 new tests alongside 435 regression tests (446 total passing).

## Task Commits

1. **Task 1: End-to-end export cancellation and process tree termination slice** - `2136147` (feat)
2. **Task 2: Ingress defense: 50MB ceiling, magic-byte validation, and audio endpoint rate limits** - `ceba53e` (feat)
