import { useState } from 'react';

import './CameraFilter.css';
import { HAIRCUTS } from './haircuts';
import type { HaircutId } from './haircuts';
import { useHairFilter } from './useHairFilter';
import type { Rgb } from './hairPaint';

interface HairColour {
  id: string;
  label: string;
  rgb: Rgb;
}

const COLOURS: HairColour[] = [
  { id: 'black', label: 'Black', rgb: { r: 24, g: 18, b: 16 } },
  { id: 'brown', label: 'Dark brown', rgb: { r: 43, g: 29, b: 20 } },
  { id: 'chestnut', label: 'Chestnut', rgb: { r: 92, g: 56, b: 34 } },
  { id: 'blonde', label: 'Blonde', rgb: { r: 168, g: 132, b: 78 } },
];

/**
 * The camera, the two cuts and the colour. Presentation only: the device and
 * the tracker live in useHairFilter, so unmounting this releases the camera.
 */
const CameraFilter: React.FC = () => {
  const [cutId, setCutId] = useState<HaircutId>('low-fade');
  const [colourId, setColourId] = useState(COLOURS[1].id);
  const [saveError, setSaveError] = useState<string | null>(null);

  const colour = COLOURS.find((entry) => entry.id === colourId) ?? COLOURS[1];
  const filter = useHairFilter(cutId, colour.rgb);
  const { status, guidance, error, videoRef, canvasRef } = filter;

  const isBusy = status === 'loading' || status === 'requesting-camera';
  const isLive = status === 'live';

  const save = async () => {
    setSaveError(null);
    const blob = await filter.capture();
    if (!blob) {
      setSaveError('Nothing to save yet. Start the camera first.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trim-${cutId}.png`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="trim-card">
      <div className="trim-cam__viewport">
        {/* The video is only the source: the canvas draws it mirrored with the
            hair on top, so what is shown and what is saved are the same image. */}
        <video ref={videoRef} className="trim-cam__source" playsInline muted autoPlay />
        <canvas
          ref={canvasRef}
          className="trim-cam__canvas"
          role="img"
          aria-label="Live camera preview with the haircut applied"
        />

        {!isLive ? (
          <div className="trim-cam__placeholder">
            <p className="trim-cam__placeholder-title">Camera</p>
            <p className="trim-cam__placeholder-body">
              Try a cut on your own head. The camera is used only while this
              screen is open, and the video never leaves your device.
            </p>
          </div>
        ) : null}

        {guidance ? (
          <p className="trim-cam__guidance" role="status">
            {guidance}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="trim-account__error" role="alert">
          {error}
        </p>
      ) : null}
      {saveError ? (
        <p className="trim-account__error" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="trim-cam__cuts" role="radiogroup" aria-label="Haircut">
        {HAIRCUTS.map((cut) => {
          const isCurrent = cut.id === cutId;
          return (
            <button
              key={cut.id}
              className={`trim-cam__cut${isCurrent ? ' trim-cam__cut--current' : ''}`}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              onClick={() => setCutId(cut.id)}
            >
              <span className="trim-cam__cut-audience">{cut.audience}</span>
              <span className="trim-cam__cut-label">{cut.label}</span>
              <span className="trim-cam__cut-blurb">{cut.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="trim-cam__colours" role="radiogroup" aria-label="Hair colour">
        {COLOURS.map((entry) => {
          const isCurrent = entry.id === colourId;
          return (
            <button
              key={entry.id}
              className={`trim-cam__swatch${isCurrent ? ' trim-cam__swatch--current' : ''}`}
              type="button"
              role="radio"
              aria-checked={isCurrent}
              aria-label={entry.label}
              title={entry.label}
              style={{ backgroundColor: `rgb(${entry.rgb.r} ${entry.rgb.g} ${entry.rgb.b})` }}
              onClick={() => setColourId(entry.id)}
            />
          );
        })}
      </div>

      <div className="trim-scanner__controls">
        {!isLive ? (
          <button
            className="trim-scanner__primary"
            type="button"
            disabled={isBusy}
            onClick={() => void filter.start()}
          >
            {isBusy ? 'Starting…' : 'Start camera'}
          </button>
        ) : (
          <>
            <button className="trim-scanner__primary" type="button" onClick={() => void save()}>
              Save photo
            </button>
            <button className="trim-scanner__secondary" type="button" onClick={filter.stop}>
              Stop camera
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraFilter;
