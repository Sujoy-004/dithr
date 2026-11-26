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

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
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
      desc: 'Full fidelity for desktop GPUs',
    },
    {
      value: 'medium',
      label: 'Medium (720p canvas, optimized passes, 30 FPS)',
      desc: 'Balanced performance for laptops and tablets',
    },
    {
      value: 'low',
      label: 'Low (480p canvas, minimal passes, 30 FPS)',
      desc: 'Lightweight rendering for low-power hardware',
    },
  ];

  return (
    <div className="relative inline-block select-none" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={`Quality Tier: ${tierShort}, Engine: ${engineShort}. Click to switch quality tier.`}
        title="Switch quality tier"
        className={`flex h-7 items-center gap-1.5 border px-2 text-[11px] font-mono transition-colors ${
          isOpen
            ? 'border-highlight bg-active text-max'
            : 'border-hairline bg-raised text-highlight hover:border-border-strong'
        }`}
      >
        <span>[TIER: {tierShort}]</span>
        {!compact && <span className="hidden sm:inline text-dim">[{engineShort}]</span>}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Quality tier selection"
          className="studio-glass absolute right-0 bottom-full mb-2 z-50 w-72 max-w-[calc(100vw-24px)] rounded-lg p-2.5 text-control sm:bottom-auto sm:top-full sm:mt-2"
        >
          <div className="mb-2 flex items-center justify-between border-b border-hairline pb-1.5">
            <span className="font-semibold text-highlight">Switch Quality Tier</span>
            <span className="text-[11px] font-mono text-dim">{engineShort}</span>
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
                  className={`flex flex-col items-start gap-0.5 rounded border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-highlight bg-active text-max'
                      : 'border-hairline bg-base/70 text-default hover:border-border-strong hover:text-highlight'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span
                      aria-hidden
                      className={`inline-block h-2 w-2 border ${
                        isSelected ? 'border-highlight bg-highlight' : 'border-dim'
                      }`}
                    />
                    <span>{opt.label}</span>
                  </div>
                  <span className="pl-4 text-[11px] text-dim leading-snug">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
