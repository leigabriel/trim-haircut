import { IonModal } from '@ionic/react';

import { DOWNLOAD_LINKS } from './downloadData';
import './DownloadModal.css';

interface DownloadModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

/**
 * Download App, styled after the login sheet: full screen, black, brand mark
 * top left.
 *
 * The store links come from downloadData.ts and are placeholders until the
 * listing URLs exist. They are rendered disabled rather than as dead links.
 */
const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onDismiss }) => (
  <IonModal
    isOpen={isOpen}
    onDidDismiss={onDismiss}
    className="trim-download"
    initialBreakpoint={1}
    breakpoints={[0, 1]}
  >
    <div className="trim-download__panel">
      <img
        className="trim-download__mark"
        src="/assets/ui/T-1.png"
        alt=""
        aria-hidden="true"
      />

      <button
        className="trim-download__close"
        type="button"
        onClick={onDismiss}
        aria-label="Close download"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="trim-download__body">
        <p className="trim-download__eyebrow">Get</p>

        <h2 className="trim-download__title">
          Trim
          <br />
          In your pocket
        </h2>

        <p className="trim-download__lede">
          Scan a face, save the styles that suit you, and carry the reference to
          the chair.
        </p>

        <ul className="trim-download__list">
          {DOWNLOAD_LINKS.map((link) => (
            <li key={link.label}>
              <a
                className={`trim-download__store${link.href ? '' : ' trim-download__store--soon'}`}
                href={link.href ?? undefined}
                aria-disabled={link.href ? undefined : 'true'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="trim-download__store-label">{link.label}</span>
                <span className="trim-download__store-note">
                  {link.href ? 'Download' : 'Not published yet'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </IonModal>
);

export default DownloadModal;