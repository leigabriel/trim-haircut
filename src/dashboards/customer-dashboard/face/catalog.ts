import { FACE_SHAPES } from './shapes';
import type { FaceShapeName } from './shapes';

/**
 * The style catalogue.
 *
 * Each cut declares which shapes it genuinely works on and how well, so a match
 * score is computed from the customer's actual shape rather than authored
 * alongside it. `trend` is a hand-maintained rank: there is no trustworthy free
 * feed for what is trending, and a fabricated one would be worse than an
 * editorial one.
 */

export interface Style {
  id: string;
  name: string;
  /** Shapes this cut genuinely works on. */
  suits: FaceShapeName[];
  /** 1-5. How well it works, so matching can be ranked rather than filtered flat. */
  strength: number;
  /** Upkeep between cuts, in weeks. */
  upkeepWeeks: number;
  note: string;
  image: string;
  /** Rank within the trending list. Null when the cut is not trending. */
  trend: number | null;
}

export const STYLES: Style[] = [
  {
    id: 'textured-crop',
    name: 'Textured Crop',
    suits: ['oval', 'square', 'heart', 'diamond', 'triangle'],
    strength: 5,
    upkeepWeeks: 2,
    note: 'The safe answer that is never wrong. Movement without length.',
    image: '/assets/styles/high-fade.png',
    trend: 2,
  },
  {
    id: 'low-taper',
    name: 'Low Taper',
    suits: ['round', 'square', 'oval', 'triangle'],
    strength: 4,
    upkeepWeeks: 3,
    note: 'Weight kept low and soft. Discreet between cuts.',
    image: '/assets/styles/low-fade.png',
    trend: 3,
  },
  {
    id: 'mid-fade',
    name: 'Mid Fade',
    suits: ['oval', 'square', 'round', 'long', 'diamond'],
    strength: 4,
    upkeepWeeks: 2,
    note: 'A gradient that softens the edge rather than ending it.',
    image: '/assets/styles/mid-fade.png',
    trend: null,
  },
  {
    id: 'crew-cut',
    name: 'Crew Cut',
    suits: ['oval', 'square', 'round', 'diamond'],
    strength: 3,
    upkeepWeeks: 4,
    note: 'The longest gap between cuts of anything here.',
    image: '/assets/styles/crew-cut.png',
    trend: 1,
  },
  {
    id: 'buzz-cut',
    name: 'Buzz Cut',
    suits: ['diamond', 'heart', 'square', 'long'],
    strength: 4,
    upkeepWeeks: 1,
    note: 'Shows the shape of the head. High upkeep, very low effort.',
    image: '/assets/styles/buzz-cut.png',
    trend: null,
  },
  {
    id: 'semikal',
    name: 'Semikal',
    suits: ['heart', 'diamond', 'oval', 'long'],
    strength: 3,
    upkeepWeeks: 3,
    note: 'A soft curtain fringe. Suits a narrow face.',
    image: '/assets/styles/semikal.png',
    trend: null,
  },
];

export const TRENDING: Style[] = [...STYLES]
  .filter((style) => style.trend !== null)
  .sort((a, b) => a.trend! - b.trend!);

export interface ScoredStyle extends Style {
  /** 1-100, derived from strength. Zero when the cut does not suit the shape. */
  match: number;
}

const asScored = (style: Style, shape: FaceShapeName | null): ScoredStyle => {
  if (!shape || !style.suits.includes(shape)) return { ...style, match: 0 };
  // Strength 5 lands in the low nineties rather than at 100, so the number
  // reads as a judgement rather than a measurement.
  return { ...style, match: Math.round((style.strength / 5) * 94) };
};

/** Cuts that suit the shape, strongest first. Empty when there is no shape. */
export const matchedStyles = (shape: FaceShapeName | null): ScoredStyle[] => {
  if (!shape) return [];
  return STYLES.filter((style) => style.suits.includes(shape))
    .map((style) => asScored(style, shape))
    .sort((a, b) => b.match - a.match);
};

/**
 * Trending, ordered by rank, each carrying its match for the customer's shape.
 * Shown whether or not a shape is set, so the section is never empty.
 */
export const trendingStyles = (shape: FaceShapeName | null): ScoredStyle[] =>
  TRENDING.map((style) => asScored(style, shape));

/** Every shape has something to recommend. Guards against a gap in the data. */
export const everyShapeHasStyles = (): boolean =>
  FACE_SHAPES.every((shape) => matchedStyles(shape).length > 0);