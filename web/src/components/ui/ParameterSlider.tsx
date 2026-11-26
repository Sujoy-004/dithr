import { useState, useRef, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export interface ParameterSliderProps {
  label: string;
  value: number;
  defaultValue?: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  isInt?: boolean;
}

/**
 * Shared accessible studio parameter slider:
 * - Tabular readout
 * - Double-click (or press Enter on the value readout) for direct numeric input
 * - Per-control reset button when value differs from default
 */
export default function ParameterSlider({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  format,
  onChange,
  isInt = false,
}: ParameterSliderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setDraft(isInt ? String(Math.round(value)) : String(Number(value.toFixed(3))));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing, value, isInt]);

  const commitDraft = () => {
    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(isInt ? Math.round(clamped) : clamped);
    }
    setEditing(false);
  };

  const showReset =
    defaultValue !== undefined && Math.abs(value - defaultValue) > (isInt ? 0.5 : 0.001);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex h-6 items-center justify-between gap-2 text-control">
        <span className="truncate text-default">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {showReset && (
            <button
              type="button"
              onClick={() => onChange(defaultValue!)}
              aria-label={`Reset ${label} to default`}
              title={`Reset ${label}`}
              className="flex h-5 w-5 items-center justify-center rounded-sm text-dim hover:bg-active hover:text-highlight"
            >
              <RotateCcw size={11} strokeWidth={1.75} aria-hidden />
            </button>
          )}
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              min={min}
              max={max}
              step={step}
              value={draft}
              aria-label={`${label} numeric value`}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitDraft();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditing(false);
                }
              }}
              className="h-5 w-16 border border-hairline bg-active px-1 text-right text-control tabular-nums text-max"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditing(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setEditing(true);
                }
              }}
              title="Double-click to type a number"
              aria-label={`Edit numeric value (${format(value)})`}
              className="h-5 min-w-10 px-1 text-right tabular-nums text-highlight hover:bg-active"
            >
              {format(value)}
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={format(value)}
        data-slider="true"
        className="w-full cursor-ew-resize bg-transparent"
      />
    </div>
  );
}
