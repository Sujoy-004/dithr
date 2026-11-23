import { useState, useEffect, useRef } from 'react';
import { useStudioStore, getRegisteredVideo } from '../../store/useStudioStore';
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
 * Provides triggers for PNG, JPEG, SVG, TXT, client-side WebM/GIF, and Studio Engine MP4/GIF exports.
 */
export default function ExportDrawer() {
  const mediaType = useStudioStore((s) => s.mediaType);
  const mediaUrl = useStudioStore((s) => s.mediaUrl);
  const mediaName = useStudioStore((s) => s.mediaName);
  const ascii = useStudioStore((s) => s.ascii);

  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'vector' | 'clip'>('image');

  // Automatically select the clip tab when video or webcam media is loaded
  useEffect(() => {
    if (mediaType === 'video' || mediaType === 'webcam') {
      setActiveTab('clip');
    }
  }, [mediaType]);

  const [cols, setCols] = useState(100);
  const [svgMode, setSvgMode] = useState<'truecolor' | 'monochrome'>('truecolor');

  // General busy & toast progress state
  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Client-side clip recording state
  const [clipDuration, setClipDuration] = useState<number>(3);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordProgressPct, setRecordProgressPct] = useState(0);
  const [recordProgressMsg, setRecordProgressMsg] = useState('');
  const recordingControllerRef = useRef<ActiveRecordingController | null>(null);

  // Server Export Modal state
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverFormat, setServerFormat] = useState<'mp4' | 'gif'>('mp4');

  const hasMedia = mediaType !== null;

  const getCanvas = (): HTMLCanvasElement | null => {
    return document.querySelector('canvas[aria-label="Media viewport canvas"]');
  };

  const getBaseFilename = (ext: string, suffix = 'dithr'): string => {
    if (mediaName) {
      const base = mediaName.replace(/\.[^/.]+$/, '');
      return `${base}-${suffix}.${ext}`;
    }
    return `dithr-export-${Date.now()}.${ext}`;
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
      const filename = getBaseFilename(format, 'render');
      await exportRasterImage(canvas, format, 0.95, filename);
      setToastMsg(`Downloaded ${filename}!`);
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
      const filename = getBaseFilename('txt', 'ascii');
      exportAsciiText(src, {
        cols,
        rampPreset: ascii.rampPreset,
        customChars: ascii.customChars,
        charAspect: ascii.charAspect,
        filename,
      });
      setToastMsg(`Downloaded ${filename}!`);
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
      const filename = getBaseFilename('svg', 'vector');
      exportAsciiSvg(src, {
        cols,
        colorMode: svgMode,
        rampPreset: ascii.rampPreset,
        customChars: ascii.customChars,
        charAspect: ascii.charAspect,
        filename,
      });
      setToastMsg(`Downloaded ${filename}!`);
    } catch (err) {
      console.error(err);
      setToastMsg('Export failed');
    } finally {
      setBusy(false);
      setProgressMsg('');
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleClientWebm = async () => {
    const canvas = getCanvas();
    if (!canvas) return;
    setRecordingBusy(true);
    setRecordProgressPct(0);
    setRecordProgressMsg('Starting WebM recording...');

    const controller: ActiveRecordingController = {
      cancel: () => {},
      isCancelled: false,
    };
    recordingControllerRef.current = controller;

    try {
      const filename = getBaseFilename('webm', 'clip');
      await recordWebmClip(
        canvas,
        clipDuration,
        (p) => {
          setRecordProgressPct(p.pct);
          setRecordProgressMsg(p.message);
        },
        filename,
        true,
        getRegisteredVideo(),
        controller,
      );
      setToastMsg(`Downloaded ${filename}!`);
    } catch (err: any) {
      if (!controller.isCancelled) {
        console.error(err);
        setToastMsg('WebM recording failed');
      }
    } finally {
      setRecordingBusy(false);
      setRecordProgressPct(0);
      setRecordProgressMsg('');
      recordingControllerRef.current = null;
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleClientGif = async () => {
    const canvas = getCanvas();
    if (!canvas) return;
    setRecordingBusy(true);
    setRecordProgressPct(0);
    setRecordProgressMsg('Recording frames for GIF...');

    const controller: ActiveRecordingController = {
      cancel: () => {},
      isCancelled: false,
    };
    recordingControllerRef.current = controller;

    try {
      const filename = getBaseFilename('gif', 'anim');
      await recordGifClip(
        canvas,
        Math.min(clipDuration, 5),
        10,
        (p) => {
          setRecordProgressPct(p.pct);
          setRecordProgressMsg(p.message);
        },
        filename,
        controller,
      );
      setToastMsg(`Downloaded ${filename}!`);
    } catch (err: any) {
      if (!controller.isCancelled) {
        console.error(err);
        setToastMsg('GIF generation failed');
      }
    } finally {
      setRecordingBusy(false);
      setRecordProgressPct(0);
      setRecordProgressMsg('');
      recordingControllerRef.current = null;
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const cancelRecording = () => {
    if (recordingControllerRef.current) {
      recordingControllerRef.current.cancel();
      setToastMsg('Recording cancelled');
    }
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
            disabled={!hasMedia || busy || recordingBusy}
            onClick={() => void handleRaster('png')}
            className="flex h-6 items-center justify-between bg-raised px-2 text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
          >
            <span>export PNG</span>
            <span className="tabular-nums text-dim">lossless</span>
          </button>
          <button
            type="button"
            disabled={!hasMedia || busy || recordingBusy}
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
            disabled={!hasMedia || busy || recordingBusy}
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
            disabled={!hasMedia || busy || recordingBusy}
            onClick={() => void handleSvg()}
            className="h-6 bg-raised px-2 text-left text-control text-highlight hover:bg-active disabled:text-dim disabled:pointer-events-none"
          >
            download vector .svg
          </button>
        </div>
      )}

      {activeTab === 'clip' && (
        <div className="flex flex-col gap-3">
          {/* Client-Side Quick Export */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-dim text-[10px] uppercase tracking-wider font-semibold">In-Browser Recording</span>
              <span className="text-dim text-[10px] tabular-nums">instant · zero queue</span>
            </div>

            {/* Duration Selector */}
            <div className="flex items-center justify-between text-control py-0.5">
              <span className="text-dim text-[11px]">duration</span>
              <div className="flex gap-1" role="group" aria-label="Clip recording duration">
                {([2, 3, 5, 10] as const).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setClipDuration(sec)}
                    disabled={recordingBusy}
                    className={`h-5 px-1.5 text-[10px] tabular-nums transition-colors ${
                      clipDuration === sec ? 'bg-active text-highlight font-semibold border border-hairline' : 'bg-raised text-dim hover:text-base'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>

            {/* Client-Side WebM button */}
            <button
              type="button"
              disabled={!hasMedia || busy || recordingBusy}
              onClick={() => void handleClientWebm()}
              className="flex h-7 items-center justify-between bg-raised px-2 text-control text-highlight border border-hairline hover:bg-active hover:border-[#a3a3a3] disabled:text-dim disabled:pointer-events-none transition-colors"
            >
              <span className="font-medium">record WebM clip</span>
              <span className="tabular-nums text-dim">{clipDuration}s · audio</span>
            </button>

            {/* Client-Side GIF button */}
            <button
              type="button"
              disabled={!hasMedia || busy || recordingBusy}
              onClick={() => void handleClientGif()}
              className="flex h-7 items-center justify-between bg-raised px-2 text-control text-highlight border border-hairline hover:bg-active hover:border-[#a3a3a3] disabled:text-dim disabled:pointer-events-none transition-colors"
            >
              <span className="font-medium">record client GIF</span>
              <span className="tabular-nums text-dim">worker · 480p</span>
            </button>

            {/* Active recording progress and cancel */}
            {recordingBusy && (
              <div className="flex flex-col gap-1 bg-active p-1.5 border border-border mt-1">
                <div className="flex items-center justify-between text-[11px] text-highlight">
                  <span className="truncate">{recordProgressMsg || 'Recording clip...'}</span>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="text-red-400 hover:text-red-300 text-[10px] uppercase font-semibold shrink-0 ml-2"
                  >
                    cancel
                  </button>
                </div>
                <div className="w-full bg-raised h-1.5 overflow-hidden border border-hairline">
                  <div
                    className="bg-highlight h-full transition-all duration-100"
                    style={{ width: `${recordProgressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-hairline" />

          {/* Studio Engine Export (Cloud) */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-dim text-[10px] uppercase tracking-wider font-semibold">Studio Engine Export</span>
              <span className="text-dim text-[10px] tabular-nums">cloud FFmpeg</span>
            </div>
            <button
              type="button"
              disabled={!hasMedia || busy || recordingBusy}
              onClick={() => {
                setServerFormat('mp4');
                setServerModalOpen(true);
              }}
              className="flex h-7 items-center justify-between bg-raised px-2 text-control text-highlight border border-hairline hover:bg-active hover:border-[#a3a3a3] disabled:text-dim disabled:pointer-events-none transition-colors"
            >
              <span className="font-medium">export MP4 (H.264 HD)</span>
              <span className="tabular-nums text-dim">1080p · Audio</span>
            </button>
            <button
              type="button"
              disabled={!hasMedia || busy || recordingBusy}
              onClick={() => {
                setServerFormat('gif');
                setServerModalOpen(true);
              }}
              className="flex h-7 items-center justify-between bg-raised px-2 text-control text-highlight border border-hairline hover:bg-active hover:border-[#a3a3a3] disabled:text-dim disabled:pointer-events-none transition-colors"
            >
              <span className="font-medium">export High-Res GIF</span>
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
      {progressMsg && (
        <div className="text-control text-highlight py-1 bg-active px-2 text-center animate-pulse">
          {progressMsg}
        </div>
      )}

      {/* Server Export Modal per D-01, D-02, D-03, D-04, D-05 */}
      <ServerExportModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        defaultFormat={serverFormat}
        onFallbackToClient={() => {
          setServerModalOpen(false);
          setActiveTab('clip');
        }}
      />
    </div>
  );
}
