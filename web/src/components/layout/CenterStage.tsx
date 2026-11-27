import { useEffect, useRef, useState } from 'react';
import type {
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import * as THREE from 'three/webgpu';
import { Maximize2, Minimize2, Palette, Webcam, X } from 'lucide-react';
import { useStudioStore, registerVideoElement, registerPipeline } from '../../store/useStudioStore';
import { StudioPipeline } from '../../engine/Pipeline';
import { detectGpuCapabilities, TIER_CONFIGS, type QualityTier } from '../../engine/capabilities';
import { AudioReactivityEngine } from '../../engine/audio/AudioReactivityEngine';
import { getSharedAnalyserNode } from '../../export/audioGraph';
import { getEffectDefinition } from '../../engine/registry';
import type { Dimensions } from '../../types/studio';
import ViewportHUD from '../canvas/ViewportHUD';
import Dropzone from '../canvas/Dropzone';
import MaskHandles from '../canvas/MaskHandles';

const ANIMATED_EFFECTS = new Set([
  'matrix',
  'waveLines',
  'noise',
  'grain',
  'crtVhs',
  'vhs',
  'threeD',
  'pixelSort',
]);

function getCappedDimensions(
  dims: Dimensions | null | undefined,
  tier: QualityTier
): Dimensions {
  const maxDim = TIER_CONFIGS[tier]?.maxDimension || 1080;
  let width = Math.max(1, Math.round(dims?.width || 800));
  let height = Math.max(1, Math.round(dims?.height || 600));

  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.max(1, Math.round((height * maxDim) / width));
      width = maxDim;
    } else {
      width = Math.max(1, Math.round((width * maxDim) / height));
      height = maxDim;
    }
  }

  return { width, height };
}

/**
 * Center Stage: responsive Three.js WebGPU / WebGL2 canvas viewport,
 * actionable error banner, WebGPU fallback indicator, dropzone, and floating HUD.
 */
