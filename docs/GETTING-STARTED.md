<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide walks you through setting up **dithr** on your local machine, launching the interactive web studio, and running the local export API backend.

---

## Prerequisites

Ensure you have the following runtimes and tools installed on your operating system:

| Dependency | Required Version | Verification Command | Description |
|------------|------------------|----------------------|-------------|
| **Node.js** | `>= 18.0.0` | `node --version` | React, Vite, and Three.js TSL studio frontend runtime. |
| **Python** | `>= 3.10` | `python --version` | FastAPI backend export service and automated testing suite. |
| **FFmpeg** | Any recent build (`>= 4.4`) | `ffmpeg -version` | Server-side video and audio transcoding on the backend export service. |

> **Note on Terminal Player:** The terminal playback CLI has been formally retired in v2.0 in favor of the full-fidelity WebGPU browser studio. `ffplay` is no longer required on end-user machines.

### Installing FFmpeg (for Backend Development)

- **macOS** (Homebrew):
  ```bash
  brew install ffmpeg
  ```
- **Ubuntu/Debian**:
  ```bash
  sudo apt update && sudo apt install -y ffmpeg
  ```
- **Windows** (winget or Chocolatey):
  ```powershell
  winget install Gyan.FFmpeg
  # or
  choco install ffmpeg
  ```

---

## Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sujoy-004/ASCII.git
   cd ASCII
   ```

2. **Launch the Web Studio:**
   ```bash
   cd web
   npm install
   npm run dev
   ```

   Navigate to `http://localhost:5173/studio/` in any modern browser supporting WebGPU or WebGL2. Drag and drop any image or video file onto the stage to test real-time shader modes.

3. **(Optional) Run the Local Export API Backend:**
   ```bash
   # From the repository root
   pip install -r requirements.txt
   uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --reload
   ```

   Verify service readiness by querying `http://127.0.0.1:8000/api/health`.

---

## Automated Verification

Run the automated testing pyramid across unit, E2E, and backend contracts:

```bash
# Frontend Vitest unit tests
npm --prefix web run test:unit

# Playwright headless browser E2E specs (Chromium + SwiftShader)
cd web && npx playwright test

# Backend pytest and Schemathesis contract fuzzing
pytest -q
```

---

## Next Steps

- Explore development patterns and code conventions: [DEVELOPMENT.md](DEVELOPMENT.md)
- Learn how to run unit and integration tests: [TESTING.md](TESTING.md)
- Review system architecture and shader internals: [ARCHITECTURE.md](ARCHITECTURE.md)
- Inspect available configuration options: [CONFIGURATION.md](CONFIGURATION.md)
