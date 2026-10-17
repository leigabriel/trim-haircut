/**
 * Reduces the MediaPipe face mesh to the four measurements the analyzer reads.
 *
 * Pure: takes landmark coordinates, returns numbers. No MediaPipe import, so it
 * can be tested against synthetic meshes.
 */

/** x, y and z in MediaPipe's normalized space; z is depth and unused here. */
export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Face oval indices, as published in FACE_LANDMARKS_FACE_OVAL. Used for the
 * camera overlay; the individual measurements below pull from the same set.
 */
export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
] as const;

/** Top centre of the forehead. The highest point of the oval. */
const FOREHEAD_TOP = 10;
/** Bottom centre of the chin. */
const CHIN = 152;
/** Widest point of the upper face, either side. */
const CHEEKBONE_LEFT = 234;
const CHEEKBONE_RIGHT = 454;
/** Jaw angle, either side. */
const JAW_LEFT = 172;
const JAW_RIGHT = 397;
/** Temple, either side, up at brow level. */
const TEMPLE_LEFT = 109;
const TEMPLE_RIGHT = 67;

/** Enough samples before a reading is treated as settled rather than noise. */
export const SETTLED_SAMPLES = 12;

export interface FaceMeasurements {
  /** Every width as a ratio of cheekbone width, so cheekbone is always 1. */
  foreheadRatio: number;
  jawRatio: number;
  lengthRatio: number;
}

const spanX = (landmarks: LandmarkPoint[], a: number, b: number): number => {
  const left = landmarks[a];
  const right = landmarks[b];
  if (!left || !right) return 0;
  return Math.abs(left.x - right.x);
};

/**
 * @param landmarks  The 478 points, or the first 468 on models without irises.
 * @param aspect     Image height divided by width.
 *
 * MediaPipe normalizes x across the image width and y across its height, so a
 * round face is an ellipse in normalized space. Width ratios are unaffected
 * because every width shares that scale and it cancels. Face length does not, so
 * it is corrected by the aspect ratio. Skipping this correction flatters long
 * faces on wide inputs and the wrong shape comes back.
 */
export const measureFace = (
  landmarks: LandmarkPoint[],
  aspect: number,
): FaceMeasurements | null => {
  const cheekbone = spanX(landmarks, CHEEKBONE_LEFT, CHEEKBONE_RIGHT);
  if (!(cheekbone > 0)) return null;

  const top = landmarks[FOREHEAD_TOP];
  const chin = landmarks[CHIN];
  if (!top || !chin) return null;

  return {
    foreheadRatio: spanX(landmarks, TEMPLE_LEFT, TEMPLE_RIGHT) / cheekbone,
    jawRatio: spanX(landmarks, JAW_LEFT, JAW_RIGHT) / cheekbone,
    lengthRatio: (Math.abs(top.y - chin.y) * aspect) / cheekbone,
  };
};

/**
 * Running mean over recent samples.
 *
 * A single frame jitters by a few percent as the customer shifts. Averaging
 * across consecutive frames settles the reading without the lag a heavier
 * smoothing window would add.
 */
export class MeasurementAverager {
  private readonly samples: FaceMeasurements[] = [];

  constructor(private readonly window = SETTLED_SAMPLES) {}

  add(measurements: FaceMeasurements): FaceMeasurements {
    this.samples.push(measurements);
    if (this.samples.length > this.window) this.samples.shift();

    const total = this.samples.reduce(
      (sum, sample) => ({
        foreheadRatio: sum.foreheadRatio + sample.foreheadRatio,
        jawRatio: sum.jawRatio + sample.jawRatio,
        lengthRatio: sum.lengthRatio + sample.lengthRatio,
      }),
      { foreheadRatio: 0, jawRatio: 0, lengthRatio: 0 },
    );

    const count = this.samples.length;
    return {
      foreheadRatio: total.foreheadRatio / count,
      jawRatio: total.jawRatio / count,
      lengthRatio: total.lengthRatio / count,
    };
  }

  get size(): number {
    return this.samples.length;
  }

  reset(): void {
    this.samples.length = 0;
  }
}