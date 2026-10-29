import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

const Clients: React.FC = () => (
  <>
    <SectionHead
      title="Clients"
      lede="The people who book your chair. Until the client history is built, their contact details and notes are on the Appointments page."
    />

    <PendingPanel
      title="Client history is not built yet"
      text="Completed and upcoming appointments are listed in Appointments with each customer's phone, email and notes. A deduplicated client history is a later pass."
      facts={[
        { label: 'Now', value: 'Appointments page' },
        { label: 'Source', value: 'Completed bookings' },
        { label: 'Later', value: 'Visits, last cut, notes' },
      ]}
    />
  </>
);

export default Clients;
