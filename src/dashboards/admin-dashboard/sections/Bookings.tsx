import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

/**
 * Booking oversight, waiting on the bookings table. The shape of the future
 * list is stated so the page documents the gap rather than hiding it.
 */
const AdminBookings: React.FC = () => (
  <>
    <SectionHead
      title="Bookings"
      lede="Every appointment across every shop, including the dispute queue when a no-show is contested."
    />

    <PendingPanel
      title="No booking records yet"
      text="Trim books nothing into the database today. When the bookings table lands, this page becomes the cross-shop list and the place where a disputed no-show is resolved."
      facts={[
        { label: 'Rows', value: 'Customer, barber, service, start time' },
        { label: 'Filters', value: 'Shop, barber, date range, status' },
        { label: 'Actions', value: 'Cancel, rebook, resolve dispute' },
      ]}
    />
  </>
);

export default AdminBookings;
