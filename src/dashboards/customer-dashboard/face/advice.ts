import type { FaceShapeName } from './shapes';

/**
 * Curated styling advice per shape.
 *
 * This is editorial, not generated. It is what a barber would say from the
 * chair, and it is instant and free, which is why the analyzer does not call
 * the model for it. Trimo is one tap deeper when the customer wants to talk it
 * through rather than read it.
 */
export interface CutSuggestion {
  name: string;
  note: string;
}

export interface ShapeAdvice {
  shape: FaceShapeName;
  headline: string;
  /** What the shape is, and what that means for a cut. */
  body: string;
  cuts: CutSuggestion[];
  /** The thing that most often goes wrong on this shape. */
  avoid: string;
  /** Prefilled question, so asking Trimo is one tap rather than a blank box. */
  askTrimo: string;
}

export const SHAPE_ADVICE: Record<FaceShapeName, ShapeAdvice> = {
  oval: {
    shape: 'oval',
    headline: 'Almost everything suits you. This is an upkeep decision, not a shape one.',
    body: 'Your forehead, cheekbones and jaw are close in width and taper in the right order, which is why Oval takes almost every short cut well. What separates a good Oval cut from a bad one is not the shape, it is how much you are willing to maintain it.',
    cuts: [
      { name: 'Textured crop', note: 'Movement without length. Forgiving of a bad week.' },
      { name: 'Low taper', note: 'Keeps weight in the sides without a hard line.' },
      { name: 'Crew cut', note: 'Neat and the longest gap between cuts of anything here.' },
    ],
    avoid: 'Heavy uniform fringe. It flattens the one feature that makes Oval work.',
    askTrimo: 'I scanned as Oval. What should I actually ask for, and how long can I go between cuts?',
  },
  round: {
    shape: 'round',
    headline: 'Add height and a hard line somewhere. The sides are what work against you.',
    body: 'Round faces read short because width and length are close. Everything that pushes the shape taller is doing the work: keeping the sides tight, the top long, and at least one edge crisp enough to draw the eye along rather than across.',
    cuts: [
      { name: 'High fade', note: 'Strips width from the sides and adds the vertical.' },
      { name: 'Undercut with texture on top', note: 'Volume where the face is shortest.' },
      { name: 'Side part with a clean line', note: 'The diagonal does the lengthening.' },
    ],
    avoid: 'A fringe cut level across the brow. It shortens what is already short.',
    askTrimo: 'I scanned as Round. How do I add height without it looking like I tried too hard?',
  },
  square: {
    shape: 'square',
    headline: 'Soften the corners, keep the width. Do not fight the jaw.',
    body: 'A Square face has a strong, even jaw line and that is the asset. Cuts that round the edges off entirely make the jaw look heavier. You want the sides to keep their width while texture and a little length break up the angles.',
    cuts: [
      { name: 'Textured crop', note: 'Softens the edge without narrowing the face.' },
      { name: 'Mid fade', note: 'Gradual, so the jaw does not end in a hard step.' },
      { name: 'Slight fringe, brushed aside', note: 'Breaks the straight line across the brow.' },
    ],
    avoid: 'Buzzing the sides very short. It squares the jaw off even further.',
    askTrimo: 'I scanned as Square. How do I soften my jaw without making my face look narrow?',
  },
  heart: {
    shape: 'heart',
    headline: 'Add width where you are narrow. Volume low, at the jaw.',
    body: 'The forehead is your widest point and the jaw is your narrowest, so the face tapers sharply downward. Volume placed at the jaw balances the whole shape. Volume on top, where you already have plenty, makes it worse.',
    cuts: [
      { name: 'Side-swept fringe', note: 'Takes the width off the forehead deliberately.' },
      { name: 'Volume at the jaw', note: 'Widens the narrow end so the taper evens out.' },
      { name: 'Mid-length, flipped out', note: 'The flip is doing the widening for you.' },
    ],
    avoid: 'Volume or height on top. It exaggerates the widest part of your face.',
    askTrimo: 'I scanned as Heart. Where exactly should the volume go so my face looks balanced?',
  },
  diamond: {
    shape: 'diamond',
    headline: 'Fill in either end. Your cheekbones are already doing the work.',
    body: 'Cheekbone width is your strongest feature, so you do not need width there. A Diamond reads best when the forehead and jaw are filled to meet it, which is close to the opposite of what a Heart needs.',
    cuts: [
      { name: 'Texture across the top', note: 'Widens the forehead to meet the cheekbones.' },
      { name: 'Full, rounded sides', note: 'Fills the jaw so the taper is not so abrupt.' },
      { name: 'Fringe, textured not blunt', note: 'Takes the temple width down a little.' },
    ],
    avoid: 'Sides shorter than the top. It isolates the cheekbones and makes the taper sharper.',
    askTrimo: 'I scanned as Diamond. What length at the sides will fill in without adding bulk?',
  },
  long: {
    shape: 'long',
    headline: 'Take width off the sides. Height is the problem, not length.',
    body: 'Your face is taller than it is wide, which stretches it vertically. Fringe and side width both pull the proportions back toward square, so most of the benefit comes from those two things rather than from cutting length off.',
    cuts: [
      { name: 'Heavy side fringe', note: 'The single most effective thing on a Long face.' },
      { name: 'Wide at the sides, short on top', note: 'Pulls the width back in.' },
      { name: 'Semi-kurly or wavy texture', note: 'Bends the straight vertical line of the face.' },
    ],
    avoid: 'Keeping the top long and the sides short. That maximises the length you are trying to reduce.',
    askTrimo: 'I scanned as Long. How short do the sides need to be to actually shorten my face?',
  },
  triangle: {
    shape: 'triangle',
    headline: 'Add width up top. Your jaw is already the widest part.',
    body: 'The jaw runs wider than the forehead, so the face narrows as it goes up. Weight moved to the top balances it. This is the one shape where sides shorter than the top is actively the right move.',
    cuts: [
      { name: 'Volume on top, tapered sides', note: 'Reverses the taper for the first time.' },
      { name: 'Quiff or swept front', note: 'Puts the width where you are narrow.' },
      { name: 'Longer, fuller sides', note: 'Narrows the jaw relative to the top.' },
    ],
    avoid: 'Heavy sides with a flat top. It doubles down on the width you already have.',
    askTrimo: 'I scanned as Triangle. How much volume on top will balance my jaw?',
  },
};

export const shapeAdvice = (shape: FaceShapeName): ShapeAdvice => SHAPE_ADVICE[shape];