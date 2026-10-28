import { useEffect } from 'react';

/** True when the OS asks for reduced motion or the in-app "Reduce motion" setting is on. */
export function motionReduced() {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('reduce-motion')
  );
}

/**
 * Fades in elements marked `data-reveal` as they scroll into view, once each.
 * Uses a data attribute (not a class) so React re-renders never undo it, and
 * does nothing — leaving everything visible — without IntersectionObserver or
 * when reduced motion is requested.
 */
export function useRevealOnScroll() {
  useEffect(() => {
    if (!('IntersectionObserver' in window) || motionReduced()) return undefined;
    const root = document.documentElement;
    const targets = [...document.querySelectorAll('[data-reveal]:not([data-visible])')];
    if (!targets.length) return undefined;

    root.classList.add('reveal-ready');
    let delivered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        delivered = true;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-visible', '');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    );
    targets.forEach((el) => observer.observe(el));

    // The observer reports every target right after observe(). If nothing arrives
    // (observer paused or unavailable in this context), never leave content hidden.
    const fallback = setTimeout(() => {
      if (delivered) return;
      observer.disconnect();
      root.classList.remove('reveal-ready');
    }, 1500);

    return () => {
      clearTimeout(fallback);
      observer.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, []);
}
