import { describe, it, expect, beforeEach } from 'vitest';
import {
  useStudioStore,
  STUDIO_THEME_ORDER,
  DEFAULT_INITIAL_STACK,
} from '../store/useStudioStore';
import {
  CHAR_PRESETS,
  CHAR_PRESET_LIST,
  resolveChars,
  DEFAULT_CHARS,
} from '../store/presets';
import {
  RETRO_PALETTES,
  RETRO_PALETTE_LIST,
  PALETTE_OPTIONS,
  hexToRgb,
} from '../store/palettes';
import { BUILTIN_STUDIO_PRESETS } from '../store/studioPresets';
import {
  isPostProcessingActive,
  postProcessTopology,
} from '../engine/registry/modulate/postProcess';
import {
  DEFAULT_POST_PROCESSING,
  DEFAULT_PROCESSING,
  DEFAULT_TONE,
  DEFAULT_ASCII,
} from '../store/defaults';
import { buildThreeJsHtml } from '../export/threejsExport';

describe('Grainrad Transformation: Themes, Typography & Visual System', () => {
  beforeEach(() => {
    localStorage.clear();
    useStudioStore.setState({
      studioTheme: 'default',
      theme: 'dark',
      activeStack: structuredClone(DEFAULT_INITIAL_STACK),
      activePresetId: null,
      customPresets: [],
      processing: { ...DEFAULT_PROCESSING },
      postProcessing: structuredClone(DEFAULT_POST_PROCESSING),
      tone: { ...DEFAULT_TONE },
      ascii: { ...DEFAULT_ASCII },
    });
  });

  it('provides all 5 studio themes in STUDIO_THEME_ORDER', () => {
    expect(STUDIO_THEME_ORDER).toEqual(['default', 'vt320', 'cassette', 'coldwar', 'light']);
  });

  it('cycles studio themes sequentially and maintains light/dark sync', () => {
    const { cycleStudioTheme, setStudioTheme } = useStudioStore.getState();

    setStudioTheme('default');
    expect(useStudioStore.getState().studioTheme).toBe('default');
    expect(useStudioStore.getState().theme).toBe('dark');

    cycleStudioTheme(); // -> vt320
    expect(useStudioStore.getState().studioTheme).toBe('vt320');
    expect(useStudioStore.getState().theme).toBe('dark');

    cycleStudioTheme(); // -> cassette
    expect(useStudioStore.getState().studioTheme).toBe('cassette');
    expect(useStudioStore.getState().theme).toBe('dark');

    cycleStudioTheme(); // -> coldwar
    expect(useStudioStore.getState().studioTheme).toBe('coldwar');
    expect(useStudioStore.getState().theme).toBe('dark');

    cycleStudioTheme(); // -> light
    expect(useStudioStore.getState().studioTheme).toBe('light');
    expect(useStudioStore.getState().theme).toBe('light');

    cycleStudioTheme(); // -> default (wraps around)
    expect(useStudioStore.getState().studioTheme).toBe('default');
    expect(useStudioStore.getState().theme).toBe('dark');
  });

  it('persists studio theme changes in localStorage', () => {
    const { setStudioTheme } = useStudioStore.getState();
    setStudioTheme('cassette');
    expect(localStorage.getItem('dithr.studioTheme')).toBe('cassette');
  });
});

describe('Grainrad Transformation: 10 Character Ramp Sets', () => {
  it('exposes exactly 10 character ramp presets with valid metadata', () => {
    expect(CHAR_PRESET_LIST).toHaveLength(10);
    const ids = CHAR_PRESET_LIST.map((p) => p.id);
    expect(ids).toEqual([
      'standard',
      'blocks',
      'binary',
      'detailed',
      'minimal',
      'alphabetic',
      'numeric',
      'math',
      'symbols',
      'custom',
    ]);
  });

  it('resolves correct ramps for every preset', () => {
    expect(resolveChars('standard')).toBe(CHAR_PRESETS.standard);
    expect(resolveChars('blocks')).toBe(CHAR_PRESETS.blocks);
    expect(resolveChars('binary')).toBe(' 01');
    expect(resolveChars('detailed')).toBe(CHAR_PRESETS.detailed);
    expect(resolveChars('detailed').length).toBeGreaterThan(40);
    expect(resolveChars('minimal')).toBe(' .:#');
    expect(resolveChars('alphabetic')).toBe(' .icotCOXWM');
    expect(resolveChars('numeric')).toBe(' 1234567890');
    expect(resolveChars('math')).toContain('×');
    expect(resolveChars('symbols')).toContain('●');
  });

  it('resolves custom glyph ramps or falls back to default', () => {
    expect(resolveChars('custom', 'ABC123')).toBe('ABC123');
    expect(resolveChars('custom', '')).toBe(DEFAULT_CHARS);
  });
});

