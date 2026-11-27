# Grainrad (`https://grainrad.com/`) REA Inspection Findings & Transformation Blueprint

**Inspected via:** REA MCP (`capture_browser_scenario`, `export_web_scripts`, DOM/A11y/CSS/Asset extraction)
**Target:** Transform `dithr.pages.dev/studio/` (`web/`) with Grainrad's terminal/studio UI/UX, themes, presets, post-processing, processing controls, palettes, character sets, and export suite while preserving `dithr`'s media-first passthrough (`activeStack = []`), composable multi-pass effect stacking, Audio Reactivity, and 3D Scene.

---

## 1. Visual Design System & 4 Switchable Terminal Themes

Grainrad uses a crisp dark terminal/CAD aesthetic driven by **IBM Plex Mono** + **JetBrains Mono** monospace typography, sharp `0px` docked borders, hairline 1px controls, and **4 switchable color themes** applied via CSS custom properties + class on `document.documentElement`:

| Theme ID | Name | `--term-bg` | `--term-panel` | `--term-border` | `--term-accent` | `--term-text` | `--term-text-dim` | `--term-text-bright` | CSS Effect (`theme-*`) |
|---|---|---|---|---|---|---|---|---|---|
| `default` | Default | `#0a0a0a` | `#0f0f0f` | `#222222` | `#ffffff` | `#888888` | `#555555` | `#cccccc` | Clean Obsidian / Chalk |
| `vt320` | VT320 | `#0a0a08` | `#0f0e0a` | `#332800` | `#ffb000` | `#ffb000` | `#664400` | `#ffcc40` | Amber CRT scanlines + amber phosphor text glow |
| `cassette` | Cassette | `#000000` | `#001100` | `#003300` | `#00ff41` | `#00ff41` | `#006622` | `#66ff66` | Green phosphor CRT + 2px borders + vignette + uppercase tracking |
| `coldwar` | NORAD | `#0a0a14` | `#12121e` | `#2a2a3a` | `#00ff41` | `#00ff41` | `#004d1a` | `#66ff99` | Subtle 16px tactical green grid + yellow highlights + uppercase telemetry |

Notice we can also preserve `'light'` as an optional 5th theme in the cycle or toggle so dark/light compatibility stays intact if tested, while making `default`, `vt320`, `cassette`, and `coldwar` first-class cycle options!

---

## 2. Workspace Architecture & Layout UX

From `grainrad_home.png`, `grainrad_a11y.json`, and `grainrad_dom.json`:
1. **Left Sidebar (`w-72` / `288px` collapsible rail)**:
   - Brand header (`dithr`) + collapse control
   - **`− Input` collapsible section**:
     - Status badge (`Standby` / `Active` / media dimensions)
     - Dashed dropzone (`border-dashed border-term-border hover:border-term-text-dim p-4`): `"Drop file or click to browse"` + format hint (`PNG, JPG, GIF, MP4, WebM, GLB`)
     - Quick triggers for Image / Video / Camera / Load Sample + Eject when active
   - **`− Effects` collapsible section**:
     - **Active Stack (dithr composable superpower)**: shows ordered signal flow (`Original media` when empty; numbered passes with drag/Up/Down reorder, Eye bypass, Copy duplicate, Trash delete, `Clear all`, `+ Add effect pass` palette).
     - **16 Shaders list** with Grainrad radio-dot indicators (`●` when active / `○` when inactive), fast single-click activate, AND **`+ Stack`** button on hover/row to layer any shader (e.g. `dither` -> `vhs`)!
   - **`+ Presets` collapsible section (NEW from Grainrad!)**:
     - **Built-in presets** (`●`/`○` list): `Terminal Green`, `Matrix`, `Retro CRT`, `High Detail`, `Minimal`, `Cyberpunk` (mapped to real `dithr` stack + post-processing + settings configurations!)
     - **Custom presets**: Save Current Settings (`name` input + `Save` / `Cancel`), delete `×`, persisted in `localStorage` / IndexedDB, plus **`Export` JSON** & **`Import` JSON**!
   - **Footer links**: `Follow` / `About` / `Changelog` (clean interactive modal sheets inside studio + `/` link back to overview)
