import './Services.css';

const SERVICES = [
  {
    title: 'Classic Haircut',
    description: 'Clean, precise cuts tailored to your preferred style and face shape.',
  },
  {
    title: 'Fade & Taper',
    description: 'Sharp low, mid, or high fades blended for a smooth, modern finish.',
  },
  {
    title: 'Beard Trim',
    description: 'Detailed beard shaping and trimming to keep your look sharp and balanced.',
  },
  {
    title: 'Hair Styling',
    description: 'Finish and styling with product for everyday wear or special occasions.',
  },
];

const Services: React.FC = () => (
  <section className="trim-services" id="services" aria-labelledby="trim-services-title">
    <div className="trim-services__head">
      <h2 className="trim-services__title" id="trim-services-title">
        Trim Services
      </h2>
      <p className="trim-services__lede">
        Professional grooming services from classic cuts to modern styles.
      </p>
    </div>

    <ul className="trim-services__grid">
      {SERVICES.map((service) => (
        <li className="trim-services__card" key={service.title}>
          <h3 className="trim-services__name">{service.title}</h3>
          <p className="trim-services__description">{service.description}</p>
        </li>
      ))}
    </ul>
  </section>
);

export default Services;
