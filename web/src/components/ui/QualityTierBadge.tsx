import { useState, useRef, useEffect } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import type { QualityTier } from '../../engine/capabilities';

interface QualityTierBadgeProps {
  compact?: boolean;
}

export default function QualityTierBadge({ compact = false }: QualityTierBadgeProps) {
  const detectedTier = useStudioStore((s) => s.detectedTier);
  const activeTier = useStudioStore((s) => s.activeTier);
  const tierOverride = useStudioStore((s) => s.tierOverride);
  const gpuEngine = useStudioStore((s) => s.gpuEngine);
  const setTierOverride = useStudioStore((s) => s.setTierOverride);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen]);

  const tierShort = activeTier === 'high' ? 'HIGH' : activeTier === 'medium' ? 'MED' : 'LOW';
  const engineShort = gpuEngine.toUpperCase();

  const options: Array<{ value: QualityTier | null; label: string; desc: string }> = [
    {
      value: null,
      label: `Auto (Detected: ${detectedTier.charAt(0).toUpperCase() + detectedTier.slice(1)})`,
      desc: 'Automatic selection based on GPU limits and device memory',
    },
    {
      value: 'high',
      label: 'High (1080p canvas, full shader passes, 60 FPS)',
      desc: 'Uncompromised visual fidelity for desktop GPUs',
    },
    {
      value: 'medium',
      label: 'Medium (720p canvas, optimized passes, 30 FPS)',
      desc: 'Balanced performance for laptops and mobile devices',
    },
    {
      value: 'low',
      label: 'Low (480p canvas, minimal passes, 30 FPS)',
      desc: 'Lightweight rendering for low-power or legacy hardware',
    },
  ];

  return (
    <div className="relative inline-block select-none" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Quality Tier: ${tierShort}, Engine: ${engineShort}. Click to switch quality tier.`}
        title="Click to switch quality tier"
        className={`flex h-5 items-center gap-1 border border-border px-1.5 text-[10px] font-mono transition-colors hover:border-[#00ff66] ${
          isOpen ? 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]' : 'text-[#00ff66] bg-raised'
        }`}
      >
        <span>[TIER: {tierShort}]</span>
        {!compact && <span className="text-dim">[{engineShort}]</span>}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Quality tier selection"
          className="absolute right-0 bottom-full mb-1 z-50 w-72 border border-border bg-[#151515] p-2 shadow-2xl text-[11px] font-mono sm:bottom-auto sm:top-full sm:mt-1"
        >
          <div className="mb-2 flex items-center justify-between border-b border-border pb-1">
            <span className="text-highlight font-semibold">Switch Quality Tier</span>
            <span className="text-[10px] text-dim">{engineShort}</span>
          </div>

          <div className="flex flex-col gap-1.5" role="radiogroup">
            {options.map((opt) => {
              const isSelected = tierOverride === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setTierOverride(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex flex-col items-start gap-0.5 p-1.5 text-left border transition-colors ${
                    isSelected
                      ? 'border-[#00ff66] bg-[#00ff66]/10 text-[#00ff66]'
                      : 'border-border bg-base text-[#777777] hover:border-border-highlight hover:text-highlight'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>{isSelected ? '●' : '○'}</span>
                    <span>{opt.label}</span>
                  </div>
                  <span className="pl-4 text-[9px] text-dim leading-tight">
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
