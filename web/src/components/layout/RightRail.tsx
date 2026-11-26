import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { getEffectDefinition } from '../../engine/registry';
import EffectInspector from '../panels/EffectInspector';
import AudioPanel from '../panels/AudioPanel';
import ThreeDPanel from '../panels/ThreeDPanel';
import ToneControls from '../panels/ToneControls';
import ExportDrawer from '../panels/ExportDrawer';

/**
 * Desktop right docked inspector rail (296px). Hidden on < 768px where
 * MobileSheet renders controls as a bottom sheet.
 * Keeps Parameters, Tone, and Export prominent (expanded by default) and
 * Audio/3D tucked into collapsible accordions.
 */
export default function RightRail() {
  const rightCollapsed = useStudioStore((s) => s.rightCollapsed);
  const toggleRightRail = useStudioStore((s) => s.toggleRightRail);
  const toggleLeftRail = useStudioStore((s) => s.toggleLeftRail);
  const activeStack = useStudioStore((s) => s.activeStack);
  const selectedPassId = useStudioStore((s) => s.selectedPassId);
  const audioState = useStudioStore((s) => s.audioState);
  const threeDState = useStudioStore((s) => s.threeDState);

  const [openSections, setOpenSections] = useState({
    params: true,
    tone: true,
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
      className="hidden md:flex w-[296px] shrink-0 flex-col overflow-y-auto border-l border-hairline bg-base"
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
        title="Tone curve"
        state="Rec. 601"
        open={openSections.tone}
        onToggle={() => toggleSection('tone')}
      >
        <ToneControls />
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
  children,
}: {
  title: string;
  state: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-hairline first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-10 w-full items-center justify-between px-4 text-control text-highlight hover:bg-raised transition-colors"
      >
        <span className="flex items-center gap-1.5 font-semibold">
          {open ? (
            <ChevronDown size={13} strokeWidth={2} aria-hidden />
          ) : (
            <ChevronRight size={13} strokeWidth={2} aria-hidden />
          )}
          <span>{title}</span>
        </span>
        <span className="max-w-[120px] truncate text-[11px] font-normal tabular-nums text-dim">
          {state}
        </span>
      </button>
      {open && children}
    </section>
  );
}
