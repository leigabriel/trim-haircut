import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

const Clients: React.FC = () => (
  <>
    <SectionHead
      title="Clients"
      lede="The people who have sat in your chair, with the cut they left with and how often they come back."
    />

    <PendingPanel
      title="No client history yet"
      text="A client list is derived from completed appointments, so it stays empty until bookings are recorded."
      facts={[
        { label: 'Row', value: 'Customer, visits, last cut' },
        { label: 'Detail', value: 'Saved cut, notes, reference images' },
        { label: 'Sort', value: 'Most recent visit' },
      ]}
    />
  </>
);

export default Clients;
