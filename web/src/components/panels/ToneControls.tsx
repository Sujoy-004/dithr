import { DEFAULT_TONE, useStudioStore } from '../../store/useStudioStore';
import ParameterSlider from '../ui/ParameterSlider';

/**
 * Rec. 601 pre-tone curve sliders with per-control reset and double-click numeric entry.
 */
export default function ToneControls() {
  const tone = useStudioStore((s) => s.tone);
  const updateTone = useStudioStore((s) => s.updateTone);
  const resetTone = useStudioStore((s) => s.resetTone);

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <ParameterSlider
        label="brightness"
        value={tone.brightness}
        defaultValue={DEFAULT_TONE.brightness}
        min={0}
        max={2}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(brightness) => updateTone({ brightness })}
      />
      <ParameterSlider
        label="contrast"
        value={tone.contrast}
        defaultValue={DEFAULT_TONE.contrast}
        min={0}
        max={2}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(contrast) => updateTone({ contrast })}
      />
      <ParameterSlider
        label="saturation"
        value={tone.saturation}
        defaultValue={DEFAULT_TONE.saturation}
        min={0}
        max={2}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(saturation) => updateTone({ saturation })}
      />
      <ParameterSlider
        label="hue rotation"
        value={tone.hueRotation}
        defaultValue={DEFAULT_TONE.hueRotation}
        min={-180}
        max={180}
        step={1}
        isInt
        format={(v) => `${Math.round(v)}°`}
        onChange={(hueRotation) => updateTone({ hueRotation })}
      />
      <ParameterSlider
        label="sharpness"
        value={tone.sharpness}
        defaultValue={DEFAULT_TONE.sharpness}
        min={0}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(sharpness) => updateTone({ sharpness })}
      />
      <ParameterSlider
        label="gamma"
        value={tone.gamma}
        defaultValue={DEFAULT_TONE.gamma}
        min={0.1}
        max={3}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(gamma) => updateTone({ gamma })}
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          role="switch"
          aria-checked={tone.invert}
          onClick={() => updateTone({ invert: !tone.invert })}
          className={`flex h-7 flex-1 items-center justify-between border px-2 text-control transition-colors ${
            tone.invert
              ? 'border-highlight bg-active text-max'
              : 'border-hairline bg-raised text-default hover:bg-active'
          }`}
        >
          <span>invert</span>
          <span className="tabular-nums">{tone.invert ? 'on' : 'off'}</span>
        </button>
        <button
          type="button"
          onClick={resetTone}
          className="h-7 border border-hairline bg-raised px-2.5 text-control text-dim hover:border-border-strong hover:text-highlight transition-colors"
        >
          reset all
        </button>
      </div>
    </div>
  );
}