describe('Grainrad Transformation: Retro Palettes & Color LUTs', () => {
  it('exposes all 12 retro colour palettes with valid hex codes', () => {
    expect(RETRO_PALETTE_LIST).toHaveLength(12);
    const hexPattern = /^#[0-9a-fA-F]{6}$/;

    for (const palette of RETRO_PALETTE_LIST) {
      expect(palette.colors.length).toBeGreaterThanOrEqual(4);
      for (const color of palette.colors) {
        expect(color).toMatch(hexPattern);
      }
    }

    expect(RETRO_PALETTES.gameboy.colors).toHaveLength(4);
    expect(RETRO_PALETTES.cga.colors).toHaveLength(4);
    expect(RETRO_PALETTES.pico8.colors).toHaveLength(16);
    expect(RETRO_PALETTES.c64.colors).toHaveLength(16);
    expect(RETRO_PALETTES.appleII.colors).toHaveLength(16);
    expect(RETRO_PALETTES.cyberpunk.colors).toHaveLength(6);
  });

  it('PALETTE_OPTIONS includes none as first neutral choice followed by all 12 palettes', () => {
    expect(PALETTE_OPTIONS[0]).toBe('none');
    expect(PALETTE_OPTIONS.slice(1)).toEqual(RETRO_PALETTE_LIST.map((p) => p.id));
  });

  it('hexToRgb correctly parses 6-digit and 3-digit hex colors into normalized sRGB', () => {
    const black = hexToRgb('#000000');
    expect(black).toEqual([0, 0, 0]);

    const white = hexToRgb('#ffffff');
    expect(white).toEqual([1, 1, 1]);

    const red = hexToRgb('#ff0000');
    expect(red).toEqual([1, 0, 0]);

    const shortHex = hexToRgb('#fff');
    expect(shortHex).toEqual([1, 1, 1]);

    const invalid = hexToRgb('invalid');
    expect(invalid).toEqual([0, 0, 0]);
  });
});

describe('Grainrad Transformation: Built-in & Custom Studio Presets', () => {
  beforeEach(() => {
    localStorage.clear();
    useStudioStore.setState({
      activeStack: structuredClone(DEFAULT_INITIAL_STACK),
      activePresetId: null,
      customPresets: [],
      studioTheme: 'default',
      postProcessing: structuredClone(DEFAULT_POST_PROCESSING),
      processing: { ...DEFAULT_PROCESSING },
    });
  });

  it('provides 6 built-in presets with complete configuration contracts', () => {
    expect(BUILTIN_STUDIO_PRESETS).toHaveLength(6);
    const ids = BUILTIN_STUDIO_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'terminal-green',
      'matrix',
      'retro-crt',
      'high-detail',
      'minimal',
      'cyberpunk',
    ]);

    for (const preset of BUILTIN_STUDIO_PRESETS) {
      expect(preset.builtIn).toBe(true);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.stack.length).toBeGreaterThan(0);
      expect(preset.postProcessing).toBeDefined();
    }
  });

  it('applyBuiltInPreset configures stack, post-processing, theme, and activePresetId', () => {
    const { applyBuiltInPreset } = useStudioStore.getState();

    applyBuiltInPreset('terminal-green');
    let state = useStudioStore.getState();
    expect(state.activePresetId).toBe('terminal-green');
    expect(state.activeStack.length).toBe(1);
    expect(state.activeStack[0].effectId).toBe('ascii');
    expect(state.studioTheme).toBe('cassette');
    expect(state.postProcessing.phosphor.enabled).toBe(true);
    expect(state.postProcessing.scanlines.enabled).toBe(true);

    applyBuiltInPreset('retro-crt');
    state = useStudioStore.getState();
    expect(state.activePresetId).toBe('retro-crt');
    expect(state.activeStack.length).toBe(2);
    expect(state.activeStack[0].effectId).toBe('dither');
    expect(state.activeStack[1].effectId).toBe('crtVhs');
    expect(state.studioTheme).toBe('vt320');
    expect(state.postProcessing.crtCurve.enabled).toBe(true);
  });

  it('custom presets: save, apply, export, delete, and import lifecycle', () => {
    const store = useStudioStore.getState();

    // 1. Save custom preset
    store.applyBuiltInPreset('terminal-green');
    const customId = store.saveCustomPreset('My Green Terminal');
    expect(customId).toMatch(/^custom-/);

    const savedState = useStudioStore.getState();
    expect(savedState.customPresets).toHaveLength(1);
    expect(savedState.customPresets[0].name).toBe('My Green Terminal');
    expect(savedState.customPresets[0].builtIn).toBe(false);
    expect(savedState.activePresetId).toBe(customId);

    // 2. Export JSON
    const json = store.exportCustomPresets();
    expect(json).toContain('My Green Terminal');
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe(customId);

    // 3. Delete custom preset
    store.deleteCustomPreset(customId);
    expect(useStudioStore.getState().customPresets).toHaveLength(0);
    expect(useStudioStore.getState().activePresetId).toBeNull();

    // 4. Import JSON back
    const count = store.importCustomPresets(json);
    expect(count).toBe(1);
    expect(useStudioStore.getState().customPresets).toHaveLength(1);
    expect(useStudioStore.getState().customPresets[0].id).toBe(customId);

    // 5. Corrupt / invalid JSON import resilience
    expect(store.importCustomPresets('not valid json')).toBe(0);
    expect(store.importCustomPresets('{"foo": "bar"}')).toBe(0);
    expect(store.importCustomPresets('[]')).toBe(0);
  });
});

