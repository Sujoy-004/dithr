import { useStudioStore } from '../../store/useStudioStore';
import QualityTierBadge from '../ui/QualityTierBadge';

/**
 * Top studio status bar matching the homepage workspace specification:
 * dithr brand link, WebGPU / WebGL2 fallback status, pipeline metadata, and quality tier control.
 */
export default function Header() {
  const gpuEngine = useStudioStore((s) => s.gpuEngine);
  const isFallback = gpuEngine === 'webgl2';

  return (
    <header
      className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-base px-3 text-control text-dim select-none"
      role="banner"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <a
          href="/"
          title="Return to dithr overview"
          className="font-bold tracking-tight text-highlight hover:text-max transition-colors"
        >
          dithr
        </a>
        <span
          className="truncate border border-hairline bg-raised px-1.5 py-0.5 text-[11px] font-mono text-highlight"
          title={
            isFallback
              ? 'WebGPU is unavailable in this browser; running on WebGL2 fallback.'
              : 'Running native WebGPU compute and render pipeline.'
          }
        >
          {isFallback ? 'webgl2 fallback' : 'webgpu'}
        </span>
      </div>

      <div className="hidden lg:flex items-center gap-4 text-[11px] text-dim">
        <span>Three.js TSL</span>
        <span>Rec. 601 Linear</span>
        <span className="text-highlight">Local GPU Buffer</span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <QualityTierBadge />
      </div>
    </header>
  );
}
