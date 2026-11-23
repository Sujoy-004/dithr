import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExportDrawer from '../components/panels/ExportDrawer';
import { useStudioStore } from '../store/useStudioStore';
import * as videoExport from '../export/videoExport';

describe('ExportDrawer Component — Client-Side Clip & Export Capabilities', () => {
  beforeEach(() => {
    // Reset Zustand store state
    useStudioStore.setState({
      mediaType: null,
      mediaUrl: null,
      mediaName: null,
    });

    // Mount mock viewport canvas in document
    document.body.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Media viewport canvas');
    canvas.width = 640;
    canvas.height = 480;
    (canvas as any).captureStream = () => ({
      addTrack: vi.fn(),
      getVideoTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    });
    canvas.toBlob = (callback: any) => {
      callback(new Blob(['mock-png-data'], { type: 'image/png' }));
    };
    document.body.appendChild(canvas);
  });

  it('renders all four subtabs: image, text, vector, and clip', () => {
    render(<ExportDrawer />);
    expect(screen.getByRole('tab', { name: 'image' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'text' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'vector' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'clip' })).toBeInTheDocument();
  });

  it('automatically selects clip tab when video media is loaded', () => {
    useStudioStore.setState({ mediaType: 'video', mediaUrl: 'blob:video' });
    render(<ExportDrawer />);
    const clipTab = screen.getByRole('tab', { name: 'clip' });
    expect(clipTab).toHaveAttribute('aria-selected', 'true');
  });

  it('provides both in-browser client recording and studio engine cloud export under clip tab', () => {
    useStudioStore.setState({ mediaType: 'video', mediaUrl: 'blob:video' });
    render(<ExportDrawer />);

    // In-browser recording triggers
    expect(screen.getByRole('button', { name: /record WebM clip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record client GIF/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Clip recording duration/i })).toBeInTheDocument();

    // Studio Engine export triggers
    expect(screen.getByRole('button', { name: /export MP4 \(H\.264 HD\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export High-Res GIF/i })).toBeInTheDocument();
  });

  it('triggers client-side WebM recording when record WebM clip is clicked', async () => {
    const recordSpy = vi.spyOn(videoExport, 'recordWebmClip').mockResolvedValue(
      new Blob(['test-webm'], { type: 'video/webm' })
    );

    useStudioStore.setState({
      mediaType: 'video',
      mediaUrl: 'blob:video',
      mediaName: 'test_video.mp4',
    });

    render(<ExportDrawer />);
    const recordBtn = screen.getByRole('button', { name: /record WebM clip/i });
    fireEvent.click(recordBtn);

    await waitFor(() => {
      expect(recordSpy).toHaveBeenCalledTimes(1);
    });

    const callArgs = recordSpy.mock.calls[0];
    expect(callArgs[3]).toContain('test_video-clip.webm');
  });

  it('allows changing clip duration before recording', () => {
    useStudioStore.setState({ mediaType: 'video', mediaUrl: 'blob:video' });
    render(<ExportDrawer />);

    const fiveSecBtn = screen.getByRole('button', { name: '5s' });
    fireEvent.click(fiveSecBtn);

    expect(screen.getByText(/5s · audio/i)).toBeInTheDocument();
  });
});
