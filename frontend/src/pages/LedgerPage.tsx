/**
 * V4 — "The bill for two choices"
 *
 * A PORT of design_handoff_v4, not an interpretation. Where a value exists in
 * spec/SECTIONS.md — a hex code, a bar width, an SVG coordinate, an easing
 * curve — it is used literally. The first attempt at this page treated the
 * handoff as a mood board and rebuilt it from the copy alone; that lost the
 * poster look, all the motion, and most of what carries the argument.
 *
 * Things that look odd here and are load-bearing:
 *   - Shelf bar widths are percentages of a shared $0-$10 scale, NOT normalised
 *     per card. Coffee's bar is longer than beef's because coffee costs more.
 *     Per-card normalisation is the obvious "fix" and it destroys the comparison.
 *   - §03's US line is amber, not red. Red reads as a team jersey and costs the
 *     page its credibility with the readers it most needs to reach.
 *   - §05's Trump bar is 13.1% of the Biden bar (42,118 / 320,938). It is meant
 *     to look almost invisible.
 *   - The crimson H1 carries a CREAM hard text-shadow with zero blur. That is
 *     the poster device the whole design hangs on.
 *
 * The root carries `container-type: inline-size` via `.v4-root`. Every clamp()
 * in tokens.css is in cqi units — without the container they all collapse to
 * their minimum and the page renders tiny.
 */

import { useEffect, useRef } from 'react';
import HormuzSimulation from '../v4/HormuzSimulation';
// @ts-expect-error — ported JS module, no types by design
import { Reveal, ImperativeText, prepareStroke, drawStroke } from '../v4/reveal.js';
// Self-hosted per the brief -- no external asset hosts in production. Weights
// are the ones tokens.css actually uses: Chivo 900 for display, Chivo Mono 700
// for labels, Archivo 400/700 for body.
import '@fontsource/chivo/700.css';
import '@fontsource/chivo/900.css';
import '@fontsource/chivo-mono/400.css';
import '@fontsource/chivo-mono/700.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '../v4/tokens.css';
import '../styles/v4.css';

const isReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** One Reveal per section; it self-terminates once its triggers have fired. */
function useReveal() {
  const ref = useRef<any>(null);
  if (!ref.current) ref.current = new Reveal({ triggerAt: 0.58 });
  useEffect(() => () => ref.current?.destroy?.(), []);
  return ref.current;
}

