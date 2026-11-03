import { useAvatarSrc } from '../../components/profile/useAvatarSrc';

interface AccountAvatarProps {
  src: string | null;
  name: string;
  /** Size or placement modifier from admin.css. */
  className?: string;
}

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

/**
 * The avatar shown beside an account in the admin tables and the booking
 * detail dialog. A missing profile picture falls back to the first letter, so
 * an account without an avatar still has a stable visual marker. A URL that
 * fails to load takes the same fallback rather than showing a broken image.
 *
 * Alt text stays empty: the name is always rendered beside it, and repeating it
 * would make a screen reader announce the person twice.
 */
const AccountAvatar: React.FC<AccountAvatarProps> = ({ src, name, className }) => {
  const avatar = useAvatarSrc(src);
  const classes = `trim-avatar${className ? ` ${className}` : ''}`;

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
    <span className={`${classes} trim-avatar--initial`} aria-hidden="true">
      {initialOf(name)}
    </span>
  );
};

export default AccountAvatar;
