import { useState, useEffect } from 'react';
import { Boxes, Download, FileImage, FileText, Film } from 'lucide-react';
import { getActivePipeline, useStudioStore } from '../../store/useStudioStore';
import { TIER_CONFIGS } from '../../engine/capabilities';
import { exportRasterImage } from '../../export/imageExport';
import { exportAsciiText } from '../../export/textExport';
import { exportAsciiSvg } from '../../export/svgExport';
import { exportThreeJsHtml } from '../../export/threejsExport';
import ServerExportModal from '../modals/ServerExportModal';
import ParameterSlider from '../ui/ParameterSlider';

type ExportTab = 'image' | 'vector' | 'clip' | '3d';

/**
 * Grainrad-style Export section: grouped format cards, on-device raster and
 * vector exports, server MP4/GIF transcoding, and a standalone Three.js viewer.
 * Discloses format, size/tier ceiling, and duration limits upfront and confirms
 * completion with verb-matched toasts ("Export PNG" -> "Exported PNG").
 */
export default function ExportDrawer() {
  const mediaType = useStudioStore((s) => s.mediaType);
  const mediaUrl = useStudioStore((s) => s.mediaUrl);
  const ascii = useStudioStore((s) => s.ascii);
  const dimensions = useStudioStore((s) => s.dimensions);
  const activeTier = useStudioStore((s) => s.activeTier);

  const [activeTab, setActiveTab] = useState<ExportTab>('image');

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
      getActivePipeline()?.render(useStudioStore.getState().playbackTime || 0);
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

  const handleThreeJs = async () => {
    setBusy(true);
    setProgressMsg('Exporting Three.js viewer...');
    try {
      const src = await getSourceElement();
      exportThreeJsHtml(src, {
        cols: Math.min(160, Math.max(32, cols)),
        rampPreset: ascii.rampPreset,
        customChars: ascii.customChars,
      });
      showToast('Exported Three.js .html');
    } catch (err) {
      console.error(err);
      showToast('Failed to export Three.js viewer.');
    } finally {
      setBusy(false);
      setProgressMsg('');
    }
  };

  const TABS: { id: ExportTab; label: string; Icon: typeof FileImage }[] = [
    { id: 'image', label: 'image', Icon: FileImage },
    { id: 'vector', label: 'vector', Icon: FileText },
    { id: 'clip', label: 'clip', Icon: Film },
    { id: '3d', label: '3d', Icon: Boxes },
  ];

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-3">
      <div
        className="grid grid-cols-4 gap-1 text-control"
        role="tablist"
        aria-label="Export format tabs"
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={`flex h-8 items-center justify-center gap-1 border text-center transition-colors ${
              activeTab === id
                ? 'border-highlight bg-active font-semibold text-max'
                : 'border-hairline bg-raised text-dim hover:text-highlight'
            }`}
          >
            <Icon size={11} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'image' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-dim">
            On-device snapshot ({outputSizeLabel}) directly from the GPU canvas.
          </p>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => void handleRaster('png')}
              className="flex h-14 flex-col items-start justify-between border border-hairline bg-raised px-2.5 py-2 text-left text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
            >
              <span className="font-medium">Export PNG</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">lossless</span>
            </button>
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => void handleRaster('jpeg')}
              className="flex h-14 flex-col items-start justify-between border border-hairline bg-raised px-2.5 py-2 text-left text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
            >
              <span className="font-medium">Export JPEG</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">95% quality</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'vector' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-dim">
            Scalable glyph grid ({cols} columns, {svgMode}).
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
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => void handleSvg()}
              className="flex h-14 flex-col items-start justify-between border border-hairline bg-raised px-2.5 py-2 text-left text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
            >
              <span className="font-medium">Export SVG</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">vector</span>
            </button>
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => void handleText()}
              className="flex h-14 flex-col items-start justify-between border border-hairline bg-raised px-2.5 py-2 text-left text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
            >
              <span className="font-medium">Export Text</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">.txt grid</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'clip' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-relaxed text-dim">
            Server export via FastAPI + FFmpeg. GIF client cap is 1 to 5 s; server allows up to
            15 s GIF or 60 s MP4.
          </p>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => {
                setServerFormat('mp4');
                setServerModalOpen(true);
              }}
              className="flex h-14 flex-col items-start justify-between border border-hairline bg-raised px-2.5 py-2 text-left text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
            >
              <span className="font-medium">Export MP4</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">1080p / 60s</span>
            </button>
            <button
              type="button"
              disabled={!hasMedia || busy}
              onClick={() => {
                setServerFormat('gif');
                setServerModalOpen(true);
              }}
              className="flex h-14 flex-col items-start justify-between border border-hairline bg-raised px-2.5 py-2 text-left text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
            >
              <span className="font-medium">Export GIF</span>
              <span className="text-[10px] uppercase tracking-wider text-dim">720p / 15s</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === '3d' && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] leading-relaxed text-dim">
            Samples the current frame into a glyph heightfield and downloads a standalone
            interactive Three.js viewer with orbit controls.
          </p>
          <ParameterSlider
            label="columns"
            value={cols}
            defaultValue={96}
            min={32}
            max={160}
            step={8}
            isInt
            format={(v) => `${Math.round(v)} cols`}
            onChange={setCols}
          />
          <button
            type="button"
            disabled={!hasMedia || busy}
            onClick={() => void handleThreeJs()}
            className="flex h-14 flex-col items-start justify-between border border-hairline bg-raised px-2.5 py-2 text-left text-control text-highlight hover:border-border-strong hover:bg-active disabled:pointer-events-none disabled:text-dim"
          >
            <span className="font-medium">Export Three.js .html</span>
            <span className="text-[10px] uppercase tracking-wider text-dim">
              standalone viewer
            </span>
          </button>
        </div>
      )}

      {!hasMedia && (
        <p className="text-[11px] text-dim">Load an image, video, or sample first to export.</p>
      )}

      {hasMedia && (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-dim">
          <Download size={10} aria-hidden />
          <span>on-device · local GPU</span>
        </div>
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
