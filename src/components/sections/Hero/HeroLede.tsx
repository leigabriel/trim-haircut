const LEDE = 'Oriental Mindoro - based barbershop specializing in the latest hair styles';

/**
 * The hero standfirst.
 *
 * It used to be split into eleven masked words and staggered in with GSAP. That
 * was eleven elements with their own layers waking up at the same moment the
 * tool stage was uploading textures, for a reveal the section fade already
 * covers. Now it is one paragraph and the hero's own fade does the work.
 */
const HeroLede: React.FC = () => <p className="trim-hero__lede">{LEDE}</p>;

export default HeroLede;
