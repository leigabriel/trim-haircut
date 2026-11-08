import BookingAvatar from './BookingAvatar';
import { barberLabel } from './types';
import type { BarberOption } from './types';

interface BarberPickerProps {
  barbers: BarberOption[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}

/**
 * Barber selection shown inside the booking dialog. Each chair is a profile
 * card with the same avatar and availability the barber controls from their
 * own dashboard, so the customer knows who is taking appointments before they
 * request a slot.
 *
 * Unavailable chairs are disabled unless they are already selected, which
 * keeps an existing booking editable if that barber has since closed their
 * book.
 */
const BarberPicker: React.FC<BarberPickerProps> = ({
  barbers,
  value,
  disabled,
  onChange,
}) => {
  const hasAvailable = barbers.some((barber) => barber.isAvailable);

  return (
    <fieldset className="trim-barber-picker" disabled={disabled}>
      <legend className="trim-book-field__label">Barber</legend>

      {barbers.length === 0 ? (
        <p className="trim-book-field__hint">No barbers are listed yet.</p>
      ) : (
        <>
          <ul className="trim-barber-picker__list">
            {barbers.map((barber) => {
              const selected = barber.id === value;
              const locked = !barber.isAvailable && !selected;

              return (
                <li key={barber.id}>
                  <label
                    className={`trim-barber-picker__card${
                      selected ? ' trim-barber-picker__card--selected' : ''
                    }${barber.isAvailable ? '' : ' trim-barber-picker__card--away'}`}
                  >
                    <input
                      className="trim-visually-hidden"
                      type="radio"
                      name="trim-barber"
                      value={barber.id}
                      checked={selected}
                      disabled={disabled || locked}
                      onChange={() => onChange(barber.id)}
                    />

                    <BookingAvatar
                      src={barber.avatarUrl}
                      name={barberLabel(barber)}
                      className="trim-book-avatar--row"
                    />

                    <span className="trim-barber-picker__text">
                      <span className="trim-barber-picker__name">
                        {barberLabel(barber)}
                      </span>
                      <span
                        className={`trim-barber-picker__state${
                          barber.isAvailable
                            ? ''
                            : ' trim-barber-picker__state--away'
                        }`}
                      >
                        {barber.isAvailable ? 'Available' : 'Not available'}
                      </span>
                    </span>

                    {selected ? (
                      <span className="trim-barber-picker__check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>

          {!hasAvailable ? (
            <p className="trim-book-field__hint">
              No barber has open bookings right now. You can still keep an
              existing chair selected.
            </p>
          ) : null}
        </>
      )}
    </fieldset>
  );
};

export default BarberPicker;
