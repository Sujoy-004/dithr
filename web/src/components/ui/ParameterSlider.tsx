import { useState, useRef, useEffect, type CSSProperties } from 'react';

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
 * Grainrad-style hairline parameter slider:
 * - 1px track with a filled progress segment and 8px dot thumb
 * - Tabular monospace readout
 * - Double-click (or Enter on the readout) for direct numeric entry
 * - Inline subtle `reset` affordance when the value differs from its default
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

  const range = max - min;
  const pct = range > 0 ? Math.min(100, Math.max(0, ((value - min) / range) * 100)) : 0;

  return (
    <div className="group/slider flex flex-col gap-1">
      <div className="flex h-5 items-center justify-between gap-2 text-control">
        <span className="truncate text-default">{label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {showReset && (
            <button
              type="button"
              onClick={() => onChange(defaultValue!)}
              aria-label={`Reset ${label} to default`}
              title={`Reset ${label}`}
              className="text-[10px] uppercase tracking-wider text-dim hover:text-highlight"
            >
              reset
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
        style={
          {
            '--slider-fill': `${pct}%`,
          } as CSSProperties
        }
      />
    </div>
  );
}
