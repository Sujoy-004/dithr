import { downloadBlob } from './download';
import {
  getAudioStreamTrack,
  getOrCreateAudioGraph,
  resumeAudioContext,
} from './audioGraph';
import { getActiveStream, getRegisteredVideo } from '../store/useStudioStore';

export interface VideoRecordProgress {
  pct: number;
  message: string;
}

export interface ActiveRecordingController {
  cancel: () => void;
  isCancelled: boolean;
}

/**
 * Negotiate optimal supported WebM container mime type per D-03.
 */
function negotiateWebmMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

/**
 * Records a short WebM video clip directly from canvas with audio track multiplexing per D-03 and RELY-03.
 */
export async function recordWebmClip(
  canvas: HTMLCanvasElement,
  durationSeconds = 3,
  onProgress?: (progress: VideoRecordProgress) => void,
  filename?: string,
  includeAudio = true,
  videoEl?: HTMLVideoElement | null,
  cancelController?: ActiveRecordingController
): Promise<Blob> {
  // 1. Resume AudioContext within user interaction gesture for browser autoplay compliance
  if (includeAudio) {
    await resumeAudioContext();
  }

  // 2. Obtain canvas video stream
  const stream = canvas.captureStream(30);

  // 3. Audio track acquisition and cloning per D-03 & RELY-03
  let clonedVideoAudioTrack: MediaStreamTrack | null = null;
  let clonedCamAudioTrack: MediaStreamTrack | null = null;

  if (includeAudio) {
    const targetVideo = videoEl ?? getRegisteredVideo();
    if (targetVideo) {
      try {
        getOrCreateAudioGraph(targetVideo);
        const audioTrack = getAudioStreamTrack();
        if (audioTrack && audioTrack.readyState === 'live') {
          clonedVideoAudioTrack = audioTrack.clone();
          stream.addTrack(clonedVideoAudioTrack);
        }
      } catch (err) {
        console.warn('[recordWebmClip] Could not attach video audio track:', err);
      }
    }

    const camStream = getActiveStream();
    if (camStream) {
      const camTracks = camStream.getAudioTracks();
      if (camTracks.length > 0 && camTracks[0].readyState === 'live') {
        clonedCamAudioTrack = camTracks[0].clone();
        stream.addTrack(clonedCamAudioTrack);
      }
    }
  }

  const cleanupClonedTracks = () => {
    if (clonedVideoAudioTrack) {
      try {
        clonedVideoAudioTrack.stop();
      } catch {
        // ignore
      }
      clonedVideoAudioTrack = null;
    }
    if (clonedCamAudioTrack) {
      try {
        clonedCamAudioTrack.stop();
      } catch {
        // ignore
      }
      clonedCamAudioTrack = null;
    }
  };

  // 4. Codec negotiation
  const mimeType = negotiateWebmMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    let timer: number | null = null;

    const stopRecording = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      cleanupClonedTracks();
    };

    if (cancelController) {
      cancelController.cancel = () => {
        cancelController.isCancelled = true;
        stopRecording();
        reject(new Error('WebM recording cancelled by user.'));
      };
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      cleanupClonedTracks();
      if (cancelController?.isCancelled) {
        return;
      }
      const blob = new Blob(chunks, { type: 'video/webm' });
      const outName = filename ?? `retro-clip-${Date.now()}.webm`;
      downloadBlob(blob, outName);
      if (onProgress) onProgress({ pct: 100, message: 'Done' });
      resolve(blob);
    };

    recorder.onerror = (e) => {
      cleanupClonedTracks();
      reject(e);
    };

    recorder.start(100);
    const start = performance.now();
    const intervalMs = 100;

    timer = window.setInterval(() => {
      if (cancelController?.isCancelled) {
        stopRecording();
        return;
      }
      const elapsed = (performance.now() - start) / 1000;
      const pct = Math.min(Math.round((elapsed / durationSeconds) * 100), 99);
      if (onProgress) onProgress({ pct, message: `Recording WebM Clip... ${pct}%` });

      if (elapsed >= durationSeconds) {
        stopRecording();
      }
    }, intervalMs);
  });
}

