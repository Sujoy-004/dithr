import { useState, useRef } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { exportRasterImage } from '../../export/imageExport';
import { exportAsciiText } from '../../export/textExport';
import { exportAsciiSvg } from '../../export/svgExport';
import {
  recordWebmClip,
  recordGifClip,
  type ActiveRecordingController,
} from '../../export/videoExport';
import ServerExportModal from '../modals/ServerExportModal';

/**
 * Tabbed Export Drawer panel (D-03, D-04, RELY-03, RELY-04).
 * Provides triggers for PNG, JPEG, SVG, TXT, WebM, and animated GIF exports with progress feedback.
 */
export default function ExportDrawer() {
  const mediaType = useStudioStore((s) => s.mediaType);
  const mediaUrl = useStudioStore((s) => s.mediaUrl);
  const ascii = useStudioStore((s) => s.ascii);

  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'vector' | 'clip'>('image');
  const [cols, setCols] = useState(100);
  const [svgMode, setSvgMode] = useState<'truecolor' | 'monochrome'>('truecolor');

  // Clip sub-format and controls
  const [clipMode, setClipMode] = useState<'webm' | 'gif'>('webm');
  const [webmDuration, setWebmDuration] = useState(3);
  const [gifDuration, setGifDuration] = useState(2);
  const [preserveAudio, setPreserveAudio] = useState(true);

  // Recording & progress state
  const [busy, setBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Active cancellation controller
  const cancelRef = useRef<ActiveRecordingController | null>(null);

  // Server Export Modal state
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverFormat, setServerFormat] = useState<'mp4' | 'gif'>('mp4');

  const hasMedia = mediaType !== null;

  const getCanvas = (): HTMLCanvasElement | null => {
    return document.querySelector('canvas[aria-label="Media viewport canvas"]');
  };

  const getSourceElement = (): Promise<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      if (mediaType === 'image' && mediaUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = mediaUrl;
      } else {
        const canvas = getCanvas();
        if (canvas) resolve(canvas);
        else reject(new Error('Canvas viewport not mounted'));
      }
    });
  };

  const handleRaster = async (format: 'png' | 'jpeg') => {
    const canvas = getCanvas();
    if (!canvas) return;
    setBusy(true);
    setProgressMsg(`Exporting ${format.toUpperCase()}...`);
    try {
      await exportRasterImage(canvas, format);
      setToastMsg(`Downloaded ${format.toUpperCase()}!`);
    } catch (err) {
      console.error(err);
      setToastMsg('Export failed');
    } finally {
      setBusy(false);
      setProgressMsg('');
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleText = async () => {
    setBusy(true);
    setProgressMsg('Generating ASCII text...');
    try {
      const src = await getSourceElement();
      exportAsciiText(src, {
        cols,
        rampPreset: ascii.rampPreset,
        customChars: ascii.customChars,
        charAspect: ascii.charAspect,
      });
      setToastMsg('Downloaded .txt!');
    } catch (err) {
      console.error(err);
      setToastMsg('Export failed');
    } finally {
      setBusy(false);
      setProgressMsg('');
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleSvg = async () => {
    setBusy(true);
    setProgressMsg('Generating vector SVG...');
    try {
      const src = await getSourceElement();
      exportAsciiSvg(src, {
        cols,
        colorMode: svgMode,
        rampPreset: ascii.rampPreset,
        customChars: ascii.customChars,
        charAspect: ascii.charAspect,
      });
      setToastMsg('Downloaded .svg!');
    } catch (err) {
      console.error(err);
      setToastMsg('Export failed');
    } finally {
      setBusy(false);
      setProgressMsg('');
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleWebm = async () => {
    const canvas = getCanvas();
    if (!canvas) return;

    const controller: ActiveRecordingController = { cancel: () => {}, isCancelled: false };
    cancelRef.current = controller;
    setBusy(true);
    setIsRecording(true);
    setProgressMsg('Recording WebM Clip... 0%');

    try {
      await recordWebmClip(
        canvas,
        webmDuration,
        (p) => setProgressMsg(p.message),
        undefined,
        preserveAudio,
        null,
        controller
      );
      setToastMsg('✔ WebM clip downloaded with synchronized audio.');
    } catch (err: any) {
      if (controller.isCancelled) {
        setToastMsg('Recording cancelled.');
      } else {
        console.error(err);
        setToastMsg('Recording interrupted. Media stream was stopped or tab was hidden.');
      }
    } finally {
      setBusy(false);
      setIsRecording(false);
      setProgressMsg('');
      cancelRef.current = null;
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  const handleGif = async () => {
    const canvas = getCanvas();
    if (!canvas) return;

    const controller: ActiveRecordingController = { cancel: () => {}, isCancelled: false };
    cancelRef.current = controller;
    setBusy(true);
    setIsRecording(true);
    setProgressMsg('Sampling frames... 0%');

    const fps = 10;
    const totalFrames = Math.round(gifDuration * fps);

    try {
      await recordGifClip(
        canvas,
        gifDuration,
        fps,
        (p) => setProgressMsg(p.message),
        undefined,
        controller
      );
      setToastMsg(`✔ Animated GIF downloaded (${totalFrames} sequential frames).`);
    } catch (err: any) {
      if (controller.isCancelled) {
        setToastMsg('Recording cancelled.');
      } else {
        console.error(err);
        setToastMsg('GIF recording failed.');
      }
    } finally {
      setBusy(false);
      setIsRecording(false);
      setProgressMsg('');
      cancelRef.current = null;
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  const handleCancelRecording = () => {
    if (cancelRef.current) {
      cancelRef.current.isCancelled = true;
      cancelRef.current.cancel();
    }
    setIsRecording(false);
    setBusy(false);
    setProgressMsg('');
    setToastMsg('Recording cancelled.');
    setTimeout(() => setToastMsg(''), 3000);
  };

  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      {/* Subtabs */}
      <div className="grid grid-cols-4 gap-1 text-control" role="tablist" aria-label="Export format tabs">
        {(['image', 'text', 'vector', 'clip'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`h-6 text-center transition-colors ${
              activeTab === tab ? 'bg-active text-highlight' : 'bg-raised text-dim hover:text-base'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {activeTab === 'image' && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleRaster('png')}
            className="flex h-6 items-center justify-between bg-raised px-2 text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
          >
            <span>export PNG</span>
            <span className="tabular-nums text-dim">lossless</span>
          </button>
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleRaster('jpeg')}
            className="flex h-6 items-center justify-between bg-raised px-2 text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
          >
            <span>export JPEG</span>
            <span className="tabular-nums text-dim">95%</span>
          </button>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="flex flex-col gap-2">
          <label className="flex h-4 items-center justify-between text-control">
            <span>columns</span>
            <span className="tabular-nums text-highlight">{cols}</span>
          </label>
          <input
            type="range"
            min={40}
            max={200}
            step={5}
            value={cols}
            onChange={(e) => setCols(Number(e.target.value))}
            className="h-4 w-full cursor-ew-resize appearance-none bg-transparent"
          />
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleText()}
            className="h-6 bg-raised px-2 text-left text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
          >
            download ASCII .txt
          </button>
        </div>
      )}

      {activeTab === 'vector' && (
        <div className="flex flex-col gap-2">
          <div className="flex h-6 items-center justify-between text-control">
            <span>color mode</span>
            <select
              value={svgMode}
              onChange={(e) => setSvgMode(e.target.value as 'truecolor' | 'monochrome')}
              className="h-6 bg-raised px-2 text-control text-highlight hover:bg-active"
            >
              <option value="truecolor">truecolor</option>
              <option value="monochrome">monochrome</option>
            </select>
          </div>
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleSvg()}
            className="h-6 bg-raised px-2 text-left text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
          >
            download vector .svg
          </button>
        </div>
      )}

      {activeTab === 'clip' && (
        <div className="flex flex-col gap-2">
          {/* Format Sub-selector */}
          <div className="grid grid-cols-2 gap-1 text-[11px]">
            <button
              type="button"
              disabled={busy}
              onClick={() => setClipMode('webm')}
              className={`h-5 text-center transition-colors border ${
                clipMode === 'webm'
                  ? 'border-[#00ff66] text-[#00ff66] bg-[#00ff66]/10'
                  : 'border-border text-dim hover:text-base'
              }`}
            >
              WebM Video
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setClipMode('gif')}
              className={`h-5 text-center transition-colors border ${
                clipMode === 'gif'
                  ? 'border-[#00ff66] text-[#00ff66] bg-[#00ff66]/10'
                  : 'border-border text-dim hover:text-base'
              }`}
            >
              Animated GIF
            </button>
          </div>

          {/* WebM Options */}
          {clipMode === 'webm' && (
            <div className="flex flex-col gap-2">
              <label className="flex h-4 items-center justify-between text-control">
                <span>duration</span>
                <span className="tabular-nums text-highlight">{webmDuration}s</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={webmDuration}
                disabled={busy}
                onChange={(e) => setWebmDuration(Number(e.target.value))}
                className="h-4 w-full cursor-ew-resize appearance-none bg-transparent"
              />

              <label className="flex items-center gap-2 text-control text-dim hover:text-base cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={preserveAudio}
                  disabled={busy}
                  onChange={(e) => setPreserveAudio(e.target.checked)}
                  className="rounded border-border accent-[#00ff66]"
                />
                <span>Preserve Audio Track</span>
              </label>

              <button
                type="button"
                disabled={!hasMedia || busy}
                onClick={() => void handleWebm()}
                className="h-7 bg-raised border border-[#00ff66]/50 px-2 text-center text-control text-highlight hover:bg-[#00ff66]/20 hover:border-[#00ff66] disabled:text-dim disabled:border-border disabled:pointer-events-none transition-colors font-semibold"
              >
                Record WebM Clip
              </button>
            </div>
          )}

          {/* GIF Options */}
          {clipMode === 'gif' && (
            <div className="flex flex-col gap-2">
              <label className="flex h-4 items-center justify-between text-control">
                <span>duration</span>
                <span className="tabular-nums text-highlight">{gifDuration}s</span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={gifDuration}
                disabled={busy}
                onChange={(e) => setGifDuration(Number(e.target.value))}
                className="h-4 w-full cursor-ew-resize appearance-none bg-transparent"
              />

              <div className="flex items-center justify-between text-[10px] text-dim">
                <span>resolution: max 480px</span>
                <span>rate: 10 fps</span>
              </div>

              <button
                type="button"
                disabled={!hasMedia || busy}
                onClick={() => void handleGif()}
                className="h-7 bg-raised border border-[#00ff66]/50 px-2 text-center text-control text-highlight hover:bg-[#00ff66]/20 hover:border-[#00ff66] disabled:text-dim disabled:border-border disabled:pointer-events-none transition-colors font-semibold"
              >
                Record Animated GIF
              </button>
            </div>
          )}

          {/* Recording & Progress Feedback with Inline Cancellation */}
          {isRecording && (
            <div className="flex flex-col gap-1.5 p-2 bg-secondary border border-border mt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-highlight truncate font-mono">
                  {progressMsg || 'Processing...'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelRecording}
                  className="px-2 py-0.5 text-[10px] font-semibold text-[#ff4444] border border-[#ff4444] hover:bg-[#ff4444]/20 transition-colors whitespace-nowrap"
                >
                  Cancel Recording
                </button>
              </div>
            </div>
          )}

          {/* High-Resolution Server-Side Video & GIF Export per D-01, D-02, D-05 */}
          <div className="flex flex-col gap-1 border-t border-border pt-2 mt-1">
            <span className="text-dim text-[10px] uppercase tracking-wider">Studio Engine Export</span>
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => {
                setServerFormat('mp4');
                setServerModalOpen(true);
              }}
              className="flex h-6 items-center justify-between bg-raised px-2 text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
            >
              <span>export MP4 (H.264 HD)</span>
              <span className="tabular-nums text-dim">1080p · Audio</span>
            </button>
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => {
                setServerFormat('gif');
                setServerModalOpen(true);
              }}
              className="flex h-6 items-center justify-between bg-raised px-2 text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
            >
              <span>export High-Res GIF</span>
              <span className="tabular-nums text-dim">720p · Two-Pass</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Indicator */}
      {toastMsg && (
        <div className="text-control text-highlight py-1 bg-active px-2 text-center border border-border">
          {toastMsg}
        </div>
      )}

      {/* Non-recording Progress Feedback */}
      {!isRecording && progressMsg && (
        <div className="text-control text-highlight py-1 bg-active px-2 text-center animate-pulse">
          {progressMsg}
        </div>
      )}

      {/* Server Export Modal per D-01, D-02, D-03, D-04, D-05 */}
      <ServerExportModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        defaultFormat={serverFormat}
      />
    </div>
  );
}
