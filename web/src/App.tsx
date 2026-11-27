import { useEffect, useState } from 'react';
import { useStudioStore } from './store/useStudioStore';
import Header from './components/layout/Header';
import LeftRail from './components/layout/LeftRail';
import CenterStage from './components/layout/CenterStage';
import RightRail from './components/layout/RightRail';
import MobileSheet from './components/layout/MobileSheet';

/**
 * Studio shell: desktop three-column workspace (LeftRail / CenterStage / RightRail)
 * and mobile full-height canvas with frosted-glass bottom sheet.
 */
export default function App() {
  const studioTheme = useStudioStore((s) => s.studioTheme);
  const zoom = useStudioStore((s) => s.zoom);
  const dimensions = useStudioStore((s) => s.dimensions);
  const activeTier = useStudioStore((s) => s.activeTier);
  const renderStatus = useStudioStore((s) => s.renderStatus);
  const setLeftCollapsed = useStudioStore((s) => s.setLeftCollapsed);
  const setRightCollapsed = useStudioStore((s) => s.setRightCollapsed);

  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  useEffect(() => {
    document.documentElement.dataset.theme = studioTheme;
  }, [studioTheme]);

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      if (!desktop) {
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

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {isDesktop && <LeftRail />}
        <CenterStage />
        {isDesktop && <RightRail />}
        {!isDesktop && <MobileSheet />}
      </main>

      <footer
        className="hidden md:flex h-7 shrink-0 items-center justify-between border-t border-hairline px-3 text-[11px] text-dim select-none"
        role="contentinfo"
      >
        <span className="tabular-nums truncate">
          zoom {Math.round(zoom * 100)}%
          {dimensions ? ` / ${dimensions.width}x${dimensions.height}` : ''}
        </span>
        <span className="tabular-nums truncate text-highlight">{renderStatusText}</span>
        <span className="truncate">Rec. 601 Linear</span>
      </footer>
    </div>
  );
}
