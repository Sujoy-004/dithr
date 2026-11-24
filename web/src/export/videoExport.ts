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
 * Negotiate optimal supported video container and codec mime type.
 * Prioritizes native MP4 (AVC1 / H.264) for high-frequency shader fidelity,
 * falling back to WebM (VP9/VP8) on platforms without native MP4 MediaRecorder support.
 */
export function negotiateVideoMimeType(): { mimeType: string; isMp4: boolean } {
  const candidates = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return {
        mimeType: candidate,
        isMp4: candidate.startsWith('video/mp4'),
      };
    }
  }
  return { mimeType: '', isMp4: false };
}

/**
 * Records a crisp video clip directly from canvas with native MP4 negotiation,
 * 8 Mbps high bitrate (preserving high-frequency dither dots, halftone grids, and ASCII character edges),
 * and audio track multiplexing per HARDEN-VIDEO-EXPORT.
 */
export async function recordMp4Clip(
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

  // 2. Obtain canvas video stream at 30 fps
  const stream = canvas.captureStream(30);

  // 3. Audio track acquisition and cloning
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
        console.warn('[recordMp4Clip] Could not attach video audio track:', err);
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

  // 4. Codec negotiation & 8 Mbps high bitrate
  const { mimeType, isMp4 } = negotiateVideoMimeType();
  const recorderOptions: MediaRecorderOptions = {
    videoBitsPerSecond: 8_000_000, // 8 Mbps high bitrate to preserve high-frequency shader details
    audioBitsPerSecond: 128_000,
  };
  if (mimeType) {
    recorderOptions.mimeType = mimeType;
  }

  const recorder = new MediaRecorder(stream, recorderOptions);
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
        reject(new Error('MP4 recording cancelled by user.'));
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
      const outputMime = isMp4 ? 'video/mp4' : (mimeType || 'video/webm');
      const blob = new Blob(chunks, { type: outputMime });
      const defaultExt = isMp4 ? 'mp4' : 'webm';
      const outName = filename ?? `retro-clip-${Date.now()}.${defaultExt}`;
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
      if (onProgress) onProgress({ pct, message: `Recording MP4 Clip... ${pct}%` });

      if (elapsed >= durationSeconds) {
        stopRecording();
      }
    }, intervalMs);
  });
}

/**
 * Compatibility wrapper for recordWebmClip, delegating to recordMp4Clip.
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
  return recordMp4Clip(
    canvas,
    durationSeconds,
    onProgress,
    filename,
    includeAudio,
    videoEl,
    cancelController
  );
}
