/* ============================================================================
   hormuz-engine.js — the Strait of Hormuz simulation, framework-free.

   THIS FILE IS THE IMPLEMENTATION, NOT A DESCRIPTION OF ONE.
   Drop it in and call it. Do not rewrite the drawing maths, the coastline
   arrays, the lane path or the queue logic — they are tuned, and re-deriving
   them by eye is how the last port lost the design.

   It owns: both canvases, the rAF loop, the vessel simulation, the timeline.
   It does NOT own: any DOM text. It hands you a readout object and you render
   it however your framework prefers.

   USAGE (React)

     const ref = useRef(null);
     useEffect(() => {
       const eng = new HormuzEngine({
         mapCanvas:   mapCanvasRef.current,
         mapWrap:     mapWrapRef.current,
         chartCanvas: chartCanvasRef.current,
         chartWrap:   chartWrapRef.current,
         onReadout:   r => applyReadout(r),   // see NOTE below
       });
       eng.mount();
       ref.current = eng;
       return () => eng.destroy();
     }, []);

   NOTE — do NOT route onReadout into setState. It fires up to 60x/second and
   a re-render per frame is exactly the performance failure this design was
   rebuilt to avoid. Write the fields to refs with textContent. The engine
   already diffs, so onReadout only fires when a value actually changed.

   PERFORMANCE CONTRACT (all three guards are load-bearing)
     1. One loop. startLoop() is a no-op if a frame is already queued.
     2. No work off-screen. Every 8th frame it re-checks the map's bounding
        rect; the whole body is skipped when the section is outside
        [-220px, viewport+220px].
     3. Repaints only when the clock moved (`dirty`).
   Plus: the static map layer is cached to an offscreen canvas keyed on size
   and blitted each frame. Only the gate glow, particles and vessels redraw.

   ⚠ ResizeObserver / IntersectionObserver are deliberately NOT used. They do
   not fire in some embedded frames. Size is re-measured on the same 8-frame
   interval. In a normal page you may swap in the real observers — but seed the
   first measurement synchronously, and keep the polling fallback if the page
   can ever be iframed.
   ============================================================================ */

export const DAY0 = Date.UTC(2025, 11, 31);
/* The span is DATA-DRIVEN. It defaults to the last hand-verified anchor and is
   extended by configureTimeline() to the last daily close in the snapshot, so
   the scrubber always runs to the most recent trading day without anyone
   editing a constant. `export let` is a live binding: every reader sees the
   updated value. */
export let SPAN = 214;                   // 31 Dec 2025 → 2 Aug 2026 (fallback)
export const BASE_DAYS_PER_SECOND = 12;  // 1x

/** Day offset from DAY0 for an ISO date. Every dated thing below uses this
    rather than a hand-counted integer -- the old integers drifted twice. */
export function dayOf(iso) {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
  return Math.round((Date.UTC(y, m, d) - DAY0) / 86400000);
}

/* ---------------------------------------------------------------- timeline */
/* Fallback price anchors, used only when the daily series is not supplied.
   `approx` and `derived` are NOT decoration — they drive the caption, the dash
   pattern and the decimal precision. Keep the flags. */
export const ANCHORS = [
  { d: 0,   v: 57.70 },
  { d: 2,   v: 57.21 },
  { d: 59,  v: 67.00, approx: true },
  { d: 97,  v: 114.58 },
  { d: 98,  v: 96.17 },
  { d: 182, v: 69.74 },
  { d: 189, v: 74.56 },
  { d: 208, v: 84.25 },
];

/* Measured data, supplied by configureTimeline(). When `prices` is set the
   chart draws every close and the readout never interpolates; when `flow` is
   set the vessel model and the transit readout follow IMF PortWatch counts. */
export const TL = { prices: null, flow: null, baseline: null, lastFlowDay: null, lastPriceDay: null };

/**
 * Wire real series into the timeline.
 *   prices:   [{date:'2026-01-02', value: 57.21}, ...]   FRED DCOILWTICO
 *   transits: { observations:[{date, total, tanker}], baseline:{total_per_day} }  IMF PortWatch
 * Extends SPAN to the later of the two series' last dates.
 */
export function configureTimeline({ prices, transits } = {}) {
  if (prices && prices.length) {
    TL.prices = prices
      .filter(p => p.value !== null && p.value !== undefined && p.date >= '2025-12-31')
      .map(p => ({ d: dayOf(p.date), v: +p.value, iso: p.date }))
      .sort((a, b) => a.d - b.d);
    TL.lastPriceDay = TL.prices.length ? TL.prices[TL.prices.length - 1].d : null;
  }
  if (transits && transits.observations && transits.observations.length) {
    TL.flow = transits.observations
      .filter(o => o.total !== null && o.total !== undefined && o.date >= '2025-12-01')
      .map(o => ({ d: dayOf(o.date), v: +o.total, tanker: o.tanker, iso: o.date }))
      .sort((a, b) => a.d - b.d);
    TL.baseline = transits.baseline && transits.baseline.total_per_day
      ? +transits.baseline.total_per_day : null;
    TL.lastFlowDay = TL.flow.length ? TL.flow[TL.flow.length - 1].d : null;
  }
  /* Run to the latest of: last close, last transit count, last dated event.
     FRED publishes closes with a lag of a few days, so the newest events can
     sit past the last close; the price readout then holds that close and says
     the market data has not caught up yet. */
  const lastEvent = EVENTS.length ? EVENTS[EVENTS.length - 1].d : 0;
  const ends = [TL.lastPriceDay, TL.lastFlowDay, lastEvent].filter(x => x !== null && x !== undefined);
  if (ends.length) SPAN = Math.max(SPAN, ...ends);
  return SPAN;
}

/* Continuous flow FALLBACK for the vessel simulation only. Never shown as a
   number. Superseded by TL.flow when PortWatch data is present. */
export const FLOW_KF = [
  { d: 0, v: 13.8 }, { d: 59, v: 13.8 }, { d: 62, v: 0 }, { d: 97, v: 0 },
  { d: 101, v: 1.6 }, { d: 169, v: 1.6 }, { d: 173, v: 4.8 }, { d: 189, v: 4.8 },
  { d: 194, v: 3.5 }, { d: 214, v: 3.5 },
];

/* Stepped readouts (fallback). These hold their last published value with an
   as-of date and render an em-dash when none exists. NEVER interpolate them. */
