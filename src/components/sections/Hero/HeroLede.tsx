import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface HeroLedeProps {
  isEntered: boolean;
}

const WORDS = [
  'Oriental',
  'Mindoro',
  '-',
  'based',
  'barbershop',
  'specializing',
  'in',
  'the',
  'latest',
  'hair',
  'styles',
];

// Word markup built once; the reveal is a separate effect.
const useLedeMarkup = (ref: React.RefObject<HTMLParagraphElement | null>) => {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const frag = document.createDocumentFragment();
    WORDS.forEach((word, index) => {
      // Mask wraps the word only; the space sits outside it.
      const mask = document.createElement('span');
      mask.className = 'trim-hero__lede-mask';
      const inner = document.createElement('span');
      inner.className = 'trim-hero__lede-word';
      inner.textContent = word;
      mask.appendChild(inner);
      frag.appendChild(mask);
      if (index < WORDS.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    node.replaceChildren(frag);
  }, [ref]);
};

// Word by word.
const HeroLede: React.FC<HeroLedeProps> = ({ isEntered }) => {
  const ref = useRef<HTMLParagraphElement>(null);

  useLedeMarkup(ref);

  useEffect(() => {
    const node = ref.current;
    if (!node || !isEntered) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const words = node.querySelectorAll<HTMLElement>('.trim-hero__lede-word');
    if (words.length === 0) return;

    // force3D keeps each word on its own layer, so no layout or paint on the hero.
    const context = gsap.context(() => {
      gsap.fromTo(
        words,
        { yPercent: 118, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.62,
          ease: 'power2.out',
          stagger: 0.045,
          overwrite: true,
          force3D: true,
          onComplete: () => gsap.set(words, { clearProps: 'willChange,transform' }),
        },
      );
    }, node);

    return () => context.revert();
  }, [isEntered]);

  return <p className="trim-hero__lede" ref={ref} aria-label={WORDS.join(' ')} />;
};

export default HeroLede;