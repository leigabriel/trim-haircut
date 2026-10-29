import type { HairGeometry } from './hairGeometry';
import type { HeadFrame } from './headPose';
import { toWorld } from './headPose';
import { clamp01, norm, v3 } from './vec';

/**
 * Draws a haircut for one frame.
 *
 * The geometry lives in head space and never changes; each frame only the head
 * frame does. So the work per frame is a projection and a few hundred path
 * fills, which is what lets this run at video rate on a phone.
 *
 * Not a depth-buffered renderer: faces that point away are culled, which is
 * exact for the convex dome and close enough for the hanging curtain, and the
 * real face outline is cut out of the result afterwards, which is what puts the
 * hair behind the forehead, cheeks and jaw when the head turns.
 */

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Surface = HTMLCanvasElement | OffscreenCanvas;

export interface Layer {
  canvas: Surface;
  ctx: Ctx2D;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Point2 {
  x: number;
  y: number;
}

/** Used until the person's own hair has been sampled. */
export const FALLBACK_HAIR: Rgb = { r: 43, g: 29, b: 20 };

const SHADES = 10;
const TONES = 5;
const TONE_GAIN = [0.8, 0.9, 1, 1.12, 1.25];

/** Towards the light: above, slightly left, in front of the face. */
const LIGHT = norm(v3(-0.25, -0.55, -0.8));

/** A face this far past edge-on to the camera is treated as facing away. */
const SHELL_CULL = 0.12;
const STRAND_CULL = 0.2;

// Reused between frames so a 30fps loop does not allocate per vertex.
let screen = new Float32Array(0);
let facing = new Float32Array(0);
let lighting = new Float32Array(0);

const grow = (count: number) => {
  if (screen.length < count * 2) {
    screen = new Float32Array(count * 2);
    facing = new Float32Array(count);
    lighting = new Float32Array(count);
  }
};

const shadeLevel = (lit: number): number =>
  Math.min(SHADES - 1, Math.max(0, Math.round((0.35 + 0.65 * lit) * (SHADES - 1))));

const css = (color: Rgb, gain: number): string => {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value * gain)));
  return `rgb(${channel(color.r)},${channel(color.g)},${channel(color.b)})`;
};

const levelGain = (level: number): number => Math.max(0.3, level / (SHADES - 1));

const drawShell = (ctx: Ctx2D, geometry: HairGeometry, frame: HeadFrame, color: Rgb) => {
  const { shell } = geometry;
  const { ex, ey, ez, origin, scale } = frame;
  const stride = shell.cols + 1;
  const count = stride * (shell.rows + 1);
  grow(count);

  for (let v = 0; v < count; v += 1) {
    const lx = shell.positions[v * 3];
    const ly = shell.positions[v * 3 + 1];
    const lz = shell.positions[v * 3 + 2];
    screen[v * 2] = origin.x + scale * (ex.x * lx + ey.x * ly + ez.x * lz);
    screen[v * 2 + 1] = origin.y + scale * (ex.y * lx + ey.y * ly + ez.y * lz);

    const nx = shell.normals[v * 3];
    const ny = shell.normals[v * 3 + 1];
    const nz = shell.normals[v * 3 + 2];
    const wx = ex.x * nx + ey.x * ny + ez.x * nz;
    const wy = ex.y * nx + ey.y * ny + ez.y * nz;
    const wz = ex.z * nx + ey.z * ny + ez.z * nz;
    facing[v] = wz;
    lighting[v] = clamp01(wx * LIGHT.x + wy * LIGHT.y + wz * LIGHT.z);
  }

  const paths: (Path2D | undefined)[] = new Array(SHADES);

  for (let j = 0; j < shell.rows; j += 1) {
    for (let i = 0; i < shell.cols; i += 1) {
      const a = j * stride + i;
      const b = a + 1;
      const c = a + stride + 1;
      const d = a + stride;

      if ((facing[a] + facing[b] + facing[c] + facing[d]) / 4 > SHELL_CULL) continue;

      const level = shadeLevel((lighting[a] + lighting[b] + lighting[c] + lighting[d]) / 4);
      const path = (paths[level] ??= new Path2D());
      path.moveTo(screen[a * 2], screen[a * 2 + 1]);
      path.lineTo(screen[b * 2], screen[b * 2 + 1]);
      path.lineTo(screen[c * 2], screen[c * 2 + 1]);
      path.lineTo(screen[d * 2], screen[d * 2 + 1]);
      path.closePath();
    }
  }

  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.25;
  paths.forEach((path, level) => {
    if (!path) return;
    const style = css(color, levelGain(level) * 0.92);
    ctx.fillStyle = style;
    // Stroked as well as filled: neighbouring quads antialias against whatever
    // is behind them, and without this the grid shows through as hairline seams.
    ctx.strokeStyle = style;
    ctx.fill(path);
    ctx.stroke(path);
  });
};

