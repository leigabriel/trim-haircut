interface SectionHeadProps {
  title: string;
  lede: string;
}

/** Shared title and standfirst, so every section opens the same way. */
const SectionHead: React.FC<SectionHeadProps> = ({ title, lede }) => (
  <header className="trim-section__head">
    <h1 className="trim-section__title">{title}</h1>
    <p className="trim-section__lede">{lede}</p>
  </header>
);

export default SectionHead;