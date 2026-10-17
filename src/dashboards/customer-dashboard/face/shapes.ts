/**
 * The seven shapes the analyzer can return, and the prototype each one is
 * measured against.
 *
 * Everything here is data. classify.ts owns the arithmetic; this file exists so
 * the numbers can be argued about without reading any logic.
 */

export const FACE_SHAPES = [
  'oval',
  'round',
  'square',
  'heart',
  'diamond',
  'long',
  'triangle',
] as const;

export type FaceShapeName = (typeof FACE_SHAPES)[number];

export interface FaceShapeDefinition {
  id: FaceShapeName;
  label: string;
  /** One line on what the shape is, for the result card. */
  summary: string;
  /**
   * Expected measurements, all ratios against cheekbone width. These are the
   * classic styling rules rather than measurements off a real population:
   * forehead and jaw roughly match the cheekbones for Oval, the jaw runs
   * narrow and the forehead wide for Heart, and so on.
   */
  prototype: ShapePrototype;
  /** How much each measurement counts. Length dominates most distinctions. */
  weights: ShapeWeights;
}

export interface ShapePrototype {
  forehead: number;
  jaw: number;
  length: number;
}

export interface ShapeWeights {
  forehead: number;
  jaw: number;
  length: number;
}

const EVEN: ShapeWeights = { forehead: 1, jaw: 1, length: 1 };

export const FACE_SHAPE_DEFINITIONS: Record<FaceShapeName, FaceShapeDefinition> = {
  oval: {
    id: 'oval',
    label: 'Oval',
    summary: 'Forehead and cheekbones close in width, with a jaw that tapers below them.',
    prototype: { forehead: 1.02, jaw: 0.92, length: 1.45 },
    weights: { ...EVEN },
  },
  round: {
    id: 'round',
    label: 'Round',
    summary: 'Short and wide, with a full cheek line and little taper at the jaw.',
    prototype: { forehead: 0.95, jaw: 0.95, length: 1.12 },
    weights: { forehead: 0.8, jaw: 1.2, length: 1.6 },
  },
  square: {
    id: 'square',
    label: 'Square',
    summary: 'Forehead, cheekbones and jaw all close to the same width, with a strong jaw line.',
    prototype: { forehead: 1.0, jaw: 1.0, length: 1.24 },
    weights: { forehead: 1.1, jaw: 1.4, length: 1.1 },
  },
  heart: {
    id: 'heart',
    label: 'Heart',
    summary: 'The forehead is the widest point, tapering to a narrow jaw.',
    prototype: { forehead: 1.14, jaw: 0.72, length: 1.38 },
    weights: { forehead: 1.6, jaw: 1.3, length: 0.7 },
  },
  diamond: {
    id: 'diamond',
    label: 'Diamond',
    summary: 'Cheekbones are the widest point, with a narrower forehead and jaw either side.',
    prototype: { forehead: 0.82, jaw: 0.74, length: 1.5 },
    weights: { forehead: 1.4, jaw: 1.3, length: 1.0 },
  },
  long: {
    id: 'long',
    label: 'Long',
    summary: 'Noticeably taller than it is wide, with widths close to level across the face.',
    prototype: { forehead: 0.97, jaw: 0.93, length: 1.85 },
    weights: { forehead: 0.6, jaw: 0.7, length: 2.4 },
  },
  triangle: {
    id: 'triangle',
    label: 'Triangle',
    summary: 'The jaw is the widest point, narrowing up to a narrow forehead.',
    prototype: { forehead: 0.76, jaw: 1.16, length: 1.42 },
    weights: { forehead: 1.4, jaw: 1.6, length: 0.7 },
  },
};

export const isFaceShapeName = (value: unknown): value is FaceShapeName =>
  typeof value === 'string' && (FACE_SHAPES as readonly string[]).includes(value);

export const faceShapeLabel = (shape: FaceShapeName): string =>
  FACE_SHAPE_DEFINITIONS[shape].label;