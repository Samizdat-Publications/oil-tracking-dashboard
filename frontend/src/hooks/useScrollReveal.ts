import { useEffect, useRef } from 'react';

/**
 * Scroll reveal hook using IntersectionObserver.
 *
 * Uses rootMargin to shrink the observation viewport — the element must
 * scroll past the bottom 15% of the viewport before the animation triggers.
 * This ensures animations happen when the user can actually SEE the element,
 * not when it first peeks in at the very bottom edge.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('scroll-revealed');
          observer.unobserve(el);
        }
      },
      {
        // Negative bottom margin = element must be 15% of viewport height
        // ABOVE the bottom edge before it counts as "intersecting"
        rootMargin: '0px 0px -15% 0px',
        threshold: 0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