export default function CenterStage() {
  const zoom = useStudioStore((s) => s.zoom);
  const pan = useStudioStore((s) => s.pan);
  const setPan = useStudioStore((s) => s.setPan);
  const mediaType = useStudioStore((s) => s.mediaType);
  const mediaUrl = useStudioStore((s) => s.mediaUrl);
  const dimensions = useStudioStore((s) => s.dimensions);
  const loadMediaFile = useStudioStore((s) => s.loadMediaFile);
  const setDimensions = useStudioStore((s) => s.setDimensions);
  const tone = useStudioStore((s) => s.tone);
  const ascii = useStudioStore((s) => s.ascii);
  const activeStack = useStudioStore((s) => s.activeStack);
  const activeTier = useStudioStore((s) => s.activeTier);
  const gpuEngine = useStudioStore((s) => s.gpuEngine);
  const errorBanner = useStudioStore((s) => s.errorBanner);
  const clearErrorBanner = useStudioStore((s) => s.clearErrorBanner);
  const fallbackNoticeDismissed = useStudioStore((s) => s.fallbackNoticeDismissed);
  const dismissFallbackNotice = useStudioStore((s) => s.dismissFallbackNotice);
  const setDetectedCapabilities = useStudioStore((s) => s.setDetectedCapabilities);
  const setRenderStatus = useStudioStore((s) => s.setRenderStatus);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const setIsMuted = useStudioStore((s) => s.setIsMuted);
  const setPlaybackTime = useStudioStore((s) => s.setPlaybackTime);
  const setDuration = useStudioStore((s) => s.setDuration);
  const audioState = useStudioStore((s) => s.audioState);
  const studioTheme = useStudioStore((s) => s.studioTheme);
  const cycleStudioTheme = useStudioStore((s) => s.cycleStudioTheme);
  const startWebcam = useStudioStore((s) => s.startWebcam);
  const stopWebcam = useStudioStore((s) => s.stopWebcam);

  const stageSectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<StudioPipeline | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animIdRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const syncRenderLoopRef = useRef<(() => void) | null>(null);
  const audioEngineRef = useRef<AudioReactivityEngine>(new AudioReactivityEngine());

  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const webcamActive = mediaType === 'webcam';

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Ctrl/Cmd + wheel zooms; a plain wheel pans. Registered natively so the
  // browser's page-zoom gesture can be prevented while the pointer is here.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
        const state = useStudioStore.getState();
        state.setZoom(state.zoom * factor);
      } else {
        event.preventDefault();
        const state = useStudioStore.getState();
        state.setPan({
          x: state.pan.x - event.deltaX,
          y: state.pan.y - event.deltaY,
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  };

  useEffect(() => {
    void detectGpuCapabilities().then((caps) => {
      setDetectedCapabilities(caps);
    });
  }, [setDetectedCapabilities]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const pipeline = new StudioPipeline({ canvas });
    pipelineRef.current = pipeline;
    registerPipeline(pipeline);

    const searchParams =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const freezeTimeParam = searchParams?.get('freezeTime') ?? undefined;
    const seedParam = searchParams?.get('seed') ?? undefined;
    const isTestMode = searchParams?.get('testMode') === 'true';
    const frozenTime =
      freezeTimeParam && !Number.isNaN(parseFloat(freezeTimeParam))
        ? parseFloat(freezeTimeParam)
        : null;
    const frozenSeed =
      seedParam && !Number.isNaN(parseFloat(seedParam)) ? parseFloat(seedParam) : null;

    const startTime = performance.now();
    let lastFrameTime = startTime;

    const loop = (time: number) => {
      if (isPausedRef.current || disposed) return;

      const currentTier = useStudioStore.getState().activeTier;
      const targetFps = TIER_CONFIGS[currentTier]?.targetFps || 60;
      const minInterval = 1000 / targetFps - 2;

      if (time - lastFrameTime >= minInterval) {
        const deltaMs = Math.max(1, Math.min(100, time - lastFrameTime));
        lastFrameTime = time;

        const currentAudioState = useStudioStore.getState().audioState;
        if (
          currentAudioState.enabled &&
          currentAudioState.status === 'live' &&
          audioEngineRef.current
        ) {
          const analyser = getSharedAnalyserNode();
          audioEngineRef.current.sensitivity = currentAudioState.sensitivity;
          audioEngineRef.current.setPreset(currentAudioState.envelopePreset);
          const energies = audioEngineRef.current.update(analyser, deltaMs);

          if (currentAudioState.mappings.length > 0) {
            const currentStack = useStudioStore.getState().activeStack;
            for (const mapping of currentAudioState.mappings) {
              const pass = currentStack.find((p) => p.instanceId === mapping.passInstanceId);
              if (!pass || !pass.enabled) continue;
              const def = getEffectDefinition(pass.effectId);
              if (!def) continue;
              const schema = def.parameters[mapping.paramKey];
              if (!schema || (schema.type !== 'float' && schema.type !== 'int')) continue;

              const baseVal = Number(pass.parameters[mapping.paramKey] ?? schema.default);
              const min = schema.min ?? 0;
              const max = schema.max ?? 1;
              const range = max - min;
              const bandEnergy = energies[mapping.band];

              const modulated = Math.min(
                max,
                Math.max(min, baseVal + bandEnergy * mapping.amount * range)
              );
              pipeline.updateUniform(mapping.passInstanceId, mapping.paramKey, modulated);
            }
          }
        }

        const renderTime = frozenTime !== null ? frozenTime : (time - startTime) * 0.001;
        pipeline.render(renderTime);
      }
      animIdRef.current = requestAnimationFrame(loop);
    };

    const shouldRunContinuousLoop = () => {
      const s = useStudioStore.getState();
      if (isTestMode || s.mediaType === 'video' || s.mediaType === 'webcam') return true;
      if (s.audioState.enabled && s.audioState.status === 'live') return true;
      if (s.activeStack.some((p) => p.enabled && ANIMATED_EFFECTS.has(p.effectId))) return true;
      return false;
    };

    const startLoopIfNeeded = () => {
      if (isPausedRef.current || disposed) return;
      if (!shouldRunContinuousLoop()) {
        if (animIdRef.current) {
          cancelAnimationFrame(animIdRef.current);
          animIdRef.current = 0;
        }
        pipeline.render(frozenTime !== null ? frozenTime : 0);
        return;
      }
      if (!animIdRef.current) {
        lastFrameTime = performance.now();
        animIdRef.current = requestAnimationFrame(loop);
      }
    };
    syncRenderLoopRef.current = startLoopIfNeeded;

    const bootPipeline = () => {
      if (disposed) return;
      pipeline
        .init()
        .then(() => {
          if (disposed) return;
          if (frozenSeed !== null) {
            pipeline.setSeed(frozenSeed);
          }
          const state = useStudioStore.getState();
          pipeline.syncStack(state.activeStack, state.activeTier);
          pipeline.updateTone(state.tone);
          pipeline.updateProcessing(state.processing);
          pipeline.updatePostProcessing(state.postProcessing);
          pipeline.updateAscii(state.ascii);
          const capped = getCappedDimensions(
            state.dimensions ?? {
              width: canvas.clientWidth || 800,
              height: canvas.clientHeight || 600,
            },
            state.activeTier
          );
          pipeline.resize(capped.width, capped.height);
          startLoopIfNeeded();
        })
        .catch((err) => {
          console.warn('Studio shader pipeline init warning:', err);
        });
    };

    let bootTimer: number | null = null;
    let idleId: number | null = null;
    let isBooted = false;
    const ensureBooted = () => {
      if (isBooted) {
        startLoopIfNeeded();
        return;
      }
      isBooted = true;
      if (bootTimer !== null) {
        window.clearTimeout(bootTimer);
        bootTimer = null;
      }
      if (idleId !== null && typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleId);
        idleId = null;
      }
      bootPipeline();
    };

    if (isTestMode || useStudioStore.getState().mediaType !== null) {
      ensureBooted();
    } else {
      // Boot GPU pipeline on first media load or 3D activation; keeps standby TBT minimal
      bootTimer = globalThis.setTimeout(ensureBooted, 12000);
    }

    const unsubMedia = useStudioStore.subscribe((state, prev) => {
      if (!prev.mediaType && state.mediaType) {
        ensureBooted();
      } else if (prev.activeStack !== state.activeStack && state.activeStack.some((p) => p.effectId === 'threeD')) {
        ensureBooted();
      }
    });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPausedRef.current = true;
        if (animIdRef.current) {
          cancelAnimationFrame(animIdRef.current);
          animIdRef.current = 0;
        }
        setRenderStatus('paused');
      } else if (isPausedRef.current) {
        isPausedRef.current = false;
        setRenderStatus('active');
        lastFrameTime = performance.now();
        startLoopIfNeeded();
      }
    };

    const handleContentVisibility = (e: Event) => {
      const isSkipped = (e as any).skipped;
      if (isSkipped) {
        isPausedRef.current = true;
        if (animIdRef.current) {
          cancelAnimationFrame(animIdRef.current);
          animIdRef.current = 0;
        }
        setRenderStatus('paused');
      } else if (isPausedRef.current && !document.hidden) {
        isPausedRef.current = false;
        setRenderStatus('active');
        lastFrameTime = performance.now();
        startLoopIfNeeded();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const stageEl = stageSectionRef.current;
    if (stageEl) {
      stageEl.addEventListener('contentvisibilityautostatechange' as any, handleContentVisibility);
    }

    return () => {
      disposed = true;
      unsubMedia();
      if (bootTimer !== null) window.clearTimeout(bootTimer);
      if (idleId !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = 0;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (stageEl) {
        stageEl.removeEventListener(
          'contentvisibilityautostatechange' as any,
          handleContentVisibility
        );
      }
      registerPipeline(null);
      syncRenderLoopRef.current = null;
      pipeline.dispose();
      pipelineRef.current = null;
    };
  }, [setRenderStatus]);

  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.syncStack(activeStack, activeTier);
      syncRenderLoopRef.current?.();
    }
  }, [activeStack, activeTier]);

  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.updateTone(tone);
      syncRenderLoopRef.current?.();
    }
  }, [tone]);

  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.updateAscii(ascii);
      syncRenderLoopRef.current?.();
    }
  }, [ascii]);

  useEffect(() => {
    if (!audioState.enabled || audioState.status !== 'live') {
      const pipeline = pipelineRef.current;
      if (!pipeline) return;
      for (const mapping of audioState.mappings) {
        const pass = activeStack.find((p) => p.instanceId === mapping.passInstanceId);
        if (pass && pass.parameters[mapping.paramKey] !== undefined) {
          pipeline.updateUniform(
            mapping.passInstanceId,
            mapping.paramKey,
            pass.parameters[mapping.paramKey]
          );
        }
      }
    }
  }, [audioState.enabled, audioState.status, audioState.mappings, activeStack]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    const capped = getCappedDimensions(dimensions, activeTier);
    pipeline.resize(capped.width, capped.height);
    syncRenderLoopRef.current?.();
  }, [activeTier, dimensions]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    if (mediaType === 'image' && mediaUrl && dimensions) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        pipeline.setSourceTexture(tex);
        const capped = getCappedDimensions(
          dimensions,
          useStudioStore.getState().activeTier
        );
        pipeline.resize(capped.width, capped.height);
        syncRenderLoopRef.current?.();
      };
      img.src = mediaUrl;
    } else if ((mediaType === 'video' || webcamActive) && videoRef.current) {
      const tex = new THREE.VideoTexture(videoRef.current);
      tex.colorSpace = THREE.SRGBColorSpace;
      pipeline.setSourceTexture(tex);
      const rawDims = {
        width: dimensions?.width || videoRef.current.videoWidth || 800,
        height: dimensions?.height || videoRef.current.videoHeight || 600,
      };
      const capped = getCappedDimensions(rawDims, useStudioStore.getState().activeTier);
      pipeline.resize(capped.width, capped.height);
      syncRenderLoopRef.current?.();
    } else if (!mediaType) {
      pipeline.clearSource();
      syncRenderLoopRef.current?.();
    }
  }, [mediaType, mediaUrl, dimensions, webcamActive]);

  useEffect(() => {
    if (videoRef.current) {
      registerVideoElement(videoRef.current);
    }
    return () => {
      registerVideoElement(null);
    };
  }, []);

  const onDragOver = (e: ReactDragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: ReactDragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
  };

  const onDrop = (e: ReactDragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadMediaFile(file);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[role="button"]') || target.closest('button')) {
      return;
    }

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pan.x,
      baseY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({
      x: drag.baseX + (e.clientX - drag.startX),
      y: drag.baseY + (e.clientY - drag.startY),
    });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerCancel = () => {
    dragRef.current = null;
  };

  const isTestMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('testMode') === 'true';
  const hasThreeD = activeStack.some((p) => p.effectId === 'threeD' && p.enabled);
  const aspectRatio = dimensions ? `${dimensions.width} / ${dimensions.height}` : '4 / 3';
  const enabledPasses = activeStack.filter((p) => p.enabled);
  const stackLabel =
    enabledPasses.length === 0
      ? 'original media'
      : enabledPasses.length === 1
        ? getEffectDefinition(enabledPasses[0].effectId)?.label ?? enabledPasses[0].effectId
        : `${enabledPasses.length} passes`;
  const engineLabel = gpuEngine === 'webgl2' ? 'WEBGL2' : 'WEBGPU';

  return (
    <section
      ref={stageSectionRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-base"
      aria-label="Center stage"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Grainrad status pill: active look + rendering backend */}
      <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 select-none">
        <div className="flex items-center gap-2 border border-hairline bg-raised/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-dim">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              mediaType || hasThreeD
                ? 'bg-term-green shadow-[0_0_6px_var(--term-green)]'
                : 'bg-hairline'
            }`}
          />
          <span className="max-w-[46vw] truncate text-highlight">{stackLabel}</span>
          <span className="border-l border-hairline pl-2 text-[9px] tracking-[0.18em]">
            {engineLabel}
          </span>
        </div>
      </div>

      {/* Viewport toolbar: theme cycle, webcam, fullscreen */}
      <div className="absolute right-2 top-2 z-30 flex items-center gap-1">
        <ToolbarButton
          label={`Theme: ${studioTheme}`}
          onClick={cycleStudioTheme}
        >
          <Palette size={14} strokeWidth={1.75} aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={webcamActive ? 'Stop webcam' : 'Start webcam'}
          onClick={() => {
            if (webcamActive) stopWebcam();
            else void startWebcam();
          }}
        >
          <Webcam size={14} strokeWidth={1.75} aria-hidden />
        </ToolbarButton>
        <ToolbarButton
          label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <Maximize2 size={14} strokeWidth={1.75} aria-hidden />
          )}
        </ToolbarButton>
      </div>

      {/* Actionable error banner */}
      {errorBanner && (
        <div
          role="alert"
          className="studio-glass absolute top-14 left-1/2 z-30 flex w-[min(92%,480px)] -translate-x-1/2 items-start justify-between gap-3 rounded-lg px-4 py-3 text-control"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-max">{errorBanner.title}</span>
            <span className="text-default">{errorBanner.detail}</span>
            <span className="text-dim">{errorBanner.recovery}</span>
          </div>
          <button
            type="button"
            onClick={clearErrorBanner}
            aria-label="Dismiss error"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-dim hover:bg-active hover:text-max"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      {/* WebGPU fallback notice */}
      {!errorBanner && gpuEngine === 'webgl2' && !fallbackNoticeDismissed && (
        <div
          role="status"
          className="studio-glass absolute top-14 left-1/2 z-20 flex max-w-[min(92%,500px)] -translate-x-1/2 items-center justify-between gap-3 rounded-full px-4 py-1.5 text-[11px] text-default"
        >
          <span>
            WebGPU is unavailable in this browser. Running on WebGL2 fallback.
          </span>
          <button
            type="button"
            onClick={dismissFallbackNotice}
            aria-label="Dismiss WebGL2 fallback notice"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-dim hover:bg-active hover:text-max"
          >
            <X size={12} aria-hidden />
          </button>
        </div>
      )}

      <Dropzone dragActive={dragOver} />

      <div
        ref={viewportRef}
        className="absolute inset-0 flex touch-none items-center justify-center p-3 pb-20 md:p-6 md:pb-16"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="relative flex max-h-full max-w-full items-center justify-center"
          style={{
            aspectRatio,
            width: dimensions ? `min(100%, ${dimensions.width}px)` : 'min(100%, 800px)',
            maxHeight: '100%',
          }}
        >
          <canvas
            ref={canvasRef}
            className={`block h-full w-full bg-base ${
              mediaType ? 'border border-hairline' : ''
            }`}
            style={
              !mediaType && !isTestMode && !hasThreeD
                ? { filter: 'brightness(0.06)' }
                : undefined
            }
            aria-label="Media viewport canvas"
          />

          <MaskHandles />
        </div>

        <video
          ref={videoRef}
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          preload="auto"
          loop={mediaType === 'video'}
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            bottom: 0,
            right: 0,
            opacity: 0.01,
            pointerEvents: 'none',
          }}
          onVolumeChange={(e) => {
            setIsMuted(e.currentTarget.muted);
          }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            if (el.videoWidth && el.videoHeight) {
              const rawDims = { width: el.videoWidth, height: el.videoHeight };
              setDimensions(rawDims);
              if (pipelineRef.current) {
                const capped = getCappedDimensions(
                  rawDims,
                  useStudioStore.getState().activeTier
                );
                pipelineRef.current.resize(capped.width, capped.height);
              }
            }
            if (el.duration && !Number.isNaN(el.duration)) {
              setDuration(el.duration);
            }
          }}
          onPlaying={(e) => {
            const el = e.currentTarget;
            if (el.videoWidth && el.videoHeight) {
              const cur = useStudioStore.getState().dimensions;
              if (!cur || cur.width !== el.videoWidth || cur.height !== el.videoHeight) {
                const rawDims = { width: el.videoWidth, height: el.videoHeight };
                setDimensions(rawDims);
                if (pipelineRef.current) {
                  const capped = getCappedDimensions(
                    rawDims,
                    useStudioStore.getState().activeTier
                  );
                  pipelineRef.current.resize(capped.width, capped.height);
                }
              }
            }
            setIsPlaying(true);
            syncRenderLoopRef.current?.();
          }}
          onTimeUpdate={(e) => {
            setPlaybackTime(e.currentTarget.currentTime || 0);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      </div>

      {dragOver && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--overlay-drag)' }}
        />
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden select-none flex-col gap-0.5 text-[10px] leading-relaxed text-dim md:flex">
        <span>Scroll to pan · Ctrl+Scroll to zoom · Alt+Drag to pan</span>
        <span className="tabular-nums">
          {dimensions ? `${dimensions.width}×${dimensions.height}` : 'no media'}
        </span>
      </div>

      <ViewportHUD />
    </section>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center border border-hairline bg-raised/90 text-dim transition-colors hover:border-border-strong hover:text-highlight"
    >
      {children}
    </button>
  );
}
