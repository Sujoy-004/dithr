// @ts-expect-error gifenc exports ESM from dist/gifenc.esm.js
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

let encoder: ReturnType<typeof GIFEncoder> | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let targetWidth = 0;
let targetHeight = 0;
let frameDelay = 100;

self.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  switch (data.type) {
    case 'INIT': {
      targetWidth = data.width;
      targetHeight = data.height;
      frameDelay = Math.round(1000 / (data.fps || 10));
      encoder = GIFEncoder();
      offscreenCanvas = new OffscreenCanvas(targetWidth, targetHeight);
      ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      break;
    }

    case 'FRAME': {
      if (!encoder || !offscreenCanvas || !ctx) return;
      const bitmap = data.bitmap as ImageBitmap;
      const frameIndex = data.frameIndex as number;
      const totalFrames = data.totalFrames as number;

      ctx.clearRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      bitmap.close();

      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
      const palette = quantize(imgData, 256);
      const index = applyPalette(imgData, palette);

      encoder.writeFrame(index, targetWidth, targetHeight, { palette, delay: frameDelay });

      const pct = Math.round(((frameIndex + 1) / totalFrames) * 100);
      self.postMessage({
        type: 'PROGRESS',
        pct,
        frameIndex: frameIndex + 1,
        totalFrames,
      });
      break;
    }

    case 'FINISH': {
      if (!encoder) return;
      encoder.finish();
      const bytes = encoder.bytesView();
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      (self as any).postMessage({ type: 'COMPLETE', buffer }, [buffer]);
      encoder = null;
      offscreenCanvas = null;
      ctx = null;
      break;
    }

    case 'CANCEL': {
      encoder = null;
      offscreenCanvas = null;
      ctx = null;
      break;
    }
  }
};
