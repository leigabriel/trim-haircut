/**
 * Minimal 3D vector helpers for the camera filter.
 *
 * Plain objects rather than three.js vectors: nothing here touches WebGL, and
 * the head maths stays importable (and testable) without a renderer.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const mul = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

/** Unit vector, or the zero vector when the input has no direction. */
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l < 1e-9 ? v3() : mul(a, 1 / l);
};

export const mid = (a: Vec3, b: Vec3): Vec3 => mul(add(a, b), 0.5);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Hermite smoothstep. Works with edge0 > edge1, which is how the haircut
 * profiles read "full length above here, bare below there" along a y axis that
 * grows downward.
 */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
