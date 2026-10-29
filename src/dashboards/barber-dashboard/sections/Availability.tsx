import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

const Availability: React.FC = () => (
  <>
    <SectionHead
      title="Availability"
      lede="The hours customers can book against: Monday to Saturday, 8:00 AM to 5:00 PM in Naujan time, in half-hour starts."
    />

    <PendingPanel
      title="Shop hours are fixed for now"
      text="create_booking() checks every request against Mon–Sat, 8:00 AM–5:00 PM in Asia/Manila and the last start depends on the service length. Per-day exceptions and per-barber hours are not editable yet."
      facts={[
        { label: 'Open', value: 'Mon–Sat, 8:00 AM–5:00 PM' },
        { label: 'Closed', value: 'Sundays' },
        { label: 'Window', value: '90 days ahead' },
      ]}
    />
  </>
);

export default Availability;
