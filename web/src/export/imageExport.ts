import { downloadBlob } from './download';
import { getActivePipeline } from '../store/useStudioStore';

/**
 * Exports the current canvas buffer as a high-resolution PNG or JPEG file (MEDIA-03).
 * Prefers pipeline.captureImageBlob() to read from WebGPU/WebGL render target avoiding
 * blank canvas readback issues, with graceful fallback to canvas.toBlob().
 */
export async function exportRasterImage(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpeg',
  quality = 0.95,
  filename?: string,
  exportWidth?: number,
  exportHeight?: number
): Promise<void> {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const outName = filename ?? `retro-fx-export-${Date.now()}.${format}`;

  const pipeline = getActivePipeline();
  if (pipeline) {
    try {
      const blob = await pipeline.captureImageBlob(format, quality, exportWidth, exportHeight);
      downloadBlob(blob, outName);
      return;
    } catch (err) {
      console.warn('Pipeline captureImageBlob failed, falling back to canvas.toBlob:', err);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create image blob from canvas'));
          return;
        }
        downloadBlob(blob, outName);
        resolve();
      },
      mimeType,
      quality
    );
  });
}
