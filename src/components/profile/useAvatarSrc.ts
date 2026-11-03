import { useEffect, useState } from 'react';

import { AVATAR_OPTIONS } from '../../auth/avatars';

/**
 * Normalises a stored avatar value before it reaches an <img>.
 *
 * Most rows hold a Trim path such as /assets/avatar/men-1.png or a Google
 * profile URL, but older rows can hold a bare avatar id or a path without the
 * leading slash. Resolving those here means one broken value cannot leave a
 * broken image beside a name.
 */
export const resolveAvatarSrc = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;

  const src = value.trim();
  if (!src) return null;

  const known = AVATAR_OPTIONS.find(
    (option) =>
      option.src === src ||
      option.id === src ||
      option.src.endsWith(`/${src}`),
  );
  if (known) return known.src;

  if (src.startsWith('//')) return `https:${src}`;
  // Google photos are served over https; an http value is mixed content on the
  // deployed site and browsers block it before it can paint.
  if (src.startsWith('http://')) return `https://${src.slice(7)}`;
  if (src.startsWith('assets/')) return `/${src}`;

  return src;
};

/**
 * The image source plus a fallback switch for a URL that resolves but fails to
 * load. Callers render the initial when `src` is null.
 */
export const useAvatarSrc = (
  value: string | null | undefined,
): { src: string | null; onError: () => void } => {
  const resolved = resolveAvatarSrc(value);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  return {
    src: failed ? null : resolved,
    onError: () => setFailed(true),
  };
};
