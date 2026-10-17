import HeroLede from './HeroLede';
import ToolModel from './ToolModel';
import './Hero.css';

interface HeroProps {
  isEntered: boolean;
  onProgress: (ratio: number) => void;
  onReady: () => void;
}

// Lede centred, wordmark bottom left, tagline bottom right.
const Hero: React.FC<HeroProps> = ({ isEntered, onProgress, onReady }) => (
  <section className={`trim-hero${isEntered ? ' trim-hero--entered' : ''}`} aria-labelledby="trim-hero-title">
    <ToolModel isEntered={isEntered} onProgress={onProgress} onReady={onReady} />

    <HeroLede isEntered={isEntered} />

    <h1 className="trim-hero__title" id="trim-hero-title">
      <span className="trim-hero__wordmark">Trim</span>

      <span className="trim-hero__tagline">
        <span className="trim-hero__tagline-line">Your best</span>
        <span className="trim-hero__tagline-line">haircut</span>
      </span>
    </h1>
  </section>
);

export default Hero;