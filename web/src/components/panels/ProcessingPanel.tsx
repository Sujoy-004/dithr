import { DEFAULT_PROCESSING, useStudioStore } from '../../store/useStudioStore';
import ParameterSlider from '../ui/ParameterSlider';

/**
 * Global Stage-0 "Processing" controls (Grainrad). These run once before the
 * effect stack, in the same pre-tone shader as brightness/contrast, and are
 * bypassed entirely while neutral.
 */
export default function ProcessingPanel() {
  const processing = useStudioStore((s) => s.processing);
  const updateProcessing = useStudioStore((s) => s.updateProcessing);
  const resetProcessing = useStudioStore((s) => s.resetProcessing);

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <ParameterSlider
        label="brightness map"
        value={processing.brightnessMap}
        defaultValue={DEFAULT_PROCESSING.brightnessMap}
        min={0}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(brightnessMap) => updateProcessing({ brightnessMap })}
      />
      <ParameterSlider
        label="edge enhance"
        value={processing.edgeEnhance}
        defaultValue={DEFAULT_PROCESSING.edgeEnhance}
        min={0}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(edgeEnhance) => updateProcessing({ edgeEnhance })}
      />
      <ParameterSlider
        label="blur"
        value={processing.blur}
        defaultValue={DEFAULT_PROCESSING.blur}
        min={0}
        max={1}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(blur) => updateProcessing({ blur })}
      />
      <ParameterSlider
        label="quantize colours"
        value={processing.quantizeColors}
        defaultValue={DEFAULT_PROCESSING.quantizeColors}
        min={0}
        max={16}
        step={1}
        isInt
        format={(v) => (v < 2 ? 'off' : `${Math.round(v)} levels`)}
        onChange={(quantizeColors) => updateProcessing({ quantizeColors })}
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          role="switch"
          aria-checked={processing.invert}
          onClick={() => updateProcessing({ invert: !processing.invert })}
          className={`flex h-7 flex-1 items-center justify-between border px-2 text-control transition-colors ${
            processing.invert
              ? 'border-highlight bg-active text-max'
              : 'border-hairline bg-raised text-default hover:bg-active'
          }`}
        >
          <span>invert source</span>
          <span className="tabular-nums">{processing.invert ? 'on' : 'off'}</span>
        </button>
        <button
          type="button"
          onClick={resetProcessing}
          className="h-7 border border-hairline bg-raised px-2.5 text-control text-dim hover:border-border-strong hover:text-highlight transition-colors"
        >
          reset all
        </button>
      </div>
    </div>
  );
}
