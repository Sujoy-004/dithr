<!-- generated-by: gsd-doc-writer -->
# dithr

Real-time retro visual transformations, shaders, and ASCII studio for images, videos, and live webcam streams across browser, headless API, and client export pipelines.

[![CI](https://github.com/Sujoy-004/ASCII/actions/workflows/ci.yml/badge.svg)](https://github.com/Sujoy-004/ASCII/actions/workflows/ci.yml)
[![Live Studio](https://img.shields.io/badge/Live%20Studio-dithr.pages.dev%2Fstudio-00f0ff?style=for-the-badge&logo=cloudflarepages&logoColor=black)](https://dithr.pages.dev/studio/)
[![Python Version](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Three.js%20TSL-990000?style=for-the-badge&logo=webgpu&logoColor=white)](https://threejs.org/)

![dithr real-time browser demonstration showing original graphic transformation into ASCII glyph art, Bayer dither, and VHS scanlines](assets/demo/rgb-ascii-studio-demo.gif)

> 🚀 **Live Studio:** [dithr.pages.dev/studio/](https://dithr.pages.dev/studio/) &nbsp;|&nbsp; 🌐 **Product Overview:** [dithr.pages.dev](https://dithr.pages.dev) &nbsp;|&nbsp; ⚡ **Quick Start:** `cd web && npm install && npm run dev`

---

## Overview

**dithr** transforms digital media into stylized retro computer graphics. It pairs a zero-install WebGPU browser studio with a high-performance FastAPI/FFmpeg export microservice.

- **Browser Studio**: Interactive WebGPU/TSL canvas featuring 16 real-time retro shaders (ASCII glyph atlas, Floyd-Steinberg and Bayer dithering, halftone dot screens, matrix digital rain, VHS/CRT scanlines, directional pixel sorting, blockify, and Rec. 601 pre-tone controls) with client GPU capability tier detection and idle render scheduling.
- **Export Backend**: Production FastAPI microservice (`dithr-api`) running bounded FFmpeg transcoding pipelines to render and download full-resolution MP4 clips and animated GIFs with audio synchronization.
- **Hermetic Testing Fixtures**: Python renderer modules (`src/renderer.py`, `src/sync.py`) are strictly preserved as deterministic offline test fixtures for regression testing.

🌐 **Product Overview:** [https://dithr.pages.dev](https://dithr.pages.dev)  
🚀 **Interactive Studio:** [https://dithr.pages.dev/studio/](https://dithr.pages.dev/studio/)

### Quick Start (One Command)

Run the interactive browser studio locally with zero backend dependencies:

```bash
git clone https://github.com/Sujoy-004/ASCII.git && cd ASCII/web && npm install && npm run dev
```

---

## Installation

### Prerequisites

- **Node.js**: `>= 18.0.0` (for web development or local frontend builds)
- **Python**: `>= 3.10` (for FastAPI backend export service or test suite execution)
- **FFmpeg**: Server-side binary for video and audio transcoding on the backend export service.

### Web Frontend Studio

```bash
cd web
npm install
npm run dev
```

### Python Package & Backend Service

To run the FastAPI export backend locally:

```bash
# Clone the repository
git clone https://github.com/Sujoy-004/ASCII.git
cd ASCII

# Install dependencies
pip install -r requirements.txt
pip install -e .
```

To run the automated test pyramid:

```bash
# Backend pytest suite (unit, integration, Schemathesis ASGI contract tests)
pytest -q

# Frontend Vitest unit tests
npm --prefix web run test:unit

# Headless browser Playwright E2E tests (SwiftShader)
cd web && npx playwright test
```

---

## Architecture & Documentation

Comprehensive architectural blueprints and operator guides are located in the `docs/` directory:

- [System Architecture](docs/ARCHITECTURE.md)
- [Getting Started Guide](docs/GETTING-STARTED.md)
- [Development Workflow](docs/DEVELOPMENT.md)
- [Testing Guide](docs/TESTING.md)
- [Configuration Reference](docs/CONFIGURATION.md)
- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
