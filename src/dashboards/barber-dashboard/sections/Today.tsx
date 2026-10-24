import { useAuth } from '../../../auth/AuthProvider';
import PendingPanel from '../../shell/PendingPanel';
import SectionHead from '../../shell/SectionHead';

/**
 * The barber's landing page. Counts stay as em dashes until bookings exist:
 * a zero would claim "nothing booked today", which is not the same as
 * "bookings are not stored yet".
 */
const Today: React.FC = () => {
  const { session, profile } = useAuth();

  const memberSince = session?.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <>
      <SectionHead
        title="Today"
        lede="Your chair for the day: the appointments in order, the customer's reference image, and what is still open."
      />

      <ul className="trim-metrics">
        <li className="trim-metric">
          <p className="trim-metric__label">Today's appointments</p>
          <p className="trim-metric__value">—</p>
          <p className="trim-metric__delta trim-metric__delta--down">Bookings not stored yet</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">This week</p>
          <p className="trim-metric__value">—</p>
          <p className="trim-metric__delta trim-metric__delta--down">Bookings not stored yet</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Next appointment</p>
          <p className="trim-metric__value">—</p>
          <p className="trim-metric__delta trim-metric__delta--down">Nothing scheduled</p>
        </li>
        <li className="trim-metric">
          <p className="trim-metric__label">Member since</p>
          <p className="trim-metric__value trim-metric__value--text">{memberSince}</p>
          <p className="trim-metric__delta">{profile?.username ?? 'Barber'}</p>
        </li>
      </ul>

      <PendingPanel
        title="No schedule to show"
        text="Trim has no bookings table yet, so there is nothing to order into a day. Once it exists, today's list appears here with accept and decline for new requests."
        facts={[
          { label: 'Order', value: 'By start time, with the next chair highlighted' },
          { label: 'Per row', value: 'Customer, service, reference image' },
          { label: 'Actions', value: 'Accept, decline, mark no-show' },
        ]}
      />
    </>
  );
};

export default Today;
