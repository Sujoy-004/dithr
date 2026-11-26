import { useEffect, useRef, useState } from 'react';
import TurnstileWidget from '../ui/TurnstileWidget';
import { exportApi, ServerBusyApiError } from '../../services/exportApi';
import { startServerExport } from '../../export/serverExport';
import type { ActiveExportController } from '../../export/serverExport';
import { useStudioStore } from '../../store/useStudioStore';
import ParameterSlider from '../ui/ParameterSlider';

export interface ServerExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: 'mp4' | 'gif';
}

type EngineStatus = 'standby' | 'waking' | 'ready';
type ExportPhase = 'config' | 'exporting' | 'completed' | 'busy' | 'error';

const BACKOFF_DELAYS = [0, 3000, 7000, 13000, 21000, 31000, 45000, 60000];

function generateAsciiProgressBar(percent: number, width = 24): string {
  const p = Math.max(0, Math.min(1, percent));
  const completed = Math.round(p * width);
  const remaining = width - completed;
  const bar = '='.repeat(Math.max(0, completed - 1)) + (completed > 0 ? '>' : '') + '-'.repeat(remaining);
  return `[${bar.slice(0, width)}] ${Math.round(p * 100)}%`;
}

export default function ServerExportModal({
  isOpen,
  onClose,
  defaultFormat = 'mp4',
}: ServerExportModalProps) {
  const [format, setFormat] = useState<'mp4' | 'gif'>(defaultFormat);
  const [resolution, setResolution] = useState<'1080p' | '720p' | '480p'>('1080p');
  const [duration, setDuration] = useState(10);
  const [fps, setFps] = useState(30);
  const [includeAudio, setIncludeAudio] = useState(true);

  const [engineStatus, setEngineStatus] = useState<EngineStatus>('standby');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [phase, setPhase] = useState<ExportPhase>('config');
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3 | 4>(1);
  const [stageProgress, setStageProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyCountdown, setBusyCountdown] = useState(30);
  const [expireCountdown, setExpireCountdown] = useState(600);
  const [isCanceling, setIsCanceling] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [telemetry, setTelemetry] = useState<{ fps?: number; speed?: string; bytesUploaded?: number }>({});
  const controllerRef = useRef<ActiveExportController | null>(null);
  const isMountedRef = useRef(true);

  const mediaDuration = useStudioStore((s) => s.duration);
  const mediaType = useStudioStore((s) => s.mediaType);

  useEffect(() => {
    setFormat(defaultFormat);
    const initialDur =
      mediaType === 'video' && mediaDuration > 0
        ? Math.min(defaultFormat === 'gif' ? 15 : 60, Math.max(1, Math.round(mediaDuration)))
        : defaultFormat === 'gif'
        ? 5
        : 10;
    setDuration(initialDur);
    if (defaultFormat === 'gif') {
      setResolution('720p');
      setFps(12);
    } else {
      setResolution('1080p');
      setFps(30);
    }
  }, [defaultFormat, mediaDuration, mediaType]);

  useEffect(() => {
    if (!isOpen) {
      setEngineStatus('standby');
      return;
    }

    isMountedRef.current = true;
    let attempt = 0;
    let timerId: number | null = null;

    const ping = async () => {
      if (!isMountedRef.current) return;
      setEngineStatus('waking');
      try {
        await exportApi.pingHealth();
        if (isMountedRef.current) {
          setEngineStatus('ready');
        }
      } catch {
        if (!isMountedRef.current) return;
        attempt++;
        if (attempt < BACKOFF_DELAYS.length) {
          timerId = window.setTimeout(ping, BACKOFF_DELAYS[attempt]);
        } else {
          setEngineStatus('standby');
        }
      }
    };

    ping();

    return () => {
      isMountedRef.current = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (phase !== 'completed') return;
    setExpireCountdown(600);
    const interval = window.setInterval(() => {
      setExpireCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'exporting') {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, phase]);

  if (!isOpen) return null;

  const handleStartExport = () => {
    setPhase('exporting');
    setCurrentStage(1);
    setStageProgress(0);
    setErrorMessage(null);
    setStatusMessage('Initiating export pipeline...');

    const ctrl = startServerExport({
      format,
      targetResolution: resolution,
      targetFps: fps,
      durationSec: duration,
      turnstileToken,
      includeAudio: format === 'mp4' && includeAudio,
      onProgress: (stage, pct, details) => {
        setCurrentStage(stage);
        setStageProgress(pct);
        if (details) {
          setTelemetry((prev) => ({ ...prev, ...details }));
        }
      },
      onStatusChange: (text) => setStatusMessage(text),
      onComplete: (url) => {
        setDownloadUrl(url);
        setPhase('completed');
        setStatusMessage(`Exported ${format.toUpperCase()}.`);
      },
      onError: (err) => {
        if (err instanceof ServerBusyApiError) {
          setPhase('busy');
          setBusyCountdown(err.retryAfter);
          const interval = window.setInterval(() => {
            setBusyCountdown((prev) => {
              if (prev <= 1) {
                window.clearInterval(interval);
                setPhase('config');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          setPhase('error');
          setErrorMessage(err.message || 'Export failed unexpectedly.');
        }
      },
    });

    controllerRef.current = ctrl;
  };

  const handleCancel = async () => {
    if (phase === 'exporting' && controllerRef.current) {
      setIsCanceling(true);
      setStatusMessage('Stopping FFmpeg subprocess and clearing job storage...');
      try {
        await controllerRef.current.cancel();
      } finally {
        controllerRef.current = null;
        setIsCanceling(false);
        setToastMessage('Canceled export job and purged temporary files.');
        setTimeout(() => {
          setPhase('config');
          setToastMessage(null);
          onClose();
        }, 1200);
      }
      return;
    }
    if (controllerRef.current) {
      await controllerRef.current.cancel();
      controllerRef.current = null;
    }
    setPhase('config');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-sm p-4 select-none overscroll-contain"
    >
      <div className="studio-glass flex w-full max-w-lg flex-col rounded-lg text-control">
        <div className="flex h-10 items-center justify-between border-b border-hairline px-4">
          <div className="flex items-center gap-2">
            <span id="export-modal-title" className="font-bold text-highlight">
              Server Export Service
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-dim">
              {engineStatus === 'ready'
                ? 'Engine: Ready'
                : engineStatus === 'waking'
                ? 'Engine: Waking'
                : 'Engine: Standby'}
            </span>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Close export modal"
              className="flex h-7 w-7 items-center justify-center border border-hairline text-dim hover:text-highlight"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 text-xs">
          {phase === 'config' && (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-dim">Format and pipeline</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormat('mp4');
                      setResolution('1080p');
                      setFps(30);
                      setDuration(10);
                    }}
                    className={`border p-2.5 text-left transition-colors ${
                      format === 'mp4'
                        ? 'border-highlight bg-active text-max'
                        : 'border-hairline bg-raised text-dim hover:text-highlight'
                    }`}
                  >
                    <div className="font-semibold">MP4 Video (H.264)</div>
                    <div className="mt-0.5 text-[11px] opacity-80">Up to 1080p, 60 s max, synced audio</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormat('gif');
                      setResolution('720p');
                      setFps(12);
                      setDuration(5);
                    }}
                    className={`border p-2.5 text-left transition-colors ${
                      format === 'gif'
                        ? 'border-highlight bg-active text-max'
                        : 'border-hairline bg-raised text-dim hover:text-highlight'
                    }`}
                  >
                    <div className="font-semibold">Animated GIF</div>
                    <div className="mt-0.5 text-[11px] opacity-80">Up to 720p, 15 s max, two-pass palette</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-dim">Resolution</span>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as '1080p' | '720p' | '480p')}
                    className="h-8 border border-hairline bg-raised px-2 text-highlight"
                  >
                    {format === 'mp4' && <option value="1080p">1080p (1920x1080)</option>}
                    <option value="720p">720p (1280x720)</option>
                    <option value="480p">480p (854x480)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-dim">Framerate</span>
                  <select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="h-8 border border-hairline bg-raised px-2 text-highlight"
                  >
                    {format === 'mp4' ? (
                      <>
                        <option value={30}>30 FPS</option>
                        <option value={60}>60 FPS</option>
                        <option value={24}>24 FPS</option>
                      </>
                    ) : (
                      <>
                        <option value={12}>12 FPS</option>
                        <option value={15}>15 FPS</option>
                        <option value={10}>10 FPS</option>
                      </>
                    )}
                  </select>
                </label>
              </div>

              <ParameterSlider
                label="duration"
                value={duration}
                defaultValue={format === 'gif' ? 5 : 10}
                min={1}
                max={format === 'gif' ? 15 : 60}
                step={1}
                isInt
                format={(v) => `${Math.round(v)} s`}
                onChange={setDuration}
              />

              {format === 'mp4' && (
                <label className="flex items-center gap-2 text-default cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                  />
                  <span>Preserve and synchronize source audio</span>
                </label>
              )}

              <TurnstileWidget
                onSuccess={(token) => setTurnstileToken(token)}
                onError={(err) => console.warn('[Turnstile]', err)}
              />

              <div className="mt-2 flex justify-end gap-2 border-t border-hairline pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 border border-hairline px-3 text-default hover:text-highlight"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStartExport}
                  className="h-8 border border-highlight bg-highlight px-4 font-semibold text-base hover:bg-max transition-colors"
                >
                  Start Export
                </button>
              </div>
            </>
          )}

          {phase === 'exporting' && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-highlight">
                  Stage {currentStage}/4:{' '}
                  {currentStage === 1
                    ? 'Capturing Canvas Frames'
                    : currentStage === 2
                    ? 'Uploading Stream Chunks'
                    : currentStage === 3
                    ? 'FFmpeg Server Transcoding'
                    : 'Packaging Media File'}
                </span>
                <span className="text-dim tabular-nums">{Math.round(stageProgress * 100)}%</span>
              </div>

              <div className="border border-hairline bg-base p-2 text-center font-mono text-sm font-bold text-highlight">
                {generateAsciiProgressBar(stageProgress)}
              </div>

              <div className="grid grid-cols-3 gap-2 border border-hairline bg-raised p-2 text-[11px]">
                <div>
                  <div className="text-dim">Format</div>
                  <div className="font-semibold text-highlight">
                    {format.toUpperCase()} ({resolution})
                  </div>
                </div>
                <div>
                  <div className="text-dim">Speed</div>
                  <div className="font-semibold text-highlight">{telemetry.speed || '1.0x'}</div>
                </div>
                <div>
                  <div className="text-dim">FPS</div>
                  <div className="font-semibold text-highlight">
                    {telemetry.fps ? telemetry.fps.toFixed(1) : `${fps}.0`}
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-dim">{statusMessage}</div>

              <div className="mt-2 flex justify-end border-t border-hairline pt-3">
                <button
                  type="button"
                  disabled={isCanceling}
                  onClick={handleCancel}
                  className="h-8 border border-hairline px-3 text-highlight hover:bg-active disabled:opacity-50"
                >
                  {isCanceling ? 'Canceling...' : 'Cancel Export Job'}
                </button>
              </div>
            </div>
          )}

          {phase === 'busy' && (
            <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
              <div className="text-highlight font-semibold text-sm">Export worker is busy</div>
              <p className="text-dim text-xs max-w-sm">
                Another media job is running on the single-worker export service. Retry in{' '}
                <span className="text-highlight font-semibold tabular-nums">{busyCountdown}s</span>.
              </p>
              <button
                type="button"
                onClick={() => setPhase('config')}
                className="h-8 border border-hairline px-3 text-highlight hover:bg-active"
              >
                Back to settings
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col gap-3 py-2">
              <div className="text-highlight font-semibold text-sm">Export failed</div>
              <div className="border border-hairline bg-base p-3 text-left">
                <p className="text-default text-xs">{errorMessage}</p>
                {errorMessage?.includes('Failed to fetch') && (
                  <p className="mt-2 border-t border-hairline pt-2 text-[11px] text-dim leading-relaxed">
                    The FastAPI export service is not reachable at localhost:8000. Start it with:
                    <code className="mt-1 block bg-raised px-2 py-1 font-mono text-highlight">
                      uvicorn src.api.main:app --port 8000
                    </code>
                    Or export PNG, JPEG, SVG, or TXT directly in the browser without a server.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPhase('config')}
                  className="h-8 border border-hairline px-3 text-highlight hover:bg-active"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 border border-hairline px-3 text-dim hover:text-highlight"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {phase === 'completed' && downloadUrl && (
            <div className="flex flex-col gap-3 py-2">
              <div className="font-semibold text-highlight">
                Exported {format.toUpperCase()}
              </div>
              <div className="flex flex-col gap-1.5 border border-hairline bg-base p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-dim">Format</span>
                  <span className="font-semibold text-highlight">
                    {format.toUpperCase()} ({resolution})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Duration</span>
                  <span className="font-semibold text-highlight">
                    {duration}s at {fps} fps
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">Expires in</span>
                  <span className="font-semibold tabular-nums text-highlight">
                    {Math.floor(expireCountdown / 60)}m {expireCountdown % 60}s
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-hairline pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 border border-hairline px-3 text-dim hover:text-highlight"
                >
                  Done
                </button>
                <a
                  href={downloadUrl}
                  download={`export_${format}.${format}`}
                  className="flex h-8 items-center border border-highlight bg-highlight px-4 font-semibold text-base hover:bg-max transition-colors"
                >
                  Download {format.toUpperCase()}
                </a>
              </div>
            </div>
          )}
        </div>
        {toastMessage && (
          <div className="border-t border-hairline bg-active p-2 text-center text-xs text-highlight">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
