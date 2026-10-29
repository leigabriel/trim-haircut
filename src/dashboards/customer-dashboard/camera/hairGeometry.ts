import type { HeadFit } from './headFit';
import type { Vec3 } from './vec';
import { clamp, norm, v3 } from './vec';

/**
 * The shapes a haircut is built from, all in head-local units (face widths).
 *
 * A haircut is two things drawn together: a shell, which is the solid body of
 * the hair as a grid of quads, and strands, which are thin polylines laid over
 * it for texture, flyaways and a believable outline. The shell alone looks like
 * a helmet and strands alone look like straw.
 */

/** The cranium, as an ellipsoid. Hair is grown on it and the head is occluded by it. */
export interface Skull {
  center: Vec3;
  radii: Vec3;
}

/** A (cols + 1) x (rows + 1) grid of vertices over the hair surface. */
export interface Shell {
  cols: number;
  rows: number;
  positions: Float32Array;
  normals: Float32Array;
}

export interface Strands {
  count: number;
  /** Every strand point, x y z, strand after strand. */
  points: Float32Array;
  /** Where each strand starts in points, in vertices; one extra entry marks the end. */
  starts: Uint32Array;
  /** Outward normal at each strand's root, 3 per strand, for lighting. */
  normals: Float32Array;
  /** 0-1 per strand, drives colour variation. */
  tone: Float32Array;
  /** Strand width in face widths. */
  width: Float32Array;
}

export interface HairGeometry {
  shell: Shell;
  strands: Strands;
  skull: Skull;
  /**
   * Local y band across which the hair thins from solid to bare, or null for
   * solid hair. This is how a fade is drawn: by height, not by painting a
   * gradient picture.
   */
  fade: { fromY: number; toY: number } | null;
}

/**
 * Fits the cranium to this face.
 *
 * Width and depth are anatomical constants (a skull is about 1.1 face widths
 * across and 1.4 front to back). Height and position are measured: the top of
 * the head sits a fixed distance above the tracked forehead top, the nape sits
 * below the ear, and the front of the skull is placed so it passes through the
 * tracked forehead rather than floating in front of or inside it.
 */
export const fitSkull = (fit: HeadFit): Skull => {
  const a = 0.56;
  const c = 0.7;

  const vertex = fit.foreheadTop.y - 0.38;
  const nape = fit.earBottomY + 0.12;
  const b = (nape - vertex) / 2;
  const centerY = (nape + vertex) / 2;

  const ratio = clamp((fit.foreheadTop.y - centerY) / b, -0.98, 0.98);
  const centerZ = clamp(fit.foreheadTop.z + c * Math.sqrt(1 - ratio * ratio), 0.3, 0.9);

  return { center: v3(0, centerY, centerZ), radii: v3(a, b, c) };
};

export const ellipsoidPoint = (skull: Skull, ux: number, uy: number, uz: number): Vec3 => ({
  x: skull.center.x + skull.radii.x * ux,
  y: skull.center.y + skull.radii.y * uy,
  z: skull.center.z + skull.radii.z * uz,
});

/** Outward unit normal of the cranium at a point on (or near) its surface. */
export const ellipsoidNormal = (skull: Skull, p: Vec3): Vec3 =>
  norm(
    v3(
      (p.x - skull.center.x) / (skull.radii.x * skull.radii.x),
      (p.y - skull.center.y) / (skull.radii.y * skull.radii.y),
      (p.z - skull.center.z) / (skull.radii.z * skull.radii.z),
    ),
  );

export const createShell = (cols: number, rows: number): Shell => {
  const count = (cols + 1) * (rows + 1);
  return {
    cols,
    rows,
    positions: new Float32Array(count * 3),
    normals: new Float32Array(count * 3),
  };
};

export const setShellVertex = (
  shell: Shell,
  row: number,
  col: number,
  position: Vec3,
  normal: Vec3,
): void => {
  const at = (row * (shell.cols + 1) + col) * 3;
  shell.positions[at] = position.x;
  shell.positions[at + 1] = position.y;
  shell.positions[at + 2] = position.z;
  shell.normals[at] = normal.x;
  shell.normals[at + 1] = normal.y;
  shell.normals[at + 2] = normal.z;
};

export class StrandBuilder {
  private readonly points: number[] = [];
  private readonly starts: number[] = [0];
  private readonly normals: number[] = [];
  private readonly tone: number[] = [];
  private readonly width: number[] = [];

  get count(): number {
    return this.tone.length;
  }

  add(path: Vec3[], normal: Vec3, tone: number, width: number): void {
    for (const p of path) this.points.push(p.x, p.y, p.z);
    this.starts.push(this.points.length / 3);
    this.normals.push(normal.x, normal.y, normal.z);
    this.tone.push(tone);
    this.width.push(width);
  }

  build(): Strands {
    return {
      count: this.tone.length,
      points: Float32Array.from(this.points),
      starts: Uint32Array.from(this.starts),
      normals: Float32Array.from(this.normals),
      tone: Float32Array.from(this.tone),
      width: Float32Array.from(this.width),
    };
  }
}

/** Small seeded generator, so a haircut is the same every time it is built. */
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
