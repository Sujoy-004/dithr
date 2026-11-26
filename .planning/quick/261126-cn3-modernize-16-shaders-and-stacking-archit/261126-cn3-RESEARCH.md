# Comprehensive Research: Modernized 16-Shader Visuals & Dynamic Stacking Architecture

**Task ID:** 261126-cn3
**Date:** 2026-11-26
**Project:** dithr — RGB ASCII & Retro FX Studio

---

## 1. Executive Summary & Root Cause Analysis

### What Was Wrong With the Previous Implementation?
1. **Destructive Default on Media Upload (Part 2 Issue):**
   - When a user uploaded an image or video, `useStudioStore` initialized `activeStack` with a hardcoded `ascii` pass (`DEFAULT_INITIAL_STACK = [{ effectId: 'ascii', ... }]`).
   - The user's uploaded high-resolution media immediately degraded into low-res ASCII blocks without user consent.
   - The user expects the media to run in its native pristine quality upon upload, with zero default effect forced upon it.

2. **Confusing & Broken Stacking Architecture (Part 2 Issue):**
   - The previous UI had two conflicting sections in `LeftRail`: an "Active Effect Stack" list at the top and a separate "Palette Mode" list at the bottom.
   - Clicking an effect in "Palette Mode" called `setSingleEffectFastPath`, which wiped out the stack. To stack, users had to find an unobtrusive `+` icon or use an "Add Effect" popover.
   - Clicking `vhs` failed because the registered ID was `'crtVhs'` while the UI dispatched `'vhs'`.
   - Users could not simply click any shader to preview it, then click another shader (like VHS) to stack it on top or remove any shader at any time.

3. **Shader Visual Quality, UX & Composition Deficiencies (Part 1 Issue):**
   - **Aliased / Jagged Math:** Shaders like `dots`, `halftone`, `threshold`, and `crosshatch` used hard step cutoffs (`<=` select 1.0 or 0.0) without `smoothstep` anti-aliasing, causing ugly stair-stepped pixels.
   - **Severe Blackout / Composition Destruction:**
     - `contour`: Screen was black everywhere except on thin 1-pixel isolines (90% black screen).
     - `dots` & `halftone`: Background between dots was pitch black, destroying overall scene exposure and color.
     - `matrix`: Overwrote the entire image with harsh green vertical lines, discarding input media.
     - `voronoi`: Implemented as a repeating radial sphere within grid squares rather than true Worley/cellular noise, looking like a broken dotted grid.
     - `waveLines`: Simply multiplied image by `sin(st.x * 100)`, producing harsh black zebra bars rather than smooth analog CRT/wavy line raster distortion.
   - **Inadequate Blending:**
     - `applyBlendMode` only supported basic linear math for 4 modes (`normal`, `multiply`, `screen`, `add`).
     - Lacked modern compositing modes like `overlay`, `softLight`, `colorDodge`, and `difference` which are essential for stacking effects like VHS scanlines, grain, or dither over underlying textures.

---

## 2. Deep Dive: Modernized Specification for the 16 Shaders

Each shader must deliver a modern, high-aesthetic visual feel, respect the composition of the user's media, provide intuitive UX controls, and support seamless multi-pass blending.

### 1. ASCII Art (`ascii`)
- **Aesthetic:** High-precision typographic text matrix (Cyberpunk terminal, retro computer console, newsprint).
- **UX & Parameters:**
  - `cellScale`: 4px to 32px (default 10px).
  - `charSpacing`: 0px to 8px.
  - `charAspect`: Monospace character aspect ratio (default 0.5).
  - `colorMode`: Full-Color (characters retain underlying RGB), Monochrome (Green Phosphor, Amber, Cyan, White), and Invert.
- **Blending:** Crisp character glyphs rendered over the background, with smooth alpha blending so the underlying video/image remains recognizable.

