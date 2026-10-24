import { useEffect } from 'react';
import { createAnimation } from '@ionic/react';

/** Short on purpose: the hero has a WebGL scene behind it already holding frames. */
const FADE_MS = 420;

/**
 * Fades the hero in once the intro clears.
 *
 * Ionic's createAnimation drives the Web Animations API, so the fade is handed
 * to the compositor instead of being stepped by React or a JS tween. That
 * matters here: the old entrance animated opacity and a transform while the
 * tool stage was uploading textures, and the two competed for the main thread.
 *
 * Reduced motion skips the fade and reveals the section outright.
 */
export const useHeroFade = (
  ref: React.RefObject<HTMLElement | null>,
  isEntered: boolean,
): void => {
  useEffect(() => {
    const node = ref.current;
    if (!node || !isEntered) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.style.opacity = '1';
      return;
    }

    const animation = createAnimation()
      .addElement(node)
      .duration(FADE_MS)
      .easing('ease-out')
      .fill('both')
      .fromTo('opacity', '0', '1')
      // Written out as well as filled: the inline value is what keeps the hero
      // visible if the animation object is ever torn down.
      .afterStyles({ opacity: '1' });

    void animation.play();

    return () => animation.destroy();
  }, [ref, isEntered]);
};
