import { useEffect } from 'react';
import { useStudioStore } from './store/useStudioStore';
import Header from './components/layout/Header';
import LeftRail from './components/layout/LeftRail';
import CenterStage from './components/layout/CenterStage';
import RightRail from './components/layout/RightRail';

/**
 * Docked studio shell (D-03): 24px titlebar, three-column workspace
 * (LeftRail 240px / CenterStage flex / RightRail 280px), 24px statusbar.
 * Theme is applied to the document root so token overrides cascade everywhere.
 */
export default function App() {
  const theme = useStudioStore((s) => s.theme);
  const zoom = useStudioStore((s) => s.zoom);
  const dimensions = useStudioStore((s) => s.dimensions);
  const activeTier = useStudioStore((s) => s.activeTier);
  const renderStatus = useStudioStore((s) => s.renderStatus);
  const setLeftCollapsed = useStudioStore((s) => s.setLeftCollapsed);
  const setRightCollapsed = useStudioStore((s) => s.setRightCollapsed);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setLeftCollapsed(true);
        setRightCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setLeftCollapsed, setRightCollapsed]);

  const targetFps = activeTier === 'high' ? '60fps' : '30fps';
  const renderStatusText =
    renderStatus === 'active'
      ? `render: active (${targetFps})`
      : 'render: paused (idle standby)';

  return (
    <div className="flex h-full w-full flex-col bg-base text-default">
      <Header />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <LeftRail />
        <CenterStage />
        <RightRail />
      </div>

      <footer
        className="flex h-6 shrink-0 items-center justify-between border-t border-hairline px-2 text-control text-dim select-none"
        role="contentinfo"
      >
        <span className="tabular-nums truncate">
          zoom {Math.round(zoom * 100)}%
          {dimensions ? ` · ${dimensions.width}×${dimensions.height}` : ''}
        </span>
        <span
          className={`tabular-nums truncate font-mono ${
            renderStatus === 'active' ? 'text-dim' : 'text-highlight'
          }`}
        >
          {renderStatusText}
        </span>
        <span className="truncate">rec.601 linear</span>
      </footer>
    </div>
  );
}