export const FLOW_READ = [
  { d: 0,   val: '13.8', pct: '100% of baseline',    cap: 'Pre-war gross transit — about 20% of world oil trade (IEA)', known: true },
  { d: 59,  val: '13.8', pct: 'closing',             cap: 'Strikes begin. The IRGC declares the Strait closed within days.', known: true },
  { d: 62,  val: '0.0',  pct: '0% of baseline',      cap: 'Strait declared closed — 13.8 mb/d of gross transit removed (IEA)', known: true },
  { d: 97,  val: '—', pct: 'no published figure', cap: 'Reopened partially under the two-week ceasefire. No transit figure was published.', known: false },
  { d: 173, val: '4.8',  pct: '35% of baseline',     cap: 'As of late June: transits triple, flow recovers to about 4.8 mb/d (IEA/CNBC)', known: true },
  { d: 189, val: '—', pct: 'no published figure', cap: 'Strikes resume and tanker attacks continue. No transit figure published since.', known: false },
];

export const RISK_READ = [
  { date: '2025-12-31', val: '0.25%',      cap: 'Last reading: pre-war standard rate (Strauss Center)' },
  { date: '2026-02-28', val: '—',     cap: 'Repricing. No published reading between the first strike and mid-April.' },
  { date: '2026-04-15', val: '10%',        cap: 'Reading of 15 Apr: 10% of a $100M hull — about $4.87/bbl (IEA, Marsh)' },
  { date: '2026-07-01', val: '1–3%',  cap: 'Reading of early July, after the June ceasefire (Marsh)' },
  { date: '2026-07-23', val: '7.5–10%', cap: 'Reading of 23 Jul, after attacks on Saudi tankers (Marsh)' },
  { date: '2026-08-01', val: '7.5–10%', cap: 'Still quoted through August; Marsh: few owners buying at that level. No August reading published.' },
].map(r => ({ ...r, d: dayOf(r.date) }));

/* k = war | tariff | policy | context.  t = provenance tier (1 or 2).
   Dated, not day-numbered: the offsets are derived. */
export const EVENTS = [
  { date: '2026-01-15', k: 'context', t: 2, h: 'Iran nuclear talks collapse; Gulf posturing begins', s: 'WTI is still near a 12-month low of $57, down about 20% over 2025.' },
  { date: '2026-02-20', k: 'tariff',  t: 1, h: 'Supreme Court strikes down the IEEPA tariffs, 6–3', s: 'Learning Resources v. Trump. Average import tariffs fall about 4.8pp — eight days before the strikes.' },
  { date: '2026-02-24', k: 'tariff',  t: 1, h: 'Section 122 blanket 10% surcharge replaces them', s: 'Roughly $1.0 trillion of imports. Energy and energy products are exempted verbatim.' },
  { date: '2026-02-28', k: 'war',     t: 1, h: 'US and Israel strike Iran; the Strait of Hormuz closes', s: 'About 13.8 mb/d of gross transit removed — a fifth of world oil trade. WTI begins a five-week climb.' },
  { date: '2026-03-02', k: 'context', t: 2, h: 'Platts suspends Hormuz grades from the Dubai benchmark', s: 'Deliverable grades cut from five to two. The benchmark now measures a different basket.' },
  { date: '2026-03-11', k: 'policy',  t: 1, h: 'IEA members release 400 million barrels', s: 'The largest coordinated release in 52 years. Expert estimates put the price effect near $2/bbl.' },
  { date: '2026-04-07', k: 'war',     t: 2, h: 'Two-week ceasefire agreed; Hormuz reopens partially', s: 'Spot closes at its $114.58 peak the same day and falls to $96.17 the next.' },
  { date: '2026-04-15', k: 'context', t: 1, h: 'Physical crude trades $35 over paper — a record', s: 'North Sea Dated over ICE Brent. The premium collapses to $3 by early May.' },
  { date: '2026-06-18', k: 'war',     t: 2, h: '60-day ceasefire and US–Iran Memorandum of Understanding', s: 'Transits triple within days. WTI falls to $69.74 — below its pre-war level.' },
  { date: '2026-07-08', k: 'war',     t: 2, h: 'US strikes Iran again; the ceasefire is declared over', s: 'WTI spot rises 4.2% to $74.56 on the day; the futures contract 4.4% to $73.52. Brent 5.2% to $78.02.' },
  { date: '2026-07-14', k: 'war',     t: 2, h: 'Three tankers attacked in a single day; a seafarer killed', s: 'Stolt Magnesium, Mombasa B and Al Bahyah are struck. The IRGC says it targeted vessels using mined routes.' },
  { date: '2026-07-23', k: 'war',     t: 2, h: 'Attacks on Saudi tankers; war-risk premiums hit 7.5–10%', s: 'Up from 1–3% weeks earlier and 0.25% before the war — $7.5–10M per voyage on a $100M hull.' },
  { date: '2026-07-24', k: 'tariff',  t: 1, h: 'Section 122 surcharge expires by statute', s: 'Section 301 forced-labor tariffs at 10% and 12.5% become the operative regime.' },
  { date: '2026-07-29', k: 'war',     t: 2, h: 'Escalation threats push Brent back above $90', s: 'Tanker attacks in the Strait continue and fighting spreads toward the Red Sea.' },
  { date: '2026-08-01', k: 'context', t: 2, h: 'A month-long lull in US–Iran strikes begins', s: 'No large military exchanges in August. Thirteen merchant ships are struck anyway, and PortWatch counts single-digit daily transits against a pre-war 83.' },
  { date: '2026-08-12', k: 'context', t: 1, h: 'July CPI: 3.4% headline, 2.5% core, energy +14.7%', s: 'Both ease a tenth from June. The breadth test still reads as a tail shock: median CPI 2.7%.' },
  { date: '2026-08-13', k: 'context', t: 1, h: 'IEA: Gulf exports down 2.1 mb/d; world supply to fall 4.3 mb/d in 2026', s: 'The strait was “effectively closed again in early July”. Stocks have drawn 410 million barrels since February.' },
  { date: '2026-08-18', k: 'war',     t: 2, h: 'MV Minoan Dignity struck, one crew killed', s: 'The same day the President says the strait is “open and operating”. Lloyd’s List counts about 14 transits a day, against roughly 100 before the war.' },
  { date: '2026-08-25', k: 'policy',  t: 2, h: 'US Navy says it has cleared mines from the strait', s: 'Underwater drones identified more than 100 suspected mines. Transits do not recover: PortWatch counts four vessels that day.' },
  { date: '2026-08-31', k: 'war',     t: 2, h: 'Saudi tanker Sidr struck; two crew killed', s: 'The deadliest attack of a month in which thirteen merchant ships were hit. WTI ends August at $87.03.' },
  { date: '2026-09-01', k: 'war',     t: 2, h: 'US and Iran trade strikes; the August lull ends', s: 'WTI spot closes $91.48, up 5.1% on the day. Brent $96.02. A September Fed rate rise is now priced at better than even odds.' },
  { date: '2026-09-02', k: 'context', t: 1, h: 'Dutch central bank confirms 86 tonnes of gold moved out of New York and Ottawa', s: '“In view of increasing geopolitical unrest.” New York’s share of Dutch reserves falls from 31% to 18.5%.' },
  { date: '2026-09-04', k: 'context', t: 1, h: 'August payrolls +162,000, the best month in five', s: 'Unemployment 4.1%. Long-term unemployed 27% of the jobless. Hires 3.2%, quits 1.9%: still low-fire, low-hire.' },
].map(e => ({ ...e, d: dayOf(e.date) }));

