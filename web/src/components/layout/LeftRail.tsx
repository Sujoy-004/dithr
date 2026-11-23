import { useState, useRef, useEffect, type ReactNode } from 'react';
import type React from 'react';
import {
  Image as ImageIcon,
  Video,
  Webcam,
  PanelLeftClose,
  PanelRightClose,
  Type as TypeIcon,
  Grid3x3,
  CircleDot,
  Tv,
  Terminal,
  Grip,
  Mountain,
  ArrowDownUp,
  Square,
  Contrast,
  Spline,
  Hash,
  Waves,
  CloudFog,
  Network,
  Palette,
  X,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Plus,
  Layers,
} from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import type { EffectMode, MediaType } from '../../types/studio';
import { getGroupedEffects, getEffectDefinition } from '../../engine/registry';

const EFFECT_ICONS: Record<string, typeof TypeIcon> = {
  ascii: TypeIcon,
  dither: Grid3x3,
  halftone: CircleDot,
  vhs: Tv,
  matrix: Terminal,
  dots: Grip,
  contour: Mountain,
  pixelSort: ArrowDownUp,
  blockify: Square,
  threshold: Contrast,
  edgeDetect: Spline,
  crosshatch: Hash,
  waveLines: Waves,
  noise: CloudFog,
  voronoi: Network,
  tone: Palette,
  grain: CloudFog,
};

function getEffectIcon(id: string): typeof TypeIcon {
  return EFFECT_ICONS[id] || Layers;
}

const EFFECT_LIST: { mode: EffectMode; label: string; Icon: typeof TypeIcon }[] = [
  { mode: 'ascii', label: 'ascii', Icon: TypeIcon },
  { mode: 'dither', label: 'dither', Icon: Grid3x3 },
  { mode: 'halftone', label: 'halftone', Icon: CircleDot },
  { mode: 'vhs', label: 'vhs', Icon: Tv },
  { mode: 'matrix', label: 'matrix', Icon: Terminal },
  { mode: 'dots', label: 'dots', Icon: Grip },
  { mode: 'contour', label: 'contour', Icon: Mountain },
  { mode: 'pixelSort', label: 'pixel sort', Icon: ArrowDownUp },
  { mode: 'blockify', label: 'blockify', Icon: Square },
  { mode: 'threshold', label: 'threshold', Icon: Contrast },
  { mode: 'edgeDetect', label: 'edge detect', Icon: Spline },
  { mode: 'crosshatch', label: 'crosshatch', Icon: Hash },
  { mode: 'waveLines', label: 'wave lines', Icon: Waves },
  { mode: 'noise', label: 'noise', Icon: CloudFog },
  { mode: 'voronoi', label: 'voronoi', Icon: Network },
  { mode: 'tone', label: 'tone', Icon: Palette },
];

const PRESETS: { preset: 'standard' | 'dense' | 'simple' | 'blocks'; label: string; tag: string }[] = [
  { preset: 'standard', label: 'standard', tag: 'p01' },
  { preset: 'dense', label: 'dense', tag: 'p02' },
  { preset: 'simple', label: 'simple', tag: 'p03' },
  { preset: 'blocks', label: 'blocks', tag: 'p04' },
];

const SOURCES: { type: MediaType; label: string; Icon: typeof ImageIcon }[] = [
  { type: 'image', label: 'image', Icon: ImageIcon },
  { type: 'video', label: 'video', Icon: Video },
  { type: 'webcam', label: 'webcam', Icon: Webcam },
];

/**
 * Left docked rail (240px) — interactive effect stack manager and dynamic palette (D-02, D-04, FX-01).
 * Supports pointer capture drag-and-drop, accessible keyboard reordering, row toggle/dup/del,
 * and fast-path single-effect tile clicks.
 */
