import { useStudioStore } from '../../store/useStudioStore';
import QualityTierBadge from '../ui/QualityTierBadge';

/**
 * Top Studio Header bar (D-08, RELY-09, UI-SPEC).
 * Displays studio identity, engine backend, offline status, and interactive GPU capability tier badge.
 */
export default function Header() {
  const gpuEngine = useStudioStore((s) => s.gpuEngine);

  return (
    <header
      className="flex h-6 shrink-0 items-center justify-between border-b border-hairline px-2 text-control text-dim select-none"
      role="banner"
    >
      <div className="flex items-center gap-2 truncate">
        <a
          href="/"
          title="Return to Product Overview"
          className="truncate text-dim hover:text-highlight transition-colors"
        >
          dithr v2.0.0 [{gpuEngine}]
        </a>
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <span>
          local session <span className="text-[#a3a3a3]">● offline-ready</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <QualityTierBadge />
        <span className="tabular-nums text-dim">ascii studio</span>
      </div>
    </header>
  );
}
