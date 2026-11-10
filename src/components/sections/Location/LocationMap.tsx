import { useEffect, useRef, useState } from 'react';

import { COORDS, SHOP } from './shop';
import './Location.css';

// Leaflet is vendored in public/assets/leaflet and loaded via a script tag,
// because Vite refuses module imports out of public/. The global build attaches
// to globalThis.leaflet, so each class is constructed with new.
const LEAFLET_JS = '/assets/leaflet/dist/leaflet-global.js';
const LEAFLET_CSS = '/assets/leaflet/dist/leaflet.css';

// Card clearance from the frame edge and the marker dot.
const GAP = 12;
// Below this the card docks to the frame bottom.
const NARROW = 768;

// Only the surface used here; the build ships no declarations.
interface LeafletPoint {
  x: number;
  y: number;
}

interface LeafletLatLngBounds {
  pad(padding: number): LeafletLatLngBounds;
}

interface LeafletMap {
  remove(): void;
  invalidateSize(animate?: boolean): this;
  on(type: string, handler: () => void): this;
  off(type: string, handler: () => void): this;
  latLngToContainerPoint(position: [number, number]): LeafletPoint;
  fitBounds(bounds: [number, number][] | LeafletLatLngBounds, options?: Record<string, unknown>): this;
}

interface LeafletLayer {
  addTo(map: LeafletMap): this;
  remove(): void;
}

interface LeafletMarker extends LeafletLayer {
  getElement(): HTMLElement | null;
}

interface LeafletPolyline extends LeafletLayer {
  getBounds(): LeafletLatLngBounds;
}

interface LeafletGlobal {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => LeafletMap;
  TileLayer: new (url: string, options: Record<string, unknown>) => LeafletLayer;
  Marker: new (position: [number, number], options: Record<string, unknown>) => LeafletMarker;
  DivIcon: new (options: Record<string, unknown>) => unknown;
  Polyline: new (positions: [number, number][], options?: Record<string, unknown>) => LeafletPolyline;
  LatLngBounds: new (positions: [number, number][]) => LeafletLatLngBounds;
}

declare global {
  interface Window {
    leaflet?: LeafletGlobal;
  }
}

/** Loads the bundle once and resolves with its global. */
const loadLeaflet = () =>
  new Promise<LeafletGlobal>((resolve, reject) => {
    if (window.leaflet) {
      resolve(window.leaflet);
      return;
    }

    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);

    const onLoad = () => {
      if (window.leaflet) resolve(window.leaflet);
      else reject(new Error('Leaflet loaded but exposed no global'));
    };

    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', () => reject(new Error('Leaflet failed to load')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Leaflet failed to load')), {
      once: true,
    });
    document.head.appendChild(script);
  });

export interface RouteDisplay {
  from: [number, number];
  fromLabel?: string;
  path: [number, number][];
}

interface LocationMapProps {
  /** Extra class on the frame, so the footer and the modal can size it. */
  className?: string;
  route?: RouteDisplay | null;
}

/**
 * The map itself, with no chrome beyond the marker card. Mounted inside the
 * footer modal rather than inline, so it only builds once the modal opens.
 */
