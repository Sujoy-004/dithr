import { useEffect, useRef } from 'react';
import { Upload, Camera, Sparkles } from 'lucide-react';
import { useStudioStore, registerBrowseHandler } from '../../store/useStudioStore';

const ACCEPT_ALL = '.png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,image/*,video/*';
const ACCEPT_IMAGE = '.png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif,image/*';
const ACCEPT_VIDEO = '.mp4,.webm,video/mp4,video/webm,video/*';

/**
 * First-load empty state dropzone:
 * Clear plain-language instruction, accepted formats, camera option, and one-click sample loader.
 */
export default function Dropzone({ dragActive }: { dragActive: boolean }) {
  const loadMediaFile = useStudioStore((s) => s.loadMediaFile);
  const loadSampleImage = useStudioStore((s) => s.loadSampleImage);
  const startWebcam = useStudioStore((s) => s.startWebcam);
  const mediaType = useStudioStore((s) => s.mediaType);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const expectedTypeRef = useRef<'image' | 'video' | undefined>(undefined);

  useEffect(() => {
    registerBrowseHandler((filter?: 'image' | 'video') => {
      expectedTypeRef.current = filter;
      if (inputRef.current) {
        if (filter === 'image') {
          inputRef.current.accept = ACCEPT_IMAGE;
        } else if (filter === 'video') {
          inputRef.current.accept = ACCEPT_VIDEO;
        } else {
          inputRef.current.accept = ACCEPT_ALL;
        }
        inputRef.current.click();
      }
    });
    return () => registerBrowseHandler(null);
  }, []);

  const openPicker = () => {
    expectedTypeRef.current = undefined;
    if (inputRef.current) {
      inputRef.current.accept = ACCEPT_ALL;
      inputRef.current.click();
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ALL}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void loadMediaFile(file, expectedTypeRef.current);
          expectedTypeRef.current = undefined;
          e.target.value = '';
        }}
      />
      {!mediaType && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div
            className={`pointer-events-auto flex w-full max-w-md flex-col items-center gap-4 border p-6 text-center transition-colors sm:p-8 ${
              dragActive
                ? 'border-highlight bg-active'
                : 'border-dashed border-hairline bg-raised/90'
            }`}
          >
            <p className="text-sm font-semibold text-highlight sm:text-[16px]">
              Drop an image or video, or use the camera
            </p>
            <p className="text-control text-dim leading-relaxed">
              Accepts PNG, JPG, WebP, GIF, MP4, and WebM. All processing runs locally on your GPU.
            </p>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={openPicker}
                aria-label="Load media: drop a file or click to browse"
                className="inline-flex min-h-10 items-center justify-center gap-2 border border-highlight bg-highlight px-4 text-control font-semibold text-base hover:bg-max transition-colors"
              >
                <Upload size={14} strokeWidth={1.75} aria-hidden />
                <span>Choose file</span>
              </button>

              <button
                type="button"
                onClick={() => void startWebcam()}
                className="inline-flex min-h-10 items-center justify-center gap-2 border border-hairline bg-base px-4 text-control font-medium text-highlight hover:border-border-strong hover:bg-active transition-colors"
              >
                <Camera size={14} strokeWidth={1.75} aria-hidden />
                <span>Use camera</span>
              </button>

              <button
                type="button"
                onClick={() => void loadSampleImage()}
                className="inline-flex min-h-10 items-center justify-center gap-2 border border-hairline bg-base px-4 text-control font-medium text-highlight hover:border-border-strong hover:bg-active transition-colors"
              >
                <Sparkles size={14} strokeWidth={1.75} className="hidden" aria-hidden />
                <span>Load sample</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
