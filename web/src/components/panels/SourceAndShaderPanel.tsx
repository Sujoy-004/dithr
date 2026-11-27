import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import {
  Image as ImageIcon,
  Video,
  Webcam,
  X,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import type { EffectMode, MediaType } from '../../types/studio';
import { getGroupedEffects, getEffectDefinition } from '../../engine/registry';

export const EFFECT_LIST: { mode: EffectMode; label: string }[] = [
  { mode: 'ascii', label: 'ascii' },
  { mode: 'dither', label: 'dither' },
  { mode: 'halftone', label: 'halftone' },
  { mode: 'vhs', label: 'vhs' },
  { mode: 'matrix', label: 'matrix' },
  { mode: 'dots', label: 'dots' },
  { mode: 'contour', label: 'contour' },
  { mode: 'pixelSort', label: 'pixelSort' },
  { mode: 'blockify', label: 'blockify' },
  { mode: 'threshold', label: 'threshold' },
  { mode: 'edgeDetect', label: 'edgeDetect' },
  { mode: 'crosshatch', label: 'crosshatch' },
  { mode: 'waveLines', label: 'waveLines' },
  { mode: 'noise', label: 'noise' },
  { mode: 'voronoi', label: 'voronoi' },
  { mode: 'tone', label: 'tone' },
];

const PRESETS: { preset: 'standard' | 'dense' | 'simple' | 'blocks'; label: string }[] = [
  { preset: 'standard', label: 'standard' },
  { preset: 'dense', label: 'dense' },
  { preset: 'simple', label: 'simple' },
  { preset: 'blocks', label: 'blocks' },
];

const SOURCES: { type: MediaType; label: string; Icon: typeof ImageIcon }[] = [
  { type: 'image', label: 'image', Icon: ImageIcon },
  { type: 'video', label: 'video', Icon: Video },
  { type: 'webcam', label: 'camera', Icon: Webcam },
];

interface SourceAndShaderPanelProps {
  section?: 'all' | 'media' | 'shaders';
}

/**
 * Shared source ingestion, effect stack, and 16-shader selector used by
 * desktop LeftRail and mobile bottom sheet.
 */
export default function SourceAndShaderPanel({ section = 'all' }: SourceAndShaderPanelProps) {
  const activeStack = useStudioStore((s) => s.activeStack);
  const selectedPassId = useStudioStore((s) => s.selectedPassId);
  const setSelectedPassId = useStudioStore((s) => s.setSelectedPassId);
  const addEffect = useStudioStore((s) => s.addEffect);
  const removeEffect = useStudioStore((s) => s.removeEffect);
  const clearStack = useStudioStore((s) => s.clearStack);
  const reorderStack = useStudioStore((s) => s.reorderStack);
  const toggleEffect = useStudioStore((s) => s.toggleEffect);
  const duplicateEffect = useStudioStore((s) => s.duplicateEffect);
  const setSingleEffectFastPath = useStudioStore((s) => s.setSingleEffectFastPath);

  const ascii = useStudioStore((s) => s.ascii);
  const updateAscii = useStudioStore((s) => s.updateAscii);
  const mediaType = useStudioStore((s) => s.mediaType);
  const mediaName = useStudioStore((s) => s.mediaName);
  const dimensions = useStudioStore((s) => s.dimensions);
  const startWebcam = useStudioStore((s) => s.startWebcam);
  const stopWebcam = useStudioStore((s) => s.stopWebcam);
  const openFileBrowser = useStudioStore((s) => s.openFileBrowser);
  const loadSampleImage = useStudioStore((s) => s.loadSampleImage);
  const clearMedia = useStudioStore((s) => s.clearMedia);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [grabbedIndex, setGrabbedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const listRef = useRef<HTMLUListElement | null>(null);
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const shaderBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const announceTimeoutRef = useRef<number | null>(null);

  const announce = (msg: string) => {
    if (announceTimeoutRef.current) {
      window.clearTimeout(announceTimeoutRef.current);
    }
    announceTimeoutRef.current = window.setTimeout(() => {
      setAnnouncement(msg);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (announceTimeoutRef.current) {
        window.clearTimeout(announceTimeoutRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setDraggingIndex(index);
    setDropTargetIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingIndex === null || !listRef.current) return;
    const items = Array.from(listRef.current.children) as HTMLElement[];
    const clientY = e.clientY;
    let target = draggingIndex;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        target = i;
        break;
      }
      target = i;
    }
    if (target !== dropTargetIndex) {
      setDropTargetIndex(target);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingIndex === null) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (dropTargetIndex !== null && dropTargetIndex !== draggingIndex) {
      reorderStack(draggingIndex, dropTargetIndex);
      const pass = activeStack[draggingIndex];
      const def = getEffectDefinition(pass.effectId);
      announce(
        `${def?.label || pass.effectId} moved to position ${dropTargetIndex + 1} of ${activeStack.length}`
      );
    }
    setDraggingIndex(null);
    setDropTargetIndex(null);
  };

  const handleStackKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const pass = activeStack[index];
    const def = getEffectDefinition(pass.effectId);
    const label = def?.label || pass.effectId;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (grabbedIndex === index) {
        setGrabbedIndex(null);
        announce(`Dropped ${label} at position ${index + 1} of ${activeStack.length}`);
      } else {
        setGrabbedIndex(index);
        announce(`Grabbed ${label}. Use arrow keys to reorder, space to drop.`);
      }
    } else if (e.key === 'ArrowUp' && grabbedIndex !== null && grabbedIndex > 0) {
      e.preventDefault();
      const nextIdx = grabbedIndex - 1;
      reorderStack(grabbedIndex, nextIdx);
      setGrabbedIndex(nextIdx);
      setTimeout(() => handleRefs.current[nextIdx]?.focus(), 0);
    } else if (
      e.key === 'ArrowDown' &&
      grabbedIndex !== null &&
      grabbedIndex < activeStack.length - 1
    ) {
      e.preventDefault();
      const nextIdx = grabbedIndex + 1;
      reorderStack(grabbedIndex, nextIdx);
      setGrabbedIndex(nextIdx);
      setTimeout(() => handleRefs.current[nextIdx]?.focus(), 0);
    } else if (e.key === 'Escape' && grabbedIndex !== null) {
      e.preventDefault();
      setGrabbedIndex(null);
    }
  };

  const handleShaderKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowDown') nextIndex = (index + 1) % EFFECT_LIST.length;
    else if (e.key === 'ArrowUp') nextIndex = (index - 1 + EFFECT_LIST.length) % EFFECT_LIST.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = EFFECT_LIST.length - 1;
    if (nextIndex !== -1) {
      e.preventDefault();
      setSingleEffectFastPath(EFFECT_LIST[nextIndex].mode);
      shaderBtnRefs.current[nextIndex]?.focus();
    }
  };

  const grouped = getGroupedEffects();
  const showMedia = section === 'all' || section === 'media';
  const showShaders = section === 'all' || section === 'shaders';
  const hasGlyphEffect = activeStack.some(
    (p) => p.effectId === 'ascii' || p.effectId === 'matrix' || p.effectId === 'threeD'
  );

  return (
    <div className="flex flex-col">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {showMedia && (
        <>
          <SectionHeader title="Source" state={mediaType ?? 'standby'} />
          <div className="px-4 pb-3">
            <div className="grid grid-cols-3 gap-1.5">
              {SOURCES.map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  data-source={type}
                  aria-pressed={mediaType === type}
                  title={
                    type === 'webcam'
                      ? mediaType === 'webcam'
                        ? 'stop camera'
                        : 'start camera'
                      : `browse ${label} file`
                  }
                  onClick={() => {
                    if (type === 'webcam') {
                      if (mediaType === 'webcam') stopWebcam();
                      else void startWebcam();
                    } else if (type === 'image') {
                      openFileBrowser('image');
                    } else if (type === 'video') {
                      openFileBrowser('video');
                    }
                  }}
                  className={`flex h-9 items-center justify-center gap-1.5 border text-control transition-colors ${
                    mediaType === type
                      ? 'border-highlight bg-active font-semibold text-max'
                      : 'border-hairline bg-raised text-default hover:border-border-strong hover:text-highlight'
                  }`}
                >
                  <Icon size={13} strokeWidth={1.75} aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {!mediaType && (
              <button
                type="button"
                onClick={() => void loadSampleImage()}
                className="mt-2 flex h-8 w-full items-center justify-center border border-hairline bg-raised text-control text-highlight hover:border-border-strong hover:bg-active transition-colors"
              >
                Load sample image
              </button>
            )}

            <div className="mt-2.5 flex items-center justify-between text-control text-dim">
              <span>dimensions</span>
              <span className="tabular-nums text-highlight">
                {dimensions ? `${dimensions.width}x${dimensions.height}` : 'none'}
              </span>
            </div>

            {mediaType && (
              <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-control">
                <span className="max-w-[140px] truncate text-dim">{mediaName || mediaType}</span>
                <button
                  type="button"
                  onClick={clearMedia}
                  title="Close media and return to standby"
                  className="flex h-7 items-center gap-1 border border-hairline bg-raised px-2 text-dim hover:text-highlight"
                >
                  <X size={11} strokeWidth={2} aria-hidden />
                  <span>eject</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showShaders && (
        <>
          <SectionHeader title="Active stack" state={`${activeStack.length}`} />
          <div className="px-4 pb-3">
            {activeStack.length === 0 ? (
              <div className="border border-dashed border-hairline p-3 text-center text-control text-dim">
                Original media (no active shaders)
              </div>
            ) : (
              <ul
                ref={listRef}
                role="list"
                aria-label="Active effect passes"
                className="flex flex-col gap-1"
              >
                {activeStack.map((pass, index) => {
                  const def = getEffectDefinition(pass.effectId);
                  const isSelected = selectedPassId === pass.instanceId;
                  const isGrabbed = grabbedIndex === index;
                  const isDropTarget = dropTargetIndex === index && draggingIndex !== index;

                  return (
                    <li
                      key={pass.instanceId}
                      role="listitem"
                      className={`flex h-9 items-center gap-0.5 border px-1 text-control transition-colors ${
                        isDropTarget
                          ? 'border-highlight bg-raised'
                          : isGrabbed
                          ? 'border-highlight bg-active'
                          : isSelected
                          ? 'border-highlight bg-active text-max'
                          : 'border-hairline bg-raised text-default hover:bg-active'
                      }`}
                    >
                      <button
                        ref={(el) => {
                          handleRefs.current[index] = el;
                        }}
                        type="button"
                        aria-label="Reorder effect. Press space to grab, arrow keys to move."
                        aria-pressed={isGrabbed}
                        title="Drag to reorder or press Space to move"
                        onPointerDown={(e) => handlePointerDown(e, index)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onKeyDown={(e) => handleStackKeyDown(e, index)}
                        className="touch-none cursor-grab p-1 text-dim hover:text-highlight active:cursor-grabbing"
                      >
                        <GripVertical size={12} strokeWidth={1.75} aria-hidden />
                      </button>

                      <span className="w-3.5 shrink-0 text-center text-[10px] tabular-nums text-dim">
                        {index + 1}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedPassId(pass.instanceId)}
                        className="flex min-w-0 flex-1 items-center truncate text-left font-medium"
                      >
                        <span
                          className={`truncate ${
                            pass.enabled ? '' : 'text-dim line-through opacity-60'
                          }`}
                        >
                          {def?.label || pass.effectId}
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center">
                        <button
                          type="button"
                          aria-label="Move effect up"
                          title="Move up"
                          disabled={index === 0}
                          onClick={() => reorderStack(index, index - 1)}
                          className="p-1 text-dim hover:text-max disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          aria-label="Move effect down"
                          title="Move down"
                          disabled={index === activeStack.length - 1}
                          onClick={() => reorderStack(index, index + 1)}
                          className="p-1 text-dim hover:text-max disabled:opacity-30 disabled:pointer-events-none"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          aria-label="Toggle effect"
                          title={pass.enabled ? 'Disable pass' : 'Enable pass'}
                          onClick={() => toggleEffect(pass.instanceId)}
                          className={`p-1 hover:text-max ${
                            pass.enabled ? 'text-highlight' : 'text-dim'
                          }`}
                        >
                          {pass.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                        <button
                          type="button"
                          aria-label="Duplicate effect"
                          title="Duplicate pass"
                          onClick={() => duplicateEffect(pass.instanceId)}
                          className="p-1 text-dim hover:text-max"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete effect"
                          title="Delete pass"
                          onClick={() => removeEffect(pass.instanceId)}
                          className="p-1 text-dim hover:text-max"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                aria-expanded={isPaletteOpen}
                onClick={() => setIsPaletteOpen((prev) => !prev)}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 border border-dashed border-hairline bg-raised px-2 text-control text-default hover:border-border-strong hover:text-highlight transition-colors"
              >
                <Plus size={12} strokeWidth={2} aria-hidden />
                <span>Add effect pass</span>
              </button>
              {activeStack.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear all shaders"
                  onClick={clearStack}
                  className="flex h-8 items-center justify-center border border-hairline bg-raised px-2.5 text-control text-dim hover:border-border-strong hover:text-highlight transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            {isPaletteOpen && (
                <div className="studio-glass mt-2 rounded p-2.5 text-control">
                  <div className="mb-1.5 text-[11px] font-semibold text-dim">Stylize</div>
                  <div className="mb-2.5 grid grid-cols-2 gap-1">
                    {grouped.stylize.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          addEffect(item.id);
                          setIsPaletteOpen(false);
                        }}
                        className="flex h-7 items-center gap-1 border border-hairline bg-base/80 px-2 text-left text-default hover:border-border-strong hover:text-highlight truncate"
                      >
                        <span className="truncate">{item.id}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mb-1.5 text-[11px] font-semibold text-dim">Modulate</div>
                  <div className="grid grid-cols-2 gap-1">
                    {grouped.modulate.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          addEffect(item.id);
                          setIsPaletteOpen(false);
                        }}
                        className="flex h-7 items-center gap-1 border border-hairline bg-base/80 px-2 text-left text-default hover:border-border-strong hover:text-highlight truncate"
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <SectionHeader title="Shaders" state={`${EFFECT_LIST.length}`} />
          <div
            className="flex flex-col border-t border-hairline"
            role="list"
            aria-label="Shader list"
          >
            {EFFECT_LIST.map(({ mode, label }, index) => {
              const canonicalMode = mode === 'vhs' ? 'crtVhs' : mode;
              const isSingleActive =
                activeStack.length === 1 && activeStack[0].effectId === canonicalMode;
              const isPresent = activeStack.some(
                (p) => p.effectId === canonicalMode && p.enabled
              );

              return (
                <div
                  key={mode}
                  role="listitem"
                  className={`flex min-h-9 items-center border-b border-hairline transition-colors ${
                    isSingleActive
                      ? 'bg-highlight text-base'
                      : isPresent
                      ? 'bg-active text-max'
                      : 'bg-base text-default hover:bg-raised hover:text-highlight'
                  }`}
                >
                  <button
                    ref={(el) => {
                      shaderBtnRefs.current[index] = el;
                    }}
                    type="button"
                    aria-pressed={isSingleActive}
                    title={`Select ${label}`}
                    onClick={() => setSingleEffectFastPath(mode)}
                    onKeyDown={(e) => handleShaderKeyDown(e, index)}
                    className="flex h-9 flex-1 items-center justify-between px-4 text-control font-medium text-left"
                  >
                    <span>{label}</span>
                    {isSingleActive && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider">
                        active
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    title={`Add ${label} to stack`}
                    aria-label={`Add ${label} to stack`}
                    onClick={(e) => {
                      e.stopPropagation();
                      addEffect(mode);
                    }}
                    className={`mr-2 flex h-7 items-center gap-0.5 border px-1.5 text-[11px] font-medium ${
                      isSingleActive
                        ? 'border-base/30 text-base hover:bg-base/10'
                        : 'border-hairline text-dim hover:border-border-strong hover:text-highlight'
                    }`}
                  >
                    <span>+ Stack</span>
                  </button>
                </div>
              );
            })}
          </div>

          {hasGlyphEffect && (
            <>
              <SectionHeader title="ASCII ramp presets" state={`${PRESETS.length}`} />
              <div className="grid grid-cols-2 gap-1.5 px-4 pb-4">
                {PRESETS.map(({ preset, label }) => {
                  const active = ascii.rampPreset === preset && ascii.customChars === '';
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateAscii({ rampPreset: preset, customChars: '' })}
                      aria-pressed={active}
                      className={`flex h-8 items-center justify-center border px-2 text-control transition-colors ${
                        active
                          ? 'border-highlight bg-active font-semibold text-max'
                          : 'border-hairline bg-raised text-default hover:border-border-strong hover:text-highlight'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeader({ title, state }: { title: string; state: string }) {
  return (
    <div className="flex items-center justify-between border-t border-hairline px-4 py-2 text-[11px] font-semibold text-dim first:border-t-0">
      <span>{title}</span>
      <span className="tabular-nums font-normal">{state}</span>
    </div>
  );
}
