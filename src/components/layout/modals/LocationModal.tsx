import { useEffect, useRef, useState } from 'react';

import { IonModal } from '@ionic/react';

import LocationMap from '../../sections/Location/LocationMap';
import type { RouteDisplay } from '../../sections/Location/LocationMap';
import { COORDS, SHOP } from '../../sections/Location/shop';
import './LocationModal.css';

interface LocationModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Full-screen map, opened from the footer's location card. The map itself is
 * heavy to build, so it is only mounted while the modal is open.
 */
const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onDismiss }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState('');
  const [route, setRoute] = useState<RouteDisplay | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
  }, [isOpen]);

  const fetchRoute = async (from: [number, number], fromLabel?: string) => {
    setIsBusy(true);
    setStatus('Finding route to the barbershop...');
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${COORDS[1]},${COORDS[0]}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Route request failed');
      const data = (await response.json()) as {
        routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }[];
      };
      const coords = data.routes?.[0]?.geometry?.coordinates;
      if (!coords || coords.length < 2) throw new Error('No route found');

      const path = coords.map(([lon, lat]) => [lat, lon] as [number, number]);
      setRoute({ from, fromLabel, path });
      const meters = data.routes?.[0]?.distance ?? 0;
      const seconds = data.routes?.[0]?.duration ?? 0;
      const km = (meters / 1000).toFixed(1);
      const mins = Math.max(1, Math.round(seconds / 60));
      setStatus(`Route found: about ${km} km, ${mins} min drive to ${SHOP.name}.`);
    } catch {
      setStatus('Could not find a route from that location. Try a more specific place.');
    } finally {
      setIsBusy(false);
    }
  };

  const searchLocation = async () => {
    const value = query.trim();
    if (!value) {
      setStatus('Enter your location to show a route.');
      return;
    }

    setIsBusy(true);
    setStatus('Searching for your location...');
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(value)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Search failed');
      const results = (await response.json()) as NominatimResult[];
      const first = results[0];
      if (!first) {
        setStatus('Location not found. Try a more specific address or place name.');
        return;
      }
      const from: [number, number] = [Number(first.lat), Number(first.lon)];
      await fetchRoute(from, first.display_name);
    } catch {
      setStatus('Could not search for that location right now. Try again.');
      setIsBusy(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported on this device or browser.');
      return;
    }

    setIsBusy(true);
    setStatus('Getting your current location...');

    const requestPosition = (highAccuracy: boolean) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 10000 : 15000,
          maximumAge: 30000,
        });
      });

    void (async () => {
      try {
        const position = await requestPosition(true);
        const from: [number, number] = [position.coords.latitude, position.coords.longitude];
        await fetchRoute(from, 'Your current location');
        return;
      } catch (error) {
        const geoError = error as GeolocationPositionError;
        if (geoError?.code === 2 || geoError?.code === 3) {
          try {
            setStatus('Retrying with lower location accuracy...');
            const position = await requestPosition(false);
            const from: [number, number] = [position.coords.latitude, position.coords.longitude];
            await fetchRoute(from, 'Your current location');
            return;
          } catch (retryError) {
            error = retryError;
          }
        }

        const finalError = error as GeolocationPositionError;
        if (finalError?.code === 1) {
          setStatus('Location access was denied. Allow location permission for this site, then try again.');
        } else if (finalError?.code === 2) {
          setStatus('Your location is unavailable right now. Check device location services or type your location.');
        } else if (finalError?.code === 3) {
          setStatus('Getting your location timed out. Try again, or type your location.');
        } else {
          setStatus('Could not get your current location. Try again or type your location.');
        }
        setIsBusy(false);
      }
    })();
  };

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

        <div className="trim-location-modal__controls">
          <label className="trim-location-modal__search">
            <span className="trim-visually-hidden">Your location</span>
            <input
              className="trim-location-modal__input"
              type="text"
              value={query}
              placeholder="Type your location (address, barangay, or city)"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void searchLocation();
              }}
            />
          </label>
          <div className="trim-location-modal__actions">
            <button
              className="trim-location-modal__action trim-location-modal__action--primary"
              type="button"
              onClick={() => void searchLocation()}
              disabled={isBusy}
            >
              Show route
            </button>
            <button
              className="trim-location-modal__action"
              type="button"
              onClick={useMyLocation}
              disabled={isBusy}
            >
              Use my location
            </button>
          </div>
          {status ? <p className="trim-location-modal__status" role="status">{status}</p> : null}
        </div>

        {isOpen ? <LocationMap className="trim-location__frame--modal" route={route} /> : null}
      </div>
    </IonModal>
  );
};

export default LocationModal;