import { lazy, Suspense, useRef } from 'react';

import HeroLede from './HeroLede';
import { useHeroFade } from './useHeroFade';
import './Hero.css';

/**
 * three.js and the glTF loader are the heaviest thing on this page, and they
 * are only needed once the hero is actually on screen. Split out, the shell
 * paints first instead of waiting on a 1.4s script evaluation; the chunks are
 * fetched while the intro is still covering the hero.
 */
const ToolModel = lazy(() => import('./ToolModel'));

interface HeroProps {
  isEntered: boolean;
  onProgress: (ratio: number) => void;
  onReady: () => void;
}

// Lede centred, wordmark bottom left, tagline bottom right.
const Hero: React.FC<HeroProps> = ({ isEntered, onProgress, onReady }) => {
  const ref = useRef<HTMLElement>(null);

  useHeroFade(ref, isEntered);

  return (
    <section ref={ref} className="trim-hero" aria-labelledby="trim-hero-title">
      <Suspense fallback={null}>
        <ToolModel isEntered={isEntered} onProgress={onProgress} onReady={onReady} />
      </Suspense>

      <HeroLede />

      <h1 className="trim-hero__title" id="trim-hero-title">
        <span className="trim-hero__wordmark">Trim</span>

        <span className="trim-hero__tagline">
          <span className="trim-hero__tagline-line">Your best</span>
          <span className="trim-hero__tagline-line">haircut</span>
        </span>
      </h1>
    </section>
  );
};

export default Hero;