const LocationMap: React.FC<LocationMapProps> = ({ className, route }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletGlobal | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const routeLineRef = useRef<LeafletPolyline | null>(null);
  const fromMarkerRef = useRef<LeafletMarker | null>(null);
  const readyRef = useRef(false);
  const routeRef = useRef<RouteDisplay | null | undefined>(route);
  const [isCardVisible, setIsCardVisible] = useState(true);
  routeRef.current = route;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || mapRef.current) return;

    let cancelled = false;
    const teardown: Array<() => void> = [];

    const applyRoute = (nextRoute?: RouteDisplay | null) => {
      const map = mapRef.current;
      const L = leafletRef.current;
      if (!map || !L) return;

      routeLineRef.current?.remove();
      routeLineRef.current = null;
      fromMarkerRef.current?.remove();
      fromMarkerRef.current = null;

      if (!nextRoute || nextRoute.path.length < 2) return;

      fromMarkerRef.current = new L.Marker(nextRoute.from, {
        icon: new L.DivIcon({
          className: 'trim-location__pin trim-location__pin--from',
          html: '<span aria-hidden="true"></span>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        title: nextRoute.fromLabel ?? 'Your location',
        interactive: false,
        keyboard: false,
      }).addTo(map);

      routeLineRef.current = new L.Polyline(nextRoute.path, {
        color: '#0034ff',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(map);

      try {
        map.fitBounds(routeLineRef.current.getBounds().pad(0.2), { animate: false });
      } catch {
        // Ignore if bounds are invalid.
      }
    };

    loadLeaflet()
      .then((L) => {
        if (cancelled) return;
        leafletRef.current = L;

        const map = new L.Map(mount, {
          center: COORDS,
          zoom: 14,
          // Page scrolling must win over map zoom, or the map swallows the scroll.
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true,
        });

        new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        new L.Marker(COORDS, {
          // Div icon, so nothing depends on the marker PNGs resolving.
          icon: new L.DivIcon({
            className: 'trim-location__pin trim-location__pin--shop',
            html: '<span aria-hidden="true"></span>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          title: `${SHOP.name}, ${SHOP.branch}`,
          alt: `${SHOP.name} barbershop in ${SHOP.branch}`,
          // The card is always open, so the marker is a position marker rather
          // than a control. Nothing to click.
          interactive: false,
          keyboard: false,
        }).addTo(map);

        // The card tracks the marker, so re-place it on every move and zoom.
        // Clamped in script rather than CSS: the marker sits mid-map, so a fixed
        // offset runs off the edge on a narrow box.
        const place = () => {
          const card = cardRef.current;
          if (!card) return;

          const point = map.latLngToContainerPoint(COORDS);

          if (mount.clientWidth <= NARROW) {
            // Phone: a card floating above the marker is too wide, so it docks
            // to the frame bottom. Set here because inline styles would win.
            card.style.left = `${GAP}px`;
            card.style.top = `${Math.max(GAP, mount.clientHeight - card.offsetHeight - GAP)}px`;
            return;
          }

          const width = card.offsetWidth;
          const maxLeft = Math.max(GAP, mount.clientWidth - width - GAP);

          card.style.left = `${Math.min(Math.max(point.x, GAP), maxLeft)}px`;
          card.style.top = `${point.y}px`;
        };

        // The card is always open, so it only needs placing. No hover, click or
        // pin state: the shop details are the point of the map, not a reward
        // for finding the marker.
        map.on('move', place);
        map.on('zoom', place);
        teardown.push(() => map.off('move', place), () => map.off('zoom', place));

        mapRef.current = map;
        readyRef.current = true;
        // Measures on attach; without this the tiles clip while settling.
        map.invalidateSize();
        place();
        applyRoute(routeRef.current);
      })
      .catch((error: unknown) => {
        console.warn('Map unavailable:', error);
      });

    return () => {
      cancelled = true;
      teardown.forEach((off) => off());
      routeLineRef.current?.remove();
      routeLineRef.current = null;
      fromMarkerRef.current?.remove();
      fromMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current) return;
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    routeLineRef.current?.remove();
    routeLineRef.current = null;
    fromMarkerRef.current?.remove();
    fromMarkerRef.current = null;

    if (!route || route.path.length < 2) return;

    fromMarkerRef.current = new L.Marker(route.from, {
      icon: new L.DivIcon({
        className: 'trim-location__pin trim-location__pin--from',
        html: '<span aria-hidden="true"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      title: route.fromLabel ?? 'Your location',
      interactive: false,
      keyboard: false,
    }).addTo(map);

    routeLineRef.current = new L.Polyline(route.path, {
      color: '#0034ff',
      weight: 5,
      opacity: 0.85,
      lineJoin: 'round',
    }).addTo(map);

    try {
      map.fitBounds(routeLineRef.current.getBounds().pad(0.2), { animate: false });
    } catch {
      // Ignore if bounds are invalid.
    }
  }, [route]);

  useEffect(() => {
    if (!isCardVisible) return;
    const map = mapRef.current;
    const mount = mountRef.current;
    const card = cardRef.current;
    if (!map || !mount || !card) return;

    const point = map.latLngToContainerPoint(COORDS);
    if (mount.clientWidth <= NARROW) {
      card.style.left = `${GAP}px`;
      card.style.top = `${Math.max(GAP, mount.clientHeight - card.offsetHeight - GAP)}px`;
      return;
    }

    const width = card.offsetWidth;
    const maxLeft = Math.max(GAP, mount.clientWidth - width - GAP);
    card.style.left = `${Math.min(Math.max(point.x, GAP), maxLeft)}px`;
    card.style.top = `${point.y}px`;
  }, [isCardVisible]);

  return (
    <div className={`trim-location__frame${className ? ` ${className}` : ''}`}>
      <div
        ref={mountRef}
        className="trim-location__map"
        role="region"
        aria-label={`Map of ${SHOP.name} barbershop, ${SHOP.address}`}
      />

      <button
        className="trim-location__card-toggle"
        type="button"
        onClick={() => setIsCardVisible((visible) => !visible)}
        aria-pressed={isCardVisible}
        aria-label={isCardVisible ? 'Hide barbershop details' : 'Show barbershop details'}
      >
        {isCardVisible ? 'Hide shop info' : 'Show shop info'}
      </button>

      {/* Anchored to the marker, so positioned in script. Not a dialog: it takes
          no focus and cannot be dismissed with Escape. */}
      {isCardVisible ? (
        <div ref={cardRef} className="trim-location__card">
          <p className="trim-location__card-name">{SHOP.name}</p>
          <p className="trim-location__card-branch">{SHOP.branch}</p>

          <ul className="trim-location__card-list">
            <li>{SHOP.address}</li>
            <li>{SHOP.hours}</li>
            <li>{SHOP.phone}</li>
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default LocationMap;