import { useEffect, useRef } from 'react';

import './FaceScanner.css';
import { drawOverlay, useFaceScanner } from './useFaceScanner';
import type { UseFaceScannerOptions } from './useFaceScanner';

type FaceScannerProps = UseFaceScannerOptions;

/**
 * The camera. Owns nothing but presentation: every device resource lives in
 * useFaceScanner, so this component can unmount freely without leaking the
 * camera.
 */
const FaceScanner: React.FC<FaceScannerProps> = (options) => {
  const scanner = useFaceScanner(options);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { videoRef, status, overlay, guidance, progress, error, result } = scanner;

  // The canvas is sized from the video so the outline lands on the face
  // whatever the stream resolution turns out to be.
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const draw = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      if (overlay) {
        context.strokeStyle = '#0034ff';
        context.lineWidth = Math.max(2, width / 320);
        context.lineJoin = 'round';
        drawOverlay(context, overlay, width, height);
      } else {
        context.clearRect(0, 0, width, height);
      }
    };

    draw();
  }, [overlay, videoRef]);

  const isBusy = status === 'loading' || status === 'requesting-camera';
  const isLive = status === 'scanning' || status === 'sampling';

  return (
    <div className="trim-card">
      <div className="trim-scanner__viewport">
        {/* Mirrored for a selfie view. Safe here: every measurement is a
            left-right span, so mirroring flips which side is which without
            changing any width. */}
        <video
          ref={videoRef}
          className="trim-scanner__video"
          playsInline
          muted
          autoPlay
          aria-label="Camera preview"
        />
        <canvas ref={canvasRef} className="trim-scanner__overlay" aria-hidden="true" />

        {result?.preview ? (
          <img className="trim-scanner__still" src={result.preview} alt="" />
        ) : null}

        {!isLive && !result ? (
          <div className="trim-scanner__placeholder">
            <p className="trim-scanner__placeholder-title">Faceshape Analyzer</p>
            <p className="trim-scanner__placeholder-body">
              Your camera is used only while this screen is open. The image never
              leaves your device — only four measurements taken from it are saved.
            </p>
          </div>
        ) : null}

        {guidance ? (
          <p className="trim-scanner__guidance" role="status">
            {guidance}
          </p>
        ) : null}

        {isLive ? (
          <div className="trim-scanner__progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="trim-account__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="trim-scanner__controls">
        {status === 'idle' || status === 'error' ? (
          <>
            <button
              className="trim-scanner__primary"
              type="button"
              disabled={isBusy}
              onClick={() => void scanner.start()}
            >
              {isBusy ? 'Starting…' : 'Start camera'}
            </button>
            <button
              className="trim-scanner__secondary"
              type="button"
              onClick={() => fileRef.current?.click()}
            >
              Upload a photo
            </button>
          </>
        ) : null}

        {isLive ? (
          <button
            className="trim-scanner__secondary"
            type="button"
            onClick={scanner.stop}
          >
            Stop camera
          </button>
        ) : null}

        {status === 'resolved' ? (
          <button
            className="trim-scanner__secondary"
            type="button"
            onClick={scanner.restart}
          >
            Scan again
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        className="trim-scanner__file"
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void scanner.analyseImage(file);
          // Cleared so choosing the same file twice fires a change again.
          event.target.value = '';
        }}
      />
    </div>
  );
};

export default FaceScanner;