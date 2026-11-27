import { create } from 'zustand';
import type {
  ActiveEffectPass,
  AsciiSettings,
  AudioMapping,
  AudioSourceType,
  AudioState,
  AudioStatusType,
  BlendMode,
  Dimensions,
  EffectMode,
  EffectParams,
  MediaType,
  PostProcessingSettings,
  ProcessingSettings,
  StudioPreset,
  StudioTheme,
  ThemeMode,
  ToneSettings,
  ThreeDPrimitiveType,
  ThreeDState,
} from '../types/studio';
import type { QualityTier, GpuCapabilities } from '../engine/capabilities';
import { getEffectDefinition } from '../engine/registry';
import {
  applyCrtProfile,
  type CrtVhsProfileName,
} from '../engine/registry/modulate/crtVhs';
import type { StudioPipeline } from '../engine/Pipeline';
import {
  DEFAULT_ASCII,
  DEFAULT_POST_PROCESSING,
  DEFAULT_PROCESSING,
  DEFAULT_TONE,
  STUDIO_THEME_ORDER,
} from './defaults';
import { BUILTIN_STUDIO_PRESETS } from './studioPresets';

export {
  DEFAULT_TONE,
  DEFAULT_ASCII,
  DEFAULT_PROCESSING,
  DEFAULT_POST_PROCESSING,
  STUDIO_THEME_ORDER,
} from './defaults';

interface Pan {
  x: number;
  y: number;
}

interface MediaState {
  mediaType: MediaType | null;
  mediaUrl: string | null;
  mediaName: string | null;
  dimensions: Dimensions | null;
}

export interface StudioErrorBanner {
  title: string;
  detail: string;
  recovery: string;
}

export type MobileSheetTab =
  | 'closed'
  | 'media'
  | 'shaders'
  | 'presets'
  | 'adjust'
  | 'export'
  | 'more';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

interface StudioState extends MediaState {
  // Viewport HUD (STUDIO-03)
  zoom: number;
  pan: Pan;
  setZoom: (zoom: number) => void;
  setPan: (pan: Pan) => void;
  resetHUD: () => void;

  // Actionable error banner (replaces blocking alerts)
  errorBanner: StudioErrorBanner | null;
  setErrorBanner: (err: StudioErrorBanner | null) => void;
  clearErrorBanner: () => void;
  fallbackNoticeDismissed: boolean;
  dismissFallbackNotice: () => void;

  // Mobile bottom sheet state
  mobileSheetTab: MobileSheetTab;
  setMobileSheetTab: (tab: MobileSheetTab) => void;

  // Active effect selection (D-02)
  effect: EffectMode | null;
  setEffect: (effect: EffectMode | null) => void;

  // Active Effect Stack (D-01, D-02, D-03, D-04, D-20, FX-01)
  activeStack: ActiveEffectPass[];
  selectedPassId: string | null;
  setSelectedPassId: (id: string | null) => void;
  addEffect: (effectId: string, initialParams?: Record<string, any>) => void;
  removeEffect: (instanceId: string) => void;
  clearStack: () => void;
  reorderStack: (fromIndex: number, toIndex: number) => void;
  toggleEffect: (instanceId: string) => void;
  duplicateEffect: (instanceId: string) => void;
  setEffectIntensity: (instanceId: string, intensity: number) => void;
  setEffectBlendMode: (instanceId: string, mode: BlendMode) => void;
  updatePassParam: (instanceId: string, paramKey: string, value: any) => void;
  setSingleEffectFastPath: (effectId: string) => void;

  // Dynamic effect parameters
  effectParams: EffectParams;
  updateEffectParam: (keyOrInstanceId: string, valueOrParamKey: any, maybeValue?: any) => void;

  // Pre-tone adjustments (SHADER-03)
  tone: ToneSettings;
  updateTone: (patch: Partial<ToneSettings>) => void;
  resetTone: () => void;

  // Global Stage-0 processing (Grainrad "Processing")
  processing: ProcessingSettings;
  updateProcessing: (patch: Partial<ProcessingSettings>) => void;
  resetProcessing: () => void;

  // Global post-processing chain after the effect stack
  postProcessing: PostProcessingSettings;
  updatePostProcessing: (patch: DeepPartial<PostProcessingSettings>) => void;
  resetPostProcessing: () => void;

  // ASCII engine parameters (SHADER-01)
  ascii: AsciiSettings;
  updateAscii: (patch: Partial<AsciiSettings>) => void;

  // Studio presets (Grainrad built-in + custom JSON import/export)
  activePresetId: string | null;
  customPresets: StudioPreset[];
  applyBuiltInPreset: (id: string) => void;
  applyCustomPreset: (id: string) => void;
  saveCustomPreset: (name: string) => string;
  deleteCustomPreset: (id: string) => void;
  importCustomPresets: (json: string) => number;
  exportCustomPresets: () => string;

  // Theme (STUDIO-03)
  theme: ThemeMode;
  toggleTheme: () => void;
  studioTheme: StudioTheme;
  setStudioTheme: (theme: StudioTheme) => void;
  cycleStudioTheme: () => void;

