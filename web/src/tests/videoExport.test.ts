import { describe, it, expect, vi } from 'vitest';
import {
  negotiateVideoMimeType,
  recordMp4Clip,
  recordWebmClip,
  type ActiveRecordingController,
} from '../export/videoExport';

describe('videoExport recording utilities (HARDEN-VIDEO-EXPORT, D-03, RELY-03)', () => {
  function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    (canvas as any).captureStream = () => ({
      addTrack: vi.fn(),
      getVideoTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    });
    return canvas;
  }

  it('negotiateVideoMimeType prioritizes mp4 codecs before webm', () => {
    const { mimeType, isMp4 } = negotiateVideoMimeType();
    expect(mimeType).toContain('mp4');
    expect(isMp4).toBe(true);
  });

  it('recordMp4Clip configures 8 Mbps high bitrate and returns valid MP4 blob', async () => {
    const canvas = createMockCanvas();
    const progressMsgs: string[] = [];

    // Spy on MediaRecorder constructor to verify bitrate configuration
    let capturedOptions: MediaRecorderOptions | undefined;
    const OriginalMediaRecorder = window.MediaRecorder;
    class SpiedMediaRecorder extends (OriginalMediaRecorder as any) {
      constructor(stream: any, options?: MediaRecorderOptions) {
        super(stream, options);
        capturedOptions = options;
      }
    }
    SpiedMediaRecorder.isTypeSupported = OriginalMediaRecorder.isTypeSupported;
    window.MediaRecorder = SpiedMediaRecorder as any;

    try {
      const blob = await recordMp4Clip(
        canvas,
        0.2, // short duration for fast test
        (p) => progressMsgs.push(p.message),
        'test-clip.mp4',
        true
      );

      expect(blob).toBeDefined();
      expect(blob.type).toBe('video/mp4');
      expect(progressMsgs.length).toBeGreaterThan(0);
      expect(capturedOptions).toBeDefined();
      expect(capturedOptions?.videoBitsPerSecond).toBe(8_000_000);
      expect(capturedOptions?.audioBitsPerSecond).toBe(128_000);
    } finally {
      window.MediaRecorder = OriginalMediaRecorder;
    }
  });

  it('recordMp4Clip respects cancellation controller and stops recording', async () => {
    const canvas = createMockCanvas();
    const controller: ActiveRecordingController = {
      cancel: () => {},
      isCancelled: false,
    };

    // Trigger cancel after starting
    setTimeout(() => {
      controller.cancel();
    }, 50);

    await expect(
      recordMp4Clip(
        canvas,
        2,
        undefined,
        'test-cancel.mp4',
        false,
        null,
        controller
      )
    ).rejects.toThrow('MP4 recording cancelled by user.');
  });

  it('recordWebmClip compatibility wrapper delegates to recordMp4Clip', async () => {
    const canvas = createMockCanvas();
    const blob = await recordWebmClip(
      canvas,
      0.1,
      undefined,
      'compat-clip.mp4',
      false
    );
    expect(blob).toBeDefined();
  });
});
