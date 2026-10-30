import { FACE_OVAL } from '../face/landmarks';
import type { LandmarkPoint } from '../face/landmarks';
import type { HeadFrame } from './headPose';
import { LM, toLocal, workingPoint } from './headPose';
import type { Vec3 } from './vec';
import { v3 } from './vec';

/**
 * What this particular face measures, in head-local units (face widths).
 *
 * A hairstyle drawn for an average head floats off a narrow forehead and
 * swallows a high one, so the cut is anchored to the person instead: the real
 * forehead top, brow line and nose base decide where the hairline, the ears and
 * the fade begin. Measured in head-local space, so the result is the same
 * whichever way the head was turned while it was taken.
 */
export interface HeadFit {
  /** The tracked face outline, in FACE_OVAL order. */
  oval: Vec3[];
  foreheadTop: Vec3;
  chinY: number;
  browY: number;
  noseBaseY: number;
  /** Ears sit between the brow line and the base of the nose. */
  earTopY: number;
  earBottomY: number;
}

/** Frames averaged before the fit is trusted. About a quarter of a second live. */
export const FIT_FRAMES = 8;

export class HeadFitter {
  private count = 0;
  private readonly oval: Vec3[] = FACE_OVAL.map(() => v3());
  private top = v3();
  private chinY = 0;
  private browY = 0;
  private noseBaseY = 0;

  /** Adds one frame. Returns false, and adds nothing, when a needed landmark is missing. */
  add(
    frame: HeadFrame,
    landmarks: LandmarkPoint[],
    width: number,
    height: number,
    zSign: number,
  ): boolean {
    const local = (index: number): Vec3 | null => {
      const point = workingPoint(landmarks, index, width, height, zSign);
      return point ? toLocal(frame, point) : null;
    };

    const ovalPoints = FACE_OVAL.map((index) => local(index));
    const top = local(LM.FOREHEAD_TOP);
    const chin = local(LM.CHIN);
    const browLeft = local(LM.BROW_LEFT);
    const browRight = local(LM.BROW_RIGHT);
    const noseBase = local(LM.NOSE_BASE);

    if (ovalPoints.some((point) => point === null)) return false;
    if (!top || !chin || !browLeft || !browRight || !noseBase) return false;

    ovalPoints.forEach((point, i) => {
      const sum = this.oval[i];
      sum.x += point!.x;
      sum.y += point!.y;
      sum.z += point!.z;
    });
    this.top = { x: this.top.x + top.x, y: this.top.y + top.y, z: this.top.z + top.z };
    this.chinY += chin.y;
    this.browY += (browLeft.y + browRight.y) / 2;
    this.noseBaseY += noseBase.y;
    this.count += 1;
    return true;
  }

  get isReady(): boolean {
    return this.count >= FIT_FRAMES;
  }

  result(): HeadFit | null {
    if (!this.isReady) return null;
    const n = this.count;
    const browY = this.browY / n;
    const noseBaseY = this.noseBaseY / n;

    return {
      oval: this.oval.map((sum) => v3(sum.x / n, sum.y / n, sum.z / n)),
      foreheadTop: v3(this.top.x / n, this.top.y / n, this.top.z / n),
      chinY: this.chinY / n,
      browY,
      noseBaseY,
      earTopY: browY + 0.02,
      earBottomY: noseBaseY + 0.03,
    };
  }

  reset(): void {
    this.count = 0;
    this.oval.forEach((sum) => {
      sum.x = 0;
      sum.y = 0;
      sum.z = 0;
    });
    this.top = v3();
    this.chinY = 0;
    this.browY = 0;
    this.noseBaseY = 0;
  }
}
