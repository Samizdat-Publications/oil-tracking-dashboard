// The Bill landing page: clips play while on screen. The page works without this script except the motion.
(function () {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conn = navigator.connection;
  // Only real data saver or a very slow link skips autoplay (a "3g" label is common on fine connections).
  const saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));

  const play = (v) => {
    if (saveData || reduced) { v.controls = true; return; }
    if (v.preload === 'none') v.preload = 'auto';
    v.play().catch(() => (v.controls = true));
  };

  const hero = document.getElementById('hero-video');
  if (hero && (saveData || reduced)) {
    hero.removeAttribute('autoplay');
    hero.pause();
    hero.controls = true;
  }

  const inview = [...document.querySelectorAll('video[data-inview]')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => {
      for (const e of es) { if (e.isIntersecting) play(e.target); else e.target.pause(); }
    }, { threshold: 0.4 });
    inview.forEach((v) => io.observe(v));
  } else {
    inview.forEach((v) => (v.controls = true));
  }
})();
