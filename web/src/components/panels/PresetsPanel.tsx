import { useRef, useState } from 'react';
import { Download, Save, Trash2, Upload } from 'lucide-react';
import { useStudioStore } from '../../store/useStudioStore';
import { BUILTIN_STUDIO_PRESETS } from '../../store/studioPresets';
import { downloadText } from '../../export/download';

/**
 * Grainrad-style Presets section: six built-in looks, user presets saved to
 * localStorage, and JSON import/export for sharing whole studio states.
 */
export default function PresetsPanel() {
  const activePresetId = useStudioStore((s) => s.activePresetId);
  const customPresets = useStudioStore((s) => s.customPresets);
  const applyBuiltInPreset = useStudioStore((s) => s.applyBuiltInPreset);
  const applyCustomPreset = useStudioStore((s) => s.applyCustomPreset);
  const saveCustomPreset = useStudioStore((s) => s.saveCustomPreset);
  const deleteCustomPreset = useStudioStore((s) => s.deleteCustomPreset);
  const importCustomPresets = useStudioStore((s) => s.importCustomPresets);
  const exportCustomPresets = useStudioStore((s) => s.exportCustomPresets);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2400);
  };

  const handleSave = () => {
    const id = saveCustomPreset(name);
    setName('');
    flash(`Saved preset (${id.slice(0, 14)}…)`);
  };

  const handleExport = () => {
    downloadText(
      exportCustomPresets(),
      `dithr-presets-${Date.now()}.json`,
      'application/json;charset=utf-8'
    );
    flash('Exported presets JSON');
  };

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-dim">
        <span>Built-in</span>
        <span className="tabular-nums">{BUILTIN_STUDIO_PRESETS.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {BUILTIN_STUDIO_PRESETS.map((preset) => {
          const active = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyBuiltInPreset(preset.id)}
              aria-pressed={active}
              title={`Apply ${preset.name}`}
              className={`flex h-8 items-center justify-between gap-1 border px-2 text-control transition-colors ${
                active
                  ? 'border-highlight bg-active font-semibold text-max'
                  : 'border-hairline bg-raised text-default hover:border-border-strong hover:text-highlight'
              }`}
            >
              <span className="truncate">{preset.name}</span>
              {preset.studioTheme && (
                <span className="shrink-0 text-[9px] uppercase tracking-wider text-dim">
                  {preset.studioTheme}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-dim">
        <span>Custom</span>
        <span className="tabular-nums">{customPresets.length}</span>
      </div>
      {customPresets.length === 0 ? (
        <p className="border border-dashed border-hairline px-2 py-2 text-[11px] leading-relaxed text-dim">
          No custom presets yet. Build a stack, then save it below.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {customPresets.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`flex h-8 items-center gap-1 border px-2 text-control ${
                  active
                    ? 'border-highlight bg-active text-max'
                    : 'border-hairline bg-raised text-default'
                }`}
              >
                <button
                  type="button"
                  onClick={() => applyCustomPreset(preset.id)}
                  className="min-w-0 flex-1 truncate text-left hover:text-highlight"
                  title={`Apply ${preset.name}`}
                >
                  {preset.name}
                </button>
                <span className="shrink-0 tabular-nums text-[10px] text-dim">
                  {preset.stack.length}fx
                </span>
                <button
                  type="button"
                  onClick={() => deleteCustomPreset(preset.id)}
                  aria-label={`Delete preset ${preset.name}`}
                  title="Delete preset"
                  className="flex h-5 w-5 shrink-0 items-center justify-center text-dim hover:text-max"
                >
                  <Trash2 size={11} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-1 flex items-center gap-1">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
          placeholder="Preset name"
          aria-label="New preset name"
          className="h-8 min-w-0 flex-1 border border-hairline bg-base px-2 text-control text-highlight placeholder:text-dim focus:border-border-strong focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          title="Save current studio state as a preset"
          className="flex h-8 shrink-0 items-center gap-1 border border-hairline bg-raised px-2 text-control text-highlight hover:border-border-strong hover:bg-active"
        >
          <Save size={12} aria-hidden />
          <span>Save</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleExport}
          className="flex h-7 flex-1 items-center justify-center gap-1 border border-hairline bg-raised text-[11px] text-default hover:border-border-strong hover:text-highlight"
        >
          <Download size={11} aria-hidden />
          <span>Export JSON</span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-7 flex-1 items-center justify-center gap-1 border border-hairline bg-raised text-[11px] text-default hover:border-border-strong hover:text-highlight"
        >
          <Upload size={11} aria-hidden />
          <span>Import JSON</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const count = importCustomPresets(await file.text());
            flash(count > 0 ? `Imported ${count} preset(s)` : 'No presets found in file');
          }}
        />
      </div>

      {message && (
        <div role="status" aria-live="polite" className="text-[11px] text-highlight">
          {message}
        </div>
      )}
    </div>
  );
}
