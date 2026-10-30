import type { HairGeometry } from './hairGeometry';
import {
  StrandBuilder,
  createShell,
  ellipsoidNormal,
  ellipsoidPoint,
  fitSkull,
  mulberry32,
  setShellVertex,
} from './hairGeometry';
import type { HeadFit } from './headFit';
import type { Vec3 } from './vec';
import { clamp, dot, len, mix, mul, norm, smoothstep, sub, v3 } from './vec';

/**
 * The two cuts the Camera page offers.
 *
 * Each is described as geometry on the fitted head, not as a picture. A fade is
 * a hair LENGTH that changes with height above the ear; a bob is a curtain that
 * hangs from the crown to a hem at the jaw. Both are anchored to the measured
 * forehead, brow, ear and chin of the person in front of the camera.
 *
 * Every number below is in face widths (about 13.5 cm), so 0.1 is roughly 1.4 cm.
 */

const TAU = Math.PI * 2;

export type HaircutId = 'low-fade' | 'short-cut';

export interface Haircut {
  id: HaircutId;
  label: string;
  audience: 'Men' | 'Women';
  blurb: string;
  /**
   * How much of the hair colour shows through where the cut leaves the scalp
   * exposed. 0 is bare skin, 1 is solid hair. A fade is mostly skin with a
   * shadow; a bob has no exposed scalp.
   */
  scalpMix: number;
  build: (fit: HeadFit, seed?: number) => HairGeometry;
}

/* ------------------------------------------------------------------ */
/* Low fade                                                            */
/* ------------------------------------------------------------------ */

/** Length of the hair on top, about 3.2 cm. */
const FADE_TOP_LENGTH = 0.24;
const FADE_MAX_STRANDS = 3200;

const buildLowFade = (fit: HeadFit, seed = 7): HairGeometry => {
  const skull = fitSkull(fit);
  const { center: c, radii: r } = skull;
  const rand = mulberry32(seed);

  // A LOW fade: skin around and behind the ear, a short ramp up to the temple,
  // then the longer top. These two heights are the whole difference between a
  // low fade and a mid or high one.
  const bareY = fit.earTopY + 0.26;
  const fadeY = fit.earTopY - 0.1;

  /** Hair length at a point, from how high it is and how far up the dome it sits. */
  const profile = (y: number, uy: number) => {
    const ramp = smoothstep(bareY, fadeY, y);
    const top = smoothstep(-0.28, -0.8, uy);
    const side = mix(0.006, 0.075, ramp);
    return { ramp, length: mix(side, FADE_TOP_LENGTH, top) };
  };

  // Rows are rings of constant height, so the shell stops on a level line at the
  // bare edge and the fade gradient is level with the head, not the screen.
  const phiMax = Math.acos(clamp((c.y - bareY) / r.y, -1, 1));
  const cols = 64;
  const rows = 22;
  const shell = createShell(cols, rows);

  for (let j = 0; j <= rows; j += 1) {
    const phi = (phiMax * j) / rows;
    const ring = Math.sin(phi);
    for (let i = 0; i <= cols; i += 1) {
      const theta = (TAU * i) / cols;
      const ux = ring * Math.sin(theta);
      const uy = -Math.cos(phi);
      const uz = -ring * Math.cos(theta);

      const root = ellipsoidPoint(skull, ux, uy, uz);
      const normal = ellipsoidNormal(skull, root);
      const { length } = profile(root.y, uy);
      const lift = 0.5 * length + 0.006;

      setShellVertex(
        shell,
        j,
        i,
        v3(root.x + normal.x * lift, root.y + normal.y * lift, root.z + normal.z * lift),
        normal,
      );
    }
  }

  // Hair grows outward from a whorl at the crown, so the top lies forward and
  // the back lies down, instead of every strand standing straight up.
  const whorl = v3(c.x + 0.05 * r.x, c.y - 0.82 * r.y, c.z + 0.45 * r.z);
  const strands = new StrandBuilder();

  for (let tries = 0; tries < 14000 && strands.count < FADE_MAX_STRANDS; tries += 1) {
    const uy = -1 + 2 * rand();
    const theta = TAU * rand();
    const ring = Math.sqrt(1 - uy * uy);
    const root = ellipsoidPoint(skull, ring * Math.sin(theta), uy, -ring * Math.cos(theta));
    if (root.y >= bareY) continue;

    const { ramp, length } = profile(root.y, uy);
    // A little stubble reaches right down to the bare line; the rest thickens
    // with height.
    if (rand() > 0.12 + 0.88 * ramp) continue;

    const normal = ellipsoidNormal(skull, root);
    const toRoot = sub(root, whorl);
    let flow = sub(toRoot, mul(normal, dot(toRoot, normal)));
    flow = len(flow) < 1e-4 ? v3(0, 0, -1) : norm(flow);

    const strandLength = length * (0.75 + 0.5 * rand());
    const points = strandLength > 0.09 ? 6 : 4;
    const path: Vec3[] = [];

    for (let k = 0; k < points; k += 1) {
      const t = k / (points - 1);
      const lift = strandLength * (1 - (1 - t) * (1 - t)) * 0.8;
      const lean = strandLength * t * 0.6;
      const sag = strandLength * t * t * 0.3;
      path.push(
        v3(
          root.x + normal.x * lift + flow.x * lean,
          root.y + normal.y * lift + flow.y * lean + sag,
          root.z + normal.z * lift + flow.z * lean,
        ),
      );
    }

    strands.add(path, normal, rand(), 0.006 + 0.05 * strandLength);
  }

  return { shell, strands: strands.build(), skull, fade: { fromY: fadeY, toY: bareY } };
};