  // Sidebar collapse (D-03)
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  toggleLeftRail: () => void;
  toggleRightRail: () => void;
  setLeftCollapsed: (collapsed: boolean) => void;
  setRightCollapsed: (collapsed: boolean) => void;

  // Media ingestion (MEDIA-01, MEDIA-02, D-04)
  loadMediaFile: (file: File, expectedType?: 'image' | 'video') => Promise<void>;
  loadSampleImage: () => Promise<void>;
  startWebcam: () => Promise<void>;
  stopWebcam: () => void;
  clearMedia: () => void;
  openFileBrowser: (filter?: 'image' | 'video') => void;
  setMedia: (media: Partial<MediaState>) => void;
  setDimensions: (dimensions: Dimensions) => void;

  // Video playback controls
  isPlaying: boolean;
  isMuted: boolean;
  playbackTime: number;
  duration: number;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setPlaybackTime: (time: number) => void;
  setDuration: (duration: number) => void;
  togglePlay: () => void;
  stopVideo: () => void;
  toggleMute: () => void;

  // GPU Capabilities & Quality Tiers (D-08, RELY-09, RELY-10)
  detectedTier: QualityTier;
  activeTier: QualityTier;
  tierOverride: QualityTier | null;
  gpuEngine: 'webgpu' | 'webgl2';
  maxTextureSize: number;
  renderStatus: 'active' | 'paused';
  setDetectedCapabilities: (caps: GpuCapabilities) => void;
  setTierOverride: (tier: QualityTier | null) => void;
  setRenderStatus: (status: 'active' | 'paused') => void;

  // Audio Reactivity Engine (D-10, D-11, D-12, D-13, D-14, FX-05)
  audioState: AudioState;
  setAudioEnabled: (enabled: boolean) => void;
  setAudioSource: (source: AudioSourceType) => void;
  setAudioStatus: (status: AudioStatusType) => void;
  setAudioSensitivity: (sensitivity: number) => void;
  setAudioEnvelopePreset: (preset: 'punchy' | 'standard' | 'smooth') => void;
  addAudioMapping: (mapping: Omit<AudioMapping, 'id'>) => void;
  removeAudioMapping: (id: string) => void;
  updateAudioMapping: (id: string, patch: Partial<AudioMapping>) => void;

  // 3D Scene & Camera State (D-15, D-16, D-17, FX-06)
  threeDState: ThreeDState;
  setThreeDPrimitive: (primitive: ThreeDPrimitiveType) => void;
  setCustomMesh: (mesh: any | null, name: string | null) => void;
  setThreeDAutoRotate: (autoRotate: boolean) => void;
  setThreeDAutoRotateSpeed: (speed: number) => void;
  resetThreeDCamera: () => void;
}

export const DEFAULT_EFFECT_PARAMS: EffectParams = {
  ditherSteps: 4,
  ditherSpread: 0.5,
  halftoneFreq: 50,
  halftoneAngle: 45,
  halftoneRadius: 1.0,
  matrixSpeed: 1.0,
  matrixDensity: 40,
  sortThreshold: 0.5,
  sortSpan: 30,
  sortDirection: 0,
  genericA: 12,
  genericB: 0.2,
  vhsScanlineIntensity: 0.35,
  vhsAberration: 0.1,
  vhsNoiseIntensity: 0.1,
  vhsCurvature: 0.0,
};

export const DEFAULT_INITIAL_STACK: ActiveEffectPass[] = [];

export const DEFAULT_AUDIO_STATE: AudioState = {
  enabled: false,
  source: 'media',
  status: 'off',
  sensitivity: 1.0,
  envelopePreset: 'standard',
  mappings: [],
};

export const DEFAULT_THREED_STATE: ThreeDState = {
  primitive: 'torusKnot',
  customMesh: null,
  customMeshName: null,
  autoRotate: true,
  autoRotateSpeed: 1.0,
  cameraResetTrigger: 0,
};

const DEFAULT_PAN: Pan = { x: 0, y: 0 };
const DEFAULT_ZOOM = 1;

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;

