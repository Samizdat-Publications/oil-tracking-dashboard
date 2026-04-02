import { useState, useEffect, useRef } from 'react';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function useCountUp(
  target: number,
  duration: number = 800,
  decimals: number = 2,
): string {
  const [display, setDisplay] = useState('--');
  const prevTarget = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target == null || isNaN(target)) {
      setDisplay('--');
      return;
    }

    const from = prevTarget.current ?? 0;
    prevTarget.current = target;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = from + (target - from) * eased;
      setDisplay(current.toFixed(decimals));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, decimals]);

  return display;
}