### 2. Bayer Dither (`dither`)
- **Aesthetic:** Macintosh 1984, Game Boy, newspaper rotogravure, early pixel art dithering.
- **UX & Parameters:**
  - `colorSteps`: 2 to 16 quantization steps.
  - `spread`: Dither dispersion factor (0.0 to 2.0).
  - `matrixSize`: 8x8 Bayer matrix (rich, smooth gradients) and 4x4 Bayer matrix.
  - `palette`: Full RGB Quantized, 1-bit Monochrome, Game Boy Olive, Cyberpunk Amber, Vaporwave CGA.
- **Composition:** Quantization occurs in linear light with Rec. 601 luminance weighting to preserve midtone contrast without clipping highlights.

### 3. Halftone Screen (`halftone`)
- **Aesthetic:** Pop art, comic book Ben-Day dots, offset printing press.
- **UX & Parameters:**
  - `frequency`: Dot screen frequency (10 to 100).
  - `angle`: Screen angle rotation (0° to 90°, default 45°).
  - `dotRadius`: Maximum dot expansion ratio (0.2 to 2.0).
  - `smoothing`: Edge feathering / anti-aliasing via `smoothstep`.
  - `paperColor`: Paper base tint (white, newsprint cream, dark void).
  - `colorMode`: Color Halftone (CMY/RGB dots) vs Monochrome Ink.
- **Composition:** Anti-aliased dots expand smoothly with luminance. The background between dots is blended with paper tint or source luminance rather than pure black voids.

### 4. Analog VHS / CRT (`vhs` / `crtVhs`)
- **Aesthetic:** 1980s VHS magnetic tape playback, Sony Trinitron CRT monitor, broadcast television.
- **UX & Parameters:**
  - Registered as both `'vhs'` and `'crtVhs'`.
  - `scanlineIntensity`: Subtly curved horizontal scanlines (0.0 to 1.0, default 0.3).
  - `scanlineCount`: 240 to 1080 lines.
  - `trackingJitter`: Horizontal tape head tape sync jitter (0.0 to 1.0).
  - `aberration`: Chromatic RGB fringe tape bleed.
  - `curvature`: Subtle CRT barrel curvature (0.0 to 0.15).
  - `noiseIntensity`: Tape magnetic noise / static snow.
  - `bloom`: Phosphor highlight glow.
- **Composition:** Can be stacked on top of ANY prior effect (e.g. Dither + VHS) with smooth `screen`, `overlay`, or `normal` blending.

### 5. Matrix Digital Rain (`matrix`)
- **Aesthetic:** The Matrix code rain, glowing phosphor glyph cascades, cyberpunk data stream.
- **UX & Parameters:**
  - `speed`: Fall velocity (0.2 to 3.0).
  - `density`: Stream column count (10 to 80).
  - `dropLength`: Code trail length (2.0 to 15.0).
  - `colorTheme`: Matrix Green, Cyber Cyan, Amber Terminal, Neon Magenta.
  - `sourceBlend`: Amount of original media preserved and backlit by the falling code (0.0 = code only, 0.7 = rich video backlighting code).
- **Composition:** Glowing white head glyphs, decaying phosphor trails, and reactive luminance blending that illuminates the user's underlying footage.

### 6. Dot Matrix Screen (`dots`)
- **Aesthetic:** LED scoreboard, stadium Jumbotron, Braun digital display.
- **UX & Parameters:**
  - `spacing`: Grid spacing (4px to 32px, default 12px).
  - `radius`: Dot size ratio (0.2 to 1.5).
  - `smoothing`: Subpixel anti-aliasing (smoothstep falloff).
  - `glow`: Subtle LED blooming around each illuminated diode.
  - `bezelDarkness`: Grid bezel between LED cells.
- **Composition:** Samples true pixel color at the center of each LED diode, applies smooth round aperture clipping with anti-aliasing, and blends soft glow.

### 7. Topographic Contour (`contour`)
- **Aesthetic:** Cartographic elevation map, architectural isoline drawing, Joy Division pulsar aesthetic.
- **UX & Parameters:**
  - `steps`: Number of elevation contour levels (4 to 32).
  - `lineWidth`: Isoline stroke thickness (0.05 to 0.4).
  - `lineColor`: Isoline tint (White, Gold, Cyan, Source Color).
  - `fillMode`: Posterized Color Bands (fills contours with quantized source tones) vs Dark Elevation vs Vector Line Art.
