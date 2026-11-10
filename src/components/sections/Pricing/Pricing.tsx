import './Pricing.css';

const PRICING = [
  { name: 'Classic Haircut', price: '₱150', note: 'Clean cut and basic styling' },
  { name: 'Fade / Taper', price: '₱180', note: 'Low, mid, or high fade finish' },
  { name: 'Beard Trim', price: '₱100', note: 'Shape, trim, and line-up' },
  { name: 'Haircut + Beard Trim', price: '₱230', note: 'Complete grooming package' },
];

const Pricing: React.FC = () => (
  <section className="trim-pricing" id="pricing" aria-labelledby="trim-pricing-title">
    <div className="trim-pricing__head">
      <h2 className="trim-pricing__title" id="trim-pricing-title">
        Pricing
      </h2>
      <p className="trim-pricing__lede">
        Simple, transparent pricing for our grooming services.
      </p>
    </div>

    <ul className="trim-pricing__list">
      {PRICING.map((item) => (
        <li className="trim-pricing__item" key={item.name}>
          <div className="trim-pricing__row">
            <h3 className="trim-pricing__name">{item.name}</h3>
            <span className="trim-pricing__price">{item.price}</span>
          </div>
          <p className="trim-pricing__note">{item.note}</p>
        </li>
      ))}
    </ul>
  </section>
);

export default Pricing;