describe('Grainrad Transformation: Global Processing & Post-Processing', () => {
  beforeEach(() => {
    useStudioStore.setState({
      processing: { ...DEFAULT_PROCESSING },
      postProcessing: structuredClone(DEFAULT_POST_PROCESSING),
    });
  });

  it('manages Stage-0 processing state and reset', () => {
    const { updateProcessing, resetProcessing } = useStudioStore.getState();

    updateProcessing({
      edgeEnhance: 0.35,
      quantizeColors: 8,
      invert: true,
    });

    let state = useStudioStore.getState();
    expect(state.processing.edgeEnhance).toBe(0.35);
    expect(state.processing.quantizeColors).toBe(8);
    expect(state.processing.invert).toBe(true);

    resetProcessing();
    state = useStudioStore.getState();
    expect(state.processing).toEqual(DEFAULT_PROCESSING);
  });

  it('manages global post-processing toggles and parameters', () => {
    const { updatePostProcessing, resetPostProcessing } = useStudioStore.getState();

    expect(isPostProcessingActive(useStudioStore.getState().postProcessing)).toBe(false);
    expect(postProcessTopology(useStudioStore.getState().postProcessing)).toBe('');

    updatePostProcessing({
      bloom: { enabled: true, threshold: 0.6, intensity: 0.75 },
      scanlines: { enabled: true, opacity: 0.25 },
    });

    const activeState = useStudioStore.getState().postProcessing;
    expect(isPostProcessingActive(activeState)).toBe(true);
    expect(activeState.bloom.enabled).toBe(true);
    expect(activeState.bloom.intensity).toBe(0.75);
    expect(activeState.scanlines.enabled).toBe(true);

    const topo = postProcessTopology(activeState);
    expect(topo).toContain('bloom');
    expect(topo).toContain('scanlines');

    // Modifying a parameter does not change topology hash
    updatePostProcessing({ bloom: { intensity: 0.95 } });
    expect(postProcessTopology(useStudioStore.getState().postProcessing)).toBe(topo);

    // Reset restores neutral default
    resetPostProcessing();
    expect(isPostProcessingActive(useStudioStore.getState().postProcessing)).toBe(false);
  });
});

describe('Grainrad Transformation: Three.js Standalone 3D HTML Export', () => {
  it('buildThreeJsHtml produces a valid standalone interactive HTML document', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;

    const html = buildThreeJsHtml(canvas, {
      cols: 40,
      rampPreset: 'detailed',
      title: 'dithr — Grainrad 3D Export Test',
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>dithr — Grainrad 3D Export Test</title>');
    expect(html).toContain('three.module.js');
    expect(html).toContain('OrbitControls.js');
    expect(html).toContain('THREE.ShaderMaterial');
    expect(html).toContain('THREE.Points');
    expect(html).toContain('Auto-rotate: on');
    expect(html).toContain('renderer.setSize(window.innerWidth, window.innerHeight)');
  });
});
