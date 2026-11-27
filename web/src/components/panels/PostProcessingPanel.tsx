import { useStudioStore } from '../../store/useStudioStore';
import type { PhosphorMode } from '../../types/studio';
import ParameterSlider from '../ui/ParameterSlider';

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-7 w-full items-center justify-between border-b border-hairline text-control text-highlight hover:bg-raised"
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            checked ? 'bg-term-green shadow-[0_0_6px_var(--term-green)]' : 'bg-hairline'
          }`}
        />
        <span>{label}</span>
      </span>
      <span className="tabular-nums text-[10px] uppercase tracking-wider text-dim">
        {checked ? 'on' : 'off'}
      </span>
    </button>
  );
}

const PHOSPHOR_MODES: PhosphorMode[] = ['green', 'amber', 'white', 'custom'];

/**
 * Grainrad post-processing chain. Compiled as one finishing stage after the
 * user's effect stack, and skipped entirely while every toggle is off.
 */
export default function PostProcessingPanel() {
  const post = useStudioStore((s) => s.postProcessing);
  const update = useStudioStore((s) => s.updatePostProcessing);
  const reset = useStudioStore((s) => s.resetPostProcessing);

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <Toggle
        label="Bloom"
        checked={post.bloom.enabled}
        onChange={(enabled) => update({ bloom: { enabled } })}
      />
      {post.bloom.enabled && (
        <div className="flex flex-col gap-1.5 pb-1">
          <ParameterSlider
            label="threshold"
            value={post.bloom.threshold}
            defaultValue={0.65}
            min={0}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(threshold) => update({ bloom: { threshold } })}
          />
          <ParameterSlider
            label="intensity"
            value={post.bloom.intensity}
            defaultValue={0.6}
            min={0}
            max={2}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(intensity) => update({ bloom: { intensity } })}
          />
        </div>
      )}

      <Toggle
        label="Film grain"
        checked={post.grain.enabled}
        onChange={(enabled) => update({ grain: { enabled } })}
      />
      {post.grain.enabled && (
        <div className="flex flex-col gap-1.5 pb-1">
          <ParameterSlider
            label="intensity"
            value={post.grain.intensity}
            defaultValue={0.25}
            min={0}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(intensity) => update({ grain: { intensity } })}
          />
          <ParameterSlider
            label="grain size"
            value={post.grain.size}
            defaultValue={2}
            min={1}
            max={8}
            step={0.5}
            format={(v) => `${v.toFixed(1)}px`}
            onChange={(size) => update({ grain: { size } })}
          />
          <ParameterSlider
            label="speed"
            value={post.grain.speed}
            defaultValue={1}
            min={0}
            max={5}
            step={0.1}
            format={(v) => `${v.toFixed(1)}x`}
            onChange={(speed) => update({ grain: { speed } })}
          />
        </div>
      )}

      <Toggle
        label="Chromatic aberration"
        checked={post.chromatic.enabled}
        onChange={(enabled) => update({ chromatic: { enabled } })}
      />
      {post.chromatic.enabled && (
        <div className="pb-1">
          <ParameterSlider
            label="offset"
            value={post.chromatic.offset}
            defaultValue={2}
            min={0}
            max={12}
            step={0.25}
            format={(v) => `${v.toFixed(2)}px`}
            onChange={(offset) => update({ chromatic: { offset } })}
          />
        </div>
      )}

      <Toggle
        label="Scanlines"
        checked={post.scanlines.enabled}
        onChange={(enabled) => update({ scanlines: { enabled } })}
      />
      {post.scanlines.enabled && (
        <div className="flex flex-col gap-1.5 pb-1">
          <ParameterSlider
            label="opacity"
            value={post.scanlines.opacity}
            defaultValue={0.25}
            min={0}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(opacity) => update({ scanlines: { opacity } })}
          />
          <ParameterSlider
            label="spacing"
            value={post.scanlines.spacing}
            defaultValue={3}
            min={1}
            max={12}
            step={1}
            isInt
            format={(v) => `${Math.round(v)}px`}
            onChange={(spacing) => update({ scanlines: { spacing } })}
          />
        </div>
      )}

      <Toggle
        label="Vignette"
        checked={post.vignette.enabled}
        onChange={(enabled) => update({ vignette: { enabled } })}
      />
      {post.vignette.enabled && (
        <div className="flex flex-col gap-1.5 pb-1">
          <ParameterSlider
            label="intensity"
            value={post.vignette.intensity}
            defaultValue={0.5}
            min={0}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(intensity) => update({ vignette: { intensity } })}
          />
          <ParameterSlider
            label="radius"
            value={post.vignette.radius}
            defaultValue={0.55}
            min={0.1}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(radius) => update({ vignette: { radius } })}
          />
        </div>
      )}

      <Toggle
        label="CRT curve"
        checked={post.crtCurve.enabled}
        onChange={(enabled) => update({ crtCurve: { enabled } })}
      />
      {post.crtCurve.enabled && (
        <div className="pb-1">
          <ParameterSlider
            label="amount"
            value={post.crtCurve.amount}
            defaultValue={0.18}
            min={0}
            max={0.6}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(amount) => update({ crtCurve: { amount } })}
          />
        </div>
      )}

      <Toggle
        label="Phosphor tint"
        checked={post.phosphor.enabled}
        onChange={(enabled) => update({ phosphor: { enabled } })}
      />
      {post.phosphor.enabled && (
        <div className="flex flex-col gap-1.5 pb-1">
          <label className="flex h-7 items-center justify-between text-control text-default">
            <span>mode</span>
            <select
              value={post.phosphor.mode}
              onChange={(e) => update({ phosphor: { mode: e.target.value as PhosphorMode } })}
              className="h-7 border border-hairline bg-raised px-2 text-control text-highlight hover:bg-active"
            >
              {PHOSPHOR_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          {post.phosphor.mode === 'custom' && (
            <label className="flex h-7 items-center justify-between text-control text-default">
              <span>colour</span>
              <input
                type="color"
                value={post.phosphor.color}
                onChange={(e) => update({ phosphor: { color: e.target.value } })}
                aria-label="Phosphor colour"
                className="h-6 w-12 border border-hairline bg-raised"
              />
            </label>
          )}
          <ParameterSlider
            label="intensity"
            value={post.phosphor.intensity}
            defaultValue={0.35}
            min={0}
            max={1}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(intensity) => update({ phosphor: { intensity } })}
          />
        </div>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-1 h-7 border border-hairline bg-raised text-control text-dim hover:border-border-strong hover:text-highlight transition-colors"
      >
        reset all
      </button>
    </div>
  );
}