/**
 * Records an animated GIF client-side offloaded to a Web Worker per D-04 and RELY-04.
 * Clamps maximum dimension to 480px to prevent browser memory exhaustion.
 */
export async function recordGifClip(
  canvas: HTMLCanvasElement,
  durationSeconds = 2,
  fps = 10,
  onProgress?: (progress: VideoRecordProgress) => void,
  filename?: string,
  cancelController?: ActiveRecordingController
): Promise<Blob> {
  const safeDuration = Math.min(Math.max(durationSeconds, 1), 5); // 1..5 seconds max
  const totalFrames = Math.round(safeDuration * fps);
  const frameIntervalMs = 1000 / fps;

  // Clamp output dimensions to max 480px on the longest edge per D-04
  const maxEdge = 480;
  let resizeWidth = canvas.width;
  let resizeHeight = canvas.height;
  if (resizeWidth > maxEdge || resizeHeight > maxEdge) {
    if (resizeWidth >= resizeHeight) {
      resizeHeight = Math.round((resizeHeight * maxEdge) / resizeWidth);
      resizeWidth = maxEdge;
    } else {
      resizeWidth = Math.round((resizeWidth * maxEdge) / resizeHeight);
      resizeHeight = maxEdge;
    }
  }

  // Spawn dedicated Vite Web Worker
  const worker = new Worker(new URL('./gif.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.postMessage({
    type: 'INIT',
    width: resizeWidth,
    height: resizeHeight,
    fps,
  });

  let isTerminated = false;
  const terminateWorker = () => {
    if (!isTerminated) {
      isTerminated = true;
      try {
        worker.postMessage({ type: 'CANCEL' });
        worker.terminate();
      } catch {
        // ignore
      }
    }
  };

  if (cancelController) {
    cancelController.cancel = () => {
      cancelController.isCancelled = true;
      terminateWorker();
    };
  }

  return new Promise(async (resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;

      if (data.type === 'PROGRESS') {
        const workerPct = Math.round(data.pct);
        if (onProgress) {
          onProgress({
            pct: workerPct,
            message: `Worker encoding GIF... ${workerPct}% (Quantizing 256 colors...)`,
          });
        }
      } else if (data.type === 'COMPLETE') {
        const blob = new Blob([data.buffer], { type: 'image/gif' });
        const outName = filename ?? `retro-clip-${Date.now()}.gif`;
        downloadBlob(blob, outName);
        terminateWorker();
        if (onProgress) onProgress({ pct: 100, message: 'Done' });
        resolve(blob);
      }
    };

    worker.onerror = (err) => {
      terminateWorker();
      reject(err);
    };

    try {
      // Sample distinct animation frames synchronized to render ticks
      for (let f = 0; f < totalFrames; f++) {
        if (cancelController?.isCancelled) {
          terminateWorker();
          reject(new Error('GIF recording cancelled by user.'));
          return;
        }

        // Wait for next animation frame for render-synchronized sampling
        await new Promise<void>((r) => {
          requestAnimationFrame(() => r());
        });

        const bitmap = await createImageBitmap(canvas, {
          resizeWidth,
          resizeHeight,
        });

        worker.postMessage(
          {
            type: 'FRAME',
            bitmap,
            frameIndex: f,
            totalFrames,
          },
          [bitmap]
        );

        const samplePct = Math.round(((f + 1) / totalFrames) * 100);
        if (onProgress) {
          onProgress({
            pct: Math.round(samplePct * 0.5),
            message: `Sampling frames... ${samplePct}% (${f + 1}/${totalFrames} distinct ticks)`,
          });
        }

        await new Promise((r) => setTimeout(r, frameIntervalMs));
      }

      // Signal worker that all frames have been sent
      worker.postMessage({ type: 'FINISH' });
    } catch (err) {
      terminateWorker();
      reject(err);
    }
  });
}
