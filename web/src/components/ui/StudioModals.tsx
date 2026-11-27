import { useEffect } from 'react';
import { X } from 'lucide-react';

export type StudioModalKind = 'about' | 'changelog';

export interface StudioModalsProps {
  kind: StudioModalKind | null;
  onClose: () => void;
}

const CHANGELOG = [
  {
    version: '2.0.0',
    date: '2026-11-27',
    items: [
      'Grainrad-derived terminal shell: default, VT320, cassette, NORAD, and light themes.',
      '10 ASCII character sets, 12 retro palettes, and six built-in studio presets.',
      'Global Stage-0 Processing and a post-processing chain after the composable stack.',
      'Sharpness control, hairline sliders, and standalone Three.js .html export.',
      'Composable multi-pass stacking preserved: add, reorder, bypass, duplicate, clear.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-18',
    items: [
      'Real-time WebGPU / TSL studio with 16 retro shaders.',
      'Client PNG, JPEG, GIF, ASCII, SVG, and WebM export plus server MP4.',
      'Python terminal player with 24-bit ANSI true-colour playback.',
    ],
  },
] as const;

/**
 * Lightweight About / Changelog overlays. Rendered from the left rail footer
 * and dismissed with Escape, the backdrop, or the close button.
 */
export default function StudioModals({ kind, onClose }: StudioModalsProps) {
  useEffect(() => {
    if (!kind) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, onClose]);

  if (!kind) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={kind === 'about' ? 'About dithr studio' : 'Changelog'}
        className="studio-glass relative flex max-h-[80vh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-5 text-control"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-max">
              {kind === 'about' ? 'About' : 'Changelog'}
            </h2>
            <p className="mt-1 text-[11px] text-dim">
              {kind === 'about' ? 'dithr — RGB ASCII & Retro FX Studio' : 'Notable changes'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-hairline text-dim hover:border-border-strong hover:text-max"
          >
            <X size={13} aria-hidden />
          </button>
        </div>

        {kind === 'about' ? (
          <div className="flex flex-col gap-3 text-default">
            <p className="leading-relaxed">
              A media-first retro imaging studio. Load an image, video, webcam, or sample and the
              original passes straight through — every shader is an opt-in layer you stack,
              reorder, and bypass.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[11px]">
              <dt className="text-dim">Rendering</dt>
              <dd className="text-highlight">Three.js TSL · WebGPU (WebGL2 fallback)</dd>
              <dt className="text-dim">Colour</dt>
              <dd className="text-highlight">Rec. 601 luminance · Linear working space</dd>
              <dt className="text-dim">Privacy</dt>
              <dd className="text-highlight">All media stays in the browser</dd>
              <dt className="text-dim">Source</dt>
              <dd>
                <a className="text-highlight underline decoration-hairline hover:text-max" href="/">
                  dithr overview
                </a>
              </dd>
            </dl>
            <p className="border-t border-hairline pt-3 text-[11px] leading-relaxed text-dim">
              Interface language derived from the Grainrad terminal studio study: hairline
              controls, phosphor themes, glyph ramps, and a global finishing chain.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {CHANGELOG.map((entry) => (
              <section key={entry.version} className="flex flex-col gap-1.5">
                <h3 className="flex items-baseline gap-2 text-[11px] font-semibold text-highlight">
                  <span className="tabular-nums">v{entry.version}</span>
                  <span className="font-normal text-dim">{entry.date}</span>
                </h3>
                <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-default">
                  {entry.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span aria-hidden className="text-dim">
                        –
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