function WhatThisShows({ dark, children }: { dark?: boolean; children: React.ReactNode }) {
  return (
    <div className={`wts${dark ? ' is-dark' : ''}`}>
      <span className="t-label wts-chip">What this shows</span>
      <p className="t-body">{children}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- §01 */

function Masthead() {
  const pct = useRef<HTMLSpanElement>(null);
  const gas = useRef<HTMLSpanElement>(null);
  const path = useRef<SVGPathElement>(null);
  const txt = useRef<any>(null);

  useEffect(() => {
    const T = new ImperativeText();
    txt.current = T;
    const reduced = isReduced();
    // Above the fold, so these fire on load rather than on scroll.
    T.count(pct.current, 99, { duration: 1400, reduced, format: (v: number) => `+${v.toFixed(0)}%` });
    T.count(gas.current, 4.2, { duration: 1600, decimals: 2, reduced, format: (v: number) => `$${v.toFixed(2)}` });
    if (path.current) { prepareStroke(path.current, reduced); drawStroke(path.current, 200); }
  }, []);
  useEffect(() => { txt.current?.replay(); });

  return (
    <section className="sec sec-ink halftone-dark" id="masthead">
      <div className="masthead-bar">
        <span className="t-label chip chip-crimson">Trump&rsquo;s Economy</span>
        <span className="t-label bar-mid">A ledger · through July 2026</span>
        <span className="t-label bar-end">Every figure sourced</span>
      </div>

      <div className="hero-grid">
        <h1 className="t-h1 hero-h1">
          The bill<br />for two<br /><span className="hero-hit">choices</span>
        </h1>
        <div className="hero-right">
          <p className="t-lead hero-lead">
            A war ordered in February. Tariffs imposed, struck down, and re-imposed.
            Neither was a pandemic, a financial crisis, or bad luck. Both are dated.
            Both landed on a grocery receipt.
          </p>
          <div className="hero-stats">
            <div className="stat-box">
              <div className="t-label">Crude, 2 Jan → 6 Apr</div>
              <div className="t-stat"><span ref={pct}>+0%</span></div>
            </div>
            <div className="stat-box">
              <div className="t-label">Gasoline / gallon</div>
              <div className="t-stat"><span ref={gas}>$0.00</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-head">
        <h2 className="chart-h2">West Texas Intermediate, 2026</h2>
        <p className="t-small chart-sub">Prices tracked the war in both directions.</p>
      </div>

      {/* Literal geometry from spec §01. Labels unrolled, never looped. */}
      <svg className="v4-svg" viewBox="0 0 1200 470" role="img"
        aria-label="WTI crude in 2026: $57.21 on 2 January, peaking $114.01 on 6 April, down to $69.74 on 1 July, then $84.25 on 27 July.">
        <defs>
          <pattern id="warhatch" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#D91E18" strokeWidth="4" opacity=".32" />
          </pattern>
          <linearGradient id="wtifill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A300" stopOpacity=".5" />
            <stop offset="100%" stopColor="#F5A300" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="380.6" y="20" width="560.6" height="380" fill="url(#warhatch)" />
        <rect x="1043.2" y="20" width="96.8" height="380" fill="url(#warhatch)" />

        <line x1="60" y1="400" x2="1160" y2="400" stroke="#F4EDE0" strokeWidth="3" opacity=".5" />
        <line x1="60" y1="320.4" x2="1160" y2="320.4" stroke="#F4EDE0" strokeWidth="1.5" strokeDasharray="7 7" opacity=".3" />
        <line x1="60" y1="57.7" x2="1160" y2="57.7" stroke="#F4EDE0" strokeWidth="1.5" strokeDasharray="7 7" opacity=".3" />
        <text x="52" y="326" className="ax" textAnchor="end">$57</text>
        <text x="52" y="63" className="ax" textAnchor="end">$114</text>

        <path d="M90 320.4 L569.1 57.7 L1007.5 262.4 L1140 195.3 L1140 400 L90 400 Z" fill="url(#wtifill)" />
        <path ref={path} d="M90 320.4 L569.1 57.7 L1007.5 262.4 L1140 195.3"
          fill="none" stroke="#F5A300" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

        {/* Each flag gets its own horizontal lane — they overlapped sharing one. */}
        <line x1="380.6" y1="70" x2="380.6" y2="400" stroke="#D91E18" strokeWidth="2.5" />
        <g transform="translate(96,36)">
          <rect width="340" height="34" fill="#D91E18" />
          <text x="13" y="23" className="flag">28 FEB · STRIKE · HORMUZ CLOSES</text>
        </g>

        <line x1="941.2" y1="317" x2="941.2" y2="400" stroke="#1E3FBF" strokeWidth="2.5" />
        <line x1="941.2" y1="317" x2="900" y2="317" stroke="#1E3FBF" strokeWidth="2.5" />
        <g transform="translate(690,300)">
          <rect width="210" height="34" fill="#1E3FBF" />
          <text x="13" y="23" className="flag">18 JUN · CEASEFIRE</text>
        </g>

        <line x1="1043.2" y1="420" x2="1043.2" y2="240" stroke="#D91E18" strokeWidth="2.5" />
        <g transform="translate(906,420)">
          <rect width="254" height="34" fill="#D91E18" />
          <text x="13" y="23" className="flag">8 JUL · STRIKES RESUME</text>
        </g>

        <g transform="translate(590,30)">
          <rect width="152" height="42" fill="#F5A300" />
          <text x="13" y="31" className="peak">$114.01</text>
        </g>

        <circle cx="1007.5" cy="262.4" r="10" fill="#1E3FBF" stroke="#F4EDE0" strokeWidth="3" />
        <text x="1007.5" y="244" className="dotl dotl-blue" textAnchor="middle">$69.74</text>
        <circle cx="1140" cy="195.3" r="10" fill="#D91E18" stroke="#F4EDE0" strokeWidth="3" />
        <text x="1148" y="178" className="dotl dotl-crimson" textAnchor="end">$84.25</text>
        <text x="90" y="348" className="dotl">2 JAN · $57.21</text>
      </svg>

      <div className="foot-row">
        <div>
          <span className="t-label chip chip-amber">What this shows</span>
          <p className="t-body foot-p">
            Oil nearly doubled after the February strike, fell all the way back to its pre-war
            level during the June ceasefire, then climbed again when strikes resumed three weeks
            later. Inflation does not switch off on the day of a ceasefire and back on three
            weeks later. Neither do tariffs.
          </p>
        </div>
        <p className="t-note foot-note">
          Four verified closes from FRED DCOILWTICO. The path between them is drawn straight —
          the daily series is not wired into this chart, and we will not invent it.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- ticker */

/**
 * Sits between §01 and §02. Ported from the reference: two identical runs, the
 * second `aria-hidden`, translated -50% over 42s. The duplicate is what makes
 * the loop seamless — at -50% the second run sits exactly where the first
 * started, so the reset is invisible.
 */
const TICKER = [
  'CRUDE $57 → $114 → $70 → $84',
  'GROUND BEEF $5.55 → $6.83',
  'COFFEE $7.02 → $9.46',
  'GASOLINE $3.21 → $4.20',
  'JOB CREATION 320,938/MO → 42,118/MO',
  'LONG-TERM UNEMPLOYED 21.1% → 27.3%',
  'US-SPECIFIC INFLATION EXCESS +0.77',
  'HIRING RATE FROZEN AT 3.3%',
];

function Ticker() {
  const run = (hidden: boolean) => (
    <span className="tk-run" aria-hidden={hidden || undefined}>
      {TICKER.map((t) => <span key={t}>{t}</span>)}
    </span>
  );
  return (
    <div className="tk" role="marquee" aria-label="Headline figures">
      <div className="tk-inner">{run(false)}{run(true)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- §02 */

const SHELF = [
  { key: 'beef', name: 'Ground beef, 1 lb', from: 5.55, to: 6.83, pct: 23, wFrom: 55.5, wTo: 68.3 },
  { key: 'coffee', name: 'Coffee, 1 lb', from: 7.02, to: 9.46, pct: 35, wFrom: 70.2, wTo: 94.6 },
  { key: 'gas', name: 'Gasoline, 1 gal', from: 3.21, to: 4.20, pct: 31, wFrom: 32.1, wTo: 42.0 },
];

function Shelf() {
  const rev = useReveal();
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;
    const el = root.current;
    rev.on(el, () => {
      el.querySelectorAll<HTMLElement>('.bar-h').forEach((b) => {
        setTimeout(() => { b.style.transform = 'scaleX(1)'; }, Number(b.dataset.delay ?? 0));
      });
    });
  }, [rev]);

  return (
    <section className="sec sec-paper halftone-light" ref={root} id="shelf">
      <div className="head-row">
        <h2 className="t-h2">The shelf</h2>
        <span className="t-note head-note">January 2025 → now · actual dollars</span>
      </div>

      <div className="grid-auto">
        {SHELF.map((s, i) => (
          <article key={s.key} className="panel-dark card">
            <div className="card-top">
              <span className="t-card">{s.name}</span>
              <span className="t-label chip chip-crimson">+{s.pct}%</span>
            </div>
            <div className="bars">
              <div className="bar-row">
                <span className="t-label bar-k">Jan 2025</span>
                <span className="track track-was">
                  <span className="bar-h fill fill-was" data-delay={i * 130} style={{ width: `${s.wFrom}%` }} />
                </span>
                <b className="t-label bar-v-lbl">${s.from.toFixed(2)}</b>
              </div>
              <div className="bar-row">
                <span className="t-label bar-k">Now</span>
                <span className="track track-now">
                  <span className="bar-h fill fill-now" data-delay={i * 130 + 90} style={{ width: `${s.wTo}%` }} />
                </span>
                <b className="t-label bar-v-lbl">${s.to.toFixed(2)}</b>
              </div>
            </div>
          </article>
        ))}
      </div>

      <WhatThisShows>
        Ground beef cost $5.55 in January 2025. It costs $6.83 now. Coffee went from $7.02 to
        $9.46. Bars are on a common dollar scale, so the lengths are comparable across items.
      </WhatThisShows>
    </section>
  );
}

/* ------------------------------------------------------------------- §03 */

function Crossing() {
  const rev = useReveal();
  const root = useRef<HTMLElement>(null);
  const eu = useRef<SVGPathElement>(null);
  const us = useRef<SVGPathElement>(null);
  const f1 = useRef<SVGGElement>(null);
  const ring = useRef<SVGGElement>(null);
  const f2 = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!root.current) return;
    const reduced = isReduced();
    [eu, us].forEach((p) => p.current && prepareStroke(p.current, reduced));
    rev.on(root.current, () => {
      drawStroke(eu.current, 0);
      drawStroke(us.current, 0);
      // The sequence IS the argument: US was better, then the cross, then worse.
      const show = (el: SVGGElement | null, d: number) => {
        if (el) setTimeout(() => { el.style.opacity = '1'; }, reduced ? 0 : d);
      };
      show(f1.current, 900);
      show(ring.current, 1500);
      show(f2.current, 1750);
    });
  }, [rev]);

  return (
    <section className="sec sec-blue halftone-dark" ref={root} id="crossing">
      <div className="head-grid">
        <h2 className="t-h2">
          The lines<br />crossed in<br /><span className="hit-amber">between</span>
        </h2>
        <p className="t-lead head-lead">
          Other rich countries are the control group. At the height of the global surge America
          was doing better than Europe. Four years later Europe is near its target and America
          is a point above it.
        </p>
      </div>

      <svg className="v4-svg" viewBox="0 0 1200 470" role="img"
        aria-label="US and euro-area inflation. October 2022: euro area 10.62 percent, US 7.76. June 2026: euro area 2.73, US 3.73. The lines cross.">
        <line x1="60" y1="400" x2="1160" y2="400" stroke="#BFD0FF" strokeWidth="3" opacity=".4" />
        <text x="120" y="436" className="ax ax-blue">OCT 2022 · GLOBAL PEAK</text>
        <text x="1080" y="436" className="ax ax-blue" textAnchor="end">JUN 2026 · NO GLOBAL SHOCK</text>

        <path ref={eu} d="M120 85.3 L1080 311.7" fill="none" stroke="#BFD0FF" strokeWidth="6" strokeLinecap="round" />
        <path ref={us} d="M120 167.3 L1080 283" fill="none" stroke="#F5A300" strokeWidth="8" strokeLinecap="round" />

        <text x="106" y="80" className="pt pt-eu" textAnchor="end">10.62%</text>
        <text x="106" y="178" className="pt pt-us" textAnchor="end">7.76%</text>
        <text x="1094" y="316" className="pt pt-eu">2.73%</text>
        <text x="1094" y="278" className="pt pt-us">3.73%</text>

        <g ref={ring} className="seq">
          <circle cx="782.9" cy="253" r="22" fill="none" stroke="#D91E18" strokeWidth="4" />
          <circle cx="782.9" cy="253" r="6" fill="#D91E18" />
        </g>

        <g ref={f1} className="seq" transform="translate(252,40)">
          <rect width="366" height="38" fill="#F4EDE0" />
          <text x="15" y="26" className="flag flag-onlight">US 2.86 PTS BELOW EUROPE</text>
        </g>
        <g ref={f2} className="seq" transform="translate(626,330)">
          <rect width="342" height="38" fill="#D91E18" />
          <text x="15" y="26" className="flag">US 1.00 PT ABOVE EUROPE</text>
        </g>

        <g transform="translate(120,18)">
          <rect width="16" height="6" fill="#BFD0FF" />
          <text x="24" y="8" className="ax ax-blue">EURO AREA</text>
          <rect x="160" width="16" height="6" fill="#F5A300" />
          <text x="184" y="8" className="ax ax-amber">UNITED STATES</text>
        </g>
      </svg>

      <WhatThisShows dark>
        In 2022 nearly every rich country had high inflation at once, and America&rsquo;s was
        slightly lower than Europe&rsquo;s. Since 2025 Europe&rsquo;s has come down and
        America&rsquo;s has not. Same shock, different outcome.
      </WhatThisShows>
      <p className="t-note foot-note">
        Two months are verified. The path between them is drawn straight and labelled as such.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- §04 */

const WAR_BARS = [
  { label: 'Gasoline y/y', value: '+26.7%', w: 100 },
  { label: 'CPI energy y/y', value: '+15.7%', w: 58.8 },
  { label: 'Headline CPI y/y', value: '+3.7%', w: 13.9 },
];

function TwoChoices() {
  const rev = useReveal();
  const root = useRef<HTMLElement>(null);
  const creep = useRef<HTMLSpanElement>(null);
  const txt = useRef<any>(null);

  useEffect(() => {
    if (!root.current) return;
    const el = root.current;
    const T = new ImperativeText();
    txt.current = T;
    const reduced = isReduced();
    rev.on(el, () => {
      el.querySelectorAll<HTMLElement>('.bar-h').forEach((b, i) => {
        setTimeout(() => { b.style.transform = 'scaleX(1)'; }, i * 120);
      });
      T.count(creep.current, 0.81, {
        duration: 1500, decimals: 2, reduced, format: (v: number) => `+${v.toFixed(2)} PTS`,
      });
    });
  }, [rev]);
  useEffect(() => { txt.current?.replay(); });

  return (
    <section className="sec sec-paper" ref={root} id="choices">
      <h2 className="t-h2">Two choices,<br />two signatures</h2>
      <p className="t-lead head-lead">
        The war and the tariffs do not show up in the same place, and saying so is what makes
        the rest of this page believable. The war is in the tails. The tariffs are in the core.
      </p>

      <div className="grid-auto-wide choices">
        <article className="card-war">
          <span className="t-kicker">Choice one · 28 February 2026</span>
          <h3 className="t-card choice-h">The war</h3>
          <div className="bars">
            {WAR_BARS.map((b) => (
              <div key={b.label} className="bar-row">
                <span className="t-label bar-k">{b.label}</span>
                <span className="track track-onwar">
                  <span className="bar-h fill fill-amber" style={{ width: `${b.w}%` }} />
                </span>
                <b className="t-label bar-v-lbl">{b.value}</b>
              </div>
            ))}
          </div>
          <p className="t-small card-p">
            Energy was never tariffed — crude is exempt from every schedule — so the only route
            from policy into a 2026 gasoline price runs through the strait.
          </p>
        </article>

        <article className="card-tariff">
          <span className="t-kicker">Choice two · ongoing</span>
          <h3 className="t-card choice-h">The tariffs</h3>
          <div className="creep">
            <div className="creep-end">
              <span className="t-label">Apr 2025</span>
              <span className="t-stat-sm">2.61%</span>
            </div>
            <span className="creep-link" aria-hidden />
            <div className="creep-end">
              <span className="t-label">May 2026</span>
              <span className="t-stat-sm">3.42%</span>
            </div>
          </div>
          <div className="creep-box">
            <span className="t-label">A persistent creep of</span>
            <span className="t-stat" ref={creep}>+0.00 PTS</span>
          </div>
          <p className="t-small card-p">
            Core PCE, with no energy component in it, running above core CPI throughout. That is
            what goods-price pass-through looks like. Credible estimates put tariffs at{' '}
            <b>0.4–0.8 points of core PCE</b> — a range, because no defensible point estimate
            exists.
          </p>
        </article>
      </div>

      {/* Load-bearing. Cutting this is the easiest way for a critic to kill the page. */}
      <div className="panel-amber honest">
        <span className="t-label">The honest part</span>
        <p className="t-body">
          The Supreme Court struck down the IEEPA tariffs on 20 February 2026, cutting average
          tariffs by about 4.8 points. The Dallas Fed found the Hormuz shipping-cost increase{' '}
          <b>completely offsets it</b>, putting the net tariff effect through 2026 close to zero.
          So the headline spike is the war and the tariffs are the slow creep in the core. Both
          follow decisions taken after January 2025 — but they are not the same number, and we
          do not add them together.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- §05 */

const MATTERS = [
  { label: 'Long-term unemployed, share of all unemployed', value: '21.1% → 27.3%', w: 91, c: 'crimson' },
  { label: 'Hiring rate (pre-2020 ~3.9%)', value: '3.3%', w: 85, c: 'amber' },
  { label: 'Quits rate — nobody is moving for a raise', value: '1.9%', w: 49, c: 'amber' },
];

function Work() {
  const rev = useReveal();
  const root = useRef<HTMLElement>(null);
  const biden = useRef<HTMLSpanElement>(null);
  const trump = useRef<HTMLSpanElement>(null);
  const txt = useRef<any>(null);

  useEffect(() => {
    if (!root.current) return;
    const el = root.current;
    const T = new ImperativeText();
    txt.current = T;
    const reduced = isReduced();
    const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
    rev.on(el, () => {
      el.querySelectorAll<HTMLElement>('.bar-v').forEach((b, i) => {
        setTimeout(() => { b.style.transform = 'scaleY(1)'; }, i * 350);
      });
      el.querySelectorAll<HTMLElement>('.bar-h').forEach((b, i) => {
        setTimeout(() => { b.style.transform = 'scaleX(1)'; }, 300 + i * 120);
      });
      T.count(biden.current, 320938, { duration: 1400, reduced, format: fmt });
      T.count(trump.current, 42118, { duration: 1400, reduced, format: fmt });
    });
  }, [rev]);
  useEffect(() => { txt.current?.replay(); });

  return (
    <section className="sec sec-ink halftone-dark" ref={root} id="work">
      <div className="head-grid">
        <h2 className="t-h2">A frozen<br />labour market</h2>
        <p className="t-lead head-lead">
          Unemployment is near record lows and that is true. It is also the wrong number. Few
          people are being laid off — but if you lose a job you stay out far longer, and you
          cannot move for a raise.
        </p>
      </div>

      <div className="work-grid">
        <div>
          <span className="t-label">Jobs created per month</span>
          <div className="cols">
            <div className="col">
              <span className="t-stat-sm col-v"><span ref={biden}>0</span></span>
              <div className="col-track">
                <span className="col-bar bar-v col-biden" style={{ height: '100%' }} />
              </div>
              <span className="t-label col-l">Biden</span>
            </div>
            <div className="col">
              <span className="t-stat-sm col-v"><span ref={trump}>0</span></span>
              <div className="col-track">
                {/* 13.1% = 42,118 / 320,938. Meant to look almost invisible. */}
                <span className="col-bar bar-v col-trump" style={{ height: '13.1%' }} />
              </div>
              <span className="t-label col-l">Trump II</span>
            </div>
            <div className="drop"><span className="t-stat">−87%</span></div>
          </div>
        </div>

        <div>
          <span className="t-label">The number that matters</span>
          <div className="matters">
            {MATTERS.map((m) => (
              <div key={m.label} className="bar-stack">
                <span className="t-label matters-l">{m.label}</span>
                <span className="track track-was">
                  <span className={`bar-h fill fill-${m.c}`} style={{ width: `${m.w}%` }} />
                </span>
                <b className="t-card matters-v">{m.value}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="t-note foot-note">
        Powell noted in December 2025 that payroll growth may be overstated by roughly 60,000 a
        month through the birth-death model — a bias that flatters these numbers, not the reverse.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- §06 */

const OTHER = [
  { v: '−45%', l: 'Eggs, per year', w: 'Avian influenza resolved. Not policy, and not claimed as such.' },
  { v: '2.6%', l: 'Core CPI', w: 'At or near target. The overshoot is in the tails, not the basket.' },
  { v: '2.7%', l: 'Median CPI', w: 'A relative-price shock moves the tail; broad demand inflation would move this.' },
  { v: 'Up', l: 'S&P 500', w: 'Higher over the period. Initial claims also low. Both true.' },
];

function OtherSide() {
  return (
    <section className="sec sec-paper" id="other-side">
      <h2 className="t-h2">The other side<br />of the coin</h2>
      <p className="t-lead head-lead">
        A page that only shows the bad rows is a page you should not trust. These sit at the
        same size as everything else.
      </p>
      <div className="grid-auto other">
        {OTHER.map((o) => (
          <article key={o.l} className="panel-outline other-card">
            <span className="t-label other-kicker">The other side</span>
            <span className="t-stat other-v">{o.v}</span>
            <span className="t-card other-l">{o.l}</span>
            <p className="t-small other-w">{o.w}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- §07 */

function Strait() {
  return (
    <section className="sec sec-sea halftone-dark" id="strait">
      <div className="head-grid">
        <h2 className="t-h2">Everything came<br />through here</h2>
        <p className="t-lead head-lead">
          One route from a decision in February to a number on a fuel pump. Press play, or drag
          the scrubber to any day.
        </p>
      </div>

      <HormuzSimulation />

      <WhatThisShows dark>
        Crude went from $57 to $114 after the strike, fell all the way back to $69.74 during the
        June ceasefire, then climbed to $84 when strikes resumed. A round trip synchronised to
        military events is an energy shock. Inherited inflation does not reverse on the day of a
        ceasefire and return three weeks later.
      </WhatThisShows>

      <div className="grid-auto">
        <div className="panel-onsea onsea-card">
          <span className="t-label">What would disprove this</span>
          <p className="t-small">
            If prices had kept rising through the June ceasefire, or if oil-insensitive
            categories had broken at the same date, the war attribution would fail.
          </p>
        </div>
        <div className="panel-onsea onsea-card">
          <span className="t-label">What we do not claim</span>
          <p className="t-small">
            No queue count — no verified figure exists at any tier. No manipulation of the
            paper-physical spread; no regulator has alleged it. The vessel layer models published
            transit ratios, it does not track ships.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- §08 */

function Sources() {
  return (
    <section className="sec sec-ink sources" id="sources">
      <div className="grid-auto">
        <div>
          <span className="t-label src-h">Sources —</span>
          <p className="t-small">
            Bureau of Labor Statistics · Bureau of Economic Analysis · Federal Reserve · Energy
            Information Administration · Eurostat · IEA · Marsh, via FRED.{' '}
            <a href="https://github.com/Samizdat-Publications/oil-tracking-dashboard">
              Code and data pipeline
            </a>.
          </p>
        </div>
        <div>
          <span className="t-label src-h">Missing —</span>
          <p className="t-small">
            October 2025 CPI does not exist. It was never collected during the 43-day shutdown,
            so every 12-month change spanning it is undefined.
          </p>
        </div>
        <div>
          <span className="t-label src-h">Not wired in —</span>
          <p className="t-small">
            IMF PortWatch transit volumes, which would turn the vessel layer from illustrative
            into a real series. Tanker day rates are unavailable at reasonable cost.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- page */

export default function LedgerPage() {
  return (
    <div className="v4-root">
      <Masthead />
      <Ticker />
      <Shelf />
      <Crossing />
      <TwoChoices />
      <Work />
      <Strait />
      <OtherSide />
      <Sources />
    </div>
  );
}
