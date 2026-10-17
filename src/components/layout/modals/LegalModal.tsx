import { IonModal } from '@ionic/react';

import './LegalModal.css';

export type LegalDoc = 'terms' | 'privacy';

interface LegalDocCopy {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

// Placeholder copy. Needs counsel review before launch.
const DOCS: Record<LegalDoc, LegalDocCopy> = {
  terms: {
    title: 'Terms of Service',
    updated: 'Last updated 9 October 2026',
    sections: [
      {
        heading: 'Using Trim',
        body: 'Trim provides hairstyle recommendations and booking tools. Recommendations are produced from the face shape, hair type, and length you enter, and are guidance rather than a professional assessment. Always confirm with your barber before committing to a cut.',
      },
      {
        heading: 'Your account',
        body: 'You sign in with Google. You are responsible for activity on your account and for keeping access to the Google account you connected secure. You can sign out at any time from your dashboard.',
      },
      {
        heading: 'Bookings',
        body: 'A booking holds a slot with a barber. Cancellations and reschedules follow the shop policy shown at the time of booking. We are not liable for a barber failing to attend an appointment.',
      },
      {
        heading: 'Content you submit',
        body: 'Photos you upload for analysis, and the details you enter, remain yours. You give us permission to process them to produce your recommendations.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated 9 October 2026',
    sections: [
      {
        heading: 'What we collect',
        body: 'Your name, email address, and profile picture from your Google account. A username you choose. Bookings you make, and hairstyles you save as favourites.',
      },
      {
        heading: 'Face shape analysis',
        body: 'Face images are processed to detect face shape and produce recommendations. They are not used to train models, and are not shared with third parties.',
      },
      {
        heading: 'Who we share with',
        body: 'Your barber sees the hairstyle you share with them when booking, and the booking itself. We do not sell your data, and we do not share it for advertising.',
      },
      {
        heading: 'Deleting your data',
        body: 'Contact us to have your account and associated data erased. Deleting your account removes your profile, bookings, and saved styles.',
      },
    ],
  },
};

interface LegalModalProps {
  /** Null when closed. */
  doc: LegalDoc | null;
  onDismiss: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ doc, onDismiss }) => {
  const copy = doc ? DOCS[doc] : null;

  return (
    <IonModal
      isOpen={doc !== null}
      onDidDismiss={onDismiss}
      className="trim-legal"
      initialBreakpoint={1}
      breakpoints={[0, 1]}
    >
      {copy && (
        <div className="trim-legal__panel">
          <button
            className="trim-legal__close"
            type="button"
            onClick={onDismiss}
            aria-label={`Close ${copy.title}`}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div className="trim-legal__body">
            <h2 className="trim-legal__title">{copy.title}</h2>
            <p className="trim-legal__updated">{copy.updated}</p>

            {copy.sections.map((section) => (
              <section className="trim-legal__section" key={section.heading}>
                <h3 className="trim-legal__heading">{section.heading}</h3>
                <p className="trim-legal__text">{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      )}
    </IonModal>
  );
};

export default LegalModal;