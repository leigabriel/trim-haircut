import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import './IntroOverlay.css';

interface IntroOverlayProps {
  onDone: () => void;
}

// Fixed length. Not tied to model loading: the hero still pulls several
// megabytes, so the wait would be unpredictable on a cold cache.
const DURATION_MS = 3000;

/** Eased ramp, so the counter settles rather than ticking linearly. */
const ease = (t: number) => 1 - (1 - t) ** 3;

/**
 * Whether the intro has already run, in module scope on purpose.
 *
 * A client-side route change never re-evaluates this module, so the flag
 * survives moving between the dashboard and the site. A real page load does
 * re-evaluate it, which is exactly the distinction that matters: the intro is
 * an arrival, not something to sit through again on every click back to the
 * site. Kept out of component state so it also survives the unmount that a
 * route change causes.
 */
let hasPlayed = false;

/**
 * Full-screen intro.
 *
 * Portalled to document.body on purpose. Rendered inline it sat inside
 * IonRouterOutlet, where the page wrapper carries a transform during route
 * transitions. A transformed ancestor becomes the containing block for
 * position:fixed, so the overlay was sized to the page box rather than the
 * viewport, and the counter drifted away from the corner.
 */
const IntroOverlay: React.FC<IntroOverlayProps> = ({ onDone }) => {
  const [display, setDisplay] = useState(0);
  // The overlay covers the app, so it must unmount itself. Firing onDone is
  // not enough: the parent only flips the hero's flag.
  const [isDone, setIsDone] = useState(hasPlayed);

  // Refs, so a parent re-render does not restart the animation.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finishRef = useRef<() => void>(() => {});
  finishRef.current = () => {
    setIsDone(true);
    onDoneRef.current();
  };

  useEffect(() => {
    // Already played in this app session, so this mount is a return visit.
    // onDone still has to fire: the hero it reveals is gated on that flag, and
    // skipping it would leave the page behind an overlay that never shows.
    if (hasPlayed) {
      onDoneRef.current();
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(100);
      hasPlayed = true;
      finishRef.current();
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = () => {
      const elapsed = performance.now() - start;
      const ratio = Math.min(1, elapsed / DURATION_MS);
      setDisplay(Math.round(ease(ratio) * 100));

      if (ratio < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      // Set on completion, not on mount, so leaving mid-intro and coming back
      // plays it rather than skipping past an animation never seen.
      hasPlayed = true;
      finishRef.current();
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (isDone) return null;

  return createPortal(
    <div className="trim-intro" role="status" aria-label="Loading Trim">
      {/* The alpha variant. The original PNG has no alpha channel, so on this
          black overlay it rendered as an opaque white square. */}
      <img
        className="trim-intro__mark"
        src="/icon-intro-alpha.png"
        alt=""
        width={512}
        height={512}
      />

      <output className="trim-intro__number" aria-live="polite">
        {String(display).padStart(3, '0')}
      </output>
    </div>,
    document.body,
  );
};

export default IntroOverlay;