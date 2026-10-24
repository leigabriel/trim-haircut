interface PendingPanelProps {
  title: string;
  text: string;
  /** What the page will show once the table behind it exists. */
  facts?: ReadonlyArray<{ label: string; value: string }>;
}

/**
 * Empty state for a section whose data store has not been built yet.
 *
 * It says so plainly rather than rendering zeros or sample rows: a dashboard
 * that invents a schedule is worse than one that admits it has none.
 */
const PendingPanel: React.FC<PendingPanelProps> = ({ title, text, facts }) => (
  <div className="trim-card">
    <h2 className="trim-card__title">{title}</h2>
    <p className="trim-card__text">{text}</p>

    {facts && facts.length > 0 ? (
      <dl className="trim-facts trim-facts--spaced">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    ) : null}

    <p className="trim-status">Not connected yet</p>
  </div>
);

export default PendingPanel;
