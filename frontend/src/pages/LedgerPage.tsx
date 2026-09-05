/* eslint-disable @typescript-eslint/no-explicit-any -- the snapshot is untyped JSON straight from the endpoints; every field is guarded before use. */
/**
 * V4 — "The bill for two choices"
 *
 * A PORT of design_handoff_v4, not an interpretation. Where a value exists in
 * spec/SECTIONS.md — a hex code, a bar width, an SVG coordinate, an easing
 * curve — it is used literally. The first attempt at this page treated the
 * handoff as a mood board and rebuilt it from the copy alone; that lost the
 * poster look, all the motion, and most of what carries the argument.
 *
 * September 2026 revision: every figure now comes from `deriveFigures()` over
 * the snapshot (see v4/ledger-data.ts). The August version carried its numbers
 * as JSX literals and a month later all of them were stale. The look is
 * unchanged; the geometry that used to be typed in is now computed from the
 * same series it describes. Three sections are new — the squeeze, the gold
 * leaving New York, and the trade that stopped moving — and the strait runs on
 * measured daily closes and IMF PortWatch transit counts.
 *
 * Things that look odd here and are load-bearing:
 *   - Shelf bar widths are percentages of a shared $0-$10 scale, NOT normalised
 *     per card. Coffee's bar is longer than beef's because coffee costs more.
 *     Per-card normalisation is the obvious "fix" and it destroys the comparison.
 *   - §03's US line is amber, not red. Red reads as a team jersey and costs the
 *     page its credibility with the readers it most needs to reach.
 *   - §05's Trump bar is sized to the ratio of the two term averages. It is
 *     meant to look almost invisible.
 *   - The crimson H1 carries a CREAM hard text-shadow with zero blur. That is
 *     the poster device the whole design hangs on.
 *
 * The root carries `container-type: inline-size` via `.v4-root`. Every clamp()
 * in tokens.css is in cqi units — without the container they all collapse to
 * their minimum and the page renders tiny.
 */

import { useEffect, useRef, useState } from 'react';
import HormuzSimulation from '../v4/HormuzSimulation';
// @ts-expect-error — ported JS module, no types by design
import { Reveal, ImperativeText, prepareStroke, drawStroke } from '../v4/reveal.js';
import { getAll } from '../v4/data';
import { deriveFigures, fmt, money, pctS, mon, day, dayShort, monthLong, quarter, type Figures, type Pt } from '../v4/ledger-data';
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

/** Reveal-driven horizontal bars inside a section root. */
function growBars(el: HTMLElement, stagger = 120, offset = 0) {
  el.querySelectorAll<HTMLElement>('.bar-h').forEach((b, i) => {
    const delay = b.dataset.delay !== undefined ? Number(b.dataset.delay) : offset + i * stagger;
    setTimeout(() => { b.style.transform = 'scaleX(1)'; }, delay);
  });
  el.querySelectorAll<HTMLElement>('.bar-v').forEach((b, i) => {
    setTimeout(() => { b.style.transform = 'scaleY(1)'; }, offset + i * stagger);
  });
}

/* ------------------------------------------------------------------- §01 */

/** Flag geometry for the masthead chart. Width is estimated from the label
    length at the 17px Chivo 900 the `.flag` class uses. */
const flagW = (label: string) => 26 + label.length * 10.4;

