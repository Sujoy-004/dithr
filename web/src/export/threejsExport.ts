import type { RampPreset } from '../types/studio';
import { resolveChars } from '../store/presets';
import { downloadText } from './download';

export interface ThreeJsExportOptions {
  cols?: number;
  rampPreset?: RampPreset;
  customChars?: string;
  filename?: string;
  title?: string;
}

interface PointCloudData {
  chars: string;
  cols: number;
  rows: number;
  positions: number[];
  colors: number[];
  charIndices: number[];
}

function sourceDimensions(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
  const width =
    'videoWidth' in source && source.videoWidth
      ? source.videoWidth
      : 'naturalWidth' in source && source.naturalWidth
      ? source.naturalWidth
      : source.width;
  const height =
    'videoHeight' in source && source.videoHeight
      ? source.videoHeight
      : 'naturalHeight' in source && source.naturalHeight
      ? source.naturalHeight
      : source.height;
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function samplePointCloud(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  cols: number,
  chars: string
): PointCloudData {
  const { width: srcWidth, height: srcHeight } = sourceDimensions(source);
  const rows = Math.max(8, Math.min(160, Math.round((cols * srcHeight) / srcWidth)));

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const positions: number[] = [];
  const colors: number[] = [];
  const charIndices: number[] = [];

  if (!ctx) {
    return { chars, cols, rows, positions, colors, charIndices };
  }

  ctx.drawImage(source, 0, 0, cols, rows);
  const pixels = ctx.getImageData(0, 0, cols, rows).data;
  const glyphs = Array.from(chars);
  const glyphCount = Math.max(1, glyphs.length);
  const spacing = 0.14;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offset = (row * cols + col) * 4;
      const r = pixels[offset] / 255;
      const g = pixels[offset + 1] / 255;
      const b = pixels[offset + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      positions.push(
        (col - cols / 2) * spacing,
        (rows / 2 - row) * spacing,
        (lum - 0.5) * 4.2
      );
      colors.push(r, g, b);
      charIndices.push(Math.min(glyphCount - 1, Math.floor(lum * glyphCount)));
    }
  }

  return { chars, cols, rows, positions, colors, charIndices };
}

function buildGlyphAtlas(chars: string): string {
  const glyphs = Array.from(chars);
  const cellWidth = 32;
  const cellHeight = 48;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, glyphs.length * cellWidth);
  canvas.height = cellHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px "JetBrains Mono", "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  glyphs.forEach((glyph, index) => {
    ctx.fillText(glyph, index * cellWidth + cellWidth / 2, cellHeight / 2);
  });

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

/** Builds the standalone interactive Three.js point-cloud document. */
export function buildThreeJsHtml(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  options: ThreeJsExportOptions = {}
): string {
  const cols = Math.max(24, Math.min(160, Math.round(options.cols ?? 96)));
  const chars = resolveChars(options.rampPreset ?? 'standard', options.customChars);
  const data = samplePointCloud(source, cols, chars);
  const atlas = buildGlyphAtlas(chars);
  const title = options.title ?? 'dithr — 3D ASCII export';
  const glyphCount = Math.max(1, Array.from(chars).length);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; overflow: hidden; background: #0a0a0a; color: #cccccc; font-family: "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace; }
  #app { position: fixed; inset: 0; }
  canvas { display: block; }
  .hud { position: fixed; z-index: 10; pointer-events: none; user-select: none; }
  .hud.top { top: 18px; left: 18px; }
  .hud.bottom { bottom: 18px; left: 18px; }
  h1 { margin: 0 0 4px; font-size: 13px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #ffffff; }
  p { margin: 0; font-size: 11px; line-height: 1.6; color: #888888; }
  .pill { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 3px 8px; border: 1px solid #222222; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #00ff41; }
  .dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; box-shadow: 0 0 8px currentColor; }
  button { pointer-events: auto; margin-top: 10px; padding: 6px 10px; border: 1px solid #222222; background: #0f0f0f; color: #cccccc; font: inherit; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; cursor: pointer; }
  button:hover { border-color: #555555; color: #ffffff; }
</style>
</head>
<body>
<div id="app"></div>
<div class="hud top">
  <h1>${title}</h1>
  <p>${data.cols} × ${data.rows} glyph heightfield</p>
  <div class="pill"><span class="dot"></span> three.js point cloud</div>
</div>
<div class="hud bottom">
  <p>Drag to orbit · Scroll to zoom · Right-drag to pan</p>
  <button id="rotate">Auto-rotate: on</button>
</div>
<script type="importmap">
{ "imports": { "three": "https://unpkg.com/three@0.187.0/build/three.module.js", "three/addons/": "https://unpkg.com/three@0.187.0/examples/jsm/" } }
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DATA = ${JSON.stringify(data)};
const ATLAS = ${JSON.stringify(atlas)};
const GLYPHS = ${glyphCount};

const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.FogExp2(0x0a0a0a, 0.035);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 6, 16);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);

const grid = new THREE.GridHelper(24, 24, 0x222222, 0x151515);
grid.position.y = -3.2;
scene.add(grid);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute(DATA.positions, 3));
geometry.setAttribute('color', new THREE.Float32BufferAttribute(DATA.colors, 3));
geometry.setAttribute('aChar', new THREE.Float32BufferAttribute(DATA.charIndices, 1));

const atlasTexture = new THREE.TextureLoader().load(ATLAS);
atlasTexture.minFilter = THREE.LinearFilter;
atlasTexture.magFilter = THREE.LinearFilter;
atlasTexture.generateMipmaps = false;
atlasTexture.colorSpace = THREE.NoColorSpace;

const material = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: {
    uAtlas: { value: atlasTexture },
    uGlyphs: { value: GLYPHS },
    uSize: { value: 9.0 }
  },
  vertexShader: \`
    attribute float aChar;
    varying vec3 vColor;
    varying float vChar;
    uniform float uSize;
    void main() {
      vColor = color;
      vChar = aChar;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uSize * (18.0 / max(0.001, -mv.z));
      gl_Position = projectionMatrix * mv;
    }
  \`,
  fragmentShader: \`
    uniform sampler2D uAtlas;
    uniform float uGlyphs;
    varying vec3 vColor;
    varying float vChar;
    void main() {
      vec2 uv = vec2((vChar + gl_PointCoord.x) / uGlyphs, 1.0 - gl_PointCoord.y);
      float ink = texture2D(uAtlas, uv).r;
      if (ink < 0.08) discard;
      gl_FragColor = vec4(vColor * ink, ink);
    }
  \`,
  vertexColors: true
});

const points = new THREE.Points(geometry, material);
points.rotation.x = -0.08;
scene.add(points);

let autoRotate = true;
const rotateButton = document.getElementById('rotate');
rotateButton.addEventListener('click', () => {
  autoRotate = !autoRotate;
  rotateButton.textContent = 'Auto-rotate: ' + (autoRotate ? 'on' : 'off');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  const delta = clock.getDelta();
  if (autoRotate) points.rotation.y += delta * 0.25;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
</script>
</body>
</html>`;
}

/** Samples the current source and downloads a standalone Three.js .html viewer. */
export function exportThreeJsHtml(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  options: ThreeJsExportOptions = {}
): string {
  const html = buildThreeJsHtml(source, options);
  const filename = options.filename ?? `dithr-3d-${Date.now()}.html`;
  downloadText(html, filename, 'text/html;charset=utf-8');
  return html;
}
