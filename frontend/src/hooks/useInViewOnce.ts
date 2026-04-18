import { useEffect, useRef, useState } from 'react';

/**
 * One-shot "has this element ever entered view?" hook.
 *
 * Returns `[ref, hasBeenVisible]`. Attach the ref to a sentinel element
 * roughly where you want the lazy work to kick in; `hasBeenVisible` flips to
 * `true` the first time the element intersects the viewport and stays true.
 *
 * Used to defer expensive work (e.g. Monte Carlo simulation) off the hero
 * critical path until the user scrolls toward the feature that needs it.
 */
export function useInViewOnce<T extends Element = HTMLDivElement>(
  options: IntersectionObserverInit = { rootMargin: '200px 0px', threshold: 0 },
) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      options,
    );
    io.observe(el);
    return () => io.disconnect();
    // options is intentionally excluded — callers pass a literal that
    // changes identity every render but is semantically stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return [ref, visible] as const;
}