function Masthead({ f }: { f: Figures }) {
  const m = f.masthead;
  const pct = useRef<HTMLSpanElement>(null);
  const gas = useRef<HTMLSpanElement>(null);
  const path = useRef<SVGPathElement>(null);
  const txt = useRef<any>(null);

  useEffect(() => {
    const T = new ImperativeText();
    txt.current = T;
    const reduced = isReduced();
    // Above the fold, so these fire on load rather than on scroll.
    if (m.peakPct !== null) T.count(pct.current, m.peakPct, { duration: 1400, reduced, format: (v: number) => `+${v.toFixed(0)}%` });
    if (m.gas) T.count(gas.current, m.gas.value, { duration: 1600, decimals: 2, reduced, format: (v: number) => `$${v.toFixed(2)}` });
    if (path.current) { prepareStroke(path.current, reduced); drawStroke(path.current, 200); }
  }, [m]);
  useEffect(() => { txt.current?.replay(); });

  // ── chart geometry: viewBox 1200×470, plot x 90..1140, $50..$120 on y ──
  const X0 = 90, X1 = 1140;
  const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000;
  const s = m.series;
  const d0 = s.length ? dayNum(s[0].date) : 0;
  const lastEvent = m.events[m.events.length - 1]?.date;
  const d1 = Math.max(s.length ? dayNum(s[s.length - 1].date) : 1, lastEvent ? dayNum(lastEvent) : 1);
  const X = (iso: string) => X0 + ((dayNum(iso) - d0) / Math.max(1, d1 - d0)) * (X1 - X0);
  const Y = (v: number) => 400 - ((v - 50) / 70) * 342;
  const line = s.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(' ');
  const area = s.length ? `${line} L${X(s[s.length - 1].date).toFixed(1)} 400 L${X(s[0].date).toFixed(1)} 400 Z` : '';
  const ev = (date: string) => m.events.find((e) => e.date === date);
  const hatch = [
    ['2026-02-28', '2026-04-07', 0.32], ['2026-04-07', '2026-06-18', 0.12],
    ['2026-07-08', lastEvent ?? '2026-09-01', 0.32],
  ] as const;
  const at = (iso: string) => m.series.reduce<Pt | null>((b, p) => (p.date <= iso ? p : b), null);

  // Flags. Top lane for the strikes, bottom lane (below the line) for the
  // ceasefires, with leaders to the price point. Positions follow the data.
  const flags = m.events.map((e, i) => {
    const x = X(e.date), w = flagW(e.label);
    const isWar = e.kind === 'war';
    const lane = isWar ? (i === 0 ? 36 : e.date >= '2026-09-01' ? 78 : 36) : 330;
    const left = i === 0 ? 96 : Math.min(x - 6, 1160 - w);
    return { ...e, x, w, lane, left, color: isWar ? '#D91E18' : '#1E3FBF', price: at(e.date) };
  });
  const peakBoxX = m.peak ? Math.min(X(m.peak.date) + 12, 1160 - 152) : 0;

  return (
    <section className="sec sec-ink halftone-dark" id="masthead">
      <div className="masthead-bar">
        <span className="t-label chip chip-crimson">Trump&rsquo;s Economy</span>
        <span className="t-label bar-mid">A ledger · {f.asOf.label}</span>
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
            Both landed on a grocery receipt — and, seven months on, the strait is still shut.
          </p>
          <div className="hero-stats">
            <div className="stat-box">
              <div className="t-label">Crude, {m.jan2 ? dayShort(m.jan2.date) : '—'} → {m.peak ? dayShort(m.peak.date) : '—'}</div>
              <div className="t-stat"><span ref={pct}>+0%</span></div>
            </div>
            <div className="stat-box">
              <div className="t-label">Gasoline / gallon · {m.gas ? day(m.gas.date) : '—'}</div>
              <div className="t-stat"><span ref={gas}>$0.00</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="chart-head">
        <h2 className="chart-h2">West Texas Intermediate, 2026</h2>
        <p className="t-small chart-sub">
          Every daily close from {m.jan2 ? day(m.jan2.date) : '—'} to {m.latest ? day(m.latest.date) : '—'}. Prices tracked the war in both directions.
        </p>
      </div>

      <svg className="v4-svg" viewBox="0 0 1200 470" role="img"
        aria-label={`WTI crude in 2026: ${money(m.jan2?.value ?? null)} on ${day(m.jan2?.date)}, peaking ${money(m.peak?.value ?? null)} on ${day(m.peak?.date)}, ${money(m.latest?.value ?? null)} on ${day(m.latest?.date)}.`}>
        <defs>
          <pattern id="warhatch" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#D91E18" strokeWidth="4" />
          </pattern>
          <linearGradient id="wtifill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F5A300" stopOpacity=".5" />
            <stop offset="100%" stopColor="#F5A300" stopOpacity="0" />
          </linearGradient>
        </defs>

        {hatch.map(([a, b, op]) => (
          <rect key={a + b} x={X(a)} y="20" width={Math.max(0, X(b) - X(a))} height="380" fill="url(#warhatch)" opacity={op} />
        ))}

        <line x1="60" y1="400" x2="1160" y2="400" stroke="#F4EDE0" strokeWidth="3" opacity=".5" />
        {m.jan2 && <line x1="60" y1={Y(m.jan2.value)} x2="1160" y2={Y(m.jan2.value)} stroke="#F4EDE0" strokeWidth="1.5" strokeDasharray="7 7" opacity=".3" />}
        {m.peak && <line x1="60" y1={Y(m.peak.value)} x2="1160" y2={Y(m.peak.value)} stroke="#F4EDE0" strokeWidth="1.5" strokeDasharray="7 7" opacity=".3" />}
        {m.jan2 && <text x="52" y={Y(m.jan2.value) + 6} className="ax" textAnchor="end">${m.jan2.value.toFixed(0)}</text>}
        {m.peak && <text x="52" y={Y(m.peak.value) + 6} className="ax" textAnchor="end">${m.peak.value.toFixed(0)}</text>}

        {area && <path d={area} fill="url(#wtifill)" />}
        <path ref={path} d={line} fill="none" stroke="#F5A300" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {flags.map((fl) => (
          <g key={fl.date}>
            {fl.price && (
              <line x1={fl.x} y1={fl.lane < 200 ? fl.lane + 34 : fl.lane} x2={fl.x} y2={Y(fl.price.value)}
                stroke={fl.color} strokeWidth="2.5" opacity=".9" />
            )}
            <g transform={`translate(${fl.left},${fl.lane})`}>
              <rect width={fl.w} height="34" fill={fl.color} />
              <text x="13" y="23" className="flag">{fl.label}</text>
            </g>
            {fl.price && <circle cx={fl.x} cy={Y(fl.price.value)} r="8" fill={fl.color} stroke="#F4EDE0" strokeWidth="3" />}
          </g>
        ))}

        {m.peak && (
          <g transform={`translate(${peakBoxX},30)`}>
            <rect width="152" height="42" fill="#F5A300" />
            <text x="13" y="31" className="peak">${m.peak.value.toFixed(2)}</text>
          </g>
        )}
        {m.jan2 && <text x={X(m.jan2.date)} y={Y(m.jan2.value) + 30} className="dotl">{dayShort(m.jan2.date)} · ${m.jan2.value.toFixed(2)}</text>}
        {m.latest && (
          <>
            <circle cx={X(m.latest.date)} cy={Y(m.latest.value)} r="10" fill="#F5A300" stroke="#F4EDE0" strokeWidth="3" />
            <text x={Math.min(X(m.latest.date) + 8, 1160)} y={Y(m.latest.value) - 18} className="dotl" textAnchor="end">
              ${m.latest.value.toFixed(2)} · {dayShort(m.latest.date)}
            </text>
          </>
        )}
        {ev('2026-06-18') && at('2026-07-01') && (
          <text x={X('2026-07-01')} y={Y(at('2026-07-01')!.value) + 28} className="dotl dotl-blue" textAnchor="middle">
            ${at('2026-07-01')!.value.toFixed(2)} · 1 JUL
          </text>
        )}
      </svg>

      <div className="foot-row">
        <div>
          <span className="t-label chip chip-amber">What this shows</span>
          <p className="t-body foot-p">
            Oil {m.peakPct !== null && m.peakPct >= 95 ? 'doubled' : 'nearly doubled'} after the February strike, fell all the way back to its
            pre-war level during the June ceasefire, then climbed again when strikes resumed three weeks
            later. It is {money(m.latest?.value ?? null)} now, with the strait still effectively shut. Inflation does not switch off
            on the day of a ceasefire and back on three weeks later. Neither do tariffs.
          </p>
        </div>
        <p className="t-note foot-note">
          {m.series.length} daily closes from FRED DCOILWTICO (Cushing spot). Gasoline is the EIA weekly
          survey; AAA put the Labor Day average at {money(m.aaaLaborDay?.usd_per_gal ?? null)}, the first Labor Day above $4.
          Diesel {money(m.diesel?.value ?? null)} ({m.diesel ? day(m.diesel.date) : '—'}), a series record.
        </p>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- ticker */

/**
 * Sits between §01 and §02. Two identical runs, the second `aria-hidden`,
 * translated -50% over 42s. The duplicate is what makes the loop seamless — at
 * -50% the second run sits exactly where the first started, so the reset is
 * invisible.
 */
function Ticker({ items }: { items: string[] }) {
  const run = (hidden: boolean) => (
    <span className="tk-run" aria-hidden={hidden || undefined}>
      {items.map((t) => <span key={t}>{t}</span>)}
    </span>
  );
  return (
    <div className="tk" role="marquee" aria-label="Headline figures">
      <div className="tk-inner">{run(false)}{run(true)}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- §02 */

function Shelf({ f }: { f: Figures }) {
  const rev = useReveal();
  const root = useRef<HTMLElement>(null);
  useEffect(() => { if (root.current) rev.on(root.current, () => growBars(root.current!)); }, [rev]);

  const beef = f.shelf.find((s) => s.key === 'beef_ground');
  const coffee = f.shelf.find((s) => s.key === 'coffee');
  const asOf = f.shelf[0]?.toLabel ?? '—';

  return (
    <section className="sec sec-paper halftone-light" ref={root} id="shelf">
      <div className="head-row">
        <h2 className="t-h2">The shelf</h2>
        <span className="t-note head-note">January 2025 → {asOf} · actual dollars</span>
      </div>

      <div className="grid-auto">
        {f.shelf.map((s, i) => (
          <article key={s.key} className="panel-dark card">
            <div className="card-top">
              <span className="t-card">{s.name}</span>
              <span className="t-label chip chip-crimson">{pctS(s.pct, 0)}</span>
            </div>
            <div className="bars">
              <div className="bar-row">
                <span className="t-label bar-k">{s.fromLabel}</span>
                <span className="track track-was">
                  {/* Shared $0-$10 scale across every card. Do not normalise. */}
                  <span className="bar-h fill fill-was" data-delay={i * 130} style={{ width: `${Math.min(100, s.from * 10)}%` }} />
                </span>
                <b className="t-label bar-v-lbl">{money(s.from)}</b>
              </div>
              <div className="bar-row">
                <span className="t-label bar-k">{s.toLabel}</span>
                <span className="track track-now">
                  <span className="bar-h fill fill-now" data-delay={i * 130 + 90} style={{ width: `${Math.min(100, s.to * 10)}%` }} />
                </span>
                <b className="t-label bar-v-lbl">{money(s.to)}</b>
              </div>
            </div>
            <p className="t-note card-src">{s.source}</p>
          </article>
        ))}
      </div>

      <WhatThisShows>
        Ground beef cost {money(beef?.from ?? null)} in January 2025. It costs {money(beef?.to ?? null)} now. Coffee went
        from {money(coffee?.from ?? null)} to {money(coffee?.to ?? null)}. Diesel, which moves everything on the shelf, is at a
        record. Bars are on a common dollar scale, so the lengths are comparable across items.
      </WhatThisShows>
    </section>
  );
}

/* ------------------------------------------------------------------- §03 */

function Crossing({ f }: { f: Figures }) {
  const c = f.crossing;
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

  const n = c.series.length;
  const X = (i: number) => 120 + (i / Math.max(1, n - 1)) * 960;
  const Y = (v: number) => 400 - (v / 11) * 330;
  const pathOf = (k: 'us' | 'benchmark') =>
    c.series.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join(' ');
  const crossIdx = c.cross ? c.series.findIndex((p) => p.date === c.cross!.date) : -1;
  const st = c.start, la = c.latest;
  const gapNow = la ? la.gap : null;
  const startGapAbs = st ? Math.abs(st.gap) : null;

  return (
    <section className="sec sec-blue halftone-dark" ref={root} id="crossing">
      <div className="head-grid">
        <h2 className="t-h2">
          The lines<br />crossed in<br /><span className="hit-amber">between</span>
        </h2>
        <p className="t-lead head-lead">
          Other rich countries are the control group. At the height of the global surge America
          was doing better than Europe. Since then the lines crossed, and America has run above it
          for {c.cross ? `${Math.round((n - 1 - crossIdx))} months` : 'most of the period'} — though the gap has narrowed as the oil shock reaches Europe.
        </p>
      </div>

      <svg className="v4-svg" viewBox="0 0 1200 470" role="img"
        aria-label={`US and euro-area inflation, ${mon(st?.date)} to ${mon(la?.date)}. Start: euro area ${st?.benchmark}%, US ${st?.us}%. Latest: euro area ${la?.benchmark}%, US ${la?.us}%. The lines cross in ${mon(c.cross?.date)}.`}>
        <line x1="60" y1="400" x2="1160" y2="400" stroke="#BFD0FF" strokeWidth="3" opacity=".4" />
        <text x="120" y="436" className="ax ax-blue">{mon(st?.date).toUpperCase()} · GLOBAL PEAK</text>
        <text x="1080" y="436" className="ax ax-blue" textAnchor="end">{mon(la?.date).toUpperCase()} · NO GLOBAL SHOCK</text>

        <path ref={eu} d={pathOf('benchmark')} fill="none" stroke="#BFD0FF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path ref={us} d={pathOf('us')} fill="none" stroke="#F5A300" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

        {st && <text x="106" y={Y(st.benchmark) - 6} className="pt pt-eu" textAnchor="end">{st.benchmark.toFixed(2)}%</text>}
        {st && <text x="106" y={Y(st.us) + 22} className="pt pt-us" textAnchor="end">{st.us.toFixed(2)}%</text>}
        {la && <text x="1094" y={Y(la.benchmark) + 22} className="pt pt-eu">{la.benchmark.toFixed(2)}%</text>}
        {la && <text x="1094" y={Y(la.us) - 6} className="pt pt-us">{la.us.toFixed(2)}%</text>}

        {crossIdx >= 0 && (
          <g ref={ring} className="seq">
            <circle cx={X(crossIdx)} cy={Y((c.series[crossIdx].us + c.series[crossIdx].benchmark) / 2)} r="22" fill="none" stroke="#D91E18" strokeWidth="4" />
            <circle cx={X(crossIdx)} cy={Y((c.series[crossIdx].us + c.series[crossIdx].benchmark) / 2)} r="6" fill="#D91E18" />
            <text x={X(crossIdx)} y={Y((c.series[crossIdx].us + c.series[crossIdx].benchmark) / 2) + 48} className="ax ax-blue" textAnchor="middle">
              {mon(c.series[crossIdx].date).toUpperCase()}
            </text>
          </g>
        )}

        <g ref={f1} className="seq" transform="translate(252,40)">
          <rect width="366" height="38" fill="#F4EDE0" />
          <text x="15" y="26" className="flag flag-onlight">US {startGapAbs?.toFixed(2)} PTS BELOW EUROPE</text>
        </g>
        <g ref={f2} className="seq" transform="translate(720,300)">
          <rect width="360" height="38" fill="#D91E18" />
          <text x="15" y="26" className="flag">US {gapNow !== null ? Math.abs(gapNow).toFixed(2) : '—'} {gapNow !== null && Math.abs(gapNow) < 1.5 ? 'PT' : 'PTS'} {gapNow !== null && gapNow < 0 ? 'BELOW' : 'ABOVE'} EUROPE</text>
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
        lower than Europe&rsquo;s. The lines crossed in {mon(c.cross?.date)} and America has run above Europe since.
        The gap is {gapNow !== null ? `${Math.abs(gapNow).toFixed(2)} points` : '—'} in {mon(la?.date)} — narrower than in the
        spring, because the same oil shock is now lifting Europe too: the euro area&rsquo;s August flash
        estimate is {c.euFlash?.headline_pct ?? '—'}% with energy up {c.euFlash?.energy_pct ?? '—'}%.
      </WhatThisShows>
      <p className="t-note foot-note">
        Every month drawn: {n} monthly readings of US CPI (BLS) and euro-area HICP (Eurostat) via FRED.
        The indices are built differently — owners&rsquo; equivalent rent is 24% of the US basket and 0% of
        the euro-area basket — which is worth roughly a point of the 2022 gap.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------- §04 */

function TwoChoices({ f }: { f: Figures }) {
  const c = f.choices;
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
      growBars(el);
      if (c.creep.change !== null) {
        T.count(creep.current, c.creep.change, {
          duration: 1500, decimals: 2, reduced, format: (v: number) => `+${v.toFixed(2)} PTS`,
        });
      }
    });
  }, [rev, c]);
  useEffect(() => { txt.current?.replay(); });

  const maxBar = Math.max(...c.warBars.map((b) => b.value ?? 0), 1);
  const asOf = c.warBars[0]?.asOf ?? '—';

  return (
    <section className="sec sec-paper" ref={root} id="choices">
      <h2 className="t-h2">Two choices,<br />two signatures</h2>
      <p className="t-lead head-lead">
        The war and the tariffs do not show up in the same place, and saying so is what makes
        the rest of this page believable. The war is in the tails. The tariffs are in the core.
      </p>

      <div className="grid-auto-wide choices">
        <article className="card-war">
          <span className="t-kicker">Choice one · 28 February 2026 · CPI for {asOf}</span>
          <h3 className="t-card choice-h">The war</h3>
          <div className="bars">
            {c.warBars.map((b) => (
              <div key={b.label} className="bar-row">
                <span className="t-label bar-k">{b.label}</span>
                <span className="track track-onwar">
                  <span className="bar-h fill fill-amber" style={{ width: `${((b.value ?? 0) / maxBar) * 100}%` }} />
                </span>
                <b className="t-label bar-v-lbl">{pctS(b.value)}</b>
              </div>
            ))}
          </div>
          <p className="t-small card-p">
            Energy was never tariffed — crude is exempt from every schedule — so the only route
            from policy into a 2026 gasoline price runs through the strait. Median CPI
            is {c.median ? `${c.median.value.toFixed(1)}%` : '—'}: the overshoot is in the tail, not the basket.
          </p>
        </article>

        <article className="card-tariff">
          <span className="t-kicker">Choice two · ongoing · §301 at 10–12.5%, §232 at 25–50%</span>
          <h3 className="t-card choice-h">The tariffs</h3>
          <div className="creep">
            <div className="creep-end">
              <span className="t-label">{mon(c.creep.start?.date)}</span>
              <span className="t-stat-sm">{c.creep.start ? `${c.creep.start.value.toFixed(2)}%` : '—'}</span>
            </div>
            <span className="creep-link" aria-hidden />
            <div className="creep-end">
              <span className="t-label">{mon(c.creep.end?.date)}</span>
              <span className="t-stat-sm">{c.creep.end ? `${c.creep.end.value.toFixed(2)}%` : '—'}</span>
            </div>
          </div>
          <div className="creep-box">
            <span className="t-label">A persistent creep of</span>
            <span className="t-stat" ref={creep}>+0.00 PTS</span>
          </div>
          <p className="t-small card-p">
            Core PCE, with no energy component in it, running above core CPI ({c.core ? `${c.core.value.toFixed(1)}%` : '—'}) throughout. That is
            what goods-price pass-through looks like. Credible estimates put tariffs at{' '}
            <b>0.4–0.8 points of core PCE</b> — a range, because no defensible point estimate
            exists. The Section 122 surcharge lapsed in July; Section 301 duties at 10% and 12.5% replaced it the same day.
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

function Work({ f }: { f: Figures }) {
  const w = f.work;
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
    const fmtN = (v: number) => Math.round(v).toLocaleString('en-US');
    rev.on(el, () => {
      el.querySelectorAll<HTMLElement>('.bar-v').forEach((b, i) => {
        setTimeout(() => { b.style.transform = 'scaleY(1)'; }, i * 350);
      });
      el.querySelectorAll<HTMLElement>('.bar-h').forEach((b, i) => {
        setTimeout(() => { b.style.transform = 'scaleX(1)'; }, 300 + i * 120);
      });
      if (w.prevMean !== null) T.count(biden.current, w.prevMean, { duration: 1400, reduced, format: fmtN });
      if (w.currMean !== null) T.count(trump.current, w.currMean, { duration: 1400, reduced, format: fmtN });
    });
  }, [rev, w]);
  useEffect(() => { txt.current?.replay(); });

  const ratioPct = w.ratio !== null ? Math.max(0, w.ratio * 100) : 0;
  const drop = w.ratio !== null ? Math.round((1 - w.ratio) * 100) : null;
  const matters = [
    w.ltuStart && w.ltuLatest ? { label: 'Long-term unemployed, share of all unemployed', value: `${w.ltuStart.value}% → ${w.ltuLatest.value}%`, w: 91, c: 'crimson' } : null,
    w.hires ? { label: `Hiring rate, ${mon(w.hires.date)} (pre-2020 ~3.9%)`, value: `${w.hires.value.toFixed(1)}%`, w: Math.round((w.hires.value / 3.9) * 100), c: 'amber' } : null,
    w.quits ? { label: 'Quits rate — nobody is moving for a raise', value: `${w.quits.value.toFixed(1)}%`, w: Math.round((w.quits.value / 3.9) * 100), c: 'amber' } : null,
  ].filter((x): x is { label: string; value: string; w: number; c: string } => !!x);

  return (
    <section className="sec sec-ink halftone-dark" ref={root} id="work">
      <div className="head-grid">
        <h2 className="t-h2">A frozen<br />labour market</h2>
        <p className="t-lead head-lead">
          Unemployment is {w.unemployment ? `${w.unemployment.value.toFixed(1)}%` : 'low'} and that is true. It is also the wrong number. Few
          people are being laid off — but if you lose a job you stay out far longer, and you
          cannot move for a raise. August&rsquo;s {w.august ? `+${fmt(w.august.change)}` : ''} was the best month in five and
          barely moves a {w.currMonths ?? '—'}-month average.
        </p>
      </div>

      <div className="work-grid">
        <div>
          <span className="t-label">Jobs created per month · through {monthLong(f.asOf.jobsMonth)}</span>
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
                {/* Sized to the ratio of the two term averages. Meant to look almost invisible. */}
                <span className="col-bar bar-v col-trump" style={{ height: `${ratioPct.toFixed(1)}%` }} />
              </div>
              <span className="t-label col-l">Trump II</span>
            </div>
            <div className="drop"><span className="t-stat">{drop !== null ? `−${drop}%` : '—'}</span></div>
          </div>
        </div>

        <div>
          <span className="t-label">The number that matters</span>
          <div className="matters">
            {matters.map((m) => (
              <div key={m.label} className="bar-stack">
                <span className="t-label matters-l">{m.label}</span>
                <span className="track track-was">
                  <span className={`bar-h fill fill-${m.c}`} style={{ width: `${Math.min(100, m.w)}%` }} />
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
        U-6 underemployment {w.u6 ? `${w.u6.value.toFixed(1)}%` : '—'}.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- §06 new */

function Squeeze({ f }: { f: Figures }) {
  const s = f.squeeze;
  const tiles = [
    s.sentiment ? {
      k: 'Consumer sentiment', v: fmt(s.sentiment.index, 1), from: `${fmt(s.sentiment.index_jan_2025, 1)} in Jan 2025`,
      w: `Michigan, final ${monthLong(s.sentiment.release).split(' ')[0]}. Only ${s.sentiment.share_expect_income_to_beat_inflation_pct}% expect their income to beat inflation next year, down from ${s.sentiment.share_expect_income_to_beat_inflation_dec_2024_pct}% in December 2024.`,
      bad: true,
    } : null,
    s.inflExp ? {
      k: 'Inflation expected next year', v: `${s.inflExp.expectations_1y_pct.toFixed(1)}%`, from: `${s.inflExp.expectations_1y_feb_2026_pct}% in Feb 2026, before the war`,
      w: `Long-run expectations ${s.inflExp.expectations_long_run_pct}%. Market breakevens stay anchored: 10-year ${s.breakeven?.value ?? '—'}%, 5y5y ${s.fwd5y5y?.value ?? '—'}%.`,
      bad: true,
    } : null,
    s.tenYear ? {
      k: '10-year Treasury yield', v: `${s.tenYear.value.toFixed(2)}%`, from: `${s.tenYearHandover?.value.toFixed(2) ?? '—'}% at the handover`,
      w: `Fed funds upper bound ${s.fedFunds?.value ?? '—'}%. Futures put a September rate RISE at ${s.hikeOdds?.probability_pct ?? '—'}% after Chair Warsh said underlying inflation had not “meaningfully improved”.`,
      bad: true,
    } : null,
    s.mortgage ? {
      k: '30-year mortgage', v: `${s.mortgage.value.toFixed(2)}%`, from: `${s.mortgageHandover?.value.toFixed(2) ?? '—'}% at the handover`,
      w: 'Lower than in January 2025 — the one row here that cuts the other way. It bottomed near 6.1% in February before the war repriced everything.',
      bad: false,
    } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <section className="sec sec-paper halftone-light" id="squeeze">
      <div className="head-row">
        <h2 className="t-h2">The squeeze</h2>
        <span className="t-note head-note">What households expect, and what money costs</span>
      </div>
      <div className="grid-auto sq-grid">
        {tiles.map((t) => (
          <article key={t.k} className={`sq-tile ${t.bad ? 'sq-bad' : 'sq-good'}`}>
            <span className="t-label sq-k">{t.k}</span>
            <span className="t-stat sq-v">{t.v}</span>
            <span className="t-note sq-from">from {t.from}</span>
            <p className="t-small sq-w">{t.w}</p>
          </article>
        ))}
      </div>
      <WhatThisShows>
        Seven months into an energy shock the Fed is talking about raising rates, not cutting them.
        Households expect {s.inflExp?.expectations_1y_pct ?? '—'}% inflation next year and most do not expect a raise to cover it.
        The Dallas Fed finds the shock hit lowest-income neighbourhoods 2.9 times harder, measured by the share of
        spending that goes to gasoline.
      </WhatThisShows>
    </section>
  );
}

/* ---------------------------------------------------------------- §07 new */

function Gold({ f }: { f: Figures }) {
  const g = f.gold;
  const rev = useReveal();
  const root = useRef<HTMLElement>(null);
  const big = useRef<HTMLSpanElement>(null);
  const txt = useRef<any>(null);

  useEffect(() => {
    if (!root.current) return;
    const el = root.current;
    const T = new ImperativeText();
    txt.current = T;
    const reduced = isReduced();
    rev.on(el, () => {
      growBars(el, 90);
      if (g.earmarked.change !== null) {
        T.count(big.current, Math.abs(g.earmarked.change), {
          duration: 1500, reduced, format: (v: number) => `−${Math.round(v).toLocaleString('en-US')} t`,
        });
      }
    });
  }, [rev, g]);
  useEffect(() => { txt.current?.replay(); });

  // Monthly change in ounces held, expressed in tonnes. Every bar points down.
  const em = g.earmarked.points;
  const deltas = em.slice(1).map((p, i) => ({ date: p.date, dt: p.tonnes - em[i].tonnes }));
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d.dt)), 1);
  const tr = g.treasuries.points;
  const trDeltas = tr.slice(1).map((p, i) => ({ date: p.date, d: p.usdBn - tr[i].usdBn }));
  const trMax = Math.max(...trDeltas.map((d) => Math.abs(d.d)), 1);

  const nl = g.moves.find((m: any) => m.country === 'Netherlands');
  const fr = g.moves.find((m: any) => m.country === 'France');
  const ind = g.moves.find((m: any) => m.country === 'India');
  const de = g.moves.find((m: any) => m.country === 'Germany');
  const priceDrop = g.price ? (g.price.latest.usd_oz / g.price.record.usd_oz - 1) * 100 : null;

  return (
    <section className="sec sec-ink halftone-dark" ref={root} id="gold">
      <div className="head-grid">
        <h2 className="t-h2">The gold<br />is <span className="hit-amber">leaving</span></h2>
        <p className="t-lead head-lead">
          Foreign governments have kept their gold in the basement of the New York Fed since the
          1940s because nowhere was safer. Since last summer they have been taking it out — not
          because the price moved, but because of where it sits.
        </p>
      </div>

      <div className="gold-grid">
        <div className="gold-vault">
          <span className="t-label">Foreign gold under earmark at the New York Fed · change each month</span>
          <div className="vault-big">
            <span className="t-stat-lg vault-n" ref={big}>−0 t</span>
            <span className="t-small vault-cap">
              {g.earmarked.start ? `${fmt(g.earmarked.start.tonnes)} t in ${mon(g.earmarked.start.date)}` : '—'} →{' '}
              {g.earmarked.latest ? `${fmt(g.earmarked.latest.tonnes)} t in ${mon(g.earmarked.latest.date)}` : '—'}
            </span>
          </div>
          <div className="vault-bars" role="img" aria-label="Monthly change in foreign gold held at the New York Fed, every month negative or zero.">
            {deltas.map((d) => (
              <div key={d.date} className="vault-col">
                <span className="t-label vault-v">{d.dt === 0 ? '0' : `${Math.round(d.dt)}`}</span>
                <span className="vault-track">
                  <span className="bar-v vault-bar" style={{ height: `${(Math.abs(d.dt) / maxAbs) * 100}%` }} />
                </span>
                <span className="t-label vault-m">{mon(d.date).slice(0, 3).toUpperCase()}</span>
              </div>
            ))}
          </div>
          <p className="t-note vault-note">
            Federal Reserve Table 3.13, valued at the statutory $42.22 an ounce — a price fixed in 1973, so a change in
            this row is ounces moving, never a valuation effect. Tonnes derived from the published dollar figures.
          </p>
        </div>

        <div className="gold-side">
          <div className="panel-onsea gold-tres">
            <span className="t-label">Treasuries in Fed custody for foreign officials · monthly change, $bn</span>
            <div className="tres-bars">
              {trDeltas.map((d) => (
                <div key={d.date} className="tres-col">
                  <span className={`t-label tres-v ${d.d < 0 ? 'is-neg' : 'is-pos'}`}>{d.d > 0 ? '+' : ''}{Math.round(d.d)}</span>
                  <span className="tres-track">
                    <span className={`bar-h tres-bar ${d.d < 0 ? 'is-neg' : 'is-pos'}`} style={{ width: `${(Math.abs(d.d) / trMax) * 100}%` }} />
                  </span>
                  <span className="t-label tres-m">{mon(d.date).slice(0, 3).toUpperCase()}</span>
                </div>
              ))}
            </div>
            <p className="t-small tres-cap">
              {g.treasuries.peak && g.treasuries.latest
                ? `${money(g.treasuries.peak.usdBn / 1000, 2)}tn in ${mon(g.treasuries.peak.date)} → ${money(g.treasuries.latest.usdBn / 1000, 2)}tn in ${mon(g.treasuries.latest.date)}, face value.`
                : '—'}{' '}
              Total foreign holdings of Treasuries were {g.tic ? `$${g.tic.total_usd_tn}tn` : '—'} in {g.tic ? mon(`${g.tic.date}-01`) : '—'} (Treasury TIC),
              down {g.tic ? `$${Math.abs(g.tic.change_in_month_usd_bn)}bn` : '—'} on the month and lower in three of four months since the February record.
            </p>
          </div>
        </div>
      </div>

      <div className="grid-auto gold-moves">
        {nl && (
          <article className="panel-outline move-card">
            <span className="t-label move-k">Netherlands · announced {day(nl.announced)}</span>
            <span className="t-stat move-v">{nl.tonnes} t</span>
            <span className="t-card move-l">out of New York and Ottawa, {nl.period}</span>
            <p className="t-small move-w">
              New York&rsquo;s share of Dutch reserves {nl.before_share_new_york_pct}% → {nl.after_share_new_york_pct}%. DNB:
              &ldquo;{nl.quote}&rdquo;. Tier 1, central bank press release.
            </p>
          </article>
        )}
        {fr && (
          <article className="panel-outline move-card">
            <span className="t-label move-k">France · {fr.period}</span>
            <span className="t-stat move-v">{fr.tonnes} t</span>
            <span className="t-card move-l">out of the New York Fed</span>
            <p className="t-small move-w">{fr.note}</p>
          </article>
        )}
        {ind && (
          <article className="panel-outline move-card">
            <span className="t-label move-k">India · share of reserves held abroad</span>
            <span className="t-stat move-v">{ind.share_abroad_before_pct}% → {ind.share_abroad_after_pct}%</span>
            <span className="t-card move-l">{mon(`${ind.share_abroad_before_date}-01`)} to {mon(`${ind.share_abroad_after_date}-01`)}</span>
            <p className="t-small move-w">Repatriated from the Bank of England and the BIS. Reserve Bank of India half-yearly report.</p>
          </article>
        )}
        {de && (
          <article className="panel-outline move-card">
            <span className="t-label move-k">Germany · still in New York</span>
            <span className="t-stat move-v">{fmt(de.tonnes_at_new_york)} t</span>
            <span className="t-card move-l">of {fmt(de.total_reserves_tonnes)} t — over a third of the Bundesbank&rsquo;s gold</span>
            <p className="t-small move-w">{de.status}</p>
          </article>
        )}
      </div>

      <div className="panel-amber honest">
        <span className="t-label">The honest part</span>
        <p className="t-body">
          Gold is <b>down {priceDrop !== null ? `${Math.abs(priceDrop).toFixed(0)}%` : '—'}</b> from its {g.price ? day(g.price.record.date) : ''} record of {money(g.price?.record.usd_oz ?? null, 0)} an ounce,
          and the dollar index is <b>higher</b> than the day the war began. This is not a dollar collapse. The ECB
          reports gold ({g.ecb?.gold_pct}%) overtook Treasuries ({g.ecb?.treasuries_pct}%) as a share of world reserves at the end of 2025,
          and a Federal Reserve note published on {g.fedCounter ? day(g.fedCounter.date) : '—'} argues, fairly, that most of that
          is valuation: private buyers pushed the price up, and foreign officials still bought about $200bn of Treasuries net since 2022.
          What the valuation argument does not explain is the custody table above. Counted in ounces, at a price
          fixed in 1973, foreign gold has left the New York Fed every month since August 2025 and none has arrived —
          {g.earmarked.change !== null ? ` ${fmt(Math.abs(g.earmarked.change))} tonnes ` : ' '}so far — and central banks that publish a reason
          say the same thing the Dutch did: geopolitical unrest.
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- §08 new */

function Trade({ f }: { f: Figures }) {
  const t = f.trade;
  const rev = useReveal();
  const root = useRef<HTMLElement>(null);
  useEffect(() => { if (root.current) rev.on(root.current, () => growBars(root.current!, 140)); }, [rev]);

  const wto = t.wto;
  const cols = wto ? [
    { l: '2025', v: wto.growth_2025_pct, c: 'col-was' },
    { l: '2026', v: wto.growth_2026_baseline_pct, c: 'col-amber' },
    { l: '2026 if energy stays high', v: wto.growth_2026_high_energy_pct, c: 'col-crimson' },
    { l: '2027', v: wto.growth_2027_pct, c: 'col-was' },
  ] : [];
  const pw = t.portwatch;
  const presidentPerNight = 30;

  return (
    <section className="sec sec-blue halftone-dark" ref={root} id="trade">
      <div className="head-grid">
        <h2 className="t-h2">Less is<br /><span className="hit-amber">moving</span></h2>
        <p className="t-lead head-lead">
          A fifth of the world&rsquo;s seaborne oil used to pass a channel 33 kilometres wide. The
          WTO halved its trade forecast before the war reached its third month; the IEA now expects
          world oil supply and demand to shrink this year.
        </p>
      </div>

      <div className="trade-grid">
        <div className="panel-onsea trade-panel">
          <span className="t-label">World merchandise trade volume, % growth · WTO, {wto ? day(wto.release) : '—'}</span>
          <div className="trade-cols">
            {cols.map((c) => (
              <div key={c.l} className="tcol">
                <span className="t-stat-sm tcol-v">{c.v.toFixed(1)}%</span>
                <span className="tcol-track">
                  <span className={`bar-v tcol-bar ${c.c}`} style={{ height: `${(c.v / 5) * 100}%` }} />
                </span>
                <span className="t-label tcol-l">{c.l}</span>
              </div>
            ))}
          </div>
          <p className="t-small trade-cap">
            In October 2025 the WTO expected {wto?.october_2025_forecast_for_2026_pct}% for 2026 on tariffs alone; the March update lifted the
            baseline to {wto?.growth_2026_baseline_pct}% and then took {Math.abs(wto?.growth_2026_baseline_pct - wto?.growth_2026_high_energy_pct).toFixed(1)} points back off if
            energy stays high. The WTO&rsquo;s own words: &ldquo;{wto?.hormuz_quote}&rdquo;
          </p>
        </div>

        <div className="panel-onsea trade-panel">
          <span className="t-label">Ships through Hormuz per day · IMF PortWatch, AIS-counted</span>
          <div className="transit-rows">
            <div className="bar-row">
              <span className="t-label bar-k">Before the war · Jan 2025–Feb 2026 average</span>
              <span className="track track-was"><span className="bar-h fill fill-was" style={{ width: '100%' }} /></span>
              <b className="t-label bar-v-lbl">{fmt(pw.baseline, 0)}</b>
            </div>
            <div className="bar-row">
              <span className="t-label bar-k">The President, late August: &ldquo;some 30 ships every night&rdquo;</span>
              <span className="track track-was"><span className="bar-h fill fill-claim" style={{ width: `${pw.baseline ? (presidentPerNight / pw.baseline) * 100 : 0}%` }} /></span>
              <b className="t-label bar-v-lbl">{presidentPerNight}</b>
            </div>
            <div className="bar-row">
              <span className="t-label bar-k">Kpler, 10-day average to {t.kpler ? day(t.kpler.date) : '—'}</span>
              <span className="track track-was"><span className="bar-h fill fill-amber" style={{ width: `${pw.baseline && t.kpler ? (t.kpler.ten_day_avg_vessels_per_day / pw.baseline) * 100 : 0}%` }} /></span>
              <b className="t-label bar-v-lbl">{t.kpler?.ten_day_avg_vessels_per_day ?? '—'}</b>
            </div>
            <div className="bar-row">
              <span className="t-label bar-k">PortWatch, 7-day average to {pw.latestDate ? day(pw.latestDate) : '—'}</span>
              <span className="track track-now"><span className="bar-h fill fill-crimson" style={{ width: `${pw.pct ?? 0}%` }} /></span>
              <b className="t-label bar-v-lbl">{pw.mean7 !== null ? pw.mean7.toFixed(1) : '—'}</b>
            </div>
          </div>
          <p className="t-small trade-cap">
            {pw.pct !== null ? `${pw.pct.toFixed(0)}% of pre-war traffic` : '—'}, of which {pw.tanker7 !== null ? pw.tanker7.toFixed(1) : '—'} tankers a day
            against {fmt(pw.tankerBaseline, 0)} before. AIS-dark vessels are not counted, so this is a floor, and the
            official counts appear to include naval auxiliaries, tugs and coastal craft. {t.attacks?.vessels_struck_in_august ?? '—'} merchant
            ships were struck in August; war-risk cover is quoted at {t.warRisk?.pct_of_hull_low}–{t.warRisk?.pct_of_hull_high}% of hull value
            against {t.warRisk?.prewar_pct_of_hull}% before the war.
          </p>
        </div>
      </div>

      <div className="grid-auto trade-tiles">
        {t.iea && (
          <article className="ttile">
            <span className="t-label ttile-k">World oil demand, 2026 · IEA</span>
            <span className="t-stat-sm ttile-v">{t.iea.world_demand_change_2026_mbd} mb/d</span>
            <p className="t-small ttile-w">Supply {t.iea.world_supply_change_2026_mbd} mb/d to {t.iea.world_supply_2026_mbd}. Gulf output shut in: {t.iea.gulf_shut_in_mbd} mb/d. Observed stocks drawn {t.iea.stock_draw_feb_to_jul_mb} million barrels since February.</p>
          </article>
        )}
        {t.usTrade && (
          <article className="ttile">
            <span className="t-label ttile-k">US trade deficit, July · BEA</span>
            <span className="t-stat-sm ttile-v">${t.usTrade.deficit_usd_bn}bn</span>
            <p className="t-small ttile-w">Up from ${t.usTrade.prior_month_deficit_usd_bn}bn in June as imports rose to ${t.usTrade.imports_usd_bn}bn. Year to date the deficit is still {Math.abs(t.usTrade.ytd_deficit_change_pct)}% smaller than 2025 — the tariffs did cut imports, before the war cut everything.</p>
          </article>
        )}
        {t.customsDuties && t.customsDutiesPeak && (
          <article className="ttile">
            <span className="t-label ttile-k">Customs duties, annualised · BEA</span>
            <span className="t-stat-sm ttile-v">${fmt(t.customsDuties.value, 0)}bn</span>
            <p className="t-small ttile-w">{quarter(t.customsDuties.date)}, down from ${fmt(t.customsDutiesPeak.value, 0)}bn in {quarter(t.customsDutiesPeak.date)} after the Supreme Court ruling. Gross receipts; net went negative in June as refunds ran at $49bn a month.</p>
          </article>
        )}
        {t.drewry && (
          <article className="ttile">
            <span className="t-label ttile-k">Shanghai → Jebel Ali, 40ft box · Drewry</span>
            <span className="t-stat-sm ttile-v">${fmt(t.drewry.shanghai_jebel_ali_usd)}</span>
            <p className="t-small ttile-w">Up {t.drewry.shanghai_jebel_ali_wow_pct}% in the week to {day(t.drewry.date)} on Gulf risk. Composite index ${fmt(t.drewry.composite_usd_per_40ft)}; Shanghai → Los Angeles ${fmt(t.drewry.shanghai_los_angeles_usd)}.</p>
          </article>
        )}
        {t.iata && (
          <article className="ttile">
            <span className="t-label ttile-k">Airline profits, 2026 · IATA</span>
            <span className="t-stat-sm ttile-v">${t.iata.net_profit_2026_usd_bn}bn</span>
            <p className="t-small ttile-w">Halved from a ${t.iata.net_profit_2026_prior_forecast_usd_bn}bn forecast as jet fuel goes from ${t.iata.jet_fuel_2025_usd_bbl} to ${t.iata.jet_fuel_2026_usd_bbl} a barrel. US airline fares
              are {pctS(f.choices.airfares?.value ?? null, 1)} on a year earlier ({mon(f.choices.airfares?.date)} CPI).</p>
          </article>
        )}
        {f.masthead.dieselRecord && (
          <article className="ttile">
            <span className="t-label ttile-k">Diesel, national average</span>
            <span className="t-stat-sm ttile-v">{money(f.masthead.diesel?.value ?? null)}</span>
            <p className="t-small ttile-w">EIA weekly, {f.masthead.diesel ? day(f.masthead.diesel.date) : '—'}, from {money(f.masthead.dieselHandover?.value ?? null)} at the handover. GasBuddy&rsquo;s daily tracker printed {money(f.masthead.dieselRecord.usd_per_gal)} on {day(f.masthead.dieselRecord.date)}, above the June 2022 record. Diesel is the price of moving everything else.</p>
          </article>
        )}
      </div>

      <WhatThisShows dark>
        The strait did not reopen when the mines were cleared. Measured traffic is a few ships a day against
        eighty-odd before the war, whatever the official count says. Less oil moves, so less of everything
        moves: the WTO cut its trade forecast, the IEA cut its demand forecast, airlines cut their profits,
        and the cost of shipping a container to the Gulf went up again last week.
      </WhatThisShows>
    </section>
  );
}

/* ------------------------------------------------------------------- §09 */

function Strait({ f }: { f: Figures }) {
  const m = f.masthead;
  return (
    <section className="sec sec-sea halftone-dark" id="strait">
      <div className="head-grid">
        <h2 className="t-h2">Everything came<br />through here</h2>
        <p className="t-lead head-lead">
          One route from a decision in February to a number on a fuel pump. Press play, or drag
          the scrubber to any day. Prices are every daily close; ship counts are IMF PortWatch.
        </p>
      </div>

      <HormuzSimulation />

      <WhatThisShows dark>
        Crude went from {money(m.jan2?.value ?? null, 0)} to {money(m.peak?.value ?? null, 0)} after the strike, fell all the way back
        to $69.74 during the June ceasefire, then climbed to {money(m.latest?.value ?? null, 0)} as strikes resumed and the
        strait stayed shut through August. A round trip synchronised to military events is an energy shock.
        Inherited inflation does not reverse on the day of a ceasefire and return three weeks later.
      </WhatThisShows>

      <div className="grid-auto">
        <div className="panel-onsea onsea-card">
          <span className="t-label">What would disprove this</span>
          <p className="t-small">
            If prices had kept rising through the June ceasefire, or if oil-insensitive
            categories had broken at the same date, the war attribution would fail.
            {f.eventStudy ? ` Event study: ${f.eventStudy.n_matched} of ${f.eventStudy.n_events} pre-classified events moved the right way.` : ''}
          </p>
        </div>
        <div className="panel-onsea onsea-card">
          <span className="t-label">What we do not claim</span>
          <p className="t-small">
            No queue count — no verified figure exists at any tier, and the &ldquo;tankers waiting&rdquo; readout
            is a model. No manipulation of the paper-physical spread; no regulator has alleged it. The map
            geometry is schematic. The transit counts are real but AIS-based, so they are a floor.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- §10 */

function OtherSide({ f }: { f: Figures }) {
  return (
    <section className="sec sec-paper" id="other-side">
      <h2 className="t-h2">The other side<br />of the coin</h2>
      <p className="t-lead head-lead">
        A page that only shows the bad rows is a page you should not trust. These sit at the
        same size as everything else.
      </p>
      <div className="grid-auto other">
        {f.other.map((o) => (
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

/* ------------------------------------------------------------------- §11 */

function Sources({ f }: { f: Figures }) {
  return (
    <section className="sec sec-ink sources" id="sources">
      <div className="grid-auto">
        <div>
          <span className="t-label src-h">Sources —</span>
          <p className="t-small">
            Bureau of Labor Statistics · Bureau of Economic Analysis · Federal Reserve (FRED, Table 3.13, FEDS Notes) ·
            Energy Information Administration · Eurostat · IEA · IMF PortWatch · WTO · ECB · De Nederlandsche Bank ·
            Marsh · Kpler and Lloyd&rsquo;s List via the press.{' '}
            <a href="https://github.com/Samizdat-Publications/oil-tracking-dashboard">Code, data pipeline and every citation</a>.
            Snapshot built {day(f.asOf.generated)}.
          </p>
        </div>
        <div>
          <span className="t-label src-h">Missing —</span>
          <p className="t-small">
            October 2025 CPI does not exist. It was never collected during the 43-day shutdown,
            so every 12-month change spanning it is undefined; this page computes changes by calendar
            month so the hole stays a hole. No war-risk premium reading has been published for August.
          </p>
        </div>
        <div>
          <span className="t-label src-h">Corrections —</span>
          <p className="t-small">
            {f.sources.crudePeakNote} An earlier build also reported June 2026 inflation as 3.73%; it was 3.53%,
            because our year-over-year indexed twelve observations back across the missing October. Both are
            fixed and covered by tests. A site that asks you to check its work should show what happens when someone does.
          </p>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- page */

export default function LedgerPage() {
  const [fig, setFig] = useState<Figures | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getAll()
      .then((snap) => { if (live) setFig(deriveFigures(snap)); })
      .catch((e) => { if (live) setErr(String(e?.message ?? e)); });
    return () => { live = false; };
  }, []);

  if (err) {
    return (
      <div className="v4-root">
        <section className="sec sec-ink">
          <span className="t-label chip chip-crimson">Trump&rsquo;s Economy</span>
          <p className="t-lead" style={{ marginTop: 16 }}>
            The data snapshot could not be loaded ({err}). Nothing on this page is typed in by hand, so
            there is nothing to show without it.
          </p>
        </section>
      </div>
    );
  }
  if (!fig) {
    return (
      <div className="v4-root">
        <section className="sec sec-ink" style={{ minHeight: '100vh' }}>
          <div className="masthead-bar">
            <span className="t-label chip chip-crimson">Trump&rsquo;s Economy</span>
            <span className="t-label bar-mid">A ledger · loading the data snapshot</span>
            <span className="t-label bar-end">Every figure sourced</span>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="v4-root">
      <Masthead f={fig} />
      <Ticker items={fig.ticker} />
      <Shelf f={fig} />
      <Crossing f={fig} />
      <TwoChoices f={fig} />
      <Work f={fig} />
      <Squeeze f={fig} />
      <Gold f={fig} />
      <Trade f={fig} />
      <Strait f={fig} />
      <OtherSide f={fig} />
      <Sources f={fig} />
    </div>
  );
}
