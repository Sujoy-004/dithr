/**
 * dithr landing page interactions:
 * 1. Exact viewport-width fitting for the hero "DITHR" display wordmark.
 * 2. Live 16-shader preview canvas using /sample-subject.webp.
 * 3. Copy command buttons with "Copied" confirmation.
 */

type ShaderKey =
  | 'ascii'
  | 'dither'
  | 'halftone'
  | 'vhs'
  | 'matrix'
  | 'dots'
  | 'contour'
  | 'pixelSort'
  | 'blockify'
  | 'threshold'
  | 'edgeDetect'
  | 'crosshatch'
  | 'waveLines'
  | 'noise'
  | 'voronoi'
  | 'tone';

const SHADER_DESCRIPTIONS: Record<ShaderKey, string> = {
  ascii: 'Maps Rec. 601 luminance across monospace glyph ramps in configurable cell grids.',
  dither: 'Applies ordered Bayer matrix dispersion across quantized tonal steps.',
  halftone: 'Projects a rotated halftone dot screen with luminance-scaled ink dots.',
  vhs: 'Emulates analog CRT scanlines, horizontal sync jitter, and subtle chromatic separation.',
  matrix: 'Cascades phosphor glyph columns modulated by underlying frame luminance.',
  dots: 'Subsamples the frame into circular LED cells separated by dark gutters.',
  contour: 'Extracts iso-luminance elevation bands into crisp topographic line contours.',
  pixelSort: 'Displaces pixel spans along directional vectors past a brightness threshold.',
  blockify: 'Quantizes the frame into flat mosaic tiles sampled at block centers.',
  threshold: 'Cuts tonal gradients into high-contrast one-bit monochrome silhouettes.',
  edgeDetect: 'Convolves spatial gradients with Sobel kernels to isolate structural edges.',
  crosshatch: 'Layers diagonal ink strokes whose density tracks shadow luminance.',
  waveLines: 'Modulates horizontal raster lines with harmonic sinusoidal displacement.',
  noise: 'Injects procedural analog grain across shadows, midtones, and highlights.',
  voronoi: 'Partitions the image into cellular Voronoi facets colored by cell centers.',
  tone: 'Adjusts Rec. 601 brightness, contrast, gamma, saturation, and hue directly.',
};

const SHADER_ORDER: ShaderKey[] = [
  'ascii',
  'dither',
  'halftone',
  'vhs',
  'matrix',
  'dots',
  'contour',
  'pixelSort',
  'blockify',
  'threshold',
  'edgeDetect',
  'crosshatch',
  'waveLines',
  'noise',
  'voronoi',
  'tone',
];

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function fitHeroWordmark() {
  const text = document.getElementById('hero-wordmark-text') as SVGTextElement | null;
  if (!text) return;
  try {
    const bbox = text.getBBox();
    if (bbox.width > 0) {
      const currentSize = parseFloat(text.getAttribute('font-size') || '290');
      const scaled = Math.min(340, (970 / bbox.width) * currentSize);
      text.setAttribute('font-size', scaled.toFixed(1));
    }
  } catch {
    // keep default SVG sizing
  }
}

