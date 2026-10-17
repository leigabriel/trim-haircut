import { matchedStyles, trendingStyles } from './catalog';
import type { ScoredStyle } from './catalog';
import { faceShapeLabel } from './shapes';
import type { FaceShapeName } from './shapes';

interface StyleRecommendationsProps {
  shape: FaceShapeName | null;
  /** Caps each group. FaceShape passes a small number; Recommendation does not. */
  limit?: number;
  /** Hides the trending group, which is redundant next to a full page of cuts. */
  hideTrending?: boolean;
}

const StyleCard: React.FC<{ style: ScoredStyle }> = ({ style }) => (
  <li className="trim-style">
    <div className="trim-style__frame">
      <img src={style.image} alt="" loading="lazy" />
      {style.match > 0 ? (
        <span className="trim-style__match">{style.match}%</span>
      ) : (
        <span className="trim-style__match trim-style__match--none">Any shape</span>
      )}
    </div>

    <div className="trim-style__body">
      <h3 className="trim-style__name">{style.name}</h3>
      <dl className="trim-style__specs">
        <div>
          <dt>Upkeep</dt>
          <dd>{style.upkeepWeeks} weeks</dd>
        </div>
      </dl>
      <p className="trim-style__note">{style.note}</p>
    </div>
  </li>
);

/**
 * Cuts for a shape, then what is trending.
 *
 * Trending shows whether or not a shape is set, so the section is never empty.
 * Where a shape is known, a trending cut that does not suit it is labelled
 * rather than hidden, because "trending" and "suits you" are different claims
 * and collapsing them would be misleading.
 */
const StyleRecommendations: React.FC<StyleRecommendationsProps> = ({
  shape,
  limit,
  hideTrending = false,
}) => {
  const matched = matchedStyles(shape);
  const trending = trendingStyles(shape).filter(
    (style) => !matched.some((other) => other.id === style.id),
  );

  const shownMatched = limit ? matched.slice(0, limit) : matched;
  const shownTrending = limit ? trending.slice(0, limit) : trending;

  return (
    <>
      {shape ? (
        <section className="trim-recos">
          <h2 className="trim-card__title">
            Cuts that suit a {faceShapeLabel(shape).toLowerCase()} face
          </h2>
          <p className="trim-card__text">
            Ranked on how well each one works on your proportions, not on how new
            it is.
          </p>

          <ul className="trim-style-grid">
            {shownMatched.map((style) => (
              <StyleCard key={style.id} style={style} />
            ))}
          </ul>
        </section>
      ) : null}

      {!hideTrending && shownTrending.length > 0 ? (
        <section className="trim-recos">
          <h2 className="trim-card__title">Trending now</h2>
          <p className="trim-card__text">
            {shape
              ? 'Every trending cut suits at least some faces. Where one does not suit yours, it says so.'
              : 'Set your face shape and these get ranked against it. Nothing here is matched to you yet.'}
          </p>

          <ul className="trim-style-grid">
            {shownTrending.map((style) => (
              <StyleCard key={style.id} style={style} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
};

export default StyleRecommendations;