- **Composition:** Instead of turning the image black, it renders smooth posterized tonal bands with crisp, anti-aliased vector contour lines at the elevation boundaries.

### 8. Directional Pixel Sort (`pixelSort`)
- **Aesthetic:** Datamosh glitch, generative digital smearing, fashion editorial distortion.
- **UX & Parameters:**
  - `direction`: Horizontal vs Vertical.
  - `threshold`: Luminance activation trigger (0.1 to 0.9).
  - `sortSpan`: Streak extension distance (10px to 100px).
  - `randomness`: Scanline jitter factor.
  - `blend`: Streak opacity over original media.
- **Composition:** Smooth multi-tap directional scanline sampling that smears high-contrast highlights while preserving shadow structure.

### 9. Blockify / Mosaic (`blockify`)
- **Aesthetic:** 8-bit / 16-bit retro arcade pixel art, privacy mosaic, digital censorship.
- **UX & Parameters:**
  - `blockSize`: Pixel block size (2px to 64px, default 10px).
  - `gridLine`: Subtle bevel/groove between pixel blocks (0.0 to 1.0).
  - `gridColor`: Dark groove vs highlighted groove.
- **Composition:** Exact UV cell quantization centered on pixels for temporal stability during video playback.

### 10. High-Contrast Threshold (`threshold`)
- **Aesthetic:** Xerox photocopy, silkscreen punk poster, darkroom high-contrast print.
- **UX & Parameters:**
  - `cutoff`: Luminance threshold point (0.0 to 1.0, default 0.5).
  - `softness`: Anti-aliased transition edge (0.0 = razor sharp, 0.2 = smooth graphic).
  - `invert`: Invert black and white.
  - `foreground`: Custom ink color (default white).
  - `background`: Custom paper color (default black).
- **Composition:** Uses `smoothstep` for customizable soft ink edges and duotone color remapping.

### 11. Edge Detection (`edgeDetect`)
- **Aesthetic:** Neon blueprint, pencil sketch outline, technical wireframe.
- **UX & Parameters:**
  - `sensitivity`: Edge response multiplier (1.0 to 10.0).
  - `thickness`: Sobel kernel sample offset (1px to 4px).
  - `mode`: White-on-Black Outlines, Black Ink on White Paper, or Neon Edge Overlay (composited over source image).
- **Composition:** Full 8-tap clamped Sobel gradient filter with smooth normalization and optional source color retention.

### 12. Crosshatch Engraving (`crosshatch`)
- **Aesthetic:** Vintage banknote engraving, woodcut print, Albrecht Dürer pen-and-ink hatching.
- **UX & Parameters:**
  - `spacing`: Hatch line spacing (4px to 16px).
  - `density`: Line weight.
  - `layers`: 4 progressive angles (45°, -45°, 90°, 0°) mapped across highlight, midtone, shadow, and deep shadow.
  - `paperTint`: Background parchment / dark backing.
- **Composition:** Anti-aliased line rendering that progressively builds depth and shadow volume.

### 13. Wave Lines (`waveLines`)
- **Aesthetic:** Analog oscilloscope CRT, scanline raster modulation, synthwave laser grid.
- **UX & Parameters:**
  - `frequency`: Raster line frequency (10 to 60).
  - `amplitude`: Horizontal wave displacement (0.0 to 1.0).
  - `speed`: Dynamic wave travel speed (0.0 to 3.0).
  - `orientation`: Horizontal vs Vertical raster lines.
  - `lineWidth`: Raster line thickness with anti-aliased sinusoidal falloff.
- **Composition:** The raster lines contour and displace in response to image luminance, creating true topographical wave lines rather than static zebra bars.

### 14. Seeded Film Noise (`noise`)
- **Aesthetic:** 35mm motion picture grain, Kodak Tri-X 400 silver halide, vintage analog photography.
- **UX & Parameters:**
  - `intensity`: Grain strength (0.05 to 1.0).
  - `scale`: Grain clumping size (1.0 to 20.0).
  - `monochrome`: Monochrome silver grain vs chromatic analog noise.
  - `tonalResponse`: Concentration in midtones (authentic film behavior, sparing pure black and blown highlights).