export const KIND_COLOR = { war: '#FF5A4E', tariff: '#7A8CFF', policy: '#3FA96A', context: '#8A99A8' };

/* --------------------------------------------------------------- geography */
/* Normalised 0..1 coordinates. Schematic — drawn to place the chokepoint
   correctly, not surveyed. The "ILLUSTRATIVE GEOMETRY" label in the UI is what
   makes that honest; do not remove the label without replacing these arrays
   with real coastline data. */
const IRAN = [[0,0],[0,.19],[.045,.215],[.088,.238],[.13,.232],[.163,.25],[.181,.283],[.203,.298],[.228,.286],[.25,.252],[.283,.262],[.318,.252],[.35,.272],[.392,.288],[.43,.279],[.463,.302],[.50,.324],[.53,.317],[.556,.33],[.578,.314],[.60,.325],[.622,.336],[.645,.349],[.666,.373],[.69,.398],[.716,.386],[.746,.393],[.777,.376],[.812,.351],[.855,.326],[.90,.306],[.95,.291],[1,.286],[1,0]];
const OMAN = [[0,1],[0,.81],[.06,.80],[.13,.79],[.20,.778],[.27,.766],[.33,.756],[.39,.745],[.44,.735],[.485,.726],[.515,.69],[.535,.65],[.55,.60],[.565,.56],[.578,.52],[.588,.487],[.598,.466],[.606,.481],[.614,.462],[.624,.477],[.634,.458],[.645,.472],[.655,.456],[.662,.469],[.672,.49],[.685,.52],[.70,.552],[.712,.585],[.728,.64],[.745,.70],[.775,.75],[.82,.79],[.87,.822],[.92,.845],[.96,.858],[1,.865],[1,1]];
const QESHM = [[.215,.352],[.245,.338],[.285,.336],[.325,.344],[.365,.358],[.397,.376],[.375,.393],[.335,.387],[.29,.375],[.248,.369]];
const ISLES = [[.417,.353,.015,'HORMUZ'],[.452,.373,.010,'LARAK'],[.301,.468,.008,''],[.192,.531,.009,'']];
const PORTS = [[.205,.297,'BANDAR ABBAS',1],[.583,.535,'KHASAB',-1],[.752,.688,'FUJAIRAH',-1]];
/* The shipping lane. Vessels ride ±0.026 off centre — the real Traffic
   Separation Scheme: outbound one side, inbound the other. */
const LANE = [[-.02,.578],[.10,.570],[.21,.558],[.32,.540],[.42,.514],[.505,.484],[.567,.446],[.617,.404],[.652,.414],[.686,.434],[.722,.470],[.768,.540],[.836,.605],[.912,.652],[1.02,.688]];

const GATE_X = 0.617, GATE_TOP = 0.334, GATE_BOT = 0.462;

/* ----------------------------------------------------------------- helpers */
export function lerpKF(arr, day) {
  if (day <= arr[0].d) return arr[0].v;
  for (let i = 1; i < arr.length; i++) {
    if (day <= arr[i].d) {
      const a = arr[i - 1], b = arr[i];
      return a.v + (b.v - a.v) * ((day - a.d) / Math.max(1e-6, b.d - a.d));
    }
  }
  return arr[arr.length - 1].v;
}
export function stepKF(arr, day) { let cur = arr[0]; for (const s of arr) if (day >= s.d) cur = s; return cur; }

export function priceAt(day) {
  /* Measured mode: hold the last close on or before `day`. Weekends and
     holidays show Friday's close with a "market shut" caption -- that is a
     real number with a real date, not an interpolation. */
  if (TL.prices && TL.prices.length) {
    const P = TL.prices;
    if (day < P[0].d) return { v: P[0].v, exact: false, held: true, a: P[0] };
    let lo = 0, hi = P.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P[mid].d <= day) lo = mid; else hi = mid - 1; }
    const a = P[lo];
    return { v: a.v, exact: Math.abs(day - a.d) < 0.55, held: Math.abs(day - a.d) >= 0.55, a };
  }
  const A = ANCHORS;
  if (day <= A[0].d) return { v: A[0].v, exact: true, a: A[0] };
  for (let i = 1; i < A.length; i++) {
    if (day <= A[i].d) {
      const a = A[i - 1], b = A[i];
      if (Math.abs(day - b.d) < 0.55) return { v: b.v, exact: true, a: b };
      if (Math.abs(day - a.d) < 0.55) return { v: a.v, exact: true, a: a };
      return { v: a.v + (b.v - a.v) * ((day - a.d) / (b.d - a.d)), exact: false };
    }
  }
  const last = A[A.length - 1];
  return { v: last.v, exact: Math.abs(day - last.d) < 0.55, a: last };
}

export function dateAt(day) { return new Date(DAY0 + Math.round(day) * 86400000); }
export function formatDay(day) {
  return dateAt(day)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase();
}
/** Trailing 7-day mean of measured transits ending on `day`, or null. */
export function flowMean7(day) {
  const F = TL.flow;
  if (!F || !F.length) return null;
  const last = Math.min(day, TL.lastFlowDay);
  const win = F.filter(o => o.d <= last && o.d > last - 7);
  if (!win.length) return null;
  return win.reduce((s, o) => s + o.v, 0) / win.length;
}

export function flowFrac(day) {
  if (TL.flow && TL.baseline) {
    const m = flowMean7(day);
    if (m !== null) return Math.max(0, Math.min(1, m / TL.baseline));
  }
  return Math.max(0, Math.min(1, lerpKF(FLOW_KF, day) / 13.8));
}

/** The transit readout: measured when PortWatch is wired, stepped otherwise. */
export function flowRead(day) {
  if (TL.flow && TL.baseline) {
    const m = flowMean7(day);
    if (m === null) return { val: '—', pct: 'no data yet', cap: 'IMF PortWatch series begins later.', known: false };
    const pct = Math.round((m / TL.baseline) * 100);
    const beyond = day > TL.lastFlowDay + 0.5;
    const asOf = beyond ? ' · latest available, ' + formatDay(TL.lastFlowDay) : '';
    return {
      val: m.toFixed(1),
      pct: pct + '% of pre-war',
      cap: '7-day average of AIS-counted transits · pre-war ' + TL.baseline.toFixed(0) + ' a day · IMF PortWatch' + asOf,
      known: true, closed: m / TL.baseline < 0.12,
    };
  }
  const fr = stepKF(FLOW_READ, day);
  return { ...fr, closed: fr.val === '0.0' };
}

