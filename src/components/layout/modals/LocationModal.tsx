import { useEffect, useRef } from 'react';

import { IonModal } from '@ionic/react';

import LocationMap from '../../sections/Location/LocationMap';
import { SHOP } from '../../sections/Location/shop';
import './LocationModal.css';

interface LocationModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

/**
 * Full-screen map, opened from the footer's location card. The map itself is
 * heavy to build, so it is only mounted while the modal is open.
 */
const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onDismiss }) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
  }, [isOpen]);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      className="trim-location-modal"
      initialBreakpoint={1}
      breakpoints={[0, 1]}
    >
      <div className="trim-location-modal__panel">
        <div className="trim-location-modal__head">
          <div>
            <h2 className="trim-location-modal__title">{SHOP.name}</h2>
            <p className="trim-location-modal__address">{SHOP.address}</p>
          </div>

          <button
            ref={closeRef}
            className="trim-location-modal__close"
            type="button"
            onClick={onDismiss}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <span className="trim-visually-hidden">Close map</span>
          </button>
        </div>

        <LocationMap className="trim-location__frame--modal" />
      </div>
    </IonModal>
  );
};

export default LocationModal;