/* ------------------------------------------------------------------ */
/* Short cut (bob)                                                     */
/* ------------------------------------------------------------------ */

/** How far round the head the front hair is swept: about 60 degrees from dead ahead. */
const BOB_FRONT_SWEEP = 1.05;
const BOB_MAX_STRANDS = 3600;

const wrapToPi = (angle: number): number => {
  let t = angle % TAU;
  if (t > Math.PI) t -= TAU;
  if (t < -Math.PI) t += TAU;
  return t;
};

const buildShortCut = (fit: HeadFit, seed = 11): HairGeometry => {
  const skull = fitSkull(fit);
  const { center: c, radii: r } = skull;
  const rand = mulberry32(seed);

  // A graduated bob: the hem sits at the chin at the front and rises towards the
  // nape at the back, which is what makes it read as a cut rather than a hood.
  const topY = c.y - r.y - 0.04;
  const hemFront = fit.chinY - 0.06;
  const hemBack = fit.earBottomY + 0.22;
  const radiusX = r.x * 1.07;
  const radiusZ = r.z * 1.04;

  /**
   * A point on the hair, by azimuth (0 is dead ahead) and how far down the fall
   * it is (0 at the crown, 1 at the hem).
   *
   * Over the dome the hair follows the skull. Below the equator it hangs
   * straight, flares a touch and turns under at the hem. The hair from the front
   * of the dome is combed round to the sides on the way down, so it frames the
   * face instead of falling across it.
   */
  const surface = (theta: number, s: number): { p: Vec3; n: Vec3 } => {
    const th = wrapToPi(theta);
    const side = th >= 0 ? 1 : -1;
    const swept = Math.max(Math.abs(th), BOB_FRONT_SWEEP);
    const thetaEff = th + (side * swept - th) * smoothstep(0.12, 0.4, s);

    const hem = mix(hemFront, hemBack, smoothstep(0.5, 2.4, Math.abs(thetaEff)));
    const y = topY + s * (hem - topY);

    const dy = (y - c.y) / r.y;
    const dome = y <= c.y ? Math.sqrt(Math.max(0, 1 - dy * dy)) : 1;

    let volume = 1 + 0.05 * smoothstep(c.y, hem, y);
    if (s > 0.88) {
      const turn = (s - 0.88) / 0.12;
      volume *= 1 - 0.14 * turn * turn;
    }

    const x = radiusX * volume * dome * Math.sin(thetaEff);
    const z = c.z - radiusZ * volume * dome * Math.cos(thetaEff);

    const n = norm(
      v3(
        x / (radiusX * radiusX),
        y <= c.y ? (y - c.y) / (r.y * r.y) : 0,
        (z - c.z) / (radiusZ * radiusZ),
      ),
    );

    return { p: v3(x, y, z), n };
  };

  const cols = 72;
  const rows = 34;
  const shell = createShell(cols, rows);

  for (let j = 0; j <= rows; j += 1) {
    for (let i = 0; i <= cols; i += 1) {
      const { p, n } = surface((TAU * i) / cols, j / rows);
      setShellVertex(shell, j, i, p, n);
    }
  }

  const strands = new StrandBuilder();
  const points = 10;

  while (strands.count < BOB_MAX_STRANDS) {
    const theta = TAU * rand();
    // Roots are on the scalp, so only the dome: the fall carries them the rest
    // of the way down.
    const start = 0.4 * Math.pow(rand(), 0.8);
    const jitter = (rand() - 0.5) * 0.05;
    const phase = rand() * TAU;

    const path: Vec3[] = [];
    for (let k = 0; k < points; k += 1) {
      const s = mix(start, 1, k / (points - 1));
      const { p, n } = surface(theta + jitter, s);
      // A faint wave, so the hair is not ruled lines.
      const wave = Math.sin(s * 9 + phase) * 0.008 * s;
      path.push(v3(p.x + n.x * (0.004 + wave), p.y, p.z + n.z * (0.004 + wave)));
    }

    strands.add(path, surface(theta, start).n, rand(), 0.013 + 0.008 * rand());
  }

  return { shell, strands: strands.build(), skull, fade: null };
};

export const HAIRCUTS: Haircut[] = [
  {
    id: 'low-fade',
    label: 'Low Fade',
    audience: 'Men',
    blurb: 'Skin at the ear and nape, a short ramp up the temple, length on top.',
    scalpMix: 0.3,
    build: buildLowFade,
  },
  {
    id: 'short-cut',
    label: 'Short Haircut',
    audience: 'Women',
    blurb: 'A chin-length graduated bob that frames the face.',
    scalpMix: 0.88,
    build: buildShortCut,
  },
];

export const getHaircut = (id: HaircutId): Haircut =>
  HAIRCUTS.find((cut) => cut.id === id) ?? HAIRCUTS[0];