/* Scrubber tick marks are DERIVED from EVENTS so they cannot drift out of sync
   with the ledger the way hard-coded percentages would. */
export function scrubTicks() {
  return EVENTS.map(e => {
    const war = e.k === 'war', mid = e.k === 'tariff' || e.k === 'policy';
    return {
      day: e.d,
      leftPct: (e.d / SPAN) * 100,
      top: war ? 10 : mid ? 13 : 27,
      width: war ? 2 : 1,
      height: war ? 15 : mid ? 9 : 8,
      color: KIND_COLOR[e.k],
    };
  });
}

/* ====================================================================== */
export class HormuzEngine {
  constructor(opts) {
    this.o = Object.assign({
      daysPerSecond: BASE_DAYS_PER_SECOND,
      autoLoop: true,
      gapTreatment: 'dashed',   // 'dashed' | 'solid' | 'anchorsOnly'
      showVessels: true,
      autoArm: true,            // start playing when scrolled to
      onReadout: null,
    }, opts);

    this.day = 0; this.playing = false; this.speed = 1;
    this.queueCount = 0; this.vessels = []; this.parts = [];
    this.spawnAcc = 0; this.holdUntil = 0; this.scrubbing = false;
    this.lastEv = -2; this.frameNo = 0; this.onScreen = false;
    this.armed = false; this.dirty = true; this.stopped = false;
    this.raf = null; this.last = 0; this.bg = null;
    this._prev = {};
  }

  mount() {
    this.stopped = false;
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.seedVessels();
    this.fit();
    if (this.reduced) {
      /* Reduced motion gets a COMPLETE end state, not a shortened animation:
         the timeline at its end, the fleet stepped to a settled arrangement. */
      this.day = SPAN;
      for (let i = 0; i < 260; i++) this.step(1 / 30);
      this.paint(); this.emit(true);
      return this;
    }
    this.paint(); this.emit(true);
    this.startLoop();
    return this;
  }

  destroy() { this.stopped = true; if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }

  /* ------------------------------------------------------------- controls */
  setPlaying(on) {
    this.armed = true;
    this.playing = !!on;
    if (this.playing && this.day >= SPAN) { this.day = 0; this.lastEv = -2; }
    if (this.playing && this.reduced) { this.reduced = false; this.startLoop(); }
    this.dirty = true; this.emit();
  }
  toggle() { this.setPlaying(!this.playing); }
  replay() {
    this.armed = true;
    this.day = 0; this.holdUntil = 0; this.lastEv = -2;
    if (this.reduced) { this.reduced = false; this.startLoop(); }
    this.setPlaying(true); this.paint();
  }
  setSpeed(v) { this.speed = v; this.emit(); }
  seek(day) {
    this.day = Math.max(0, Math.min(SPAN, day));
    this.lastEv = -2; this.paint(); this.emit();
  }
  beginScrub() { this.armed = true; this.scrubbing = true; this.playing = false; this.emit(); }
  endScrub() { this.scrubbing = false; }
  dayFromClientX(clientX, trackEl) {
    const b = trackEl.getBoundingClientRect();
    return Math.max(0, Math.min(SPAN, ((clientX - b.left) / Math.max(1, b.width)) * SPAN));
  }

