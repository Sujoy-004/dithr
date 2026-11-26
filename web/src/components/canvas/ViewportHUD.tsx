import type { ReactNode } from 'react';
import { Minus, Plus, Sun, Moon, Play, Pause, Square, Volume2, VolumeX, X } from 'lucide-react';
import { useStudioStore, ZOOM_MAX, ZOOM_MIN } from '../../store/useStudioStore';
import QualityTierBadge from '../ui/QualityTierBadge';

const ZOOM_STEP = 1.25;

function formatTime(sec: number): string {
  if (!sec || Number.isNaN(sec) || !Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Floating frosted-glass viewport HUD pinned above the bottom edge.
 * Clears the mobile bottom sheet cleanly on narrow viewports.
 */
export default function ViewportHUD() {
  const zoom = useStudioStore((s) => s.zoom);
  const setZoom = useStudioStore((s) => s.setZoom);
  const resetHUD = useStudioStore((s) => s.resetHUD);
  const dimensions = useStudioStore((s) => s.dimensions);
  const mediaType = useStudioStore((s) => s.mediaType);
  const theme = useStudioStore((s) => s.theme);
  const toggleTheme = useStudioStore((s) => s.toggleTheme);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const isMuted = useStudioStore((s) => s.isMuted);
  const playbackTime = useStudioStore((s) => s.playbackTime);
  const duration = useStudioStore((s) => s.duration);
  const togglePlay = useStudioStore((s) => s.togglePlay);
  const stopVideo = useStudioStore((s) => s.stopVideo);
  const toggleMute = useStudioStore((s) => s.toggleMute);
  const clearMedia = useStudioStore((s) => s.clearMedia);

  return (
    <div
      className="studio-glass pointer-events-auto absolute bottom-16 left-1/2 z-20 flex max-w-[calc(100vw-20px)] -translate-x-1/2 items-center gap-1 rounded-full px-2.5 py-1 md:bottom-3"
      role="toolbar"
      aria-label="Viewport controls"
    >
      {mediaType === 'video' && (
        <>
          <HUDButton label={isPlaying ? 'pause video' : 'play video'} onClick={togglePlay}>
            {isPlaying ? (
              <Pause size={13} strokeWidth={1.75} className="text-highlight" />
            ) : (
              <Play size={13} strokeWidth={1.75} className="text-highlight" />
            )}
          </HUDButton>
          <HUDButton label="stop video" onClick={stopVideo}>
            <Square size={12} strokeWidth={1.75} />
          </HUDButton>
          <HUDButton label={isMuted ? 'unmute audio' : 'mute audio'} onClick={toggleMute}>
            {isMuted ? (
              <VolumeX size={13} strokeWidth={1.75} className="text-highlight" />
            ) : (
              <Volume2 size={13} strokeWidth={1.75} className="text-highlight" />
            )}
          </HUDButton>
          <span className="hidden sm:inline min-w-14 text-center text-control tabular-nums text-dim">
            {formatTime(playbackTime)} / {formatTime(duration)}
          </span>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
        </>
      )}

      <HUDButton
        label="zoom out"
        disabled={zoom <= ZOOM_MIN}
        onClick={() => setZoom(zoom / ZOOM_STEP)}
      >
        <Minus size={13} strokeWidth={1.75} />
      </HUDButton>
      <span
        className="min-w-10 text-center text-control tabular-nums text-highlight"
        aria-live="polite"
      >
        {Math.round(zoom * 100)}%
      </span>
      <HUDButton
        label="zoom in"
        disabled={zoom >= ZOOM_MAX}
        onClick={() => setZoom(zoom * ZOOM_STEP)}
      >
        <Plus size={13} strokeWidth={1.75} />
      </HUDButton>
      <HUDButton label="reset pan and zoom" onClick={resetHUD}>
        <span className="px-1 text-control">reset</span>
      </HUDButton>

      <span aria-hidden className="hidden sm:inline mx-0.5 h-4 w-px bg-hairline" />
      <span className="hidden sm:inline text-control tabular-nums text-dim">
        {dimensions ? `${dimensions.width}x${dimensions.height}` : 'no media'}
      </span>

      <span aria-hidden className="hidden sm:inline mx-0.5 h-4 w-px bg-hairline" />
      <div className="hidden sm:inline-flex">
        <QualityTierBadge compact />
      </div>

      {mediaType && (
        <>
          <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
          <HUDButton label="eject media" onClick={clearMedia}>
            <X size={13} strokeWidth={1.75} />
            <span className="hidden sm:inline text-control text-dim">eject</span>
          </HUDButton>
        </>
      )}

      <span aria-hidden className="mx-0.5 h-4 w-px bg-hairline" />
      <HUDButton
        label={`switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? (
          <Sun size={13} strokeWidth={1.75} />
        ) : (
          <Moon size={13} strokeWidth={1.75} />
        )}
      </HUDButton>
    </div>
  );
}

function HUDButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-1.5 text-default transition-colors enabled:hover:bg-active enabled:hover:text-highlight disabled:text-dim disabled:opacity-40"
    >
      {children}
    </button>
  );
}
