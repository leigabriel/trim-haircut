import { STYLES } from './data';
import './Styles.css';

// Border only: no fill, no rounded corners. Replace the placeholder files in
// public/assets/styles/ to drop in real photos.
const Styles: React.FC = () => (
  <section className="trim-styles" id="styles" aria-labelledby="trim-styles-title">
    <h2 className="trim-styles__title" id="trim-styles-title">
      Style Categories
    </h2>

    <ul className="trim-styles__grid">
      {STYLES.map((style) => (
        <li className="trim-styles__cell" key={style.id}>
          <img
            className="trim-styles__image"
            src={style.img}
            alt={style.name}
            loading="lazy"
            width={640}
            height={640}
          />
          <span className="trim-styles__label">{style.name}</span>
        </li>
      ))}
    </ul>
  </section>
);

export default Styles;