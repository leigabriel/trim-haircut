import { RESOLVE_AFTER } from './config';

/**
 * The scan's progress and resolve decision, in one place.
 *
 * Both must be driven by the same counter. They were not: the bar counted good
 * frames while the resolve condition read the averager's retained sample count,
 * which saturates at its window. The bar filled and the scan never completed.
 */

/** 0-1 through the sampling window. Clamped, since more frames can arrive. */
export const scanProgress = (goodFrames: number): number =>
  Math.min(1, Math.max(0, goodFrames / RESOLVE_AFTER));

/** Whether enough good frames have been seen to commit to a reading. */
export const shouldResolve = (goodFrames: number): boolean =>
  goodFrames >= RESOLVE_AFTER;