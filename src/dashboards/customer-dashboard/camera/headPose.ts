import type { LandmarkPoint } from '../face/landmarks';
import { OneEuroFilter } from './oneEuro';
import type { Vec3 } from './vec';
import { add, cross, dot, len, mid, mul, norm, sub, v3 } from './vec';

/**
 * Head pose, read straight off the tracked landmarks.
 *
 * The facial transformation matrix would give a pose too, but its axis
 * conventions differ between MediaPipe builds and the docs do not pin them
 * down. Building the frame from landmarks instead means it is correct by
 * construction: the same points that sit on the face define the axes, so the
 * hair cannot disagree with the video about which way the head is turned.
 *
 * Working space is pixels. x runs right and y runs down (the canvas), z runs
 * away from the camera, scaled like x so the three axes are comparable.
 * Head-local space is the same handedness measured in face widths from the
 * midpoint between the cheekbones, so a hairstyle is described once and fits a
 * face at any distance.
 */

export const LM = {
  FOREHEAD_TOP: 10,
  CHIN: 152,
  CHEEK_LEFT: 234,
  CHEEK_RIGHT: 454,
  NOSE_TIP: 1,
  NOSE_BASE: 2,
  BROW_LEFT: 105,
  BROW_RIGHT: 334,
} as const;

export interface HeadFrame {
  /** Midpoint between the cheekbones, in working space. */
  origin: Vec3;
  /** Unit axes: right across the face, down from forehead to chin, and away from the camera. */
  ex: Vec3;
  ey: Vec3;
  ez: Vec3;
  /** Pixels per face width. Measured in 3D so it holds steady as the head turns. */
  scale: number;
}

/** A landmark in working space, or null when the mesh does not have it. */
export const workingPoint = (
  landmarks: LandmarkPoint[],
  index: number,
  width: number,
  height: number,
  zSign: number,
): Vec3 | null => {
  const point = landmarks[index];
  if (!point) return null;
  return { x: point.x * width, y: point.y * height, z: point.z * width * zSign };
};

export const estimateFrame = (
  landmarks: LandmarkPoint[],
  width: number,
  height: number,
  zSign: number,
): HeadFrame | null => {
  const left = workingPoint(landmarks, LM.CHEEK_LEFT, width, height, zSign);
  const right = workingPoint(landmarks, LM.CHEEK_RIGHT, width, height, zSign);
  const top = workingPoint(landmarks, LM.FOREHEAD_TOP, width, height, zSign);
  const chin = workingPoint(landmarks, LM.CHIN, width, height, zSign);
  if (!left || !right || !top || !chin) return null;

  const across = sub(right, left);
  const scale = len(across);
  if (scale < 1e-3) return null;
  const ex = mul(across, 1 / scale);

  // Forehead to chin is not exactly perpendicular to the cheekbone line (a
  // tilted head, a long chin), so take the part of it that is.
  const down = sub(chin, top);
  const ey = norm(sub(down, mul(ex, dot(down, ex))));
  if (len(ey) < 0.5) return null;

  return { origin: mid(left, right), ex, ey, ez: cross(ex, ey), scale };
};

/**
 * Which way landmark z runs, as +1 or -1 (0 when the frame cannot say).
 *
 * MediaPipe documents that smaller z is nearer the camera, but a sign error
 * here would turn the hair inside out, so it is checked against something the
 * face guarantees instead of trusted: the nose tip stands proud of the
 * cheekbone plane, towards the viewer, whatever way the head is turned.
 */
export const estimateZSign = (
  landmarks: LandmarkPoint[],
  width: number,
  height: number,
): 1 | -1 | 0 => {
  const frame = estimateFrame(landmarks, width, height, 1);
  const nose = workingPoint(landmarks, LM.NOSE_TIP, width, height, 1);
  if (!frame || !nose) return 0;

  const protrusion = dot(sub(nose, frame.origin), frame.ez) / frame.scale;
  if (Math.abs(protrusion) < 0.06) return 0;
  return protrusion < 0 ? 1 : -1;
};

/** Working space to head-local space (face widths). */
export const toLocal = (frame: HeadFrame, point: Vec3): Vec3 => {
  const d = sub(point, frame.origin);
  return {
    x: dot(d, frame.ex) / frame.scale,
    y: dot(d, frame.ey) / frame.scale,
    z: dot(d, frame.ez) / frame.scale,
  };
};

/** Head-local space to working space. */
export const toWorld = (frame: HeadFrame, local: Vec3): Vec3 =>
  add(
    frame.origin,
    mul(
      add(add(mul(frame.ex, local.x), mul(frame.ey, local.y)), mul(frame.ez, local.z)),
      frame.scale,
    ),
  );

/** Rotates a head-local direction into working space. No scale, no translation. */
export const rotateToWorld = (frame: HeadFrame, local: Vec3): Vec3 =>
  add(add(mul(frame.ex, local.x), mul(frame.ey, local.y)), mul(frame.ez, local.z));

/**
 * Smooths the frame over time with a One Euro filter per channel.
 *
 * The axes are filtered as raw components and then re-orthonormalised, which is
 * accurate for the small per-frame rotations a head makes and avoids the cost
 * and edge cases of quaternion filtering.
 */
export class FrameSmoother {
  private readonly origin = [0, 1, 2].map(() => new OneEuroFilter(1.4, 0.012));
  private readonly ex = [0, 1, 2].map(() => new OneEuroFilter(2, 1.5));
  private readonly ey = [0, 1, 2].map(() => new OneEuroFilter(2, 1.5));
  private readonly size = new OneEuroFilter(1.2, 0.01);

  update(frame: HeadFrame, timestampMs: number): HeadFrame {
    const pass = (filters: OneEuroFilter[], vector: Vec3): Vec3 =>
      v3(
        filters[0].filter(vector.x, timestampMs),
        filters[1].filter(vector.y, timestampMs),
        filters[2].filter(vector.z, timestampMs),
      );

    const origin = pass(this.origin, frame.origin);
    const ex = norm(pass(this.ex, frame.ex));
    const eyRaw = pass(this.ey, frame.ey);
    const ey = norm(sub(eyRaw, mul(ex, dot(eyRaw, ex))));
    const scale = this.size.filter(frame.scale, timestampMs);

    return { origin, ex, ey, ez: cross(ex, ey), scale };
  }

  reset(): void {
    [...this.origin, ...this.ex, ...this.ey, this.size].forEach((filter) => filter.reset());
  }
}