function clampZoom(zoom: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

let activePipeline: StudioPipeline | null = null;

export function registerPipeline(pipeline: StudioPipeline | null): void {
  activePipeline = pipeline;
}

export function getActivePipeline(): StudioPipeline | null {
  return activePipeline;
}

function canonicalizeEffectId(effectId: string): string {
  return effectId === 'vhs' ? 'crtVhs' : effectId;
}

function toUiEffectMode(effectId: string): EffectMode {
  return (effectId === 'crtVhs' ? 'vhs' : effectId) as EffectMode;
}

function generateInstanceId(effectId: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${effectId}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${effectId}-${Math.random().toString(36).slice(2, 9)}`;
}

const THEME_STORAGE_KEY = 'dithr.studioTheme';
const PRESET_STORAGE_KEY = 'dithr.customPresets';

function readStoredTheme(): StudioTheme {
  if (typeof localStorage === 'undefined') return 'default';
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY) as StudioTheme | null;
    if (raw && (STUDIO_THEME_ORDER as readonly string[]).includes(raw)) return raw;
  } catch {
    // storage unavailable
  }
  return 'default';
}

function persistTheme(theme: StudioTheme): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore quota/security errors
  }
}

function readStoredPresets(): StudioPreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPresetLike).map(normalizePreset) : [];
  } catch {
    return [];
  }
}

function persistPresets(presets: StudioPreset[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore quota/security errors
  }
}

function isPresetLike(value: any): boolean {
  return !!value && typeof value === 'object' && typeof value.name === 'string' && Array.isArray(value.stack);
}

function normalizePreset(value: any): StudioPreset {
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `custom-${generateInstanceId('preset')}`,
    name: String(value.name || 'Untitled'),
    builtIn: false,
    stack: value.stack.map((entry: any) => ({
      effectId: canonicalizeEffectId(String(entry.effectId)),
      enabled: entry.enabled !== false,
      intensity: typeof entry.intensity === 'number' ? entry.intensity : 1,
      blendMode: entry.blendMode ?? 'normal',
      parameters: { ...(entry.parameters ?? {}) },
    })),
    tone: { ...DEFAULT_TONE, ...(value.tone ?? {}) },
    ascii: { ...DEFAULT_ASCII, ...(value.ascii ?? {}) },
    processing: { ...DEFAULT_PROCESSING, ...(value.processing ?? {}) },
    postProcessing: {
      bloom: { ...DEFAULT_POST_PROCESSING.bloom, ...(value.postProcessing?.bloom ?? {}) },
      grain: { ...DEFAULT_POST_PROCESSING.grain, ...(value.postProcessing?.grain ?? {}) },
      chromatic: { ...DEFAULT_POST_PROCESSING.chromatic, ...(value.postProcessing?.chromatic ?? {}) },
      scanlines: { ...DEFAULT_POST_PROCESSING.scanlines, ...(value.postProcessing?.scanlines ?? {}) },
      vignette: { ...DEFAULT_POST_PROCESSING.vignette, ...(value.postProcessing?.vignette ?? {}) },
      crtCurve: { ...DEFAULT_POST_PROCESSING.crtCurve, ...(value.postProcessing?.crtCurve ?? {}) },
      phosphor: { ...DEFAULT_POST_PROCESSING.phosphor, ...(value.postProcessing?.phosphor ?? {}) },
    },
    studioTheme: (STUDIO_THEME_ORDER as readonly string[]).includes(value.studioTheme)
      ? (value.studioTheme as StudioTheme)
      : undefined,
  };
}

function materializeStack(entries: StudioPreset['stack']): ActiveEffectPass[] {
  return entries.map((entry) => {
    const effectId = canonicalizeEffectId(entry.effectId);
    const def = getEffectDefinition(effectId);
    const parameters: Record<string, any> = {};
    if (def) {
      for (const [key, schema] of Object.entries(def.parameters)) {
        parameters[key] = schema.default;
      }
    }
    Object.assign(parameters, entry.parameters ?? {});
    return {
      instanceId: generateInstanceId(effectId),
      effectId,
      enabled: entry.enabled !== false,
      intensity: typeof entry.intensity === 'number' ? entry.intensity : 1,
      blendMode: entry.blendMode ?? 'normal',
      parameters,
    };
  });
}

function snapshotFromState(state: StudioState): Omit<StudioPreset, 'id' | 'name' | 'builtIn'> {
  return {
    stack: state.activeStack.map((pass) => ({
      effectId: pass.effectId,
      enabled: pass.enabled,
      intensity: pass.intensity,
      blendMode: pass.blendMode,
      parameters: structuredClone(pass.parameters),
    })),
    tone: { ...state.tone },
    ascii: { ...state.ascii },
    processing: { ...state.processing },
    postProcessing: structuredClone(state.postProcessing),
    studioTheme: state.studioTheme,
  };
}

let activeObjectUrl: string | null = null;
let activeStream: MediaStream | null = null;
let registeredVideo: HTMLVideoElement | null = null;
let activeFile: File | null = null;

export function getActiveFile(): File | null {
  return activeFile;
}

export function getRegisteredVideo(): HTMLVideoElement | null {
  if (registeredVideo && typeof document !== 'undefined' && document.contains(registeredVideo)) {
    return registeredVideo;
  }
  const el =
    typeof document !== 'undefined'
      ? (document.querySelector('video') as HTMLVideoElement | null)
      : null;
  if (el) {
    registeredVideo = el;
    return el;
  }
  return null;
}

export function getActiveStream(): MediaStream | null {
  return activeStream;
}

export function registerVideoElement(el: HTMLVideoElement | null): void {
  registeredVideo = el;
  if (el) {
    if (activeStream) {
      el.srcObject = activeStream;
      el.muted = true;
      el.play().catch(() => undefined);
    } else if (activeObjectUrl) {
      el.src = activeObjectUrl;
      el.play().catch(() => undefined);
    }
  }
}

let browseHandler: ((filter?: 'image' | 'video') => void) | null = null;

export function registerBrowseHandler(fn: ((filter?: 'image' | 'video') => void) | null): void {
  browseHandler = fn;
}

function stopStream(): void {
  if (!activeStream) return;
  for (const track of activeStream.getTracks()) track.stop();
  activeStream = null;
  if (registeredVideo) {
    registeredVideo.srcObject = null;
  }
}

function revokeUrl(): void {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  if (registeredVideo) {
    registeredVideo.removeAttribute('src');
  }
}

function detachMediaPlayback(): void {
  stopStream();
  revokeUrl();
  activeFile = null;
}

function readImageDimensions(url: string): Promise<Dimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = url;
  });
}

export const useStudioStore = create<StudioState>()((set, get) => ({
  mediaType: null,
  mediaUrl: null,
  mediaName: null,
  dimensions: null,

  zoom: DEFAULT_ZOOM,
  pan: DEFAULT_PAN,
  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  setPan: (pan) => set({ pan }),
  resetHUD: () => set({ zoom: DEFAULT_ZOOM, pan: DEFAULT_PAN }),

  errorBanner: null,
  setErrorBanner: (errorBanner) => set({ errorBanner }),
  clearErrorBanner: () => set({ errorBanner: null }),
  fallbackNoticeDismissed: false,
  dismissFallbackNotice: () => set({ fallbackNoticeDismissed: true }),

  mobileSheetTab: 'closed',
  setMobileSheetTab: (mobileSheetTab) => set({ mobileSheetTab }),

  effect: null,
  setEffect: (effect) => {
    if (effect === null) {
      get().clearStack();
    } else {
      get().setSingleEffectFastPath(effect);
    }
  },

  activeStack: DEFAULT_INITIAL_STACK,
  selectedPassId: null,

  setSelectedPassId: (selectedPassId) => set({ selectedPassId }),

  addEffect: (effectId, initialParams) => {
    const canonicalId = canonicalizeEffectId(effectId);
    const def = getEffectDefinition(canonicalId);
    const params: Record<string, any> = {};
    if (def) {
      for (const [k, s] of Object.entries(def.parameters)) {
        params[k] = s.default;
      }
    }
    if (initialParams) {
      Object.assign(params, initialParams);
    }
    const newPass: ActiveEffectPass = {
      instanceId: generateInstanceId(canonicalId),
      effectId: canonicalId,
      enabled: true,
      intensity: 1.0,
      blendMode: 'normal',
      parameters: params,
    };
    const next = [...get().activeStack, newPass];
    activePipeline?.syncStack(next, get().activeTier);
    set({
      activeStack: next,
      selectedPassId: newPass.instanceId,
      effect: get().effect ?? toUiEffectMode(canonicalId),
    });
  },

  removeEffect: (instanceId) => {
    const state = get();
    const index = state.activeStack.findIndex((p) => p.instanceId === instanceId);
    if (index === -1) return;
    const next = state.activeStack.filter((p) => p.instanceId !== instanceId);
    let nextSelectedId = state.selectedPassId;
    if (state.selectedPassId === instanceId) {
      if (next.length === 0) {
        nextSelectedId = null;
      } else {
        const fallbackIdx = Math.max(0, index - 1);
        nextSelectedId = next[fallbackIdx]?.instanceId ?? null;
      }
    }
    const nextMappings = state.audioState.mappings.filter(
      (m) => m.passInstanceId !== instanceId
    );
    activePipeline?.syncStack(next, state.activeTier);
    set({
      activeStack: next,
      selectedPassId: nextSelectedId,
      effect: next.length === 0 ? null : state.effect,
      audioState: {
        ...state.audioState,
        mappings: nextMappings,
      },
    });
  },

  clearStack: () => {
    activePipeline?.syncStack([], get().activeTier);
    set({
      activeStack: [],
      selectedPassId: null,
      effect: null,
    });
  },

  reorderStack: (fromIndex, toIndex) => {
    const state = get();
    if (
      fromIndex < 0 ||
      fromIndex >= state.activeStack.length ||
      toIndex < 0 ||
      toIndex >= state.activeStack.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const item = state.activeStack[fromIndex];
    if (!item) return;
    const next = state.activeStack.toSpliced(fromIndex, 1).toSpliced(toIndex, 0, item);
    activePipeline?.syncStack(next, state.activeTier);
    set({ activeStack: next });
  },

  toggleEffect: (instanceId) => {
    const state = get();
    const next = state.activeStack.map((p) =>
      p.instanceId === instanceId ? { ...p, enabled: !p.enabled } : p
    );
    activePipeline?.syncStack(next, state.activeTier);
    set({ activeStack: next });
  },

  duplicateEffect: (instanceId) => {
    const state = get();
    const index = state.activeStack.findIndex((p) => p.instanceId === instanceId);
    if (index === -1) return;
    const original = state.activeStack[index];
    const clone: ActiveEffectPass = structuredClone(original);
    clone.instanceId = generateInstanceId(original.effectId);
    const next = state.activeStack.toSpliced(index + 1, 0, clone);
    activePipeline?.syncStack(next, state.activeTier);
    set({
      activeStack: next,
      selectedPassId: clone.instanceId,
    });
  },

  setEffectIntensity: (instanceId, intensity) => {
    const clamped = Math.max(0, Math.min(1, intensity));
    const next = get().activeStack.map((p) =>
      p.instanceId === instanceId ? { ...p, intensity: clamped } : p
    );
    activePipeline?.updateUniform(instanceId, 'intensity', clamped);
    set({ activeStack: next });
  },

  setEffectBlendMode: (instanceId, mode) => {
    const state = get();
    const next = state.activeStack.map((p) =>
      p.instanceId === instanceId ? { ...p, blendMode: mode } : p
    );
    activePipeline?.syncStack(next, state.activeTier);
    set({ activeStack: next });
  },

  updatePassParam: (instanceId, paramKey, value) => {
    let bundledUpdates: Record<string, any> | null = null;
    const next = get().activeStack.map((p) => {
      if (p.instanceId !== instanceId) return p;
      if (p.effectId === 'crtVhs' && paramKey === 'profile') {
        bundledUpdates = applyCrtProfile(value as CrtVhsProfileName);
        return {
          ...p,
          parameters: {
            ...p.parameters,
            ...bundledUpdates,
            [paramKey]: value,
          },
        };
      }
      return {
        ...p,
        parameters: {
          ...p.parameters,
          [paramKey]: value,
        },
      };
    });

    if (bundledUpdates) {
      for (const [k, v] of Object.entries(bundledUpdates)) {
        activePipeline?.updateUniform(instanceId, k, v);
      }
    }
    activePipeline?.updateUniform(instanceId, paramKey, value);
    set({ activeStack: next });
  },

  setSingleEffectFastPath: (effectId) => {
    const canonicalId = canonicalizeEffectId(effectId);
    const def = getEffectDefinition(canonicalId);
    const params: Record<string, any> = {};
    if (def) {
      for (const [k, s] of Object.entries(def.parameters)) {
        params[k] = s.default;
      }
    }
    const instanceId = generateInstanceId(canonicalId);
    const pass: ActiveEffectPass = {
      instanceId,
      effectId: canonicalId,
      enabled: true,
      intensity: 1.0,
      blendMode: 'normal',
      parameters: params,
    };
    activePipeline?.syncStack([pass], get().activeTier);
    set({
      activeStack: [pass],
      selectedPassId: instanceId,
      effect: toUiEffectMode(canonicalId),
    });
  },

  effectParams: DEFAULT_EFFECT_PARAMS,
  updateEffectParam: (keyOrInstanceId: any, valueOrParamKey: any, maybeValue?: any) => {
    if (maybeValue !== undefined) {
      get().updatePassParam(keyOrInstanceId, valueOrParamKey, maybeValue);
    } else {
      set((s) => ({ effectParams: { ...s.effectParams, [keyOrInstanceId]: valueOrParamKey } }));
      const selected = get().selectedPassId;
      if (selected) {
        activePipeline?.updateUniform(selected, keyOrInstanceId, valueOrParamKey);
      }
    }
  },

  tone: DEFAULT_TONE,
  updateTone: (patch) => {
    const nextTone = { ...get().tone, ...patch };
    activePipeline?.updateTone(nextTone);
    set({ tone: nextTone });
  },
  resetTone: () => {
    activePipeline?.updateTone(DEFAULT_TONE);
    set({ tone: DEFAULT_TONE });
  },

  processing: DEFAULT_PROCESSING,
  updateProcessing: (patch) => {
    const next = { ...get().processing, ...patch };
    activePipeline?.updateProcessing(next);
    set({ processing: next });
  },
  resetProcessing: () => {
    activePipeline?.updateProcessing(DEFAULT_PROCESSING);
    set({ processing: DEFAULT_PROCESSING });
  },

  postProcessing: DEFAULT_POST_PROCESSING,
  updatePostProcessing: (patch) => {
    const current = get().postProcessing;
    const next: PostProcessingSettings = {
      bloom: { ...current.bloom, ...(patch.bloom ?? {}) },
      grain: { ...current.grain, ...(patch.grain ?? {}) },
      chromatic: { ...current.chromatic, ...(patch.chromatic ?? {}) },
      scanlines: { ...current.scanlines, ...(patch.scanlines ?? {}) },
      vignette: { ...current.vignette, ...(patch.vignette ?? {}) },
      crtCurve: { ...current.crtCurve, ...(patch.crtCurve ?? {}) },
      phosphor: { ...current.phosphor, ...(patch.phosphor ?? {}) },
    };
    activePipeline?.updatePostProcessing(next);
    set({ postProcessing: next });
  },
  resetPostProcessing: () => {
    activePipeline?.updatePostProcessing(DEFAULT_POST_PROCESSING);
    set({ postProcessing: structuredClone(DEFAULT_POST_PROCESSING) });
  },

  ascii: DEFAULT_ASCII,
  updateAscii: (patch) => {
    const nextAscii = { ...get().ascii, ...patch };
    activePipeline?.updateAscii(nextAscii);
    set({ ascii: nextAscii });
  },

  activePresetId: null,
  customPresets: readStoredPresets(),

  applyBuiltInPreset: (id) => {
    const preset = BUILTIN_STUDIO_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const stack = materializeStack(preset.stack);
    activePipeline?.syncStack(stack, get().activeTier);
    activePipeline?.updateTone(preset.tone);
    activePipeline?.updateProcessing(preset.processing);
    activePipeline?.updatePostProcessing(preset.postProcessing);
    activePipeline?.updateAscii(preset.ascii);
    set({
      activeStack: stack,
      selectedPassId: stack[0]?.instanceId ?? null,
      effect: stack[0] ? toUiEffectMode(stack[0].effectId) : null,
      tone: { ...preset.tone },
      ascii: { ...preset.ascii },
      processing: { ...preset.processing },
      postProcessing: structuredClone(preset.postProcessing),
      activePresetId: preset.id,
    });
    if (preset.studioTheme) get().setStudioTheme(preset.studioTheme);
  },

  applyCustomPreset: (id) => {
    const preset = get().customPresets.find((item) => item.id === id);
    if (!preset) return;
    const stack = materializeStack(preset.stack);
    activePipeline?.syncStack(stack, get().activeTier);
    activePipeline?.updateTone(preset.tone);
    activePipeline?.updateProcessing(preset.processing);
    activePipeline?.updatePostProcessing(preset.postProcessing);
    activePipeline?.updateAscii(preset.ascii);
    set({
      activeStack: stack,
      selectedPassId: stack[0]?.instanceId ?? null,
      effect: stack[0] ? toUiEffectMode(stack[0].effectId) : null,
      tone: { ...preset.tone },
      ascii: { ...preset.ascii },
      processing: { ...preset.processing },
      postProcessing: structuredClone(preset.postProcessing),
      activePresetId: preset.id,
    });
    if (preset.studioTheme) get().setStudioTheme(preset.studioTheme);
  },

  saveCustomPreset: (name) => {
    const id = `custom-${generateInstanceId('preset')}`;
    const preset: StudioPreset = {
      id,
      name: name.trim() || 'Untitled preset',
      builtIn: false,
      ...snapshotFromState(get()),
    };
    const next = [...get().customPresets, preset];
    persistPresets(next);
    set({ customPresets: next, activePresetId: id });
    return id;
  },

  deleteCustomPreset: (id) => {
    const next = get().customPresets.filter((preset) => preset.id !== id);
    persistPresets(next);
    set((state) => ({
      customPresets: next,
      activePresetId: state.activePresetId === id ? null : state.activePresetId,
    }));
  },

  importCustomPresets: (json) => {
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return 0;
    }
    const candidates = Array.isArray(parsed) ? parsed : parsed?.presets;
    if (!Array.isArray(candidates)) return 0;

    const imported = candidates.filter(isPresetLike).map((value) => ({
      ...normalizePreset(value),
      builtIn: false,
    }));
    if (imported.length === 0) return 0;

    const merged = [...get().customPresets];
    for (const preset of imported) {
      const existingIndex = merged.findIndex((item) => item.id === preset.id);
      if (existingIndex >= 0) merged[existingIndex] = preset;
      else merged.push(preset);
    }
    persistPresets(merged);
    set({ customPresets: merged });
    return imported.length;
  },

  exportCustomPresets: () => JSON.stringify(get().customPresets, null, 2),

  theme: readStoredTheme() === 'light' ? 'light' : 'dark',
  studioTheme: readStoredTheme(),
  toggleTheme: () => {
    get().setStudioTheme(get().theme === 'dark' ? 'light' : 'default');
  },
  setStudioTheme: (studioTheme) => {
    persistTheme(studioTheme);
    set({ studioTheme, theme: studioTheme === 'light' ? 'light' : 'dark' });
  },
  cycleStudioTheme: () => {
    const currentIndex = STUDIO_THEME_ORDER.indexOf(get().studioTheme);
    const next = STUDIO_THEME_ORDER[(currentIndex + 1) % STUDIO_THEME_ORDER.length];
    get().setStudioTheme(next);
  },

  leftCollapsed: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  rightCollapsed: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  toggleLeftRail: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRightRail: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
  setLeftCollapsed: (collapsed) => set({ leftCollapsed: collapsed }),
  setRightCollapsed: (collapsed) => set({ rightCollapsed: collapsed }),

  detectedTier: 'high',
  activeTier: 'high',
  tierOverride: null,
  gpuEngine: 'webgpu',
  maxTextureSize: 8192,
  renderStatus: 'active',

  setDetectedCapabilities: (caps: GpuCapabilities) => {
    set((state) => ({
      detectedTier: caps.tier,
      activeTier: state.tierOverride ?? caps.tier,
      gpuEngine: caps.engine,
      maxTextureSize: caps.maxTextureSize,
    }));
  },

  setTierOverride: (tier: QualityTier | null) => {
    set((state) => ({
      tierOverride: tier,
      activeTier: tier ?? state.detectedTier,
    }));
  },

  setRenderStatus: (renderStatus: 'active' | 'paused') => {
    set({ renderStatus });
  },

  audioState: DEFAULT_AUDIO_STATE,

  setAudioEnabled: (enabled) =>
    set((state) => ({
      audioState: {
        ...state.audioState,
        enabled,
        status: enabled
          ? state.audioState.status === 'off'
            ? 'waiting'
            : state.audioState.status
          : 'off',
      },
    })),

  setAudioSource: (source) =>
    set((state) => ({
      audioState: { ...state.audioState, source },
    })),

  setAudioStatus: (status) =>
    set((state) => ({
      audioState: { ...state.audioState, status },
    })),

  setAudioSensitivity: (sensitivity) =>
    set((state) => ({
      audioState: {
        ...state.audioState,
        sensitivity: Math.max(0.1, Math.min(3.0, sensitivity)),
      },
    })),

  setAudioEnvelopePreset: (envelopePreset) =>
    set((state) => ({
      audioState: { ...state.audioState, envelopePreset },
    })),

  addAudioMapping: (mapping) => {
    const id = generateInstanceId('audio-map');
    const newMapping: AudioMapping = { ...mapping, id };
    set((state) => ({
      audioState: {
        ...state.audioState,
        mappings: [...state.audioState.mappings, newMapping],
      },
    }));
  },

  removeAudioMapping: (id) =>
    set((state) => ({
      audioState: {
        ...state.audioState,
        mappings: state.audioState.mappings.filter((m) => m.id !== id),
      },
    })),

  updateAudioMapping: (id, patch) =>
    set((state) => ({
      audioState: {
        ...state.audioState,
        mappings: state.audioState.mappings.map((m) =>
          m.id === id ? { ...m, ...patch } : m
        ),
      },
    })),

  threeDState: DEFAULT_THREED_STATE,

  setThreeDPrimitive: (primitive) => {
    set((state) => ({
      threeDState: { ...state.threeDState, primitive },
    }));
    const stack = get().activeStack;
    const threeDPass = stack.find((p) => p.effectId === 'threeD');
    if (threeDPass) {
      get().updatePassParam(threeDPass.instanceId, 'primitive', primitive);
    }
  },

  setCustomMesh: (customMesh, customMeshName) =>
    set((state) => ({
      threeDState: {
        ...state.threeDState,
        customMesh,
        customMeshName,
        primitive: customMesh ? 'custom' : state.threeDState.primitive,
      },
    })),

  setThreeDAutoRotate: (autoRotate) =>
    set((state) => ({
      threeDState: { ...state.threeDState, autoRotate },
    })),

  setThreeDAutoRotateSpeed: (autoRotateSpeed) =>
    set((state) => ({
      threeDState: { ...state.threeDState, autoRotateSpeed },
    })),

  resetThreeDCamera: () =>
    set((state) => ({
      threeDState: {
        ...state.threeDState,
        cameraResetTrigger: state.threeDState.cameraResetTrigger + 1,
      },
    })),

  isPlaying: false,
  isMuted: false,
  playbackTime: 0,
  duration: 0,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsMuted: (muted) => {
    const el = getRegisteredVideo();
    if (el) {
      el.muted = muted;
    }
    set({ isMuted: muted });
  },
  setPlaybackTime: (time) => set({ playbackTime: time }),
  setDuration: (duration) => set({ duration }),
  togglePlay: () => {
    const el = getRegisteredVideo();
    if (!el) return;
    if (el.paused) {
      el.play().then(() => set({ isPlaying: true })).catch(() => undefined);
    } else {
      el.pause();
      set({ isPlaying: false });
    }
  },
  stopVideo: () => {
    const el = getRegisteredVideo();
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    set({ isPlaying: false, playbackTime: 0 });
  },
  toggleMute: () => {
    const el = getRegisteredVideo();
    if (!el) return;
    const nextMuted = !el.muted;
    el.muted = nextMuted;
    if (!nextMuted) {
      if (el.volume === 0) el.volume = 1.0;
      el.play().catch(() => undefined);
    }
    set({ isMuted: nextMuted });
  },

  loadMediaFile: async (file, expectedType) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'];
    const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi'];
    const isImage = file.type.startsWith('image/') || imageExts.includes(ext);
    const isVideo = file.type.startsWith('video/') || videoExts.includes(ext);

    if (expectedType === 'image' && !isImage) {
      set({
        errorBanner: {
          title: 'Unsupported image file',
          detail: `"${file.name}" is not a supported image format.`,
          recovery: 'Select a PNG, JPG, WebP, or GIF file.',
        },
      });
      return;
    }
    if (expectedType === 'video' && !isVideo) {
      set({
        errorBanner: {
          title: 'Unsupported video file',
          detail: `"${file.name}" is not a supported video format.`,
          recovery: 'Select an MP4 or WebM file.',
        },
      });
      return;
    }
    if (!isImage && !isVideo) {
      set({
        errorBanner: {
          title: 'Unsupported file type',
          detail: `"${file.name}" cannot be decoded by the studio.`,
          recovery: 'Drop a PNG, JPG, WebP, GIF, MP4, or WebM file.',
        },
      });
      return;
    }

    set({ errorBanner: null });
    stopWebcamInternal(set, get);
    revokeUrl();

    const url = URL.createObjectURL(file);
    activeObjectUrl = url;
    activeFile = file;

    if (isImage) {
      try {
        const dimensions = await readImageDimensions(url);
        set({
          mediaType: 'image',
          mediaUrl: url,
          mediaName: file.name,
          dimensions,
          isPlaying: false,
          playbackTime: 0,
          duration: 0,
        });
        get().resetHUD();
      } catch {
        revokeUrl();
        set({
          errorBanner: {
            title: 'Image failed to load',
            detail: `"${file.name}" could not be decoded in this browser.`,
            recovery: 'Try exporting the image as PNG, JPG, or WebP and dropping it again.',
          },
        });
      }
    } else {
      const el = getRegisteredVideo();
      if (el) {
        el.pause();
        el.srcObject = null;
        el.src = url;
        el.loop = true;
        el.currentTime = 0;
        el.volume = 1.0;
        el.muted = false;

        const startPlayback = async () => {
          try {
            await el.play();
            set({ isPlaying: true, isMuted: false });
          } catch {
            el.muted = true;
            await el.play().then(() => set({ isPlaying: true })).catch(() => undefined);
            set({ isMuted: true });
          }
        };

        if (el.readyState >= 2) {
          void startPlayback();
        } else {
          el.oncanplay = () => {
            el.oncanplay = null;
            void startPlayback();
          };
        }
      }

      const dimensions =
        el && el.videoWidth && el.videoHeight
          ? { width: el.videoWidth, height: el.videoHeight }
          : { width: 800, height: 600 };

      set({
        mediaType: 'video',
        mediaUrl: url,
        mediaName: file.name,
        dimensions,
        isPlaying: true,
        isMuted: el ? el.muted : false,
        playbackTime: 0,
        duration: el?.duration || 0,
      });
      get().resetHUD();
    }
  },

  loadSampleImage: async () => {
    set({ errorBanner: null });
    stopWebcamInternal(set, get);
    revokeUrl();

    try {
      const dimensions = await readImageDimensions('/sample-subject.webp');
      set({
        mediaType: 'image',
        mediaUrl: '/sample-subject.webp',
        mediaName: 'sample-crt.webp',
        dimensions,
        isPlaying: false,
        playbackTime: 0,
        duration: 0,
      });
      get().resetHUD();
    } catch {
      set({
        errorBanner: {
          title: 'Sample image unavailable',
          detail: 'The bundled sample asset could not be loaded.',
          recovery: 'Drop a PNG, JPG, or WebP image from your device instead.',
        },
      });
    }
  },

  startWebcam: async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      set({
        errorBanner: {
          title: 'Camera API unavailable',
          detail: 'This browser or insecure context does not allow camera capture.',
          recovery: 'Open dithr over HTTPS in a modern browser, or load an image or video file.',
        },
      });
      return;
    }
    set({ errorBanner: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      stopWebcamInternal(set, get);
      revokeUrl();
      activeStream = stream;

      const el = registeredVideo;
      if (el) {
        el.pause();
        el.removeAttribute('src');
        el.srcObject = stream;
        el.muted = true;
        await el.play().catch((err) => console.warn('Webcam play warning:', err));
      }

      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings();
      const w = settings?.width || el?.videoWidth || 1280;
      const h = settings?.height || el?.videoHeight || 720;

      set({
        mediaType: 'webcam',
        mediaUrl: null,
        mediaName: 'live webcam',
        dimensions: { width: w, height: h },
        isPlaying: true,
        playbackTime: 0,
        duration: 0,
      });
      get().resetHUD();
    } catch (err: any) {
      let title = 'Camera could not start';
      let detail = err?.message || 'Camera initialization failed.';
      let recovery = 'Allow camera permission in your browser settings and retry.';

      if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        title = 'Camera is already in use';
        detail = 'Another application or browser tab holds the camera stream.';
        recovery = 'Close the other camera app or tab, then select Camera again.';
      } else if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        title = 'Camera permission blocked';
        detail = 'The browser blocked access to your camera.';
        recovery = 'Click the camera icon in the address bar, allow permission, and retry.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        title = 'No camera detected';
        detail = 'No video capture device was reported by your system.';
        recovery = 'Connect a camera or drop an image or video file onto the canvas.';
      }

      set({
        errorBanner: { title, detail, recovery },
      });
    }
  },

  stopWebcam: () => stopWebcamInternal(set, get),

  clearMedia: () => {
    detachMediaPlayback();
    if (registeredVideo) {
      try {
        registeredVideo.pause();
        registeredVideo.removeAttribute('src');
        registeredVideo.srcObject = null;
        registeredVideo.load();
      } catch {
        // ignore
      }
    }
    set({
      mediaType: null,
      mediaUrl: null,
      mediaName: null,
      dimensions: null,
      isPlaying: false,
      playbackTime: 0,
      duration: 0,
    });
    get().resetHUD();
  },

  openFileBrowser: (filter?: 'image' | 'video') => {
    if (!browseHandler) {
      console.warn('File browser not registered yet (Dropzone not mounted)');
      return;
    }
    browseHandler(filter);
  },

  setMedia: (media) => set(media),
  setDimensions: (dimensions) => set({ dimensions }),
}));

function stopWebcamInternal(
  set: (partial: Partial<StudioState>) => void,
  get: () => StudioState
): void {
  if (activeStream) {
    stopStream();
    if (get().mediaType === 'webcam') {
      set({
        mediaType: null,
        mediaUrl: null,
        mediaName: null,
        dimensions: null,
      });
    }
  }
}

if (typeof window !== 'undefined') {
  (window as any).useStudioStore = useStudioStore;
  (window as any).getActivePipeline = getActivePipeline;
}
