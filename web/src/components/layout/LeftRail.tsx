import { PanelLeftClose, PanelLeftOpen, PanelRightClose } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import SourceAndShaderPanel from '../panels/SourceAndShaderPanel';

/**
 * Desktop left docked rail (248px). Hidden on viewports below 768px where
 * MobileSheet takes over so the canvas fills the viewport.
 */
export default function LeftRail() {
  const activeStack = useStudioStore((s) => s.activeStack);
  const selectedPassId = useStudioStore((s) => s.selectedPassId);
  const setSelectedPassId = useStudioStore((s) => s.setSelectedPassId);
  const leftCollapsed = useStudioStore((s) => s.leftCollapsed);
  const toggleLeftRail = useStudioStore((s) => s.toggleLeftRail);
  const toggleRightRail = useStudioStore((s) => s.toggleRightRail);

  if (leftCollapsed) {
    return (
      <aside
        className="hidden md:flex w-12 shrink-0 flex-col items-center gap-1 border-r border-hairline bg-base py-2"
        aria-label="Left rail (collapsed)"
      >
        <button
          type="button"
          aria-label="expand left rail"
          title="Expand left rail"
          onClick={toggleLeftRail}
          className="flex h-8 w-8 items-center justify-center text-dim hover:bg-active hover:text-highlight"
        >
          <PanelLeftOpen size={16} strokeWidth={1.75} />
        </button>
        <div className="my-1 w-6 border-b border-hairline" />
        {activeStack.map((pass) => {
          const isSelected = selectedPassId === pass.instanceId;
          return (
            <button
              key={pass.instanceId}
              type="button"
              aria-label={`select ${pass.effectId}`}
              title={pass.effectId}
              onClick={() => setSelectedPassId(pass.instanceId)}
              className={`flex h-8 w-8 items-center justify-center text-[10px] font-bold uppercase ${
                isSelected ? 'bg-active text-max' : 'text-dim hover:bg-active hover:text-highlight'
              }`}
            >
              {pass.effectId.slice(0, 2)}
            </button>
          );
        })}
        <div className="mt-auto">
          <button
            type="button"
            aria-label="toggle right rail"
            title="Toggle right rail"
            onClick={toggleRightRail}
            className="flex h-8 w-8 items-center justify-center text-dim hover:bg-active hover:text-highlight"
          >
            <PanelRightClose size={16} strokeWidth={1.75} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="hidden md:flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-hairline bg-base"
      aria-label="Left rail"
    >
      <SourceAndShaderPanel section="all" />

      <div className="mt-auto flex justify-between border-t border-hairline p-2">
        <button
          type="button"
          aria-label="collapse left rail"
          title="Collapse left rail"
          onClick={toggleLeftRail}
          className="flex h-8 w-8 items-center justify-center text-dim hover:bg-active hover:text-highlight"
        >
          <PanelLeftClose size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="toggle right rail"
          title="Toggle right rail"
          onClick={toggleRightRail}
          className="flex h-8 w-8 items-center justify-center text-dim hover:bg-active hover:text-highlight"
        >
          <PanelRightClose size={16} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
