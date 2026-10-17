import { shapeAdvice } from '../face/advice';
import { galleryItemsFor } from '../face/gallery';
import StyleRecommendations from '../face/StyleRecommendations';
import type { FaceProfileState } from '../face/useFaceProfile';
import { faceShapeLabel } from '../face/shapes';
import SectionHead from './SectionHead';

interface RecommendationProps {
  face: FaceProfileState;
  onSetFace: () => void;
}

/**
 * Cuts matched to the customer's shape, then what is trending.
 *
 * Trending renders whether or not a shape is set, so this section is never
 * empty. Without a shape it says plainly that nothing here is matched yet,
 * rather than showing a full grid of percentages that mean nothing.
 */
const Recommendation: React.FC<RecommendationProps> = ({ face, onSetFace }) => {
  const shape = face.shape;
  const label = shape ? faceShapeLabel(shape) : null;

  return (
    <>
      <SectionHead
        title="Recommendation"
        lede={
          label
            ? `Matched to your ${label.toLowerCase()} face, then what is trending regardless.`
            : 'What is trending now. Set your face shape and the first list gets ranked against your proportions.'
        }
      />

      {!face.isLoading && !shape ? (
        <div className="trim-card">
          <h2 className="trim-card__title">Nothing matched to you yet</h2>
          <p className="trim-card__text">
            Trim cannot score a cut against a face it has not measured. Set your
            shape by hand if you know it, or let the camera work it out.
          </p>
          <button className="trim-account__analyze" type="button" onClick={onSetFace}>
            Set my face shape
          </button>
        </div>
      ) : null}

      {face.error ? (
        <p className="trim-account__error" role="alert">
          {face.error}
        </p>
      ) : null}

      {/* The shape gallery. Only meaningful once a shape exists, so it is not
          rendered against a guess. */}
      {shape && label ? (
        <section className="trim-gallery-block">
          <div className="trim-gallery-block__head">
            <h2 className="trim-card__title">{label} gallery</h2>
            <p className="trim-gallery-block__note">{shapeAdvice(shape).headline}</p>
          </div>

          <ul className="trim-gallery">
            {galleryItemsFor(shape).map((item) => (
              <li className="trim-gallery__item" key={item.src}>
                <img
                  className="trim-gallery__image"
                  src={item.src}
                  alt={`${item.name} (${label})`}
                  loading="lazy"
                  width={800}
                  height={800}
                />
                <div className="trim-gallery__meta">
                  <span className="trim-gallery__name">{item.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <StyleRecommendations shape={shape} />
    </>
  );
};

export default Recommendation;