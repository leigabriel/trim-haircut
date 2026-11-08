import { useAvatarSrc } from '../../components/profile/useAvatarSrc';

interface BookingAvatarProps {
  src: string | null | undefined;
  name: string;
  /** Size modifier from booking.css. */
  className?: string;
}

const initialOf = (name: string): string =>
  name.trim().charAt(0).toUpperCase() || '?';

/**
 * The customer or barber picture shown on a booking surface. A missing avatar
 * falls back to the first letter, and a URL that fails to load takes the same
 * fallback instead of leaving a broken image beside the name.
 *
 * Alt text stays empty: the name is always rendered beside it, so repeating it
 * would make a screen reader announce the person twice.
 */
const BookingAvatar: React.FC<BookingAvatarProps> = ({ src, name, className }) => {
  const avatar = useAvatarSrc(src);
  const classes = `trim-book-avatar${className ? ` ${className}` : ''}`;

  if (avatar.src) {
    return (
      <img
        className={classes}
        src={avatar.src}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={avatar.onError}
      />
    );
  }

  return (
    <span className={`${classes} trim-book-avatar--initial`} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
};

export default BookingAvatar;