function luma(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function renderShaderPreview(
  canvas: HTMLCanvasElement,
  srcCanvas: HTMLCanvasElement,
  shader: ShaderKey,
  seeds: { x: number; y: number; r: number; g: number; b: number }[]
) {
  const ctx = canvas.getContext('2d');
  const sCtx = srcCanvas.getContext('2d');
  if (!ctx || !sCtx) return;

  const w = canvas.width;
  const h = canvas.height;
  const srcData = sCtx.getImageData(0, 0, w, h).data;

  ctx.fillStyle = '#08090b';
  ctx.fillRect(0, 0, w, h);

  if (shader === 'ascii') {
    const ramp = ' .:-=+*#%@';
    const cw = 10;
    const ch = 15;
    // Pre-rasterize 10 glyphs once into a tiny 10x15 atlas to avoid 2500+ fillText calls
    const atlas = document.createElement('canvas');
    atlas.width = ramp.length * cw;
    atlas.height = ch;
    const aCtx = atlas.getContext('2d');
    if (aCtx) {
      aCtx.fillStyle = '#ffffff';
      aCtx.font = 'bold 13px ui-monospace, Menlo, Consolas, monospace';
      aCtx.textBaseline = 'top';
      for (let i = 0; i < ramp.length; i++) {
        aCtx.fillText(ramp[i], i * cw + 1, 1);
      }
      const aData = aCtx.getImageData(0, 0, atlas.width, ch).data;
      const out = ctx.createImageData(w, h);
      const od = out.data;
      for (let cy = 0; cy < h; cy += ch) {
        for (let cx = 0; cx < w; cx += cw) {
          const sx = Math.min(w - 1, cx + 5);
          const sy = Math.min(h - 1, cy + 7);
          const sp = (sy * w + sx) * 4;
          const r = srcData[sp];
          const g = srcData[sp + 1];
          const b = srcData[sp + 2];
          const l = luma(r, g, b);
          const chIdx = Math.min(ramp.length - 1, Math.floor(l * ramp.length));
          if (chIdx === 0) continue;
          const glyphOffsetX = chIdx * cw;
          for (let py = 0; py < ch && cy + py < h; py++) {
            for (let px = 0; px < cw && cx + px < w; px++) {
              const alpha = aData[(py * atlas.width + (glyphOffsetX + px)) * 4 + 3];
              if (alpha > 16) {
                const f = alpha / 255;
                const dp = ((cy + py) * w + (cx + px)) * 4;
                od[dp] = Math.round(8 + (r - 8) * f);
                od[dp + 1] = Math.round(9 + (g - 9) * f);
                od[dp + 2] = Math.round(11 + (b - 11) * f);
                od[dp + 3] = 255;
              }
            }
          }
        }
      }
      for (let i = 3; i < od.length; i += 4) {
        if (od[i] === 0) {
          od[i - 3] = 8;
          od[i - 2] = 9;
          od[i - 1] = 11;
          od[i] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
    }
    return;
  }

  if (shader === 'matrix') {
    const glyphs = '01アイウエオカキクケコ';
    const cw = 10;
    const ch = 13;
    ctx.font = 'bold 11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    for (let x = 0; x < w; x += cw) {
      const colPhase = ((x * 37) % 100) / 100;
      for (let y = 0; y < h; y += ch) {
        const p = (Math.min(h - 1, y + 6) * w + Math.min(w - 1, x + 5)) * 4;
        const l = luma(srcData[p], srcData[p + 1], srcData[p + 2]);
        const stream = Math.pow((((y / h + colPhase) % 1) + 1) % 1, 2.2);
        const val = Math.min(1, l * 0.85 + stream * 0.35);
        if (val > 0.08) {
          const gIdx = Math.floor((x * 13 + y * 7) % glyphs.length);
          const v = Math.round(val * 240);
          ctx.fillStyle = `rgb(${Math.round(v * 0.72)},${v},${Math.round(v * 0.8)})`;
          ctx.fillText(glyphs[gIdx], x, y);
        }
      }
    }
    return;
  }

  if (shader === 'dots' || shader === 'halftone') {
    const step = shader === 'halftone' ? 10 : 12;
    const angle = shader === 'halftone' ? 0.45 : 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let gy = -h; gy < h * 1.5; gy += step) {
      for (let gx = -w; gx < w * 1.5; gx += step) {
        const x = Math.round(w / 2 + gx * cos - gy * sin);
        const y = Math.round(h / 2 + gx * sin + gy * cos);
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const p = (y * w + x) * 4;
        const r = srcData[p];
        const g = srcData[p + 1];
        const b = srcData[p + 2];
        const l = luma(r, g, b);
        const radius = (step * 0.48) * Math.sqrt(l);
        if (radius > 0.4) {
          ctx.fillStyle = shader === 'halftone' ? '#e9ebf0' : `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return;
  }

  if (shader === 'waveLines') {
    ctx.strokeStyle = '#e9ebf0';
    ctx.lineWidth = 1.4;
    const rowStep = 8;
    for (let y = 4; y < h; y += rowStep) {
      ctx.beginPath();
      for (let x = 0; x < w; x += 3) {
        const p = (y * w + x) * 4;
        const l = luma(srcData[p], srcData[p + 1], srcData[p + 2]);
        const amp = l * 4.5;
        const dy = Math.sin(x * 0.14 + y * 0.2) * amp;
        if (x === 0) ctx.moveTo(x, y + dy);
        else ctx.lineTo(x, y + dy);
      }
      ctx.stroke();
    }
    return;
  }

  if (shader === 'crosshatch') {
    ctx.strokeStyle = '#e9ebf0';
    ctx.lineWidth = 1.1;
    const cell = 8;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const p = (y * w + x) * 4;
        const l = luma(srcData[p], srcData[p + 1], srcData[p + 2]);
        if (l > 0.12) {
          ctx.beginPath();
          ctx.moveTo(x, y + cell);
          ctx.lineTo(x + cell, y);
          if (l > 0.4) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + cell, y + cell);
          }
          if (l > 0.7) {
            ctx.moveTo(x + cell / 2, y);
            ctx.lineTo(x + cell / 2, y + cell);
          }
          ctx.stroke();
        }
      }
    }
    return;
  }

  // Pixel-buffer shaders
  const out = ctx.createImageData(w, h);
  const od = out.data;

  if (shader === 'blockify') {
    const bs = 14;
    for (let y = 0; y < h; y++) {
      const sy = Math.min(h - 1, Math.floor(y / bs) * bs + (bs >> 1));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(w - 1, Math.floor(x / bs) * bs + (bs >> 1));
        const sp = (sy * w + sx) * 4;
        const dp = (y * w + x) * 4;
        od[dp] = srcData[sp];
        od[dp + 1] = srcData[sp + 1];
        od[dp + 2] = srcData[sp + 2];
        od[dp + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    return;
  }

  if (shader === 'voronoi') {
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        let best = Infinity;
        let bestSeed = seeds[0];
        for (let i = 0; i < seeds.length; i++) {
          const s = seeds[i];
          const dx = s.x - x;
          const dy = s.y - y;
          const d = dx * dx + dy * dy;
          if (d < best) {
            best = d;
            bestSeed = s;
          }
        }
        for (let oy = 0; oy < 2 && y + oy < h; oy++) {
          for (let ox = 0; ox < 2 && x + ox < w; ox++) {
            const dp = ((y + oy) * w + (x + ox)) * 4;
            od[dp] = bestSeed.r;
            od[dp + 1] = bestSeed.g;
            od[dp + 2] = bestSeed.b;
            od[dp + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    return;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      let r = srcData[p];
      let g = srcData[p + 1];
      let b = srcData[p + 2];

      if (shader === 'dither') {
        const l = luma(r, g, b);
        const bVal = BAYER_4X4[Math.floor(y / 2) % 4][Math.floor(x / 2) % 4] / 16 - 0.5;
        const q = Math.max(0, Math.min(1, Math.floor((l + bVal * 0.42) * 3 + 0.5) / 3));
        const v = Math.round(q * 240);
        r = v;
        g = v;
        b = v;
      } else if (shader === 'threshold') {
        const v = luma(r, g, b) > 0.28 ? 236 : 12;
        r = v;
        g = v;
        b = v;
      } else if (shader === 'contour') {
        const l = luma(r, g, b);
        const bands = 10;
        const f = (l * bands) % 1;
        const edge = f < 0.14 ? 236 : 14;
        r = edge;
        g = edge;
        b = edge;
      } else if (shader === 'edgeDetect') {
        const xm = Math.max(0, x - 1);
        const xp = Math.min(w - 1, x + 1);
        const ym = Math.max(0, y - 1);
        const yp = Math.min(h - 1, y + 1);
        const gx =
          luma(srcData[(y * w + xp) * 4], srcData[(y * w + xp) * 4 + 1], srcData[(y * w + xp) * 4 + 2]) -
          luma(srcData[(y * w + xm) * 4], srcData[(y * w + xm) * 4 + 1], srcData[(y * w + xm) * 4 + 2]);
        const gy =
          luma(srcData[(yp * w + x) * 4], srcData[(yp * w + x) * 4 + 1], srcData[(yp * w + x) * 4 + 2]) -
          luma(srcData[(ym * w + x) * 4], srcData[(ym * w + x) * 4 + 1], srcData[(ym * w + x) * 4 + 2]);
        const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy) * 900));
        r = mag;
        g = mag;
        b = mag;
      } else if (shader === 'vhs') {
        const jitter = Math.round(Math.sin(y * 0.08) * 3);
        const rx = Math.max(0, Math.min(w - 1, x + 4 + jitter));
        const bx = Math.max(0, Math.min(w - 1, x - 4 + jitter));
        const scan = y % 3 === 0 ? 0.68 : 1.05;
        r = Math.min(255, Math.round(srcData[(y * w + rx) * 4] * scan));
        g = Math.min(255, Math.round(g * scan));
        b = Math.min(255, Math.round(srcData[(y * w + bx) * 4 + 2] * scan));
      } else if (shader === 'pixelSort') {
        const l = luma(r, g, b);
        if (l > 0.22) {
          const sx = Math.max(0, x - Math.round((l - 0.22) * 38));
          const sp = (y * w + sx) * 4;
          r = srcData[sp];
          g = srcData[sp + 1];
          b = srcData[sp + 2];
        }
      } else if (shader === 'noise') {
        const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const grain = (n - 0.5) * 62;
        r = Math.max(0, Math.min(255, r + grain));
        g = Math.max(0, Math.min(255, g + grain));
        b = Math.max(0, Math.min(255, b + grain));
      } else if (shader === 'tone') {
        const l = Math.pow(luma(r, g, b), 0.78);
        const c = Math.max(0, Math.min(1, (l - 0.5) * 1.35 + 0.5));
        const v = Math.round(c * 245);
        r = v;
        g = v;
        b = v;
      }

      od[p] = r;
      od[p + 1] = g;
      od[p + 2] = b;
      od[p + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready
      .then(() => requestAnimationFrame(fitHeroWordmark))
      .catch(() => undefined);
  }
  window.addEventListener('resize', fitHeroWordmark, { passive: true });

  // Copy buttons
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy');
      if (!value) return;
      let ok = false;
      try {
        await navigator.clipboard.writeText(value);
        ok = true;
      } catch {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (ok) {
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => {
          btn.textContent = prev;
        }, 1800);
      }
    });
  });

  // Live shader preview canvas
  const canvas = document.getElementById('shader-preview-canvas') as HTMLCanvasElement | null;
  const listEl = document.getElementById('shader-list');
  const nameEl = document.getElementById('shader-active-name');
  const descEl = document.getElementById('shader-active-desc');

  if (!canvas || !listEl) return;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = canvas.width;
  srcCanvas.height = canvas.height;

  let activeShader: ShaderKey = 'ascii';
  let imageReady = false;
  let sampleStarted = false;
  let voronoiSeeds: { x: number; y: number; r: number; g: number; b: number }[] = [];

  const ensureSampleLoaded = () => {
    if (sampleStarted) return;
    sampleStarted = true;
    const img = new Image();
    img.src = '/sample-subject.webp';
    img.onload = () => {
      const sCtx = srcCanvas.getContext('2d');
      if (!sCtx) return;
      sCtx.fillStyle = '#08090b';
      sCtx.fillRect(0, 0, srcCanvas.width, srcCanvas.height);
      const scale = Math.min(srcCanvas.width / img.width, srcCanvas.height / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      sCtx.drawImage(img, (srcCanvas.width - dw) / 2, (srcCanvas.height - dh) / 2, dw, dh);

      const sd = sCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height).data;
      voronoiSeeds = [];
      for (let gy = 18; gy < srcCanvas.height; gy += 36) {
        for (let gx = 18; gx < srcCanvas.width; gx += 36) {
          const jx = Math.min(srcCanvas.width - 1, Math.max(0, gx + Math.round(Math.sin(gx + gy) * 10)));
          const jy = Math.min(srcCanvas.height - 1, Math.max(0, gy + Math.round(Math.cos(gx * 0.5 + gy) * 10)));
          const p = (jy * srcCanvas.width + jx) * 4;
          voronoiSeeds.push({ x: jx, y: jy, r: sd[p], g: sd[p + 1], b: sd[p + 2] });
        }
      }

      imageReady = true;
      renderShaderPreview(canvas, srcCanvas, activeShader, voronoiSeeds);
    };
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          ensureSampleLoaded();
        }
      },
      { rootMargin: '0px' }
    );
    io.observe(canvas);
  } else {
    setTimeout(ensureSampleLoaded, 300);
  }

  const selectShader = (shader: ShaderKey, focusButton = false) => {
    activeShader = shader;
    if (nameEl) nameEl.textContent = shader;
    if (descEl) descEl.textContent = SHADER_DESCRIPTIONS[shader];

    const buttons = listEl.querySelectorAll<HTMLButtonElement>('[data-shader]');
    buttons.forEach((b) => {
      const match = b.getAttribute('data-shader') === shader;
      b.setAttribute('aria-selected', match ? 'true' : 'false');
      if (match && focusButton) b.focus();
    });

    if (imageReady) {
      renderShaderPreview(canvas, srcCanvas, activeShader, voronoiSeeds);
    } else {
      ensureSampleLoaded();
    }
  };

  listEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-shader]');
    if (!btn) return;
    const key = btn.getAttribute('data-shader') as ShaderKey | null;
    if (key) selectShader(key);
  });

  listEl.addEventListener('keydown', (e) => {
    const idx = SHADER_ORDER.indexOf(activeShader);
    if (idx === -1) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      selectShader(SHADER_ORDER[(idx + 1) % SHADER_ORDER.length], true);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      selectShader(SHADER_ORDER[(idx - 1 + SHADER_ORDER.length) % SHADER_ORDER.length], true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectShader(SHADER_ORDER[0], true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectShader(SHADER_ORDER[SHADER_ORDER.length - 1], true);
    }
  });
});