const drawStrands = (ctx: Ctx2D, geometry: HairGeometry, frame: HeadFrame, color: Rgb) => {
  const { strands } = geometry;
  const { ex, ey, ez, origin, scale } = frame;
  const paths: (Path2D | undefined)[] = new Array(SHADES * TONES * 2);

  for (let s = 0; s < strands.count; s += 1) {
    const nx = strands.normals[s * 3];
    const ny = strands.normals[s * 3 + 1];
    const nz = strands.normals[s * 3 + 2];
    const wz = ex.z * nx + ey.z * ny + ez.z * nz;
    if (wz > STRAND_CULL) continue;

    const wx = ex.x * nx + ey.x * ny + ez.x * nz;
    const wy = ex.y * nx + ey.y * ny + ez.y * nz;
    const level = shadeLevel(clamp01(wx * LIGHT.x + wy * LIGHT.y + wz * LIGHT.z));
    const tone = Math.min(TONES - 1, Math.floor(strands.tone[s] * TONES));
    const heavy = strands.width[s] < 0.012 ? 0 : 1;

    const id = (level * TONES + tone) * 2 + heavy;
    const path = (paths[id] ??= new Path2D());

    for (let k = strands.starts[s]; k < strands.starts[s + 1]; k += 1) {
      const lx = strands.points[k * 3];
      const ly = strands.points[k * 3 + 1];
      const lz = strands.points[k * 3 + 2];
      const x = origin.x + scale * (ex.x * lx + ey.x * ly + ez.x * lz);
      const y = origin.y + scale * (ex.y * lx + ey.y * ly + ez.y * lz);
      if (k === strands.starts[s]) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  paths.forEach((path, id) => {
    if (!path) return;
    const heavy = id % 2;
    const tone = Math.floor(id / 2) % TONES;
    const level = Math.floor(id / 2 / TONES);

    ctx.strokeStyle = css(color, levelGain(level) * TONE_GAIN[tone]);
    ctx.lineWidth = Math.max(0.8, (heavy ? 0.016 : 0.009) * scale);
    ctx.stroke(path);
  });
};

/** Removes the face from the hair, so the forehead, cheeks and jaw stay in front of it. */
const cutOutFace = (ctx: Ctx2D, face: Point2[]) => {
  if (face.length < 3) return;

  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(face[0].x, face[0].y);
  for (let i = 1; i < face.length; i += 1) ctx.lineTo(face[i].x, face[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
};

/**
 * Thins the hair from solid to nothing between two heights on the head. The
 * gradient is laid along the head's own down axis, so it tilts with the head.
 */
const fadeByHeight = (
  ctx: Ctx2D,
  geometry: HairGeometry,
  frame: HeadFrame,
  width: number,
  height: number,
) => {
  const { fade, skull } = geometry;
  if (!fade) return;

  const from = toWorld(frame, v3(0, fade.fromY, skull.center.z));
  const to = toWorld(frame, v3(0, fade.toY, skull.center.z));
  // A zero length gradient paints nothing, which would erase the whole cut.
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return;

  const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
};

export const paintHair = (
  out: Ctx2D,
  layer: Layer,
  geometry: HairGeometry,
  frame: HeadFrame,
  color: Rgb,
  face: Point2[],
): void => {
  const { canvas, ctx } = layer;
  const { width, height } = canvas;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, width, height);

  drawShell(ctx, geometry, frame, color);
  drawStrands(ctx, geometry, frame, color);
  cutOutFace(ctx, face);
  fadeByHeight(ctx, geometry, frame, width, height);

  out.drawImage(canvas, 0, 0);
};