export default function LeftRail() {
  const activeStack = useStudioStore((s) => s.activeStack);
  const selectedPassId = useStudioStore((s) => s.selectedPassId);
  const setSelectedPassId = useStudioStore((s) => s.setSelectedPassId);
  const addEffect = useStudioStore((s) => s.addEffect);
  const removeEffect = useStudioStore((s) => s.removeEffect);
  const reorderStack = useStudioStore((s) => s.reorderStack);
  const toggleEffect = useStudioStore((s) => s.toggleEffect);
  const duplicateEffect = useStudioStore((s) => s.duplicateEffect);
  const setSingleEffectFastPath = useStudioStore((s) => s.setSingleEffectFastPath);

  const ascii = useStudioStore((s) => s.ascii);
  const updateAscii = useStudioStore((s) => s.updateAscii);
  const mediaType = useStudioStore((s) => s.mediaType);
  const mediaName = useStudioStore((s) => s.mediaName);
  const dimensions = useStudioStore((s) => s.dimensions);
  const leftCollapsed = useStudioStore((s) => s.leftCollapsed);
  const toggleLeftRail = useStudioStore((s) => s.toggleLeftRail);
  const toggleRightRail = useStudioStore((s) => s.toggleRightRail);
  const startWebcam = useStudioStore((s) => s.startWebcam);
  const stopWebcam = useStudioStore((s) => s.stopWebcam);
  const openFileBrowser = useStudioStore((s) => s.openFileBrowser);
  const clearMedia = useStudioStore((s) => s.clearMedia);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [grabbedIndex, setGrabbedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const listRef = useRef<HTMLUListElement | null>(null);
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);
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

  // Pointer Capture Drag-and-Drop handlers (Modern Web Guidance)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button !== 0) return;
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
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
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
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

  // Keyboard navigation on drag handle (Space to grab/drop, ArrowUp/ArrowDown to swap, Escape to cancel)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
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
        announce(
          `Grabbed ${label}. Current position ${index + 1} of ${activeStack.length}. Use arrow keys to reorder, space to drop, escape to cancel.`
        );
      }
    } else if (e.key === 'ArrowUp') {
      if (grabbedIndex !== null && grabbedIndex > 0) {
        e.preventDefault();
        const nextIdx = grabbedIndex - 1;
        reorderStack(grabbedIndex, nextIdx);
        setGrabbedIndex(nextIdx);
        announce(`${label} moved to position ${nextIdx + 1} of ${activeStack.length}`);
        setTimeout(() => {
          handleRefs.current[nextIdx]?.focus();
        }, 0);
      }
    } else if (e.key === 'ArrowDown') {
      if (grabbedIndex !== null && grabbedIndex < activeStack.length - 1) {
        e.preventDefault();
        const nextIdx = grabbedIndex + 1;
        reorderStack(grabbedIndex, nextIdx);
        setGrabbedIndex(nextIdx);
        announce(`${label} moved to position ${nextIdx + 1} of ${activeStack.length}`);
        setTimeout(() => {
          handleRefs.current[nextIdx]?.focus();
        }, 0);
      }
    } else if (e.key === 'Escape') {
      if (grabbedIndex !== null) {
        e.preventDefault();
        setGrabbedIndex(null);
        announce(`Reorder cancelled. ${label} remains at position ${index + 1} of ${activeStack.length}`);
      }
    }
  };

  const grouped = getGroupedEffects();

  if (leftCollapsed) {
    return (
      <aside
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-hairline bg-base py-2"
        aria-label="Left rail (collapsed)"
      >
        <RailButton label="expand left rail" onClick={toggleLeftRail}>
          <span aria-hidden>◧</span>
        </RailButton>
        <div className="my-1 w-6 border-b border-hairline" />
        {activeStack.map((pass) => {
          const Icon = getEffectIcon(pass.effectId);
          const isSelected = selectedPassId === pass.instanceId;
          return (
            <RailButton
              key={pass.instanceId}
              label={`select ${pass.effectId}`}
              active={isSelected}
              onClick={() => setSelectedPassId(pass.instanceId)}
            >
              <Icon size={16} strokeWidth={1.5} className={pass.enabled ? '' : 'opacity-40'} />
            </RailButton>
          );
        })}
        <div className="mt-auto">
          <RailButton label="toggle right rail" onClick={toggleRightRail}>
            <PanelRightClose size={16} strokeWidth={1.5} />
          </RailButton>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Polite live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Mobile backdrop to dismiss drawer on tap */}
      <div
        className="fixed inset-0 z-20 bg-black/60 md:hidden"
        onClick={toggleLeftRail}
        aria-hidden
      />
      <aside
        className="fixed md:relative inset-y-6 md:inset-y-0 left-0 z-30 flex w-60 max-w-[85vw] shrink-0 flex-col overflow-y-auto border-r border-hairline bg-base shadow-2xl md:shadow-none"
        aria-label="Left rail"
      >
        {/* Source Ingestion Section */}
        <SectionHeader title="source input" state={mediaType ?? 'standby'} />
        <div className="px-4 pb-3">
          <div className="flex gap-1">
            {SOURCES.map(({ type, label, Icon }) => (
              <SourceButton
                key={type}
                type={type}
                label={label}
                Icon={Icon}
                onSelect={() => {
                  if (type === 'webcam') {
                    if (mediaType === 'webcam') stopWebcam();
                    else void startWebcam();
                  } else if (type === 'image') {
                    openFileBrowser('image');
                  } else if (type === 'video') {
                    openFileBrowser('video');
                  }
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-dim text-control">
            <span>dimensions</span>
            <span className="tabular-nums text-highlight">
              {dimensions ? `${dimensions.width}x${dimensions.height}` : '—'}
            </span>
          </div>
          {mediaType && (
            <div className="mt-2 flex items-center justify-between border-t border-hairline pt-2 text-control">
              <span className="truncate text-dim max-w-[130px]">{mediaName || mediaType}</span>
              <button
                type="button"
                onClick={clearMedia}
                title="Close media and return to standby"
                className="flex items-center gap-1 text-dim hover:text-highlight hover:bg-active px-1.5 h-5 bg-raised transition-colors"
              >
                <X size={10} strokeWidth={2} />
                <span>eject</span>
              </button>
            </div>
          )}
        </div>

        {/* Active Effect Stack Section (D-02, FX-01) */}
        <SectionHeader title="active stack" state={`${activeStack.length}`} />
        <div className="px-4 pb-2">
          {activeStack.length === 0 ? (
            <div className="p-3 text-center border border-dashed border-hairline text-dim text-control">
              Stack is empty. Add an effect below.
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
                const Icon = getEffectIcon(pass.effectId);
                const isSelected = selectedPassId === pass.instanceId;
                const isGrabbed = grabbedIndex === index;
                const isDropTarget = dropTargetIndex === index && draggingIndex !== index;

                return (
                  <li
                    key={pass.instanceId}
                    role="listitem"
                    className={`group flex h-7 items-center gap-1 px-1 text-control border transition-colors motion-reduce:transition-none ${
                      isDropTarget
                        ? 'border-highlight bg-raised'
                        : isGrabbed
                        ? 'border-highlight bg-active'
                        : isSelected
                        ? 'border-hairline bg-active text-highlight'
                        : 'border-transparent bg-raised text-default hover:bg-active'
                    }`}
                  >
                    {/* Dedicated Drag Handle */}
                    <button
                      ref={(el) => {
                        handleRefs.current[index] = el;
                      }}
                      type="button"
                      role="button"
                      aria-label="Reorder effect. Press space to grab, arrow keys to move."
                      aria-pressed={isGrabbed}
                      title="Drag to reorder or press Space to move with keyboard"
                      onPointerDown={(e) => handlePointerDown(e, index)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="touch-none cursor-grab active:cursor-grabbing p-0.5 text-dim hover:text-highlight focus-visible:ring-1 focus-visible:ring-highlight"
                    >
                      <GripVertical size={13} strokeWidth={1.5} />
                    </button>

                    {/* Pass Selection & Title */}
                    <button
                      type="button"
                      onClick={() => setSelectedPassId(pass.instanceId)}
                      className="flex flex-1 items-center gap-1.5 truncate text-left"
                    >
                      <Icon size={12} strokeWidth={1.5} className="shrink-0 text-dim" />
                      <span
                        className={`truncate ${
                          pass.enabled ? '' : 'text-dim line-through opacity-60'
                        }`}
                      >
                        {def?.label || pass.effectId}
                      </span>
                    </button>

                    {/* Quick Row Actions: Eye, Duplicate, Delete */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label="Toggle effect"
                        title={pass.enabled ? 'Disable pass' : 'Enable pass'}
                        onClick={() => toggleEffect(pass.instanceId)}
                        className={`p-1 hover:text-highlight transition-colors ${
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
                        className="p-1 text-dim hover:text-highlight transition-colors"
                      >
                        <Copy size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete effect"
                        title="Delete pass from stack"
                        onClick={() => removeEffect(pass.instanceId)}
                        className="p-1 text-dim hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Add Effect Button & Grouped Popover */}
          <div className="mt-2">
            <button
              type="button"
              aria-expanded={isPaletteOpen}
              onClick={() => setIsPaletteOpen((prev) => !prev)}
              className="flex h-6 w-full items-center justify-center gap-1.5 border border-dashed border-hairline bg-raised px-2 text-control text-default hover:border-highlight hover:bg-active hover:text-highlight transition-colors"
            >
              <Plus size={12} strokeWidth={2} />
              <span>+ add effect</span>
            </button>

            {isPaletteOpen && (
              <div className="mt-1.5 border border-hairline bg-raised p-2 text-control shadow-lg">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-dim">
                  Stylize
                </div>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {grouped.stylize.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        addEffect(item.id);
                        setIsPaletteOpen(false);
                      }}
                      className="flex h-5 items-center gap-1 px-1.5 bg-base hover:bg-active text-default text-left transition-colors truncate"
                    >
                      <Plus size={9} className="shrink-0 text-dim" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-dim">
                  Modulate
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {grouped.modulate.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        addEffect(item.id);
                        setIsPaletteOpen(false);
                      }}
                      className="flex h-5 items-center gap-1 px-1.5 bg-base hover:bg-active text-default text-left transition-colors truncate"
                    >
                      <Plus size={9} className="shrink-0 text-dim" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Palette Section / Direct Tile Fast-Path (D-04) */}
        <SectionHeader title="palette mode" state={`${EFFECT_LIST.length}`} />
        <div
          className="grid grid-cols-2 gap-px bg-hairline"
          role="region"
          aria-label="Effect palette"
        >
          {EFFECT_LIST.map(({ mode, label, Icon }) => {
            const isSingleActive =
              activeStack.length === 1 && activeStack[0].effectId === mode;
            const isPresent = activeStack.some(
              (p) => p.effectId === mode && p.enabled
            );
            return (
              <div
                key={mode}
                className={`group relative flex h-6 items-center bg-base transition-colors duration-fast ${
                  isSingleActive
                    ? 'bg-active text-highlight'
                    : isPresent
                    ? 'text-highlight'
                    : 'text-default hover:bg-active'
                }`}
              >
                <button
                  type="button"
                  title={`Set single effect: ${label} (${mode})`}
                  data-effect-id={mode}
                  data-testid={`set-effect-${mode}`}
                  onClick={() => setSingleEffectFastPath(mode)}
                  className="flex h-full flex-1 items-center gap-1.5 px-2 text-control text-left truncate"
                >
                  <span aria-hidden className="w-2.5 text-center text-[10px]">
                    {isSingleActive ? '●' : isPresent ? '◆' : '○'}
                  </span>
                  <span className="truncate">{label}</span>
                  <Icon size={11} strokeWidth={1.5} className="ml-auto shrink-0 opacity-60" />
                </button>
                <button
                  type="button"
                  title={`Add ${label} (${mode}) to stack`}
                  aria-label={`Add ${label} to stack`}
                  data-effect-id={mode}
                  data-testid={`add-effect-${mode}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    addEffect(mode);
                  }}
                  className="mr-1 flex h-4 w-4 items-center justify-center text-dim hover:text-highlight hover:bg-raised"
                >
                  <Plus size={10} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Macro Presets Section */}
        <SectionHeader title="macro presets" state={`${PRESETS.length}`} />
        <div className="flex flex-wrap gap-1 px-4 pb-3">
          {PRESETS.map(({ preset, label, tag }) => (
            <button
              key={preset}
              type="button"
              onClick={() => updateAscii({ rampPreset: preset, customChars: '' })}
              aria-pressed={ascii.rampPreset === preset && ascii.customChars === ''}
              className={`flex h-6 items-center gap-2 px-2 text-control transition-colors duration-fast ${
                ascii.rampPreset === preset && ascii.customChars === ''
                  ? 'bg-active text-highlight'
                  : 'bg-raised text-default hover:bg-active'
              }`}
            >
              <span>{label}</span>
              <span className="text-dim">{tag}</span>
            </button>
          ))}
        </div>

        {/* Rail Footer Controls */}
        <div className="mt-auto flex justify-between border-t border-hairline p-2">
          <RailButton label="collapse left rail" onClick={toggleLeftRail}>
            <PanelLeftClose size={16} strokeWidth={1.5} />
          </RailButton>
          <RailButton label="toggle right rail" onClick={toggleRightRail}>
            <PanelRightClose size={16} strokeWidth={1.5} />
          </RailButton>
        </div>
      </aside>
    </>
  );
}

function SectionHeader({ title, state }: { title: string; state: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-control text-dim">
      <span aria-hidden>− {title}</span>
      <span className="tabular-nums">{state}</span>
    </div>
  );
}

function SourceButton({
  type,
  label,
  Icon,
  onSelect,
}: {
  type: MediaType;
  label: string;
  Icon: typeof ImageIcon;
  onSelect: () => void;
}) {
  const mediaType = useStudioStore((s) => s.mediaType);
  return (
    <button
      type="button"
      data-source={type}
      aria-pressed={mediaType === type}
      title={
        type === 'webcam'
          ? mediaType === 'webcam'
            ? 'stop webcam'
            : 'start webcam'
          : `browse ${label} file`
      }
      onClick={onSelect}
      className={`flex h-6 flex-1 items-center justify-center gap-1 text-control transition-colors duration-fast ${
        mediaType === type ? 'bg-active text-highlight' : 'bg-raised text-default hover:bg-active'
      }`}
    >
      <Icon size={12} strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  );
}

function RailButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-6 w-8 items-center justify-center transition-colors duration-fast ${
        active ? 'bg-active text-highlight' : 'text-dim hover:bg-active hover:text-highlight'
      }`}
    >
      {children}
    </button>
  );
}
