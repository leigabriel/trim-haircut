import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/AuthProvider';
import LoginModal from './modals/LoginModal';
import './Nav.css';

/** `tone` matches the page behind the nav: dark text on the hero, light on black. */
interface NavProps {
  tone?: 'dark' | 'light';
}

/**
 * Site nav. Fixed to the top of the viewport and never hides on scroll.
 *
 * No hamburger. The account control is the only entry, and it sits in the bar
 * at every width: an avatar when signed in, the login word when not. A panel
 * holding one link was a second place to look for the same thing.
 */
const Nav: React.FC<NavProps> = ({ tone = 'dark' }) => {
  const { session, profile } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const name = profile?.username ?? profile?.displayName ?? 'your account';

  return (
    <>
      <header className={`trim-nav trim-nav--${tone}`}>
        <Link className="trim-nav__brand" to="/home" aria-label="Trim, home">
          <span aria-hidden="true">T</span>
        </Link>

        <nav className="trim-nav__menu" aria-label="Main">
          <ul className="trim-nav__links">
            {session ? (
              <li>
                <Link className="trim-nav__avatar" to="/dashboard" aria-label={`Dashboard, signed in as ${name}`}>
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" />
                  ) : (
                    <span aria-hidden="true">
                      {(profile?.username ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>
              </li>
            ) : (
              <li>
                <button
                  className="trim-nav__link trim-nav__link--button"
                  type="button"
                  onClick={() => setIsLoginOpen(true)}
                >
                  login
                </button>
              </li>
            )}
          </ul>
        </nav>
      </header>

      <LoginModal isOpen={isLoginOpen} onDismiss={() => setIsLoginOpen(false)} />
    </>
  );
};

export default Nav;