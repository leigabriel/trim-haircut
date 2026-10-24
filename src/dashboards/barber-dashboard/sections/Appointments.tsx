import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

const Appointments: React.FC = () => (
  <>
    <SectionHead
      title="Appointments"
      lede="Every booking for your chair, past and upcoming, rather than the single day Today shows."
    />

    <PendingPanel
      title="No appointments yet"
      text="Appointments are not written to the database yet. When they are, this page lists them by date with the customer's reference image attached."
      facts={[
        { label: 'Range', value: 'Upcoming, today, past' },
        { label: 'Row', value: 'Customer, service, time, status' },
        { label: 'Actions', value: 'Accept, decline, reschedule' },
      ]}
    />
  </>
);

export default Appointments;