- **Composition:** High-speed deterministic hash noise with temporal seeding for filmic motion during playback.

### 15. Voronoi Mosaic (`voronoi`)
- **Aesthetic:** Stained glass cathedral window, faceted gemstone, irregular polygon mosaic.
- **UX & Parameters:**
  - `scale`: Cell scale (8px to 64px).
  - `jitter`: Organic irregularity of cell seed positions (0.0 to 1.0).
  - `borderWidth`: Lead came / facet boundary width (0.0 to 0.3).
  - `borderColor`: Dark lead came vs bright facet highlight.
  - `cellColor`: Averaged cell color vs gradient shading.
- **Composition:** True cellular noise (3x3 grid neighborhood Euclidean distance to nearest feature point) with crisp anti-aliased cell boundaries and facet color sampling.

### 16. Cinema Tone Adjustment (`tone`)
- **Aesthetic:** Color grading suite, DaVinci Resolve color wheels, Kodak/Fuji film stock emulation.
- **UX & Parameters:**
  - `brightness`: -1.0 to +1.0 exposure trim.
  - `contrast`: 0.0 to 2.5 S-curve contrast.
  - `saturation`: 0.0 (monochrome) to 2.0 (vibrant) via Rec. 601 luminance.
  - `hueRotation`: -180° to +180° Rodrigues rotation.
  - `gamma`: 0.2 to 3.0 power curve.
  - `temperature`: Cool (blue) to Warm (amber) white balance shift.
  - `invert`: Negative film inversion.
- **Composition:** Pointwise linear light color matrix operation.

---

## 3. Deep Dive: Modernized Stacking & Ingestion UX Architecture

### Core Workflow Requirements
1. **Pristine Media Ingestion:**
   - Default initial stack: `[]` (empty stack).
   - On image/video upload: canvas displays the uploaded media in full native resolution and color. No effect is active until the user clicks one.
2. **Unified 16-Shader Grid in LeftRail:**
   - Remove the confusing "Active Effect Stack" vs "Palette Mode" separation.
   - Present the 16 Shaders as interactive, modern cards:
     - Each card displays:
       - Shader Icon and Name (e.g. `dither`, `vhs`, `ascii`, etc.).
       - Status badge: `ACTIVE` / `IN STACK [Layer #]` or clean standby.
       - Quick Toggle (Eye icon): Enable/disable without removing.
       - Quick Remove (Trash icon): Remove from stack.
       - Direct Click:
         - If not in stack: adds to stack, activates, and selects it in the inspector!
         - If already in stack: selects it in the inspector!
       - Quick Stack Button (+): Stacks another instance on top at any time!
3. **Active Visual Layer Stack Section:**
   - A dedicated, compact, clean Layer Stack panel at the top of LeftRail showing the active passes in rendering order (Bottom to Top).
   - Shows:
     - Layer order number (`#1`, `#2`, ...).
     - Effect name and icon.
     - Enable / bypass toggle.
     - Opacity / intensity quick slider or percentage.
     - Blend mode selector (`normal`, `screen`, `multiply`, `overlay`, `add`).
     - Reorder drag handle (or Up/Down arrows).
     - Delete button.
   - When stack has 0 items: Displays a friendly, modern callout: *"Clean Media (Passthrough). Click any shader below to apply."*
4. **Instant Layer Stacking Scenario (User's Example):**
   - User uploads a video. Video plays clean in pristine quality.
   - User clicks `dither` → `dither` is added to stack, video is dithered.
   - User clicks `vhs` → `vhs` is stacked on top of `dither`! Video is now dithered AND has VHS scanlines/tape warmth.
   - User clicks `vhs` in inspector, changes blend mode to `screen` or adjusts scanline intensity.
   - User decides to remove `dither` → clicks trash on `dither`, only `vhs` remains!
   - User clicks trash on `vhs` → stack is empty, clean video returns immediately!
5. **Robust Blend Modes in `applyBlendMode`:**
   - Support `normal`, `multiply`, `screen`, `add`, `overlay`, and `softLight` in linear color space.
