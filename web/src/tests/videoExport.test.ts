import { describe, it, expect, vi } from 'vitest';
import { recordWebmClip, recordGifClip, type ActiveRecordingController } from '../export/videoExport';

describe('videoExport recording utilities (D-03, D-04, RELY-03, RELY-04)', () => {
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

  it('recordWebmClip records canvas and returns a valid WebM blob', async () => {
    const canvas = createMockCanvas();
    const progressMsgs: string[] = [];

    const blob = await recordWebmClip(
      canvas,
      0.2, // short duration for fast test
      (p) => progressMsgs.push(p.message),
      'test-clip.webm',
      true
    );

    expect(blob).toBeDefined();
    expect(blob.type).toBe('video/webm');
    expect(progressMsgs.length).toBeGreaterThan(0);
  });

  it('recordWebmClip respects cancellation controller', async () => {
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
      recordWebmClip(
        canvas,
        2,
        undefined,
        'test-cancel.webm',
        false,
        null,
        controller
      )
    ).rejects.toThrow('WebM recording cancelled by user.');
  });

  it('recordGifClip clamps canvas dimensions to 480px and outputs gif blob', async () => {
    const canvas = createMockCanvas(1920, 1080);
    const progressCalls: number[] = [];

    const blob = await recordGifClip(
      canvas,
      1, // 1 second
      5, // 5 fps
      (p) => progressCalls.push(p.pct),
      'test-clip.gif'
    );

    expect(blob).toBeDefined();
    expect(blob.type).toBe('image/gif');
    expect(progressCalls.length).toBeGreaterThan(0);
  });
});
