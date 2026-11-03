import type { ReactNode } from 'react';

interface SectionHeadProps {
  title: string;
  lede: string;
  /** Optional control aligned with the heading, such as an "Add" button. */
  action?: ReactNode;
}

/** Shared title and standfirst, so every section opens the same way. */
const SectionHead: React.FC<SectionHeadProps> = ({ title, lede, action }) => (
  <header
    className={`trim-section__head${action ? ' trim-section__head--with-action' : ''}`}
  >
    <div className="trim-section__head-copy">
      <h1 className="trim-section__title">{title}</h1>
      <p className="trim-section__lede">{lede}</p>
    </div>
    {action ? <div className="trim-section__head-action">{action}</div> : null}
  </header>
);

export default SectionHead;