  /* ----------------------------------------------------------------- loop */
  startLoop() {
    if (this.raf || this.stopped) return;
    this.last = performance.now();
    const loop = t => {
      this.raf = null;
      if (this.stopped) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.frameNo++;

      if ((this.frameNo & 7) === 0) {
        this.onScreen = this.checkOnScreen();
        if (this.fitIfResized()) this.dirty = true;
      }

      if (this.onScreen) {
        if (this.playing && !this.scrubbing) {
          if (this.holdUntil > 0) {
            this.holdUntil -= dt;
            if (this.holdUntil <= 0) { this.day = 0; this.lastEv = -2; }
          } else {
            this.day += dt * this.o.daysPerSecond * this.speed;
            if (this.day >= SPAN) {
              this.day = SPAN;
              if (!this.o.autoLoop) this.playing = false;
              else this.holdUntil = 1.1;
            }
          }
          this.step(dt);
          this.dirty = true;
        }
        if (this.dirty) { this.paint(); this.emit(); this.dirty = false; }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  checkOnScreen() {
    const e = this.o.mapWrap; if (!e) return false;
    const r = e.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    /* Autoplay arms ONCE, when the map reaches 60% of viewport height.
       Never on load — the reader must actually be looking at it. */
    if (this.o.autoArm && !this.armed && r.top < vh * 0.6 && r.bottom > 0) {
      this.armed = true; this.playing = true;
    }
    return r.bottom > -220 && r.top < vh + 220;
  }

  /* ------------------------------------------------------------- readouts */
  getReadout() {
    const d = this.day, pr = priceAt(d);
    const a = pr.a || {};
    const measured = !!(TL.prices && TL.prices.length);
    const priceCaption = pr.exact
      ? (a.derived ? 'DERIVED \u00B7 \u221215% FROM THE PEAK'
        : a.approx ? 'APPROX. CLOSE \u00B7 ' + formatDay(a.d)
        : 'VERIFIED CLOSE \u00B7 ' + formatDay(a.d))
      : measured ? (d > TL.lastPriceDay + 0.5 ? 'LAST PUBLISHED CLOSE \u00B7 ' + formatDay(a.d)
                                             : 'MARKET SHUT \u00B7 LAST CLOSE ' + formatDay(a.d))
      : 'BETWEEN CLOSES \u00B7 DRAWN STRAIGHT';
    const provenance = pr.exact ? (a.derived ? 'derived' : a.approx ? 'approx' : 'verified')
      : measured ? 'held' : 'interpolated';

    const fr = flowRead(d);
    const rr = stepKF(RISK_READ, d);
    const ff = flowFrac(d);
    /* Measured counts are noisy day to day; a 7-day mean under three-quarters
       of the pre-war average is not "normal" traffic. */
    const NORMAL = TL.flow ? 0.6 : 0.97, CLOSED = TL.flow ? 0.12 : 0.06;
    const gate = ff >= NORMAL ? { label: 'TRANSIT NORMAL', color: '#3FA96A' }
      : ff < CLOSED ? { label: 'STRAIT CLOSED', color: '#D91E18' }
      : { label: 'PARTIAL TRANSIT', color: '#F5A300' };

    let idx = -1;
    EVENTS.forEach((e, i) => { if (d >= e.d) idx = i; });
    const ev = idx < 0 ? null : EVENTS[idx];

    return {
      day: d,
      date: formatDay(d),
      /* Exact closes print two decimals; interpolated values print rounded
         integers. The precision IS the provenance signal — keep it. */
      /* A held close is still a verified two-decimal number; only an
         interpolated one is rounded, because rounding IS the provenance signal. */
      price: '$' + ((pr.exact || measured) ? pr.v.toFixed(2) : Math.round(pr.v)),
      priceCaption, provenance,
      priceDimmed: !pr.exact || !!a.derived || !!a.approx,
      flow: fr.val, flowPct: fr.pct, flowCaption: fr.cap,
      flowColor: !fr.known ? '#7A8A95' : (fr.closed ? '#D91E18' : ff >= NORMAL ? '#3FA96A' : '#F5A300'),
      risk: rr.val, riskCaption: rr.cap,
      riskColor: rr.val === '\u2014' ? '#7A8A95' : '#F5A300',
      queue: String(this.queueCount),
      queueColor: this.queueCount > 6 ? '#D91E18' : '#7A8A95',
      gateLabel: gate.label, gateColor: gate.color, gatePulse: ff <= 0.97,
      progressPct: (d / SPAN) * 100,
      playing: this.playing, speed: this.speed,
      eventIndex: idx,
      event: ev && {
        date: formatDay(ev.d), kind: ev.k.toUpperCase(), tier: 'TIER ' + ev.t,
        headline: ev.h, detail: ev.s, color: KIND_COLOR[ev.k],
        /* changed=true means: flash the card. Only then. */
        changed: idx !== this._lastEmitIdx,
      },
    };
  }

  emit(force) {
    if (!this.o.onReadout) return;
    const r = this.getReadout();
    if (!force && this._prev.date === r.date && this._prev.price === r.price
      && this._prev.queue === r.queue && this._prev.eventIndex === r.eventIndex
      && this._prev.playing === r.playing && this._prev.speed === r.speed) return;
    this._prev = r;
    this.o.onReadout(r);
    this._lastEmitIdx = r.eventIndex;
  }

  /* ----------------------------------------------------------------- sizing */
  fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    [[this.o.mapCanvas, this.o.mapWrap], [this.o.chartCanvas, this.o.chartWrap]].forEach(([cv, wr]) => {
      if (!cv || !wr) return;
      const b = wr.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(b.width * dpr));
      cv.height = Math.max(1, Math.round(b.height * dpr));
      cv._w = b.width; cv._h = b.height; cv._dpr = dpr;
    });
  }
  fitIfResized() {
    const wr = this.o.mapWrap, cv = this.o.mapCanvas;
    if (!wr || !cv) return false;
    const b = wr.getBoundingClientRect();
    if (Math.abs(b.width - (cv._w || 0)) < 0.5 && Math.abs(b.height - (cv._h || 0)) < 0.5) return false;
    this.fit(); this.bg = null;
    return true;
  }

  /* ------------------------------------------------------------ simulation */
  seedVessels() {
    this.vessels = [];
    for (let i = 0; i < 26; i++) {
      this.vessels.push({
        s: (i * 0.0385 + 0.01) % 1, dir: i % 2 ? -1 : 1,
        spd: 0.035 + (i % 5) * 0.003, pass: true, w: [0.78, 1, 1.34][i % 3],
      });
    }
  }

  step(dt) {
    const ff = flowFrac(this.day);
    const open = ff > 0.97;
    /* On closure, every vessel that has NOT yet cleared the midpoint loses its
       pass and queues. That is what makes the backup read as a consequence. */
    if (this.wasOpen && !open) {
      for (const v of this.vessels) if (!((v.dir > 0 && v.s > 0.5) || (v.dir < 0 && v.s < 0.5))) v.pass = false;
    }
    this.wasOpen = open;

    this.spawnAcc += dt * 2.2 * this.speed;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.vessels.length < 58) {
        const dir = Math.random() < 0.52 ? 1 : -1;
        const cls = Math.random(), wq = cls < 0.42 ? 0.78 : cls < 0.78 ? 1 : 1.34;
        this.vessels.push({ s: dir > 0 ? -0.01 : 1.01, dir, spd: 0.032 + Math.random() * 0.012, pass: open, w: wq });
      }
    }

    const west = [], east = [];
    for (const v of this.vessels) {
      if (v.dir > 0 && v.s < 0.5 && !v.pass) west.push(v);
      else if (v.dir < 0 && v.s > 0.5 && !v.pass) east.push(v);
    }
    west.sort((a, b) => b.s - a.s); east.sort((a, b) => a.s - b.s);
    /* Passage is granted probabilistically, so reopening drains the queue as a
       SURGE rather than instantly. This is the most legible moment in the whole
       simulation — do not replace it with a hard flag flip. */
    const grant = ff * dt * 2.4;
    if (west.length && Math.random() < grant) west[0].pass = true;
    if (east.length && Math.random() < grant) east[0].pass = true;
    if (open) for (const v of this.vessels) v.pass = true;

    const gap = Math.max(0.0105, (this.shipL || 12) * 1.12 / (1.15 * (this.mapW || 600)));
    west.forEach((v, i) => { v.lim = 0.5 - gap * i; });
    east.forEach((v, i) => { v.lim = 0.5 + gap * i; });

    const keep = [];
    for (const v of this.vessels) {
      const stepAmt = dt * v.spd * this.speed * (0.35 + 0.65 * Math.max(0.45, ff));
      let ns = v.s + stepAmt * v.dir;
      let stalled = false;
      if (!v.pass && v.lim !== undefined) {
        if (v.dir > 0 && ns > v.lim) { ns = Math.max(v.s, Math.min(ns, v.lim)); stalled = true; }
        if (v.dir < 0 && ns < v.lim) { ns = Math.min(v.s, Math.max(ns, v.lim)); stalled = true; }
      }
      v.stalled = stalled && Math.abs(ns - v.s) < stepAmt * 0.35;
      v.s = ns;
      if (v.s > -0.06 && v.s < 1.06) keep.push(v);
    }
    this.vessels = keep;
    this.queueCount = this.vessels.filter(v => !v.pass).length;

