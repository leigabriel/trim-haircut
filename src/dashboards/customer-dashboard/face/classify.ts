import type { FaceMeasurements } from './landmarks';
import { FACE_SHAPE_DEFINITIONS, FACE_SHAPES } from './shapes';
import type { FaceShapeName } from './shapes';

/**
 * Turns measurements into a shape.
 *
 * Each shape is scored by weighted squared distance from its prototype, and the
 * confidence is the winner's share of a softmax over all seven scores. A face
 * that sits genuinely between two shapes scores them nearly equal, so its
 * confidence falls on its own rather than being asserted.
 */

/**
 * Softmax sharpness. High enough that a textbook face resolves around 86% and a
 * distinctive one above 95%, low enough that an ambiguous face stays ambiguous.
 */
const SHARPNESS = 40;

/** Below this the reading is too close to call and the UI says so. */
export const AMBIGUOUS_CONFIDENCE = 60;

export interface ShapeScore {
  shape: FaceShapeName;
  score: number;
  /** 0-1 share of the total, summing to 1 across all seven. */
  probability: number;
}

export interface Classification {
  shape: FaceShapeName;
  /** Whole percent, 1-100. */
  confidence: number;
  scores: ShapeScore[];
  /** Closest runner-up, for "reads as Heart too" copy. Null only if unranked. */
  runnerUp: FaceShapeName | null;
  /** True when the top two are too close to call confidently. */
  isAmbiguous: boolean;
}

const scoreAgainst = (
  measurements: FaceMeasurements,
  shape: FaceShapeName,
): number => {
  const { prototype, weights } = FACE_SHAPE_DEFINITIONS[shape];

  return (
    weights.forehead * (measurements.foreheadRatio - prototype.forehead) ** 2 +
    weights.jaw * (measurements.jawRatio - prototype.jaw) ** 2 +
    weights.length * (measurements.lengthRatio - prototype.length) ** 2
  );
};

export const classifyFace = (measurements: FaceMeasurements): Classification => {
  const raw = FACE_SHAPES.map((shape) => ({
    shape,
    score: scoreAgainst(measurements, shape),
  })).sort((a, b) => a.score - b.score);

  // Subtracting the best keeps the exponentials in range; softmax is invariant
  // to the shift, and without it a distant face overflows to Infinity.
  const best = raw[0].score;
  const exponentials = raw.map((entry) => Math.exp(-(entry.score - best) * SHARPNESS));
  const total = exponentials.reduce((sum, value) => sum + value, 0);

  const scores: ShapeScore[] = raw.map((entry, index) => ({
    shape: entry.shape,
    score: entry.score,
    probability: exponentials[index] / total,
  }));

  const winner = scores[0];

  return {
    shape: winner.shape,
    confidence: Math.round(winner.probability * 100),
    scores,
    runnerUp: scores.length > 1 ? scores[1].shape : null,
    isAmbiguous: winner.probability * 100 < AMBIGUOUS_CONFIDENCE,
  };
};