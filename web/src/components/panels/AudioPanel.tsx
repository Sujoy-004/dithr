import { useState } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import {
  resumeAudioContext,
  setAudioInputSource,
  disableMicSource,
} from '../../export/audioGraph';
import { getEffectDefinition } from '../../engine/registry';
import type {
  AudioSourceType,
  AudioStatusType,
  AudioFrequencyBand,
} from '../../types/studio';
import { Volume2, Mic, Activity, Plus, Trash2, AlertCircle } from 'lucide-react';
import ParameterSlider from '../ui/ParameterSlider';

function formatParamLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

const STATUS_CONFIG: Record<AudioStatusType, { label: string; active: boolean }> = {
  off: { label: 'off', active: false },
  waiting: { label: 'connecting', active: false },
  live: { label: 'live', active: true },
  denied: { label: 'blocked', active: false },
  unavailable: { label: 'unavailable', active: false },
};

/**
 * Audio reactivity panel aligned with the monochrome studio design system.
 */
export default function AudioPanel() {
  const audioState = useStudioStore((s) => s.audioState);
  const setAudioEnabled = useStudioStore((s) => s.setAudioEnabled);
  const setAudioSource = useStudioStore((s) => s.setAudioSource);
  const setAudioStatus = useStudioStore((s) => s.setAudioStatus);
  const setAudioSensitivity = useStudioStore((s) => s.setAudioSensitivity);
  const setAudioEnvelopePreset = useStudioStore((s) => s.setAudioEnvelopePreset);
  const addAudioMapping = useStudioStore((s) => s.addAudioMapping);
  const removeAudioMapping = useStudioStore((s) => s.removeAudioMapping);
  const updateAudioMapping = useStudioStore((s) => s.updateAudioMapping);
  const activeStack = useStudioStore((s) => s.activeStack);

  const [isActivating, setIsActivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusConfig = STATUS_CONFIG[audioState.status] || STATUS_CONFIG.off;

  const handleToggleAudio = async () => {
    setErrorMessage(null);

    if (audioState.enabled && audioState.status === 'live') {
      if (audioState.source === 'mic') {
        await disableMicSource().catch(() => {});
      }
      setAudioEnabled(false);
      setAudioStatus('off');
      return;
    }

    setIsActivating(true);
    setAudioStatus('waiting');

    try {
      const resumeResult = await resumeAudioContext();
      if (resumeResult === 'unavailable') {
        setAudioStatus('unavailable');
        setAudioEnabled(false);
        setErrorMessage('Web Audio is unavailable in this browser. Switch to a modern Chromium or Firefox build.');
        return;
      }

      await setAudioInputSource(audioState.source);
      setAudioEnabled(true);
      setAudioStatus('live');
    } catch (err: any) {
      setAudioEnabled(false);
      setAudioStatus('denied');
      setErrorMessage(
        err?.message || 'Microphone access was blocked. Allow microphone permission in the browser address bar and retry.'
      );
    } finally {
      setIsActivating(false);
    }
  };

  const handleSourceChange = async (newSource: AudioSourceType) => {
    setAudioSource(newSource);
    setErrorMessage(null);

    if (audioState.enabled && audioState.status === 'live') {
      try {
        await setAudioInputSource(newSource);
      } catch (err: any) {
        setAudioStatus('denied');
        setErrorMessage(err?.message || 'Could not switch audio source. Check microphone permission.');
      }
    }
  };

  const handleAddDefaultMapping = () => {
    if (activeStack.length === 0) return;

    for (const pass of activeStack) {
      const def = getEffectDefinition(pass.effectId);
      if (!def) continue;

      const numEntries = Object.entries(def.parameters).filter(
        ([_, s]) => s.type === 'float' || s.type === 'int'
      );
      if (numEntries.length > 0) {
        const [paramKey] = numEntries[0];
        addAudioMapping({
          passInstanceId: pass.instanceId,
          paramKey,
          band: 'bass',
          amount: 0.5,
        });
        return;
      }
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 pb-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleToggleAudio}
          disabled={isActivating}
          aria-label={audioState.enabled ? 'Disable Audio Reactivity' : 'Enable Audio Reactivity'}
          className={`flex h-8 flex-1 items-center justify-center gap-1.5 border px-3 text-control font-medium transition-colors ${
            audioState.enabled && audioState.status === 'live'
              ? 'border-highlight bg-active text-max'
              : 'border-hairline bg-raised text-default hover:border-border-strong hover:text-highlight'
          }`}
        >
          <Activity size={13} aria-hidden />
          <span>
            {isActivating
              ? 'Connecting...'
              : audioState.enabled && audioState.status === 'live'
              ? 'Disable Audio'
              : 'Enable Audio'}
          </span>
        </button>

        <div
          role="status"
          aria-label={`Audio status: ${statusConfig.label}`}
          className={`flex h-8 items-center gap-1.5 border px-2.5 text-[11px] ${
            statusConfig.active
              ? 'border-highlight bg-active text-max'
              : 'border-hairline bg-raised text-dim'
          }`}
        >
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 border border-highlight bg-active p-2 text-[11px] text-highlight"
        >
          <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-hairline pt-2.5">
        <span className="text-[11px] font-semibold text-dim">Input source</span>
        <div role="radiogroup" aria-label="Audio input source" className="grid grid-cols-2 gap-1">
          <button
            type="button"
            role="radio"
            aria-checked={audioState.source === 'media'}
            onClick={() => handleSourceChange('media')}
            className={`flex h-8 items-center justify-center gap-1.5 border px-2 text-control transition-colors ${
              audioState.source === 'media'
                ? 'border-highlight bg-active font-medium text-max'
                : 'border-hairline bg-raised text-dim hover:text-highlight'
            }`}
          >
            <Volume2 size={13} aria-hidden />
            <span className="truncate">Video Audio</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={audioState.source === 'mic'}
            onClick={() => handleSourceChange('mic')}
            className={`flex h-8 items-center justify-center gap-1.5 border px-2 text-control transition-colors ${
              audioState.source === 'mic'
                ? 'border-highlight bg-active font-medium text-max'
                : 'border-hairline bg-raised text-dim hover:text-highlight'
            }`}
          >
            <Mic size={13} aria-hidden />
            <span className="truncate">Microphone</span>
          </button>
        </div>
      </div>

      <div className="border-t border-hairline pt-2.5">
        <ParameterSlider
          label="sensitivity"
          value={audioState.sensitivity}
          defaultValue={1.0}
          min={0.1}
          max={3.0}
          step={0.1}
          format={(v) => `${v.toFixed(1)}x`}
          onChange={setAudioSensitivity}
        />
      </div>

      <div className="flex flex-col gap-1.5 border-t border-hairline pt-2.5">
        <span className="text-[11px] font-semibold text-dim">Response smoothing</span>
        <div className="grid grid-cols-3 gap-1">
          {(['punchy', 'standard', 'smooth'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAudioEnvelopePreset(preset)}
              className={`h-7 border text-[11px] capitalize transition-colors ${
                audioState.envelopePreset === preset
                  ? 'border-highlight bg-active font-medium text-max'
                  : 'border-hairline bg-raised text-dim hover:text-highlight'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-dim">Modulation mappings</span>
          <button
            type="button"
            onClick={handleAddDefaultMapping}
            disabled={activeStack.length === 0}
            aria-label="Add audio modulation mapping"
            className="flex h-6 items-center gap-1 border border-hairline bg-raised px-2 text-[11px] text-highlight hover:bg-active disabled:opacity-40"
          >
            <Plus size={11} aria-hidden />
            <span>Add</span>
          </button>
        </div>

        {audioState.mappings.length === 0 ? (
          <p className="py-1 text-[11px] text-dim">
            {activeStack.length === 0
              ? 'Add an effect pass to map audio bands.'
              : 'Click Add to link bass, mid, or treble energy to an effect slider.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {audioState.mappings.map((mapping) => {
              const pass = activeStack.find((p) => p.instanceId === mapping.passInstanceId);
              const def = pass ? getEffectDefinition(pass.effectId) : undefined;
              const numericParams = def
                ? Object.entries(def.parameters).filter(
                    ([_, s]) => s.type === 'float' || s.type === 'int'
                  )
                : [];

              return (
                <div
                  key={mapping.id}
                  className="flex flex-col gap-2 border border-hairline bg-raised p-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <select
                      value={mapping.passInstanceId}
                      aria-label="Target effect pass"
                      onChange={(e) => {
                        const newPassId = e.target.value;
                        const newPass = activeStack.find((p) => p.instanceId === newPassId);
                        const newDef = newPass ? getEffectDefinition(newPass.effectId) : undefined;
                        const firstParam = newDef
                          ? Object.keys(newDef.parameters).find(
                              (k) =>
                                newDef.parameters[k].type === 'float' ||
                                newDef.parameters[k].type === 'int'
                            ) || mapping.paramKey
                          : mapping.paramKey;
                        updateAudioMapping(mapping.id, {
                          passInstanceId: newPassId,
                          paramKey: firstParam,
                        });
                      }}
                      className="h-7 flex-1 border border-hairline bg-base px-1.5 text-[11px] text-highlight"
                    >
                      {activeStack.map((p) => {
                        const d = getEffectDefinition(p.effectId);
                        return (
                          <option key={p.instanceId} value={p.instanceId}>
                            {d?.label || p.effectId}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeAudioMapping(mapping.id)}
                      aria-label="Remove modulation mapping"
                      className="flex h-7 w-7 items-center justify-center border border-hairline text-dim hover:text-highlight"
                    >
                      <Trash2 size={12} aria-hidden />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={mapping.paramKey}
                      aria-label="Target parameter"
                      onChange={(e) =>
                        updateAudioMapping(mapping.id, { paramKey: e.target.value })
                      }
                      className="h-7 border border-hairline bg-base px-1.5 text-[11px] text-highlight"
                    >
                      {numericParams.map(([key]) => (
                        <option key={key} value={key}>
                          {formatParamLabel(key)}
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-3 gap-0.5" role="group" aria-label="Frequency band">
                      {(['bass', 'mid', 'treble'] as AudioFrequencyBand[]).map((band) => (
                        <button
                          key={band}
                          type="button"
                          onClick={() => updateAudioMapping(mapping.id, { band })}
                          className={`h-7 border text-[10px] capitalize ${
                            mapping.band === band
                              ? 'border-highlight bg-active font-semibold text-max'
                              : 'border-hairline bg-base text-dim hover:text-highlight'
                          }`}
                        >
                          {band.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ParameterSlider
                    label="modulation depth"
                    value={mapping.amount}
                    defaultValue={0.5}
                    min={-1.0}
                    max={1.0}
                    step={0.05}
                    format={(v) =>
                      v > 0 ? `+${Math.round(v * 100)}%` : `${Math.round(v * 100)}%`
                    }
                    onChange={(val) => updateAudioMapping(mapping.id, { amount: val })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
