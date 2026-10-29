/**
 * The avatar set in public/assets/avatar, grouped the way the picker shows it.
 * Keeping the paths here rather than in the components means the stored value
 * can be checked on save, so a profile can only point at one of these files.
 */
export interface AvatarOption {
  id: string;
  label: string;
  src: string;
}

export interface AvatarGroup {
  label: string;
  options: AvatarOption[];
}

export const CUSTOM_AVATAR_PREFIX = '/assets/avatar/';

export const AVATAR_GROUPS: readonly AvatarGroup[] = [
  {
    label: 'Men',
    options: [
      { id: 'men-1', label: 'Men 1', src: '/assets/avatar/men-1.png' },
      { id: 'men-2', label: 'Men 2', src: '/assets/avatar/men-2.png' },
      { id: 'men-3', label: 'Men 3', src: '/assets/avatar/men-3.png' },
    ],
  },
  {
    label: 'Women',
    options: [
      { id: 'woman-1', label: 'Women 1', src: '/assets/avatar/woman-1.png' },
      { id: 'woman-2', label: 'Women 2', src: '/assets/avatar/woman-2.png' },
      { id: 'woman-3', label: 'Women 3', src: '/assets/avatar/woman-3.png' },
    ],
  },
];

export const AVATAR_OPTIONS: readonly AvatarOption[] = AVATAR_GROUPS.flatMap(
  (group) => group.options,
);

export const avatarOption = (src: string): AvatarOption | null =>
  AVATAR_OPTIONS.find((option) => option.src === src) ?? null;

/**
 * True once the account has picked one of Trim's avatars. A Google photo also
 * lives in avatar_url, so the value cannot simply be checked for null.
 */
export const isCustomAvatar = (src: string | null | undefined): boolean =>
  typeof src === 'string' && src.startsWith(CUSTOM_AVATAR_PREFIX);
