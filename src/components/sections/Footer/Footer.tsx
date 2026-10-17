import { useState } from 'react';

import DownloadModal from '../../layout/modals/DownloadModal';
import LocationModal from '../../layout/modals/LocationModal';
import { SHOP } from '../Location/shop';
import Scissors from './Scissors';
import { FOOTER_LINKS, SOCIAL_LINKS } from './data';
import './Footer.css';

const WORDMARK = 'Trim';
const YEAR = String(new Date().getFullYear());

// Normal flow after the styles grid. A pinned back layer left it too little
// scroll travel to settle, which clipped the nav links.
const Footer: React.FC = () => {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);

  return (
    <section className="trim-footer" aria-labelledby="trim-footer-title">
      {/* Backdrop layer. Sits behind every piece of copy and bleeds off the
          bottom, so it reads as a graphic rather than a column of content. */}
      <div className="trim-footer__stage" aria-hidden="true">
        <Scissors fill={1.15} offsetY={0.18} />
      </div>

      <div className="trim-footer__inner">
        <div className="trim-footer__topbar">
          <span className="trim-footer__tag">Trim</span>
          <span className="trim-footer__tag">{YEAR}</span>
        </div>

        <nav className="trim-footer__nav" aria-label="Footer">
          {FOOTER_LINKS.map((link) => (
            <button
              className="trim-footer__link"
              key={link.index}
              type="button"
              onClick={() => {
                if (link.action === 'download') setIsDownloadOpen(true);
              }}
            >
              <span className="trim-footer__index" aria-hidden="true">
                {link.index}
              </span>
              <span className="trim-footer__label">{link.label}</span>
              <span className="trim-footer__hint" aria-hidden="true">
                View
              </span>
            </button>
          ))}

          <button
            className="trim-footer__link"
            type="button"
            onClick={() => setIsMapOpen(true)}
          >
            <span className="trim-footer__index" aria-hidden="true">
              02
            </span>
            <span className="trim-footer__label">Location</span>
            <span className="trim-footer__hint" aria-hidden="true">
              View
            </span>
          </button>
        </nav>

        <div className="trim-footer__socials">
          {SOCIAL_LINKS.map((link) => (
            <a
              className="trim-footer__social"
              href={link.href}
              key={link.label}
              target={link.label === 'email' ? undefined : '_blank'}
              rel="noopener noreferrer"
            >
              [{link.label}]
            </a>
          ))}
        </div>

        <address className="trim-footer__shop">
          <span className="trim-footer__shop-name">{SHOP.name}</span>
          <span className="trim-footer__shop-line">{SHOP.address}</span>
          <span className="trim-footer__shop-line">{SHOP.hours}</span>
          <a className="trim-footer__shop-line" href={`tel:${SHOP.phone.replace(/\s/g, '')}`}>
            {SHOP.phone}
          </a>
        </address>

        {/* Largest element on the page, and the last thing in it. Bleeds off
            the bottom edge by design. */}
        <h2 className="trim-footer__wordmark" id="trim-footer-title" aria-label="Trim">
          {WORDMARK.split('').map((char, index) => (
            <span className="trim-footer__char" key={index} aria-hidden="true">
              {char}
            </span>
          ))}
        </h2>
      </div>

      <LocationModal isOpen={isMapOpen} onDismiss={() => setIsMapOpen(false)} />
      <DownloadModal isOpen={isDownloadOpen} onDismiss={() => setIsDownloadOpen(false)} />
    </section>
  );
};

export default Footer;