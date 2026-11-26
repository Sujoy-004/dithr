import { useState, useEffect } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { TIER_CONFIGS } from '../../engine/capabilities';
import { exportRasterImage } from '../../export/imageExport';
import { exportAsciiText } from '../../export/textExport';
import { exportAsciiSvg } from '../../export/svgExport';
import ServerExportModal from '../modals/ServerExportModal';
import ParameterSlider from '../ui/ParameterSlider';

/**
 * Tabbed Export Drawer panel.
 * Supports PNG, JPEG, TXT, SVG client exports and Server MP4/GIF transcoding.
 * Discloses format, size/tier ceiling, and duration limits upfront and confirms
 * completion with verb-matched toasts ("Export PNG" -> "Exported PNG").
 */
export default function ExportDrawer() {
  const mediaType = useStudioStore((s) => s.mediaType);
  const mediaUrl = useStudioStore((s) => s.mediaUrl);
  const ascii = useStudioStore((s) => s.ascii);
  const dimensions = useStudioStore((s) => s.dimensions);
  const activeTier = useStudioStore((s) => s.activeTier);

  const [activeTab, setActiveTab] = useState<'image' | 'text' | 'vector' | 'clip'>('image');

  useEffect(() => {
    if (mediaType === 'video' || mediaType === 'webcam') {
      setActiveTab('clip');
    }
  }, [mediaType]);

  const [cols, setCols] = useState(100);
  const [svgMode, setSvgMode] = useState<'truecolor' | 'monochrome'>('truecolor');

  const [busy, setBusy] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverFormat, setServerFormat] = useState<'mp4' | 'gif'>('mp4');

  const hasMedia = mediaType !== null;
  const maxDim = TIER_CONFIGS[activeTier]?.maxDimension || 1080;
  const outputSizeLabel = dimensions
    ? `${Math.min(dimensions.width, maxDim)}×${Math.min(dimensions.height, maxDim)} max`
    : `up to ${maxDim}px`;

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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(''), 3000);
  };

  const handleRaster = async (format: 'png' | 'jpeg') => {
    const canvas = getCanvas();
    if (!canvas) return;
    setBusy(true);
    setProgressMsg(`Exporting ${format.toUpperCase()}...`);
    try {
      await exportRasterImage(canvas, format);
      showToast(`Exported ${format.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      showToast(`Failed to export ${format.toUpperCase()}. Retry or switch tier.`);
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleText = async () => {
    setBusy(true);
    setProgressMsg('Exporting TXT...');
    try {
      const src = await getSourceElement();
      exportAsciiText(src, {
        cols,
        rampPreset: ascii.rampPreset,
        customChars: ascii.customChars,
        charAspect: ascii.charAspect,
      });
      showToast('Exported TXT');
    } catch (err) {
      console.error(err);
      showToast('Failed to export TXT.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const handleSvg = async () => {
    setBusy(true);
    setProgressMsg('Exporting SVG...');
    try {
      const src = await getSourceElement();
      exportAsciiSvg(src, {
        cols,
        colorMode: svgMode,
        rampPreset: ascii.rampPreset,
        customChars: ascii.customChars,
        charAspect: ascii.charAspect,
      });
      showToast('Exported SVG');
    } catch (err) {
      console.error(err);
      showToast('Failed to export SVG.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-3">
      <div
        className="grid grid-cols-4 gap-1 text-control"
        role="tablist"
        aria-label="Export format tabs"
      >
        {(['image', 'text', 'vector', 'clip'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`h-7 border text-center transition-colors ${
              activeTab === tab
                ? 'border-highlight bg-active font-semibold text-max'
                : 'border-hairline bg-raised text-dim hover:text-highlight'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'image' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-dim">
            On-device snapshot ({outputSizeLabel}) directly from GPU canvas.
          </p>
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleRaster('png')}
            className="flex h-8 items-center justify-between border border-hairline bg-raised px-2.5 text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
          >
            <span className="font-medium">Export PNG</span>
            <span className="tabular-nums text-dim">lossless</span>
          </button>
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleRaster('jpeg')}
            className="flex h-8 items-center justify-between border border-hairline bg-raised px-2.5 text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
          >
            <span className="font-medium">Export JPEG</span>
            <span className="tabular-nums text-dim">95% quality</span>
          </button>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-dim">
            Plain Rec. 601 ASCII grid (.txt), {cols} columns wide.
          </p>
          <ParameterSlider
            label="columns"
            value={cols}
            defaultValue={100}
            min={40}
            max={200}
            step={5}
            isInt
            format={(v) => `${Math.round(v)} cols`}
            onChange={setCols}
          />
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleText()}
            className="h-8 border border-hairline bg-raised px-2.5 text-left text-control font-medium text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
          >
            Export TXT
          </button>
        </div>
      )}

      {activeTab === 'vector' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-dim">
            Scalable SVG glyph grid ({cols} columns, {svgMode}).
          </p>
          <label className="flex h-7 items-center justify-between text-control text-default">
            <span>color mode</span>
            <select
              value={svgMode}
              onChange={(e) => setSvgMode(e.target.value as 'truecolor' | 'monochrome')}
              className="h-7 border border-hairline bg-raised px-2 text-control text-highlight hover:bg-active"
            >
              <option value="truecolor">truecolor</option>
              <option value="monochrome">monochrome</option>
            </select>
          </label>
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleSvg()}
            className="h-8 border border-hairline bg-raised px-2.5 text-left text-control font-medium text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
          >
            Export SVG
          </button>
        </div>
      )}

      {activeTab === 'clip' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-dim">
            Server export via FastAPI + FFmpeg. GIF client cap is 1 to 5 s; server allows up to 15 s GIF or 60 s MP4.
          </p>
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => {
              setServerFormat('mp4');
              setServerModalOpen(true);
            }}
            className="flex h-9 items-center justify-between gap-2 border border-hairline bg-raised px-2.5 text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
          >
            <span className="font-medium truncate">Export MP4 (H.264)</span>
            <span className="shrink-0 tabular-nums text-[11px] text-dim">1080p / 60s max</span>
          </button>
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => {
              setServerFormat('gif');
              setServerModalOpen(true);
            }}
            className="flex h-9 items-center justify-between gap-2 border border-hairline bg-raised px-2.5 text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
          >
            <span className="font-medium truncate">Export GIF</span>
            <span className="shrink-0 tabular-nums text-[11px] text-dim">720p / 15s max</span>
          </button>
        </div>
      )}

      {!hasMedia && (
        <p className="text-[11px] text-dim">Load an image, video, or sample first to export.</p>
      )}

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="border border-highlight bg-active px-2.5 py-1.5 text-center text-control font-medium text-max"
        >
          {toastMsg}
        </div>
      )}

      {progressMsg && (
        <div
          role="status"
          aria-live="polite"
          className="border border-hairline bg-raised px-2.5 py-1.5 text-center text-control text-highlight"
        >
          {progressMsg}
        </div>
      )}

      <ServerExportModal
        isOpen={serverModalOpen}
        onClose={() => setServerModalOpen(false)}
        defaultFormat={serverFormat}
      />
    </div>
  );
}
