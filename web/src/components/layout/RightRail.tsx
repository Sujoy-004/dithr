import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { getEffectDefinition } from '../../engine/registry';
import EffectInspector from '../panels/EffectInspector';
import AudioPanel from '../panels/AudioPanel';
import ThreeDPanel from '../panels/ThreeDPanel';
import ToneControls from '../panels/ToneControls';
import ProcessingPanel from '../panels/ProcessingPanel';
import PostProcessingPanel from '../panels/PostProcessingPanel';
import ExportDrawer from '../panels/ExportDrawer';

/**
 * Desktop right docked inspector rail (352px). Hidden on < 768px where
 * MobileSheet renders controls as a bottom sheet.
 * Order follows Grainrad: Settings, Processing, Post-Processing, Export,
 * then Audio and 3D tucked into collapsible accordions.
 */
export default function RightRail() {
  const rightCollapsed = useStudioStore((s) => s.rightCollapsed);
  const toggleRightRail = useStudioStore((s) => s.toggleRightRail);
  const toggleLeftRail = useStudioStore((s) => s.toggleLeftRail);
  const activeStack = useStudioStore((s) => s.activeStack);
  const selectedPassId = useStudioStore((s) => s.selectedPassId);
  const audioState = useStudioStore((s) => s.audioState);
  const threeDState = useStudioStore((s) => s.threeDState);
  const processing = useStudioStore((s) => s.processing);
  const post = useStudioStore((s) => s.postProcessing);
  const resetTone = useStudioStore((s) => s.resetTone);

  const [openSections, setOpenSections] = useState({
    params: true,
    settings: true,
    processing: false,
    post: false,
    export: true,
    audio: false,
    threeD: false,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedPass = activeStack.find((p) => p.instanceId === selectedPassId);
  const def = selectedPass ? getEffectDefinition(selectedPass.effectId) : undefined;
  const effectTitle = def?.label || selectedPass?.effectId || 'none';

  const processingActive =
    processing.invert ||
    processing.brightnessMap > 0 ||
    processing.edgeEnhance > 0 ||
    processing.blur > 0 ||
    processing.quantizeColors > 1;
  const postActive = Object.values(post).some((stage: any) => stage.enabled);

  if (rightCollapsed) {
    return (
      <aside
        className="hidden md:flex w-12 shrink-0 flex-col items-center gap-1 border-l border-hairline bg-base py-2"
        aria-label="Right rail (collapsed)"
      >
        <button
          type="button"
          aria-label="expand right rail"
          title="Expand right rail"
          onClick={toggleRightRail}
          className="flex h-8 w-8 items-center justify-center text-dim hover:bg-active hover:text-highlight"
        >
          <PanelRightOpen size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="toggle left rail"
          title="Toggle left rail"
          onClick={toggleLeftRail}
          className="flex h-8 w-8 items-center justify-center text-dim hover:bg-active hover:text-highlight"
        >
          <PanelLeftClose size={16} strokeWidth={1.75} />
        </button>
        <span className="mt-8 -rotate-90 whitespace-nowrap text-control text-dim">
          {effectTitle}
        </span>
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex w-[22rem] shrink-0 flex-col overflow-y-auto border-l border-hairline bg-base"
      aria-label="Right rail"
    >
      <CollapsibleGroup
        title="Parameters"
        state={effectTitle}
        open={openSections.params}
        onToggle={() => toggleSection('params')}
      >
        <div className="px-4 pb-3">
          <EffectInspector />
        </div>
      </CollapsibleGroup>

      <CollapsibleGroup
        title="Settings"
        state="Rec. 601"
        open={openSections.settings}
        onToggle={() => toggleSection('settings')}
        action={
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              resetTone();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                resetTone();
              }
            }}
            className="text-[10px] uppercase tracking-wider text-dim hover:text-highlight"
          >
            reset
          </span>
        }
      >
        <ToneControls />
      </CollapsibleGroup>

      <CollapsibleGroup
        title="Processing"
        state={processingActive ? 'global' : 'off'}
        open={openSections.processing}
        onToggle={() => toggleSection('processing')}
      >
        <ProcessingPanel />
      </CollapsibleGroup>

      <CollapsibleGroup
        title="Post-Processing"
        state={postActive ? 'global' : 'off'}
        open={openSections.post}
        onToggle={() => toggleSection('post')}
      >
        <PostProcessingPanel />
      </CollapsibleGroup>

      <CollapsibleGroup
        title="Export"
        state="on-device / api"
        open={openSections.export}
        onToggle={() => toggleSection('export')}
      >
        <ExportDrawer />
      </CollapsibleGroup>

      <CollapsibleGroup
        title="Audio reactivity"
        state={audioState.enabled && audioState.status === 'live' ? 'live' : 'off'}
        open={openSections.audio}
        onToggle={() => toggleSection('audio')}
      >
        <AudioPanel />
      </CollapsibleGroup>

      <CollapsibleGroup
        title="3D scene"
        state={threeDState.primitive}
        open={openSections.threeD}
        onToggle={() => toggleSection('threeD')}
      >
        <ThreeDPanel />
      </CollapsibleGroup>

      <div className="mt-auto flex justify-end border-t border-hairline p-2">
        <button
          type="button"
          aria-label="collapse right rail"
          title="Collapse right rail"
          onClick={toggleRightRail}
          className="flex h-8 w-8 items-center justify-center text-dim hover:bg-active hover:text-highlight"
        >
          <PanelRightClose size={16} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}

function CollapsibleGroup({
  title,
  state,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  state: string;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-hairline first:border-t-0">
      <div className="flex h-10 w-full items-center justify-between gap-2 px-4 hover:bg-raised transition-colors">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-control text-highlight"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            {open ? (
              <ChevronDown size={13} strokeWidth={2} aria-hidden />
            ) : (
              <ChevronRight size={13} strokeWidth={2} aria-hidden />
            )}
            <span>{title}</span>
          </span>
        </button>
        {action}
        <span className="max-w-[110px] truncate text-[11px] font-normal tabular-nums text-dim">
          {state}
        </span>
      </div>
      {open && children}
    </section>
  );
}
