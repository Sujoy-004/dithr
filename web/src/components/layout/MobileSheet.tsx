import { ChevronDown } from 'lucide-react';
import { useStudioStore, type MobileSheetTab } from '../../store/useStudioStore';
import SourceAndShaderPanel from '../panels/SourceAndShaderPanel';
import EffectInspector from '../panels/EffectInspector';
import ToneControls from '../panels/ToneControls';
import ExportDrawer from '../panels/ExportDrawer';
import AudioPanel from '../panels/AudioPanel';
import ThreeDPanel from '../panels/ThreeDPanel';

const TABS: { id: Exclude<MobileSheetTab, 'closed'>; label: string }[] = [
  { id: 'media', label: 'Media' },
  { id: 'shaders', label: 'Shaders' },
  { id: 'adjust', label: 'Adjust' },
  { id: 'export', label: 'Export' },
  { id: 'more', label: 'Audio / 3D' },
];

/**
 * Mobile bottom sheet (< 768px) using frosted liquid glass so the canvas
 * fills the full remaining viewport height without side-rail compression.
 */
export default function MobileSheet() {
  const mobileSheetTab = useStudioStore((s) => s.mobileSheetTab);
  const setMobileSheetTab = useStudioStore((s) => s.setMobileSheetTab);
  const isOpen = mobileSheetTab !== 'closed';

  const handleTabClick = (tab: Exclude<MobileSheetTab, 'closed'>) => {
    setMobileSheetTab(mobileSheetTab === tab ? 'closed' : tab);
  };

  return (
    <section
      aria-label="Studio controls"
      className="studio-glass fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-b-0 md:hidden"
    >
      {/* Top tab bar */}
      <div className="flex h-13 items-center justify-between gap-1 px-2">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = mobileSheetTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-expanded={active}
                onClick={() => handleTabClick(tab.id)}
                className={`h-9 shrink-0 rounded-full px-3 text-control font-medium transition-colors ${
                  active
                    ? 'bg-highlight text-base font-semibold'
                    : 'text-default hover:bg-active hover:text-highlight'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {isOpen && (
          <button
            type="button"
            onClick={() => setMobileSheetTab('closed')}
            aria-label="Collapse controls sheet"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-dim hover:bg-active hover:text-highlight"
          >
            <ChevronDown size={16} strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>

      {/* Expandable sheet body */}
      {isOpen && (
        <div className="max-h-[54dvh] overflow-y-auto border-t border-hairline pt-2 pb-4">
          {mobileSheetTab === 'media' && <SourceAndShaderPanel section="media" />}
          {mobileSheetTab === 'shaders' && <SourceAndShaderPanel section="shaders" />}
          {mobileSheetTab === 'adjust' && (
            <div className="flex flex-col gap-4">
              <div className="px-4">
                <h2 className="mb-2 text-[11px] font-semibold text-dim">Effect parameters</h2>
                <EffectInspector />
              </div>
              <div className="border-t border-hairline pt-3">
                <h2 className="mb-2 px-4 text-[11px] font-semibold text-dim">Tone curve</h2>
                <ToneControls />
              </div>
            </div>
          )}
          {mobileSheetTab === 'export' && <ExportDrawer />}
          {mobileSheetTab === 'more' && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="mb-2 px-4 text-[11px] font-semibold text-dim">Audio reactivity</h2>
                <AudioPanel />
              </div>
              <div className="border-t border-hairline pt-3">
                <h2 className="mb-2 px-4 text-[11px] font-semibold text-dim">3D scene</h2>
                <ThreeDPanel />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
