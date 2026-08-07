/* ============================================================================
   reveal.js — the scroll-reveal engine for the page.

   Every section of this design animates once, on scroll, and never re-triggers.
   The motion is not decoration: a bar that grows is the argument being made.
   A static screenshot of this page is a different, worse design.

   Two things here are deliberate and were arrived at by fixing bugs:

   1. THE THRESHOLD IS LATE. An element fires when its top passes 58% of
      viewport height. The obvious threshold — "top edge enters the viewport" —
      means every animation finishes before the reader's eye arrives, and the
      page reads as static. If you change one number in this file, do not
      change this one.

   2. NO IntersectionObserver. It does not fire in some embedded frames, which
      silently froze every reveal on this page once already. This uses a
      SELF-TERMINATING rAF poll: it stops itself the moment the last trigger has
      run, so there is no standing per-frame cost. In a normal top-level page an
      IntersectionObserver is fine — but if the page can ever be iframed, keep
      this.

   USAGE

     const reveal = new Reveal();
     reveal.on(barGroupEl, () => growBars());
     reveal.on(chartEl,    () => drawLines());
     // ... then, on unmount:
     reveal.destroy();

   Respect prefers-reduced-motion by checking `reveal.reduced` and jumping to
   the COMPLETE end state — not a shortened animation.
   ============================================================================ */

export class Reveal {
  constructor(opts = {}) {
    this.triggerAt = opts.triggerAt ?? 0.58;   // fraction of viewport height
    this.reduced = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.pending = [];
    this.pumping = false;
    this.dead = false;
    this.raf = null;
  }

  /* Register a one-shot trigger. Fires immediately under reduced motion. */
  on(el, run) {
    if (!el || this.dead) return;
    if (this.reduced) { run(); return; }
    this.pending.push({ el, run });
    if (!this.pumping) { this.pumping = true; this.pump(); }
  }

  pump() {
    if (this.dead) return;
    const vh = window.innerHeight || 800;
    this.pending = this.pending.filter(t => {
      const r = t.el.getBoundingClientRect();
      if (r.bottom > 40 && r.top < vh * this.triggerAt) { t.run(); return false; }
      return true;
    });
    if (this.pending.length) this.raf = requestAnimationFrame(() => this.pump());
    else { this.pumping = false; this.raf = null; }
  }

  destroy() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null; this.pending = [];
  }
}

/* ----------------------------------------------------------------------------
   Counters. Cubic ease-out over the given duration.

   ⚠ THE BUG YOU WILL HIT: React restores imperative DOM writes on re-render.
   A value written with textContent silently reverts to whatever the JSX says
   the moment anything re-renders. Same for an <input>'s .value. So every
   imperatively-written value is recorded here and replayed after render.

   In React:  useEffect(() => { store.replay(); });   // no dep array
---------------------------------------------------------------------------- */
export class ImperativeText {
  constructor() { this.vals = new Map(); }

  /* Write now and remember, so a later re-render cannot wipe it. */
  put(el, text) {
    if (!el) return;
    this.vals.set(el, text);
    if (el.textContent !== text) el.textContent = text;
  }

  /* Call after every render. */
  replay() {
    this.vals.forEach((t, el) => {
      if (el && el.isConnected && el.textContent !== t) el.textContent = t;
    });
  }

  count(el, to, { decimals = 0, duration = 1500, format = null, reduced = false } = {}) {
    if (!el) return;
    const fmt = v => (format ? format(v) : v.toFixed(decimals));
    if (reduced) { this.put(el, fmt(to)); return; }
    const t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / duration);
      this.put(el, fmt(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

/* ----------------------------------------------------------------------------
   Stroke reveal for SVG paths. Call prepare() once after layout — getTotalLength
   needs the element to be laid out — then draw() when the reveal fires.
---------------------------------------------------------------------------- */
export function prepareStroke(path, reduced) {
  if (!path || path.dataset.strokeReady) return;
  const L = path.getTotalLength();
  path.dataset.strokeReady = '1';
  path.style.strokeDasharray = L + ' ' + L;
  path.style.strokeDashoffset = reduced ? 0 : L;
  path.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.3,.85,.3,1)';
}
export function drawStroke(path, delay = 0) {
  if (!path) return;
  setTimeout(() => { if (path) path.style.strokeDashoffset = 0; }, delay);
}

/* Bars. transform-origin is set in CSS (left for horizontal, bottom for
   vertical); this just flips the scale. */
export function growBar(el, delay = 0) {
  if (!el) return;
  setTimeout(() => {
    if (!el) return;
    el.style.transform = el.style.transform.indexOf('scaleY') >= 0 ? 'scaleY(1)' : 'scaleX(1)';
  }, delay);
}
export function fadeIn(el, delay = 0) {
  if (!el) return;
  setTimeout(() => { if (el) el.style.opacity = 1; }, delay);
}
