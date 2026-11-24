import '@testing-library/jest-dom/vitest';
import 'vitest-canvas-mock';

// Browser API mocks for jsdom
if (typeof window !== 'undefined') {
  // Mock MediaRecorder
  (window as any).MediaRecorder = class MockMediaRecorder {
    state = 'inactive';
    ondataavailable: ((e: any) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((e: any) => void) | null = null;

    static isTypeSupported(type: string): boolean {
      return type.includes('webm') || type.includes('mp4');
    }

    options?: any;
    constructor(public stream?: any, options?: any) {
      this.options = options;
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      this.state = 'inactive';
      if (this.ondataavailable) {
        const mimeType = this.options?.mimeType?.split(';')[0] || 'video/mp4';
        this.ondataavailable({
          data: new Blob(['mock-chunk'], { type: mimeType }),
        });
      }
      if (this.onstop) {
        this.onstop();
      }
    }
  };

  // Mock AudioContext
  (window as any).AudioContext = class MockAudioContext {
    state = 'suspended';
    destination = {};
    resume() {
      this.state = 'running';
      return Promise.resolve();
    }
    createGain() {
      return {
        gain: { value: 1.0 },
        connect: () => {},
        disconnect: () => {},
      };
    }
    createAnalyser() {
      return {
        fftSize: 256,
        frequencyBinCount: 128,
        smoothingTimeConstant: 0.0,
        connect: () => {},
        disconnect: () => {},
        getByteFrequencyData: (arr: Uint8Array) => arr.fill(0),
      };
    }
    createMediaElementSource(_el?: any) {
      return { connect: () => {}, disconnect: () => {} };
    }
    createMediaStreamSource(_stream?: any) {
      return { connect: () => {}, disconnect: () => {} };
    }
    createMediaStreamDestination() {
      return {
        stream: {
          getAudioTracks: () => [
            {
              id: 'mock-audio-track',
              kind: 'audio',
              readyState: 'live',
              clone: function () {
                return { ...this, stop: () => {} };
              },
              stop: () => {},
            },
          ],
        },
      };
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  };

  // Mock navigator.gpu
  Object.defineProperty(navigator, 'gpu', {
    value: {
      requestAdapter: async () => ({
        limits: {
          maxTextureDimension2D: 8192,
        },
      }),
    },
    writable: true,
    configurable: true,
  });

  // Mock createImageBitmap
  if (typeof window.createImageBitmap === 'undefined') {
    (window as any).createImageBitmap = async () => ({
      width: 480,
      height: 360,
      close: () => {},
    });
  }

  // Mock Worker
  (window as any).Worker = class MockWorker {
    onmessage: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;

    postMessage(data: any) {
      if (data.type === 'FRAME') {
        if (this.onmessage) {
          this.onmessage({
            data: {
              type: 'PROGRESS',
              pct: Math.min(Math.round(((data.frameIndex + 1) / data.totalFrames) * 100), 100),
              frameIndex: data.frameIndex,
              totalFrames: data.totalFrames,
            },
          });
        }
      } else if (data.type === 'FINISH') {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({
              data: {
                type: 'COMPLETE',
                buffer: new Uint8Array([71, 73, 70, 56, 57, 97]).buffer, // GIF89a
              },
            });
          }
        }, 10);
      }
    }

    terminate() {}
  };
}
