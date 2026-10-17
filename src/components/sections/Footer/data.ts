export interface FooterLink {
  index: string;
  label: string;
  /** Opens a modal rather than navigating, when set. */
  action?: 'download';
}

export const FOOTER_LINKS: FooterLink[] = [
  { index: '01', label: 'Download App', action: 'download' },
];

export interface SocialLink {
  label: string;
  href: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  { label: 'email', href: 'mailto:hello@trim.app' },
  { label: 'instagram', href: 'https://instagram.com/trim' },
  { label: 'facebook', href: 'https://facebook.com/trim' },
  { label: 'tiktok', href: 'https://tiktok.com/leimxnsquare' },
];