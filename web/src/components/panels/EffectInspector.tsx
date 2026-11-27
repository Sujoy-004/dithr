import { useStudioStore } from '../../store/useStudioStore';
import { getEffectDefinition } from '../../engine/registry';
import type { BlendMode, RampPreset } from '../../types/studio';
import { Sliders } from 'lucide-react';
import ParameterSlider from '../ui/ParameterSlider';

export interface EffectInspectorProps {
  onParamChange?: (key: string, value: any) => void;
}

function formatParamLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/**
 * Schema-driven parameter inspector for the selected effect pass.
 * Uses ParameterSlider for double-click numeric entry and per-control reset.
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
      <div className="flex flex-col items-center justify-center py-6 text-center text-control text-dim">
        <Sliders size={18} className="mb-2 opacity-50" aria-hidden />
        <p className="max-w-[200px]">
          Select any of the 16 shaders or + Stack on the left rail to stylize and adjust parameters.
        </p>
      </div>
    );
  }

  const definition = getEffectDefinition(selectedPass.effectId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-hairline pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-semibold text-highlight text-control truncate">
            {definition?.label || selectedPass.effectId}
          </span>
          {!selectedPass.enabled && (
            <span className="border border-hairline bg-raised px-1.5 py-0.5 text-[10px] text-dim">
              bypassed
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="border border-hairline bg-raised px-1.5 py-0.5 text-[10px] text-dim uppercase">
            {definition?.category || 'stylize'}
          </span>
        </div>
      </div>

      {/* Compositing */}
      <div className="flex flex-col gap-2 border-b border-hairline pb-3">
        <ParameterSlider
          label="intensity"
          value={selectedPass.intensity}
          defaultValue={1.0}
          min={0.0}
          max={1.0}
          step={0.01}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(val) => {
            setEffectIntensity(selectedPass.instanceId, val);
            if (onParamChange) onParamChange('intensity', val);
          }}
        />
        <label className="flex h-7 items-center justify-between text-control text-default">
          <span>blend mode</span>
          <select
            value={selectedPass.blendMode}
            onChange={(e) => {
              const mode = e.target.value as BlendMode;
              setEffectBlendMode(selectedPass.instanceId, mode);
              if (onParamChange) onParamChange('blendMode', mode);
            }}
            className="h-7 border border-hairline bg-raised px-2 text-control text-highlight hover:bg-active"
          >
            <option value="normal">normal</option>
            <option value="multiply">multiply</option>
            <option value="screen">screen</option>
            <option value="add">add</option>
          </select>
        </label>
      </div>

      {/* Dynamic Schema Parameters */}
      <div className="flex flex-col gap-2.5">
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
                <ParameterSlider
                  key={key}
                  label={formatParamLabel(key)}
                  value={Number(currentValue)}
                  defaultValue={Number(schema.default)}
                  min={min}
                  max={max}
                  step={step}
                  isInt={schema.type === 'int'}
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
                <div key={key} className="flex h-7 items-center justify-between text-control">
                  <span className="text-default">{formatParamLabel(key)}</span>
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
                    className={`flex h-5 w-9 items-center border border-hairline px-0.5 transition-colors ${
                      isChecked ? 'bg-active text-highlight' : 'bg-base text-dim'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 transition-transform ${
                        isChecked ? 'translate-x-4 bg-highlight' : 'translate-x-0 bg-dim'
                      }`}
                    />
                  </button>
                </div>
              );
            }

            if (schema.type === 'select') {
              return (
                <label key={key} className="flex h-7 items-center justify-between text-control text-default">
                  <span>{formatParamLabel(key)}</span>
                  <select
                    value={String(currentValue)}
                    onChange={(e) => {
                      updatePassParam(selectedPass.instanceId, key, e.target.value);
                      if (onParamChange) onParamChange(key, e.target.value);
                    }}
                    className="h-7 border border-hairline bg-raised px-2 text-control text-highlight hover:bg-active"
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

        {selectedPass.effectId === 'ascii' && (
          <div className="flex flex-col gap-2 border-t border-hairline pt-2.5">
            <label className="flex h-7 items-center justify-between text-control text-default">
              <span>glyph ramp</span>
              <select
                value={ascii.rampPreset}
                onChange={(e) =>
                  updateAscii({ rampPreset: e.target.value as RampPreset, customChars: '' })
                }
                className="h-7 border border-hairline bg-raised px-2 text-control text-highlight hover:bg-active"
              >
                <option value="standard">standard</option>
                <option value="dense">dense</option>
                <option value="simple">simple</option>
                <option value="blocks">blocks</option>
              </select>
            </label>
            <label className="flex h-7 items-center justify-between gap-2 text-control text-default">
              <span className="shrink-0">custom ramp</span>
              <input
                type="text"
                value={ascii.customChars}
                placeholder="uses preset"
                onChange={(e) => updateAscii({ customChars: e.target.value })}
                className="h-7 w-32 border border-hairline bg-raised px-2 text-control text-highlight placeholder:text-dim hover:bg-active"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
