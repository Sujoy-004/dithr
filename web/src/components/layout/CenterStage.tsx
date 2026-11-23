import { useEffect, useRef, useState } from 'react';
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three/webgpu';
import { useStudioStore, registerVideoElement, registerPipeline } from '../../store/useStudioStore';
import { StudioPipeline } from '../../engine/Pipeline';
import { detectGpuCapabilities, TIER_CONFIGS } from '../../engine/capabilities';
import { AudioReactivityEngine } from '../../engine/audio/AudioReactivityEngine';
import { getSharedAnalyserNode } from '../../export/audioGraph';
import { getEffectDefinition } from '../../engine/registry';
import ViewportHUD from '../canvas/ViewportHUD';
import Dropzone from '../canvas/Dropzone';
import MaskHandles from '../canvas/MaskHandles';

/**
 * Center Stage (D-03, D-08, RELY-09, RELY-10): canvas viewport with
 * hardware-accelerated CSS transform layer, Three.js WebGPU / WebGL2 shader pipeline,
 * GPU capability detection, adaptive FPS throttling, and intelligent idle render pause.
 *
 * Stage-wide drag-and-drop (D-04, MEDIA-01): dropping a file anywhere over
 * the stage loads it; the standby dropzone card shows while no media is
 * loaded and its frame steps to solid hairline while dragging.
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
  const effect = useStudioStore((s) => s.effect);
  const effectParams = useStudioStore((s) => s.effectParams);
  const activeStack = useStudioStore((s) => s.activeStack);
  const activeTier = useStudioStore((s) => s.activeTier);
  const setDetectedCapabilities = useStudioStore((s) => s.setDetectedCapabilities);
  const setRenderStatus = useStudioStore((s) => s.setRenderStatus);
  const setIsPlaying = useStudioStore((s) => s.setIsPlaying);
  const setIsMuted = useStudioStore((s) => s.setIsMuted);
  const setPlaybackTime = useStudioStore((s) => s.setPlaybackTime);
  const setDuration = useStudioStore((s) => s.setDuration);
  const audioState = useStudioStore((s) => s.audioState);

  const stageSectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipelineRef = useRef<StudioPipeline | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animIdRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const audioEngineRef = useRef<AudioReactivityEngine>(new AudioReactivityEngine());

  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const webcamActive = mediaType === 'webcam';

  // 1. Detect GPU Capabilities on mount per D-08 and RELY-09
  useEffect(() => {
    void detectGpuCapabilities().then((caps) => {
      setDetectedCapabilities(caps);
    });
  }, [setDetectedCapabilities]);

  // 2. Initialize Pipeline on mount and attach adaptive RAF loop with idle pause (RELY-10)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pipeline = new StudioPipeline({ canvas });
    pipelineRef.current = pipeline;
    registerPipeline(pipeline);

    // Parse deterministic test params: ?testMode=true&freezeTime=1.0&seed=42 (D-27)
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const freezeTimeParam = searchParams?.get('freezeTime') ?? undefined;
    const seedParam = searchParams?.get('seed') ?? undefined;
    const frozenTime = freezeTimeParam && !isNaN(parseFloat(freezeTimeParam)) ? parseFloat(freezeTimeParam) : null;
    const frozenSeed = seedParam && !isNaN(parseFloat(seedParam)) ? parseFloat(seedParam) : null;

    const startTime = performance.now();
    let lastFrameTime = startTime;

    const loop = (time: number) => {
      if (isPausedRef.current) return;

      const currentTier = useStudioStore.getState().activeTier;
      const targetFps = TIER_CONFIGS[currentTier]?.targetFps || 60;
      const minInterval = 1000 / targetFps - 2; // small tolerance margin

      if (time - lastFrameTime >= minInterval) {
        const deltaMs = Math.max(1, Math.min(100, time - lastFrameTime));
        lastFrameTime = time;

        // Audio reactivity modulation (D-11, D-12, D-14, FX-05)
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

    pipeline
      .init()
      .then(() => {
        if (frozenSeed !== null) {
          pipeline.setSeed(frozenSeed);
        }
        pipeline.resize(canvas.clientWidth || 800, canvas.clientHeight || 600);
        if (!isPausedRef.current) {
          animIdRef.current = requestAnimationFrame(loop);
        }
      })
      .catch((err) => {
        console.warn('Studio shader pipeline init warning:', err);
      });

    // Handle document visibilitychange (tab hidden/backgrounded)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPausedRef.current = true;
        if (animIdRef.current) {
          cancelAnimationFrame(animIdRef.current);
          animIdRef.current = 0;
        }
        setRenderStatus('paused');
      } else {
        if (isPausedRef.current) {
          isPausedRef.current = false;
          setRenderStatus('active');
          lastFrameTime = performance.now();
          if (!animIdRef.current && pipelineRef.current) {
            animIdRef.current = requestAnimationFrame(loop);
          }
        }
      }
    };

    // Handle container contentvisibilityautostatechange (off-screen scrolling)
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
        if (!animIdRef.current && pipelineRef.current) {
          animIdRef.current = requestAnimationFrame(loop);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const stageEl = stageSectionRef.current;
    if (stageEl) {
      stageEl.addEventListener(
        'contentvisibilityautostatechange' as any,
        handleContentVisibility
      );
    }

    return () => {
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
      pipeline.dispose();
      pipelineRef.current = null;
    };
  }, [setRenderStatus]);

  // 3. Synchronize tone, ascii, effect, active stack and parameters to pipeline
  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.syncStack(activeStack, activeTier);
    }
  }, [activeStack, activeTier]);

  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.updateTone(tone);
    }
  }, [tone]);

  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.updateAscii(ascii);
    }
  }, [ascii]);

  useEffect(() => {
    if (pipelineRef.current) {
      pipelineRef.current.setEffect(effect);
    }
  }, [effect]);

  useEffect(() => {
    if (pipelineRef.current) {
      for (const [key, value] of Object.entries(effectParams)) {
        pipelineRef.current.updateEffectParam(key, value);
      }
    }
  }, [effectParams]);

  // Restore base parameter uniforms when audio reactivity is disabled
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

  // 4. Adapt canvas sizing to quality tier and dimensions
  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    const maxDim = TIER_CONFIGS[activeTier]?.maxDimension || 1080;
    let targetW = dimensions?.width || 800;
    let targetH = dimensions?.height || 600;

    if (targetW > maxDim || targetH > maxDim) {
      if (targetW >= targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    pipeline.resize(targetW, targetH);
  }, [activeTier, dimensions]);

  // 5. Synchronize media texture to pipeline
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
        pipeline.resize(dimensions.width, dimensions.height);
      };
      img.src = mediaUrl;
    } else if ((mediaType === 'video' || webcamActive) && videoRef.current) {
      const tex = new THREE.VideoTexture(videoRef.current);
      tex.colorSpace = THREE.SRGBColorSpace;
      pipeline.setSourceTexture(tex);
      const w = dimensions?.width || videoRef.current.videoWidth || 800;
      const h = dimensions?.height || videoRef.current.videoHeight || 600;
      pipeline.resize(w, h);
    } else if (!mediaType) {
      pipeline.clearSource();
    }
  }, [mediaType, mediaUrl, dimensions, webcamActive]);

  // Register persistent video element on mount
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
    // Only capture pointer on the background stage itself, not when clicking dropzone
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

  return (
    <section
      ref={stageSectionRef}
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-base"
      aria-label="Center stage"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Hidden file input always available on stage */}
      <Dropzone dragActive={dragOver} />

      <div
        className="absolute inset-0 flex touch-none items-center justify-center"
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
        {/* Canvas and on-canvas overlay wrapper */}
        <div
          className="relative block"
          style={{
            width: dimensions ? `${dimensions.width}px` : '800px',
            height: dimensions ? `${dimensions.height}px` : '600px',
          }}
        >
          {/* WebGPU / WebGL2 Engine Canvas */}
          <canvas
            ref={canvasRef}
            className="block w-full h-full bg-base"
            aria-label="Media viewport canvas"
          />

          {/* Interactive Mask Handles Overlay (D-07, FX-03) */}
          <MaskHandles />
        </div>

        {/* Single persistent in-viewport video playback element for video and live webcam */}
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
              setDimensions({ width: el.videoWidth, height: el.videoHeight });
              if (pipelineRef.current) {
                pipelineRef.current.resize(el.videoWidth, el.videoHeight);
              }
            }
            if (el.duration && !isNaN(el.duration)) {
              setDuration(el.duration);
            }
          }}
          onPlaying={(e) => {
            const el = e.currentTarget;
            if (el.videoWidth && el.videoHeight) {
              const cur = useStudioStore.getState().dimensions;
              if (!cur || cur.width !== el.videoWidth || cur.height !== el.videoHeight) {
                setDimensions({ width: el.videoWidth, height: el.videoHeight });
                if (pipelineRef.current) {
                  pipelineRef.current.resize(el.videoWidth, el.videoHeight);
                }
              }
            }
            setIsPlaying(true);
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

      <ViewportHUD />
    </section>
  );
}
