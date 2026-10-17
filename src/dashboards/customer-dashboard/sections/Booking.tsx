import { BOOKING_METRICS, BOOKINGS } from '../data';
import SectionHead from './SectionHead';

const Booking: React.FC = () => (
  <>
    <SectionHead
      title="Booking"
      lede="Every appointment with the barbers you follow. Confirmed cuts keep your recommendation history in order so the next one starts from what you actually got."
    />

    <ul className="trim-metrics">
      {BOOKING_METRICS.map((metric) => (
        <li className="trim-metric" key={metric.label}>
          <p className="trim-metric__label">{metric.label}</p>
          <p className="trim-metric__value">{metric.value}</p>
          <p
            className={`trim-metric__delta${metric.isGood ? '' : ' trim-metric__delta--down'}`}
          >
            {metric.delta}
          </p>
        </li>
      ))}
    </ul>

    <div className="trim-table-wrap">
      <table className="trim-table">
        <caption className="trim-visually-hidden">
          Appointments by date, barber, service and status
        </caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Barber</th>
            <th scope="col">Service</th>
            <th scope="col">Status</th>
            <th scope="col" className="trim-table__num">
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {BOOKINGS.map((booking) => (
            <tr key={booking.id}>
              <td data-label="When">{booking.when}</td>
              <td data-label="Barber">
                <span className="trim-table__primary">{booking.barber}</span>
                <span className="trim-table__secondary">{booking.shop}</span>
              </td>
              <td data-label="Service">{booking.service}</td>
              <td data-label="Status">
                <span className={`trim-status trim-status--${booking.status.toLowerCase()}`}>
                  {booking.status}
                </span>
              </td>
              <td data-label="Price" className="trim-table__num">
                {booking.price}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </>
);

export default Booking;