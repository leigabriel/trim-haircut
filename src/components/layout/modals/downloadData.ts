export interface DownloadLink {
  label: string;
  /**
   * The store listing URL. Null until the app is actually published, so the
   * modal can say so rather than rendering a link that goes nowhere.
   */
  href: string | null;
}

export const DOWNLOAD_LINKS: DownloadLink[] = [
  { label: 'iOS · App Store', href: null },
  { label: 'Android · Google Play', href: null },
];