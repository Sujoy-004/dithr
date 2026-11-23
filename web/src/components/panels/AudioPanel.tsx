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
import {
  Volume2,
  Mic,
  Activity,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';

function formatParamLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

/**
 * Status chip styling and labels (D-13).
 */
const STATUS_CONFIG: Record<
  AudioStatusType,
  { label: string; className: string; pulse: boolean }
> = {
  off: {
    label: 'off',
    className: 'border-hairline bg-raised text-dim',
    pulse: false,
  },
  waiting: {
    label: 'waiting for click',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    pulse: false,
  },
  live: {
    label: 'live',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
    pulse: true,
  },
  denied: {
    label: 'denied',
    className: 'border-red-500/40 bg-red-500/10 text-red-400',
    pulse: false,
  },
  unavailable: {
    label: 'unavailable',
    className: 'border-hairline bg-raised text-dim/60',
    pulse: false,
  },
};

/**
 * Audio reactivity panel (D-10, D-11, D-12, D-13, D-14, FX-05).
 * Explicit user opt-in, status chip, source selection, master sensitivity,
 * envelope presets, and modulation parameter mappings.
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
      // Disable audio
      if (audioState.source === 'mic') {
        await disableMicSource().catch(() => {});
      }
      setAudioEnabled(false);
      setAudioStatus('off');
      return;
    }

    // Explicit opt-in activation (D-13)
    setIsActivating(true);
    setAudioStatus('waiting');

    try {
      const resumeResult = await resumeAudioContext();
      if (resumeResult === 'unavailable') {
        setAudioStatus('unavailable');
        setAudioEnabled(false);
        setErrorMessage('Web Audio is not available in this browser.');
        return;
      }

      await setAudioInputSource(audioState.source);
      setAudioEnabled(true);
      setAudioStatus('live');
    } catch (err: any) {
      console.warn('[AudioPanel] Audio activation failed:', err);
      setAudioEnabled(false);
      setAudioStatus('denied');
      setErrorMessage(
        err?.message || 'Permission denied or microphone could not be initialized.'
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
        console.warn('[AudioPanel] Audio source switch failed:', err);
        setAudioStatus('denied');
        setErrorMessage(
          err?.message || 'Could not switch audio source.'
        );
      }
    }
  };

  // Helper to add a default mapping for the first available pass & numeric param
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
      {/* Top Controls: Enable/Disable Button & Status Chip */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleToggleAudio}
          disabled={isActivating}
          aria-label={audioState.enabled ? 'Disable Audio Reactivity' : 'Enable Audio Reactivity'}
          className={`flex h-7 flex-1 items-center justify-center gap-1.5 px-3 text-control font-medium transition-colors ${
            audioState.enabled && audioState.status === 'live'
              ? 'bg-active text-highlight border border-emerald-500/50 hover:bg-raised'
              : 'bg-raised text-dim hover:bg-active hover:text-highlight border border-hairline'
          }`}
        >
          <Activity size={13} className={audioState.status === 'live' ? 'text-emerald-400' : ''} />
          <span>
            {isActivating
              ? 'Connecting...'
              : audioState.enabled && audioState.status === 'live'
              ? 'Disable Audio'
              : 'Enable Audio'}
          </span>
        </button>

        {/* Status Chip (D-13) */}
        <div
          role="status"
          aria-label={`Audio status: ${statusConfig.label}`}
          className={`flex h-7 items-center gap-1.5 px-2 text-[11px] border ${statusConfig.className} capitalize`}
        >
          {statusConfig.pulse ? (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60" />
          )}
          <span>{statusConfig.label}</span>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-1.5 border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Audio Source Selector (D-10) */}
      <div className="flex flex-col gap-1.5 border-t border-hairline pt-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-dim">
          Audio Input Source
        </span>
        <div
          role="radiogroup"
          aria-label="Audio input source"
          className="grid grid-cols-2 gap-1"
        >
          <button
            type="button"
            role="radio"
            aria-checked={audioState.source === 'media'}
            onClick={() => handleSourceChange('media')}
            className={`flex h-7 items-center justify-center gap-1.5 px-2 text-control transition-colors ${
              audioState.source === 'media'
                ? 'bg-active text-highlight border border-hairline font-medium'
                : 'bg-raised text-dim hover:bg-active hover:text-highlight'
            }`}
          >
            <Volume2 size={13} />
            <span className="truncate">Video Audio</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={audioState.source === 'mic'}
            onClick={() => handleSourceChange('mic')}
            className={`flex h-7 items-center justify-center gap-1.5 px-2 text-control transition-colors ${
              audioState.source === 'mic'
                ? 'bg-active text-highlight border border-hairline font-medium'
                : 'bg-raised text-dim hover:bg-active hover:text-highlight'
            }`}
          >
            <Mic size={13} />
            <span className="truncate">Microphone</span>
          </button>
        </div>
      </div>

      {/* Master Sensitivity Slider (D-11) */}
      <div className="flex flex-col gap-1.5 border-t border-hairline pt-2">
        <div className="flex items-center justify-between text-control">
          <label htmlFor="audio-sensitivity-slider" className="text-dim">
            Master Sensitivity
          </label>
          <span className="tabular-nums text-highlight">
            {audioState.sensitivity.toFixed(1)}x
          </span>
        </div>
        <input
          id="audio-sensitivity-slider"
          type="range"
          min={0.1}
          max={3.0}
          step={0.1}
          value={audioState.sensitivity}
          onChange={(e) => setAudioSensitivity(parseFloat(e.target.value))}
          aria-label="Master audio sensitivity"
          className="h-1 w-full cursor-pointer appearance-none bg-raised accent-highlight"
        />
      </div>

      {/* Attack / Release Smoothing Presets (D-14) */}
      <div className="flex flex-col gap-1.5 border-t border-hairline pt-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-dim">
          Response Smoothing
        </span>
        <div className="grid grid-cols-3 gap-1">
          {(['punchy', 'standard', 'smooth'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAudioEnvelopePreset(preset)}
              className={`h-6 text-[11px] capitalize transition-colors ${
                audioState.envelopePreset === preset
                  ? 'bg-active text-highlight border border-hairline font-medium'
                  : 'bg-raised text-dim hover:bg-active hover:text-highlight'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Modulation Mappings Section (D-11) */}
      <div className="flex flex-col gap-2 border-t border-hairline pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-dim">
            Modulation Mappings
          </span>
          <button
            type="button"
            onClick={handleAddDefaultMapping}
            disabled={activeStack.length === 0}
            aria-label="Add audio modulation mapping"
            className="flex h-5 items-center gap-1 px-1.5 text-[10px] bg-raised text-dim hover:bg-active hover:text-highlight disabled:opacity-40"
          >
            <Plus size={11} />
            <span>Add</span>
          </button>
        </div>

        {audioState.mappings.length === 0 ? (
          <div className="py-2 text-center text-[11px] text-dim/70">
            {activeStack.length === 0
              ? 'Add an effect pass to configure audio modulation.'
              : 'No audio mappings active. Click "+ Add" to link an audio band to an effect parameter.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
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
                  className="flex flex-col gap-1.5 border border-hairline bg-raised/40 p-2"
                >
                  {/* Top row: Target pass & Remove button */}
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
                      className="h-6 flex-1 bg-base text-[11px] text-highlight border border-hairline px-1 focus:outline-none"
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
                      className="flex h-6 w-6 items-center justify-center text-dim hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Second row: Target parameter & Band selector */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={mapping.paramKey}
                      aria-label="Target parameter"
                      onChange={(e) =>
                        updateAudioMapping(mapping.id, { paramKey: e.target.value })
                      }
                      className="h-6 bg-base text-[11px] text-highlight border border-hairline px-1 focus:outline-none"
                    >
                      {numericParams.map(([key, _schema]) => (
                        <option key={key} value={key}>
                          {formatParamLabel(key)}
                        </option>
                      ))}
                    </select>

                    {/* Band selector buttons */}
                    <div className="grid grid-cols-3 gap-0.5" role="group" aria-label="Frequency band">
                      {(['bass', 'mid', 'treble'] as AudioFrequencyBand[]).map((band) => (
                        <button
                          key={band}
                          type="button"
                          onClick={() => updateAudioMapping(mapping.id, { band })}
                          className={`h-6 text-[10px] capitalize transition-colors ${
                            mapping.band === band
                              ? 'bg-active text-highlight border border-hairline font-bold'
                              : 'bg-base text-dim hover:bg-active'
                          }`}
                        >
                          {band.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Third row: Depth Slider (-100% to +100%) */}
                  <div className="flex flex-col gap-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-dim">Modulation Depth</span>
                      <span className="tabular-nums text-highlight">
                        {mapping.amount > 0 ? `+${Math.round(mapping.amount * 100)}%` : `${Math.round(mapping.amount * 100)}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1.0}
                      max={1.0}
                      step={0.05}
                      value={mapping.amount}
                      aria-label="Modulation depth"
                      onChange={(e) =>
                        updateAudioMapping(mapping.id, {
                          amount: parseFloat(e.target.value),
                        })
                      }
                      className="h-1 w-full cursor-pointer appearance-none bg-base accent-highlight"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
