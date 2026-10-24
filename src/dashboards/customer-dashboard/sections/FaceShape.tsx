import { useState } from 'react';

import { shapeAdvice } from '../face/advice';
import FaceScanner from '../face/FaceScanner';
import StyleRecommendations from '../face/StyleRecommendations';
import type { FaceProfileState } from '../face/useFaceProfile';
import type { FaceScanResult } from '../face/useFaceScanner';
import { faceShapeLabel } from '../face/shapes';
import SectionHead from '../../shell/SectionHead';

interface FaceShapeProps {
  profile: FaceProfileState;
  onAskTrimo: (prompt: string) => void;
}

/**
 * Percentages of cheekbone width, which is the reference every bar is read
 * against.
 *
 * The track runs past 100 so a forehead wider than the cheekbones still fits.
 * The reference tick sits at 100 rather than at the end of the track, so bar
 * lengths stay comparable across readings.
 */
const TRACK_MAX = 140;
const asPercent = (ratio: number) => Math.round(ratio * 100);
const asTrackPercent = (percent: number) => `${(percent / TRACK_MAX) * 100}%`;

const FaceShape: React.FC<FaceShapeProps> = ({
  profile,
  onAskTrimo,
}) => {
  const [scan, setScan] = useState<FaceScanResult | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const resolved = scan?.classification ?? null;
  const measurements = scan?.measurements ?? profile.profile?.measurements ?? null;
  const shape = resolved?.shape ?? profile.profile?.shape ?? null;

  /**
   * A scan is saved the moment it resolves, because the customer asked for the
   * reading and discarding it would be a worse default than a silent retry. A
   * failed write keeps the result on screen rather than throwing away a
   * measurement that took no effort to take.
   */
  const onResolved = async (result: FaceScanResult) => {
    setScan(result);
    setSaveFailed(false);

    const saved = await profile.saveScan(result.classification, result.measurements);
    if (!saved) setSaveFailed(true);
  };

  const bars = measurements
    ? [
        { label: 'Forehead width', value: asPercent(measurements.foreheadRatio) },
        { label: 'Cheekbone width', value: 100 },
        { label: 'Jaw width', value: asPercent(measurements.jawRatio) },
        { label: 'Face length', value: asPercent(measurements.lengthRatio) },
      ]
    : [];

  return (
    <>
      <SectionHead
        title="Faceshape Analyzer"
        lede="Measures your forehead, cheekbones and jaw against your face length, then reads a shape from the result. The image is processed on your device and never uploaded."
      />

      <FaceScanner onResolved={(result) => void onResolved(result)} />

      {saveFailed ? (
        <p className="trim-account__error" role="alert">
          Your reading is below but could not be saved. It will not follow you to
          Recommendation until it saves.
        </p>
      ) : null}

      {shape && resolved ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Result</h2>
          <p className="trim-result">
            <strong>{faceShapeLabel(shape)}</strong>
            <span className="trim-result__confidence">
              {resolved.confidence}% confidence
            </span>
          </p>

          {resolved.isAmbiguous ? (
            <p className="trim-card__text">
              That is close to the line between {faceShapeLabel(shape).toLowerCase()} and{' '}
              {resolved.runnerUp ? faceShapeLabel(resolved.runnerUp).toLowerCase() : 'another shape'},
              so treat it as a suggestion. Scanning again in better light usually
              settles it.
            </p>
          ) : (
            <p className="trim-card__text">
              A clear read. Forehead, cheekbone and jaw proportions all point the
              same way.
            </p>
          )}

          <button
            className="trim-scanner__secondary"
            type="button"
            onClick={() => onAskTrimo(shapeAdvice(shape).askTrimo)}
          >
            Ask Trimo about this
          </button>
        </div>
      ) : null}

      {measurements ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Landmarks</h2>

          <p className="trim-card__scale">
            Width as a percentage of your cheekbones
            <span className="trim-card__scale-mark" aria-hidden="true" />
          </p>

          <ul className="trim-landmarks">
            {bars.map((bar) => (
              <li className="trim-landmark" key={bar.label}>
                <div className="trim-landmark__head">
                  <span className="trim-landmark__label">{bar.label}</span>
                  <span className="trim-landmark__value">{bar.value}%</span>
                </div>

                <div className="trim-landmark__track">
                  <div className="trim-landmark__fill" style={{ width: asTrackPercent(bar.value) }} />
                  <span
                    className="trim-landmark__reference"
                    style={{ left: asTrackPercent(100) }}
                    aria-hidden="true"
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {shape ? (
        <div className="trim-card">
          <h2 className="trim-card__title">What it means</h2>
          <p className="trim-card__text">{shapeAdvice(shape).body}</p>

          <ul className="trim-findings">
            {shapeAdvice(shape).cuts.map((cut) => (
              <li className="trim-finding" key={cut.name}>
                <span className="trim-finding__head">
                  <span className="trim-finding__label">{cut.name}</span>
                </span>
                <span className="trim-finding__body">{cut.note}</span>
              </li>
            ))}
            <li className="trim-finding">
              <span className="trim-finding__head">
                <span className="trim-finding__label">Watch out for</span>
              </span>
              <span className="trim-finding__body">{shapeAdvice(shape).avoid}</span>
            </li>
          </ul>
        </div>
      ) : null}

      {shape ? (
        <StyleRecommendations shape={shape} limit={3} hideTrending />
      ) : null}
    </>
  );
};

export default FaceShape;