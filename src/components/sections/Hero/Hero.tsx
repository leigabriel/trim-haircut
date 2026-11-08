import { lazy, Suspense, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../../auth/AuthProvider';
import LoginModal from '../../layout/modals/LoginModal';
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

// Lede centred, Book Now centred at the bottom.
const Hero: React.FC<HeroProps> = ({ isEntered, onProgress, onReady }) => {
  const ref = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { session } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useHeroFade(ref, isEntered);

  const handleBookNow = () => {
    if (session) {
      navigate('/dashboard?view=booking');
      return;
    }
    setIsLoginOpen(true);
  };

  return (
    <section ref={ref} className="trim-hero" aria-label="Trim">
      <Suspense fallback={null}>
        <ToolModel isEntered={isEntered} onProgress={onProgress} onReady={onReady} />
      </Suspense>

      <HeroLede />

      <div className="trim-hero__action">
        <button
          className="trim-hero__book"
          type="button"
          onClick={handleBookNow}
        >
          Book Now
        </button>
      </div>

      <LoginModal isOpen={isLoginOpen} onDismiss={() => setIsLoginOpen(false)} />
    </section>
  );
};

export default Hero;
