import SectionHead from '../../shell/SectionHead';
import { STYLES } from '../../customer-dashboard/face/catalog';

/**
 * The catalogue the recommendation engine ranks.
 *
 * It is compiled into the client (face/catalog.ts), so this page reads it from
 * the same constant rather than a second copy. Editing is not offered until the
 * catalogue moves into a table; a switch that changed nothing would be worse
 * than no switch.
 */
const AdminCatalog: React.FC = () => (
  <>
    <SectionHead
      title="Style Library"
      lede="The cuts Trimo recommends, with the shapes each one suits. This is the same catalogue the customer dashboard ranks against."
    />

    <div className="trim-card">
      <h2 className="trim-card__title">{STYLES.length} styles</h2>

      <ul className="trim-saved">
        {STYLES.map((style) => (
          <li className="trim-saved__row" key={style.id}>
            <img
              className="trim-saved__thumb trim-saved__thumb--photo"
              src={style.image}
              alt=""
              loading="lazy"
            />
            <span className="trim-saved__text">
              <span className="trim-saved__name">{style.name}</span>
              <span className="trim-saved__meta">{style.note}</span>
            </span>
            <span className="trim-saved__match">{style.strength}/5</span>
          </li>
        ))}
      </ul>
    </div>

    <div className="trim-card">
      <h2 className="trim-card__title">Editing</h2>
      <p className="trim-card__text">
        The catalogue ships with the app, so edits need a code change. Moving it
        into a table is what unlocks add, retire and image upload here.
      </p>
      <p className="trim-status">Read only</p>
    </div>
  </>
);

export default AdminCatalog;