2. **Center Canvas Viewport (`flex-1 bg-term-bg relative overflow-hidden`)**:
   - **Top-center status pill**: `● <active shader / stack or Original> [WEBGPU]` (or `[WEBGL2]`) + render state indicator
   - **Top-right quick icon buttons**: `Theme: <id>` cycle button, `Start Webcam` / `Stop Webcam` quick toggle button, `Fullscreen` toggle button, plus mobile drawer triggers `<1024px`/`<768px`
   - **Standby Center Prompt**: `"Awaiting input"` / `"Drop a file or select a source"` with instant `Choose file`, `Use camera`, `Load sample` actions
   - **Bottom-left shortcut hint** (when media loaded): `"Scroll to pan · Ctrl+Scroll to zoom · Alt+Drag to pan"` (plus double-click/drag support)
   - **Bottom-right (desktop) / Bottom-center (mobile) Zoom & Playback Capsule**:
     - Video playback controls (Play/Pause/Stop/Mute + `0:00 / 0:00`) when video active
     - `-` | `100%` | `+` | `Reset` | `100%` (native 1:1 pixel zoom) | Quality tier badge | Eject
3. **Right Inspector (`w-[22rem]` / `352px` or `296px–340px` collapsible rail)**:
   - **`− Settings`** with top-right **`Reset`** button:
     - Composed pass settings (Intensity, Blend mode, per-shader schema controls)
     - **10 ASCII / Matrix Character Sets**: `STANDARD` (` .:-=+*#%@`), `BLOCKS` (` ░▒▓█`), `BINARY` (` 01`), `DETAILED` (` .'\`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$`), `MINIMAL` (` .:#`), `ALPHABETIC` (` .icotCOXWM`), `NUMERIC` (` 1234567890`), `MATH` (` .-+×÷=≠<>≤≥∞∑∏√∫`), `SYMBOLS` (` ·•○◎●◐◑◒◓◔◕◖◗`), `CUSTOM`
     - **Hairline Slider component**: Left label (`text-dim text-xs`), fixed-width monospace `tabular-nums` value, `1px` track with filled accent bar + circular dot thumb (`w-2 h-2`), double-click numeric entry, and compact `reset` action when modified!
     - **Sharpness** added to Pre-Tone Adjustments (`Brightness`, `Contrast`, `Saturation`, `Hue Rotation`, `Sharpness`, `Gamma`, `Invert`)!
     - **Color Palettes** (`GameBoy (4)`, `CGA (16)`, `NES (54)`, `PICO-8 (16)`, `C64 (16)`, `Apple II (16)`, `Macintosh (16)`, `Sepia`, `Cyberpunk`, `Newspaper`, `Risograph`) for `dither` / `threshold`!
   - **`+ Processing` collapsible section (NEW global signal stage)**:
     - Global preprocessing toggles/sliders (`Invert`, `Brightness Map`, `Edge Enhance`, `Blur`, `Quantize Colors`, `Shape Matching`) cleanly mapped onto Stage-0 GPU uniforms!
   - **`+ Post-Processing` collapsible section (NEW global finishing stage)**:
     - Independent toggleable post-FX chain layered cleanly AFTER the stack in GPU TSL: **Bloom** (`threshold`, `intensity`), **Film Grain** (`intensity`, `size`, `speed`), **Chromatic** (`offset`), **Scanlines** (`opacity`, `spacing`), **Vignette** (`intensity`, `radius`), **CRT Curve** (`amount`), **Phosphor** (`green`, `amber`, `white`, `custom` + custom hex)!
   - **`− Export` collapsible section**:
     - Grainrad 2-column Format Cards (`PNG .png`, `JPEG .jpg`, `GIF .gif`, `Video .mp4`, `SVG .svg`, `Text .txt`, **`Three.js .html`** — interactive standalone HTML 3D ASCII/pixel point-cloud viewer export!), format description text, optional columns/FPS/scale config, and full-width high-contrast primary `Export <FORMAT>` CTA button!
   - **`+ Audio reactivity` & `+ 3D scene`** collapsible sections preserved!

---

## 3. Verification & Quality Requirements

- Preserve media-first passthrough on upload (`DEFAULT_INITIAL_STACK = []`, `effect = null`).
- Preserve `setSingleEffectFastPath`, `addEffect` (`+ Stack`), `removeEffect`, `reorderStack`, `toggleEffect`, `duplicateEffect`, `clearStack`.
- Preserve all existing unit test suites (`125` Vitest tests) and Playwright E2E scenarios, and add coverage for themes, presets, post-processing, 10 character sets, palettes, and Three.js `.html` export.
- Run `npm --prefix web run build && npm --prefix web run test:unit && npm --prefix web run test:e2e`.
