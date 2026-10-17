import { useEffect, useRef } from 'react';

import './About.css';

// Pinned behind the hero, so it never enters the viewport alone.
const About: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Decorative clip, so it only decodes while on screen.
  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0 },
    );
    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="trim-about" id="about" aria-labelledby="trim-about-title" ref={sectionRef}>
      <video
        ref={videoRef}
        className="trim-about__video"
        src="/assets/video/trim.mp4"
        muted
        loop
        autoPlay
        playsInline
        preload="auto"
        tabIndex={-1}
        aria-hidden="true"
      />

      <h2 className="trim-about__copy" id="trim-about-title">
        Trim is a hairstyle discovery and recommendation application designed to help
        customers find hairstyles that complement their face shape, hair type, and hair
        length.
      </h2>
    </section>
  );
};

export default About;