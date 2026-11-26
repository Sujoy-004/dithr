import { useStudioStore } from '../../store/useStudioStore';
import { getEffectDefinition } from '../../engine/registry';
import type { BlendMode, RampPreset } from '../../types/studio';
import { Sliders } from 'lucide-react';

export interface EffectInspectorProps {
  onParamChange?: (key: string, value: any) => void;
}

function formatParamLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/**
 * Dynamic schema-driven parameter inspector panel (D-02, D-03, D-20, D-22, FX-01).
 * Retrieves parameter schemas from EffectRegistry for the selected stack pass and
 * mutates uniforms directly with zero pipeline rebuild overhead.
 */
export default function EffectInspector({ onParamChange }: EffectInspectorProps) {
  const activeStack = useStudioStore((s) => s.activeStack);
  const selectedPassId = useStudioStore((s) => s.selectedPassId);
  const setEffectIntensity = useStudioStore((s) => s.setEffectIntensity);
  const setEffectBlendMode = useStudioStore((s) => s.setEffectBlendMode);
  const updatePassParam = useStudioStore((s) => s.updatePassParam);
  const ascii = useStudioStore((s) => s.ascii);
  const updateAscii = useStudioStore((s) => s.updateAscii);

  const selectedPass = activeStack.find((p) => p.instanceId === selectedPassId);

  if (!selectedPass) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-control text-dim">
        <Sliders size={20} className="mb-2 opacity-40" />
        <p className="max-w-[190px]">
          Select an effect from the stack or click <span className="text-highlight">+ Add Effect</span> to adjust parameters.
        </p>
      </div>
    );
  }

  const definition = getEffectDefinition(selectedPass.effectId);

  return (
    <div className="flex flex-col gap-3">
      {/* Pass Header & Meta Badges */}
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-highlight text-control truncate">
            {definition?.label || selectedPass.effectId}
          </span>
          {!selectedPass.enabled && (
            <span className="px-1 text-[10px] bg-raised text-dim border border-hairline">
              bypassed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="px-1 text-[10px] bg-raised text-dim border border-hairline uppercase">
            {definition?.category || 'stylize'}
          </span>
          <span className="px-1 text-[10px] bg-raised text-dim border border-hairline" title="Cost weight">
            w:{definition?.costWeight ?? 1}
          </span>
        </div>
      </div>

      {/* Compositing Card (D-03): Intensity & Blend Mode */}
      <div className="flex flex-col gap-2 border-b border-hairline pb-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-dim">
          Compositing
        </div>
        <SliderRow
          label="intensity"
          value={selectedPass.intensity}
          min={0.0}
          max={1.0}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(val) => {
            setEffectIntensity(selectedPass.instanceId, val);
            if (onParamChange) onParamChange('intensity', val);
          }}
        />
        <label className="flex h-6 items-center justify-between text-control">
          <span>blend mode</span>
          <select
            value={selectedPass.blendMode}
            onChange={(e) => {
              const mode = e.target.value as BlendMode;
              setEffectBlendMode(selectedPass.instanceId, mode);
              if (onParamChange) onParamChange('blendMode', mode);
            }}
            className="h-6 bg-raised px-2 text-control text-highlight hover:bg-active focus-visible:bg-active"
          >
            <option value="normal">normal</option>
            <option value="multiply">multiply</option>
            <option value="screen">screen</option>
            <option value="add">add</option>
            <option value="overlay">overlay</option>
            <option value="softLight">soft light</option>
          </select>
        </label>
      </div>

      {/* Dynamic Schema Parameters Card (D-20, D-22) */}
      <div className="flex flex-col gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-dim">
          Parameters
        </div>

        {definition &&
          Object.entries(definition.parameters).map(([key, schema]) => {
            const currentValue = selectedPass.parameters[key] ?? schema.default;

            if (schema.type === 'float' || schema.type === 'int') {
              const min = schema.min ?? 0;
              const max = schema.max ?? 100;
              const step = schema.step ?? (schema.type === 'int' ? 1 : 0.05);
              const unit = schema.unit ?? '';

              const formatVal = (v: number) => {
                if (schema.type === 'int') return `${Math.round(v)}${unit ? ' ' + unit : ''}`;
                if (unit === 'deg') return `${Math.round(v)}°`;
                if (unit === '%') return `${Math.round(v * 100)}%`;
                if (unit) return `${Number.isInteger(v) ? v : v.toFixed(2)} ${unit}`;
                return Number.isInteger(v) ? `${v}` : v.toFixed(2);
              };

              return (
                <SliderRow
                  key={key}
                  label={formatParamLabel(key)}
                  value={Number(currentValue)}
                  min={min}
                  max={max}
                  step={step}
                  format={formatVal}
                  onChange={(val) => {
                    const parsed = schema.type === 'int' ? Math.round(val) : val;
                    updatePassParam(selectedPass.instanceId, key, parsed);
                    if (onParamChange) onParamChange(key, parsed);
                  }}
                />
              );
            }

            if (schema.type === 'boolean') {
              const isChecked = Boolean(currentValue);
              return (
                <div key={key} className="flex h-6 items-center justify-between text-control">
                  <span>{formatParamLabel(key)}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isChecked}
                    aria-label={formatParamLabel(key)}
                    onClick={() => {
                      const nextVal = !isChecked;
                      updatePassParam(selectedPass.instanceId, key, nextVal);
                      if (onParamChange) onParamChange(key, nextVal);
                    }}
                    className={`flex h-5 w-9 items-center px-0.5 border border-hairline transition-colors ${
                      isChecked ? 'bg-active text-highlight' : 'bg-base text-dim'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 bg-highlight transition-transform ${
                        isChecked ? 'translate-x-4' : 'translate-x-0 bg-dim'
                      }`}
                    />
                  </button>
                </div>
              );
            }

            if (schema.type === 'select') {
              return (
                <label key={key} className="flex h-6 items-center justify-between text-control">
                  <span>{formatParamLabel(key)}</span>
                  <select
                    value={String(currentValue)}
                    onChange={(e) => {
                      updatePassParam(selectedPass.instanceId, key, e.target.value);
                      if (onParamChange) onParamChange(key, e.target.value);
                    }}
                    className="h-6 bg-raised px-2 text-control text-highlight hover:bg-active focus-visible:bg-active"
                  >
                    {schema.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            return null;
          })}

        {/* ASCII Glyph Atlas Options (SHADER-01) */}
        {selectedPass.effectId === 'ascii' && (
          <div className="flex flex-col gap-2 pt-1 border-t border-hairline">
            <label className="flex h-6 items-center justify-between text-control">
              <span>glyph ramp</span>
              <select
                value={ascii.rampPreset}
                onChange={(e) =>
                  updateAscii({ rampPreset: e.target.value as RampPreset, customChars: '' })
                }
                className="h-6 bg-raised px-2 text-control text-highlight hover:bg-active focus-visible:bg-active"
              >
                <option value="standard">standard</option>
                <option value="dense">dense</option>
                <option value="simple">simple</option>
                <option value="blocks">blocks</option>
              </select>
            </label>
            <label className="flex h-6 items-center justify-between gap-2 text-control">
              <span className="shrink-0">custom ramp</span>
              <input
                type="text"
                value={ascii.customChars}
                placeholder="(uses preset)"
                onChange={(e) => updateAscii({ customChars: e.target.value })}
                className="h-6 w-36 bg-raised px-2 text-control text-highlight placeholder:text-dim hover:bg-active focus-visible:bg-active"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

/** Slider: 1px hairline track, square thumb, label left / tabular value right. */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex h-4 items-center justify-between text-control">
        <span>{label}</span>
        <span className="tabular-nums text-highlight">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        data-slider="true"
        className="h-4 w-full cursor-ew-resize appearance-none bg-transparent"
      />
    </div>
  );
}