    if (ff < 0.9 && Math.random() < dt * 26 * (1 - ff)) {
      this.parts.push({ x: 0.60 + Math.random() * 0.06, y: 0.40 + Math.random() * 0.06, life: 1, vy: 0.05 + Math.random() * 0.06, vx: (Math.random() - 0.5) * 0.03 });
    }
    for (const p of this.parts) { p.life -= dt * 0.85; p.y -= p.vy * dt; p.x += p.vx * dt; }
    this.parts = this.parts.filter(p => p.life > 0).slice(-70);
  }

  /* --------------------------------------------------------------- drawing */
  lanePt(s, off) {
    const n = LANE.length - 1;
    const t = Math.max(0, Math.min(0.9999, s)) * n;
    const i = Math.floor(t), f = t - i;
    const a = LANE[i], b = LANE[Math.min(n, i + 1)];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f + off, dx: b[0] - a[0], dy: b[1] - a[1] };
  }
  laneAng(p, w, h, dir) { return Math.atan2(p.dy * h, p.dx * w) + (dir > 0 ? 0 : Math.PI); }
  poly(ctx, pts, w, h) {
    ctx.beginPath();
    pts.forEach((p, i) => { const x = p[0] * w, y = p[1] * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  }

  /* A tanker: bow curve, deck line, aft superstructure, bridge windows above
     13px, and a gradient wake when moving. Amber = under way, crimson = held. */
  ship(ctx, x, y, ang, L, moving, hull, deck, sup, rgb) {
    const B = L * 0.20;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (moving) {
      const wl = L * 1.7;
      const g = ctx.createLinearGradient(-L * 0.5, 0, -L * 0.5 - wl, 0);
      g.addColorStop(0, 'rgba(' + rgb + ',.15)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-L * 0.48, -B * 0.34); ctx.lineTo(-L * 0.5 - wl, -B * 1.05);
      ctx.lineTo(-L * 0.5 - wl, B * 1.05); ctx.lineTo(-L * 0.48, B * 0.34);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.quadraticCurveTo(L * 0.34, -B * 0.46, L * 0.14, -B * 0.5);
    ctx.lineTo(-L * 0.44, -B * 0.46);
    ctx.quadraticCurveTo(-L * 0.5, 0, -L * 0.44, B * 0.46);
    ctx.lineTo(L * 0.14, B * 0.5);
    ctx.quadraticCurveTo(L * 0.34, B * 0.46, L * 0.5, 0);
    ctx.closePath();
    ctx.fillStyle = hull; ctx.fill();
    ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(3,8,12,.65)'; ctx.stroke();
    if (L > 8) {
      ctx.beginPath(); ctx.moveTo(L * 0.30, 0); ctx.lineTo(-L * 0.26, 0);
      ctx.lineWidth = Math.max(0.55, B * 0.22); ctx.strokeStyle = deck; ctx.stroke();
    }
    ctx.fillStyle = sup;
    ctx.fillRect(-L * 0.42, -B * 0.36, Math.max(1.3, L * 0.15), B * 0.72);
    if (L > 11) ctx.fillRect(-L * 0.30, -B * 0.16, Math.max(0.9, L * 0.05), B * 0.32);
    if (L > 13) {
      ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(L * 0.44, -B * 0.20); ctx.quadraticCurveTo(L * 0.50, 0, L * 0.44, B * 0.20); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(-L * 0.16 + i * L * 0.11, -B * 0.30, Math.max(0.7, L * 0.03), B * 0.60);
      }
    }
    ctx.restore();
  }

  /* Everything static goes here, once, into an offscreen canvas keyed on size. */
  buildBg(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#04090F'); g.addColorStop(.5, '#08161F'); g.addColorStop(1, '#040B12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    const vg = ctx.createRadialGradient(w * .55, h * .45, Math.min(w, h) * .12, w * .55, h * .45, w * .75);
    vg.addColorStop(0, 'rgba(245,163,0,.035)'); vg.addColorStop(1, 'rgba(0,0,0,.34)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(244,237,224,.03)'; ctx.lineWidth = 1;
    for (let y = 0.08; y < 1; y += 0.08) { ctx.beginPath(); ctx.moveTo(0, y * h); ctx.lineTo(w, y * h); ctx.stroke(); }
    for (let x = 0.12; x < 1; x += 0.12) { ctx.beginPath(); ctx.moveTo(x * w, 0); ctx.lineTo(x * w, h); ctx.stroke(); }

    const shapes = [IRAN, OMAN, QESHM];
    [[9, 'rgba(245,163,0,.045)'], [4, 'rgba(245,163,0,.07)']].forEach(([lw, col]) => {
      ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineJoin = 'round';
      shapes.forEach(s => { this.poly(ctx, s, w, h); ctx.stroke(); });
      ISLES.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x * w, y * h, r * w, 0, 6.2832); ctx.stroke(); });
    });

    const drawLand = pts => {
      this.poly(ctx, pts, w, h);
      const lg = ctx.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, '#3A3225'); lg.addColorStop(1, '#26211A');
      ctx.fillStyle = lg; ctx.fill();
      ctx.strokeStyle = '#8A7B60'; ctx.lineWidth = 1.4; ctx.stroke();
    };
    shapes.forEach(drawLand);
    ISLES.forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.arc(x * w, y * h, r * w, 0, 6.2832);
      ctx.fillStyle = '#3A3225'; ctx.fill();
      ctx.strokeStyle = '#8A7B60'; ctx.lineWidth = 1.2; ctx.stroke();
    });

    const laneStroke = (off, style, dash, lw) => {
      ctx.beginPath();
      for (let s = 0; s <= 1.0001; s += 0.02) {
        const p = this.lanePt(s, off);
        s ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h);
      }
      ctx.strokeStyle = style; ctx.lineWidth = lw;
      if (dash) ctx.setLineDash(dash);
      ctx.stroke(); ctx.setLineDash([]);
    };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    laneStroke(0, 'rgba(244,237,224,.05)', null, 13);
    ctx.lineCap = 'butt';
    laneStroke(0, 'rgba(244,237,224,.15)', [1, 6], 3);
    laneStroke(-0.026, 'rgba(244,237,224,.19)', [4, 6], 1);
    laneStroke(0.026, 'rgba(244,237,224,.19)', [4, 6], 1);

    const gx = GATE_X * w, gTop = GATE_TOP * h, gBot = GATE_BOT * h;
    ctx.strokeStyle = 'rgba(244,237,224,.34)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx - 4, gTop); ctx.lineTo(gx + 4, gTop);
    ctx.moveTo(gx, gTop); ctx.lineTo(gx, gBot);
    ctx.moveTo(gx - 4, gBot); ctx.lineTo(gx + 4, gBot);
    ctx.stroke();
    ctx.font = '700 8.5px "Chivo Mono", monospace'; ctx.fillStyle = '#9BA9B6'; ctx.textAlign = 'center';
    ctx.fillText('33 KM', gx, gTop - 7);
    if (w > 520) {
      ctx.font = '700 8px "Chivo Mono", monospace'; ctx.fillStyle = '#6B7A85'; ctx.textAlign = 'left';
      const tp = this.lanePt(0.17, -0.026);
      ctx.fillText('TRAFFIC SEPARATION SCHEME', tp.x * w, tp.y * h - 9);
    }

    ctx.textAlign = 'center';
    ctx.font = '700 9.5px "Chivo Mono", monospace'; ctx.fillStyle = '#C4B49A';
    ctx.fillText('I R A N', 0.135 * w, 0.10 * h);
    ctx.fillText('U . A . E .', 0.145 * w, 0.93 * h);
    ctx.fillText('MUSANDAM \u00B7 OMAN', 0.60 * w, 0.88 * h);
    if (w > 460) { ctx.font = '700 7.5px "Chivo Mono", monospace'; ctx.fillStyle = '#9C8E76'; ctx.fillText('QESHM', 0.30 * w, 0.366 * h); }
    ctx.font = '600 9px "Chivo Mono", monospace';
    ctx.fillStyle = '#4E7286'; ctx.textAlign = 'left';
    ctx.fillText('P E R S I A N   G U L F', 0.04 * w, 0.70 * h);
    ctx.textAlign = 'right';
    ctx.fillText('G U L F   O F   O M A N', 0.965 * w, 0.35 * h);

    if (w > 460) {
      PORTS.forEach(([x, y, name, dir]) => {
        const px = x * w, py = y * h;
        ctx.fillStyle = '#B8AC98';
        ctx.fillRect(px - 1.8, py - 1.8, 3.6, 3.6);
        ctx.strokeStyle = 'rgba(184,172,152,.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 6.2832); ctx.stroke();
        ctx.font = '700 7.5px "Chivo Mono", monospace'; ctx.fillStyle = '#95897A';
        ctx.textAlign = 'left';
        ctx.fillText(name, px + 8, py + (dir > 0 ? -4 : 9));
      });
    }
    return c;
  }

  paint() { this.paintMap(); this.paintChart(); }

  paintMap() {
    const cv = this.o.mapCanvas; if (!cv || !cv._w) return;
    const ctx = cv.getContext('2d'), w = cv._w, h = cv._h;
    ctx.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const ff = flowFrac(this.day);

    if (!this.bg || this.bgW !== w || this.bgH !== h) {
      this.bg = this.buildBg(w, h, cv._dpr); this.bgW = w; this.bgH = h;
    }
    ctx.drawImage(this.bg, 0, 0, w, h);

    const gx = GATE_X * w, gTop = GATE_TOP * h, gBot = GATE_BOT * h;
    if (ff < 0.97) {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 380);
      ctx.strokeStyle = 'rgba(217,30,24,' + (0.34 + 0.55 * (1 - ff) * pulse).toFixed(3) + ')';
      ctx.lineWidth = 3.4;
      ctx.beginPath(); ctx.moveTo(gx, gTop + 2); ctx.lineTo(gx, gBot - 2); ctx.stroke();
      const bg = ctx.createLinearGradient(gx - 14, 0, gx + 14, 0);
      bg.addColorStop(0, 'rgba(217,30,24,0)'); bg.addColorStop(.5, 'rgba(217,30,24,.15)'); bg.addColorStop(1, 'rgba(217,30,24,0)');
      ctx.fillStyle = bg; ctx.fillRect(gx - 14, gTop, 28, gBot - gTop);
      ctx.strokeStyle = 'rgba(217,30,24,' + (0.45 * pulse).toFixed(3) + ')'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(gx, (gTop + gBot) / 2, 9 + pulse * 5, 0, 6.2832); ctx.stroke();
    }

    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life) * 0.45;
      ctx.fillStyle = '#FF7A45';
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 1.5, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;

    const base = Math.max(9, w / 40);
    this.shipL = base; this.mapW = w;
    for (const v of (this.o.showVessels === false ? [] : this.vessels)) {
      if (v.s < -0.05 || v.s > 1.05) continue;
      const p = this.lanePt(v.s, v.dir > 0 ? -0.026 : 0.026);
      const ang = this.laneAng(p, w, h, v.dir);
      if (!v.stalled && v.pass) this.ship(ctx, p.x * w, p.y * h, ang, base * v.w, true, '#F5A300', '#FFD98A', '#FFF3D6', '245,163,0');
      else this.ship(ctx, p.x * w, p.y * h, ang, base * v.w, false, '#D91E18', '#FF8880', '#FFDAD6', '217,30,24');
    }
    /* Inset is dropped below 470px — the detail budget on a phone goes to the
       lane and the gate, not to a magnifier. */
    if (w >= 470 && this.o.showVessels !== false) this.paintInset(ctx, w, h, ff, base);
  }

  paintInset(ctx, w, h, ff, base) {
    const Z = 3.5, cx = GATE_X, cy = 0.398;
    const iw = Math.min(258, w * 0.44), ih = Math.min(126, h * 0.36);
    const ix = w - 12 - iw, iy = h - 12 - ih;
    const vw = iw / (w * Z), vh = ih / (h * Z);

    ctx.strokeStyle = 'rgba(244,237,224,.24)'; ctx.lineWidth = 1;
    ctx.strokeRect((cx - vw / 2) * w, (cy - vh / 2) * h, vw * w, vh * h);
    ctx.strokeStyle = 'rgba(244,237,224,.1)';
    ctx.beginPath(); ctx.moveTo((cx + vw / 2) * w, (cy + vh / 2) * h); ctx.lineTo(ix, iy); ctx.stroke();

    ctx.save();
    ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
    const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
    g.addColorStop(0, '#061118'); g.addColorStop(1, '#040C13');
    ctx.fillStyle = g; ctx.fillRect(ix, iy, iw, ih);

    const IX = nx => ix + iw / 2 + (nx - cx) * w * Z;
    const IY = ny => iy + ih / 2 + (ny - cy) * h * Z;

    [IRAN, OMAN].forEach(pts => {
      ctx.beginPath();
      pts.forEach((p, i) => { i ? ctx.lineTo(IX(p[0]), IY(p[1])) : ctx.moveTo(IX(p[0]), IY(p[1])); });
      ctx.closePath();
      ctx.fillStyle = '#201C16'; ctx.fill();
      ctx.strokeStyle = '#5A5142'; ctx.lineWidth = 1.1; ctx.stroke();
    });
    [-0.026, 0.026].forEach(off => {
      ctx.beginPath();
      for (let s = 0.36; s <= 0.66; s += 0.01) {
        const p = this.lanePt(s, off);
        s === 0.36 ? ctx.moveTo(IX(p.x), IY(p.y)) : ctx.lineTo(IX(p.x), IY(p.y));
      }
      ctx.strokeStyle = 'rgba(244,237,224,.16)'; ctx.setLineDash([5, 7]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
    });
    if (ff < 0.97) {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 380);
      ctx.strokeStyle = 'rgba(217,30,24,' + (0.35 + 0.5 * pulse).toFixed(3) + ')'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(IX(GATE_X), IY(0.336)); ctx.lineTo(IX(GATE_X), IY(0.460)); ctx.stroke();
    }
    for (const v of this.vessels) {
      if (v.s < 0.34 || v.s > 0.68) continue;
      const p = this.lanePt(v.s, v.dir > 0 ? -0.026 : 0.026);
      const x = IX(p.x), y = IY(p.y);
      if (x < ix - 40 || x > ix + iw + 40 || y < iy - 40 || y > iy + ih + 40) continue;
      const iL = base * v.w * 1.7, iAng = this.laneAng(p, w, h, v.dir);
      if (!v.stalled && v.pass) this.ship(ctx, x, y, iAng, iL, true, '#F5A300', '#FFD98A', '#FFF3D6', '245,163,0');
      else this.ship(ctx, x, y, iAng, iL, false, '#D91E18', '#FF8880', '#FFDAD6', '217,30,24');
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(245,163,0,.4)'; ctx.lineWidth = 2;
    ctx.strokeRect(ix, iy, iw, ih);
    ctx.fillStyle = 'rgba(6,18,24,.86)'; ctx.fillRect(ix, iy, 124, 16);
    ctx.font = '700 8px "Chivo Mono", monospace'; ctx.fillStyle = '#F5A300'; ctx.textAlign = 'left';
    ctx.fillText('THE NARROWS \u00B7 \u00D73.5', ix + 6, iy + 11);
  }

  paintChart() {
    const cv = this.o.chartCanvas; if (!cv || !cv._w) return;
    const ctx = cv.getContext('2d'), w = cv._w, h = cv._h;
    ctx.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const L = 38, R = 8, T = 10, B = 22;
    const X = d => L + (d / SPAN) * (w - L - R);
    const Y = v => T + (1 - (v - 50) / 70) * (h - T - B);

    ctx.font = '600 9.5px "Chivo Mono", monospace'; ctx.textAlign = 'right';
    [60, 80, 100, 120].forEach(v => {
      ctx.strokeStyle = 'rgba(244,237,224,.07)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(w - R, Y(v)); ctx.stroke();
      ctx.fillStyle = '#5B6873'; ctx.fillText('$' + v, L - 7, Y(v) + 3);
    });

    /* Pre-war level: the last close before the strike. The whole round-trip
       argument is measured against it. */
    const preWar = TL.prices && TL.prices.length ? priceAt(dayOf('2026-02-27')).v : 57.21;
    ctx.strokeStyle = 'rgba(244,237,224,.3)'; ctx.setLineDash([2, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, Y(preWar)); ctx.lineTo(w - R, Y(preWar)); ctx.stroke(); ctx.setLineDash([]);

    const dNow = this.day, pn = priceAt(dNow), mode = this.o.gapTreatment;

    EVENTS.forEach(e => {
      if (e.k !== 'war') return;
      ctx.strokeStyle = e.d <= this.day ? 'rgba(217,30,24,.3)' : 'rgba(217,30,24,.1)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X(e.d), T + 4); ctx.lineTo(X(e.d), h - B); ctx.stroke();
    });

    if (TL.prices && TL.prices.length) {
      /* Measured mode: the whole daily path faintly, the played part bright.
         No dashes -- every vertex is a verified close. */
      const P = TL.prices;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      P.forEach((p, i) => { i ? ctx.lineTo(X(p.d), Y(p.v)) : ctx.moveTo(X(p.d), Y(p.v)); });
      ctx.strokeStyle = 'rgba(245,163,0,.16)'; ctx.lineWidth = 1.5; ctx.stroke();

      ctx.beginPath();
      let started = false;
      for (const p of P) {
        if (p.d > dNow) break;
        started ? ctx.lineTo(X(p.d), Y(p.v)) : ctx.moveTo(X(p.d), Y(p.v));
        started = true;
      }
      if (started) { ctx.lineTo(X(Math.min(dNow, SPAN)), Y(pn.v)); }
      ctx.strokeStyle = '#F5A300'; ctx.lineWidth = 2.4;
      ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(245,163,0,.55)';
      ctx.stroke(); ctx.shadowBlur = 0;

      /* Event closes get a dot; drawing 170 dots would be noise. */
      EVENTS.forEach(e => {
        const pe = priceAt(e.d), on = e.d <= dNow;
        ctx.beginPath(); ctx.arc(X(e.d), Y(pe.v), on ? 3.2 : 2, 0, 6.2832);
        ctx.fillStyle = on ? '#F5A300' : 'rgba(245,163,0,.28)'; ctx.fill();
        if (on) { ctx.strokeStyle = 'rgba(10,26,36,.9)'; ctx.lineWidth = 1.2; ctx.stroke(); }
      });
    }

    ctx.beginPath();
    if (!TL.prices) ANCHORS.forEach((a, i) => { i ? ctx.lineTo(X(a.d), Y(a.v)) : ctx.moveTo(X(a.d), Y(a.v)); });
    ctx.strokeStyle = 'rgba(245,163,0,.16)'; ctx.lineWidth = 1.5; if (!TL.prices) ctx.stroke();

    ctx.lineJoin = 'round'; ctx.strokeStyle = '#F5A300';
    for (let i = 1; i < ANCHORS.length && mode !== 'anchorsOnly' && !TL.prices; i++) {
      const a = ANCHORS[i - 1], b = ANCHORS[i];
      if (a.d >= dNow) break;
      const endD = Math.min(b.d, dNow);
      const endV = endD === b.d ? b.v : priceAt(endD).v;
      /* A gap longer than 10 days is drawn DASHED and unglowed — the reader can
         see at a glance which segments are real and which are drawn straight. */
      const long = b.d - a.d > 10 && mode === 'dashed';
      ctx.setLineDash(long ? [6, 6] : []);
      ctx.shadowBlur = long ? 0 : 8;
      ctx.shadowColor = 'rgba(245,163,0,.55)';
      ctx.lineWidth = long ? 2 : 2.6;
      ctx.beginPath(); ctx.moveTo(X(a.d), Y(a.v)); ctx.lineTo(X(endD), Y(endV)); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.shadowBlur = 0;

    if (!TL.prices) ANCHORS.forEach(a => {
      const on = a.d <= dNow;
      ctx.beginPath(); ctx.arc(X(a.d), Y(a.v), on ? 3.4 : 2.2, 0, 6.2832);
      ctx.fillStyle = on ? '#F5A300' : 'rgba(245,163,0,.28)'; ctx.fill();
      if (on) { ctx.strokeStyle = 'rgba(10,26,36,.9)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    });

    ctx.strokeStyle = 'rgba(244,237,224,.34)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(dNow), T); ctx.lineTo(X(dNow), h - B); ctx.stroke();
    ctx.beginPath(); ctx.arc(X(dNow), Y(pn.v), 4.4, 0, 6.2832); ctx.fillStyle = '#F4EDE0'; ctx.fill();

    // Month labels derived from DAY0 and SPAN, so extending the span adds months.
    ctx.font = '600 9.5px "Chivo Mono", monospace'; ctx.fillStyle = '#5B6873'; ctx.textAlign = 'center';
    const NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    for (let m = 0; m < 24; m++) {
      const d = Math.round((Date.UTC(2026, m, 1) - DAY0) / 86400000);
      if (d > SPAN - 6) break;
      const l = NAMES[m % 12];
      if (w > 460 || ['JAN', 'APR', 'JUL', 'OCT'].indexOf(l) >= 0) ctx.fillText(l, X(d), h - 7);
    }
  }
}
