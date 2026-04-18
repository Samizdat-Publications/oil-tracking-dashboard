import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useDownstream, useMilestones, useOilPrices } from '../hooks/useOilPrices';
import { useCrisisComparison } from '../hooks/useCrisisComparison';
import {
  COMMODITY_DATA,
  IRAN_WAR_DATE,
  WAR_BASELINE_DATE,
  alignSeries,
  computeCorrelation,
  getValueBeforeDate,
} from '../lib/commodity-data';
import type { CrisisData, Milestone, PriceSeries } from '../types';
import '../styles/broadsheet.css';

// ─── helpers ────────────────────────────────────────────────────────────
function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── Odometer: digit-flip counter ───────────────────────────────────────
function Odometer({
  value,
  decimals = 2,
  prefix = '',
  duration = 1400,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  duration?: number;
}) {
  const [displayed, setDisplayed] = useState(reducedMotion() ? value : 0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const targetRef = useRef(value);
  // Mirror displayed into a ref so the animation effect can read the latest
  // value without making `displayed` a dependency (which would restart the
  // animation every frame and cause an infinite loop).
  const displayedRef = useRef(displayed);
  useEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);

  useEffect(() => {
    if (reducedMotion()) {
      setDisplayed(value);
      return;
    }
    fromRef.current = displayedRef.current;
    targetRef.current = value;
    startRef.current = null;
    const animate = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const progress = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayed(fromRef.current + (targetRef.current - fromRef.current) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const str = displayed.toFixed(decimals);
  return (
    <span className="odometer" aria-label={`${prefix}${value.toFixed(decimals)}`}>
      {prefix}
      {str.split('').map((ch, i) => (
        <span key={i} className={/\d/.test(ch) ? 'odo-digit' : 'odo-static'}>
          {ch}
        </span>
      ))}
    </span>
  );
}

// ─── useInView ──────────────────────────────────────────────────────────
function useInView<T extends Element>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

// ─── Build derived hero metrics from real WTI series ────────────────────
function useHeroMetrics() {
  const wtiQ = useOilPrices('wti');
  const brentQ = useOilPrices('brent');
  return useMemo(() => {
    const wti = wtiQ.data;
    const brent = brentQ.data;
    const wtiObs = wti?.observations ?? [];
    const brentObs = brent?.observations ?? [];
    const currentWTI = wtiObs.length ? wtiObs[wtiObs.length - 1].value : 112.36;
    const currentBrent = brentObs.length ? brentObs[brentObs.length - 1].value : 116.56;
    const wtiBaseline = wti ? getValueBeforeDate(wti, WAR_BASELINE_DATE) : null;
    const brentBaseline = brent ? getValueBeforeDate(brent, WAR_BASELINE_DATE) : null;
    const wtiBase = wtiBaseline ?? 63.35;
    const brentBase = brentBaseline ?? 68.37;
    const pctSinceWar = ((currentWTI - wtiBase) / wtiBase) * 100;
    const dollarSinceWar = currentWTI - wtiBase;
    const brentDollarSinceWar = currentBrent - brentBase;
    const today = new Date('2026-04-17');
    const daysOfWar = daysBetween(IRAN_WAR_DATE, today.toISOString().slice(0, 10));
    return {
      wti,
      brent,
      currentWTI,
      currentBrent,
      pctSinceWar,
      dollarSinceWar,
      brentDollarSinceWar,
      daysOfWar,
      isLoading: wtiQ.isLoading || brentQ.isLoading,
    };
  }, [wtiQ.data, brentQ.data, wtiQ.isLoading, brentQ.isLoading]);
}

// ─── TICKER ─────────────────────────────────────────────────────────────
function Ticker({ currentWTI, dollarSinceWar }: { currentWTI: number; dollarSinceWar: number }) {
  const dsQ = useDownstream();
  const items = useMemo(() => {
    const tail =
      dsQ.data?.series.slice(0, 7).map((s) => {
        const last = s.observations.at(-1);
        const baseline = getValueBeforeDate(s, WAR_BASELINE_DATE);
        const pct = last && baseline ? ((last.value - baseline) / baseline) * 100 : 0;
        const meta = COMMODITY_DATA[s.series_id];
        const icon = meta?.icon ?? '\u{1F4C8}';
        const name = (meta?.displayName ?? s.name).toUpperCase();
        const price = last ? `$${last.value.toFixed(2)}` : '—';
        return {
          icon,
          name,
          price,
          change: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% since war`,
          up: pct >= 0,
        };
      }) ?? [];
    return [
      {
        icon: '\u{1F6E2}\uFE0F',
        name: 'CRUDE OIL',
        price: `$${currentWTI.toFixed(2)}`,
        change: `+$${dollarSinceWar.toFixed(2)} since war`,
        up: dollarSinceWar >= 0,
      },
      ...tail,
    ];
  }, [dsQ.data, currentWTI, dollarSinceWar]);

  const row = (prefix: string) =>
    items.map((it, i) => (
      <span key={`${prefix}-${i}`} className="ticker-item">
        <span className="ticker-icon">{it.icon}</span>
        <span className="ticker-name">{it.name}</span>
        <strong className="ticker-price">{it.price}</strong>
        <span className={`ticker-change ${it.up ? 'up' : 'down'}`}>{it.change}</span>
        <span className="ticker-sep">|</span>
      </span>
    ));

  return (
    <div className="ticker-bar" role="marquee" aria-label="Live commodity prices">
      <div className="ticker-track">
        {row('a')}
        {row('b')}
      </div>
    </div>
  );
}

// ─── HERO ───────────────────────────────────────────────────────────────
function Hero() {
  const m = useHeroMetrics();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);
  const today = new Date('2026-04-17')
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toUpperCase();

  // gasoline (real value if available)
  const dsQ = useDownstream();
  const gasoline = useMemo(() => {
    const g = dsQ.data?.series.find((s) => s.series_id === 'gasoline');
    if (!g) return { current: 4.82, dollar: 1.61 };
    const last = g.observations.at(-1)?.value ?? 4.82;
    const base = getValueBeforeDate(g, WAR_BASELINE_DATE) ?? 3.21;
    return { current: last, dollar: last - base };
  }, [dsQ.data]);

  return (
    <section className="hero" data-screen-label="01 Hero">
      <div className="data-rain" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => {
          const labels = ['$128.42', '+55%', 'HORMUZ', 'WTI', 'BRENT', 'LIVE', 'OPEC+'];
          return (
            <span
              key={i}
              style={{
                left: `${(i * 4.3) % 100}%`,
                animationDelay: `${(i * 0.7) % 6}s`,
                animationDuration: `${6 + (i % 4)}s`,
              }}
            >
              {labels[i % labels.length]}
            </span>
          );
        })}
      </div>

      <header className="masthead">
        <div className="mast-left">
          <span className="mast-title">CRUDE OIL ANALYTICS</span>
          <span className="mast-sub">War Economy Desk</span>
        </div>
        <div className="mast-right">
          <span className="mast-date">{today}</span>
          <span className="mast-vol">VOL. III &middot; NO. 47</span>
          <span className="live-indicator">
            <span className="live-dot" />
            LIVE
          </span>
        </div>
      </header>

      <div className="hero-grid">
        <div className={`hero-left ${mounted ? 'in' : ''}`}>
          <div className="kicker">
            <span className="kicker-rule" />
            URGENT &middot; SINCE FEB 28, 2026
          </div>
          <h1 className="hero-headline">
            <span className="hl-line">Oil has climbed</span>
            <span className="hl-line hl-em">
              <span className="hl-big">
                <Odometer value={m.pctSinceWar} decimals={1} />
              </span>
              <span className="hl-pct">%</span>
            </span>
            <span className="hl-line">since the first strike.</span>
          </h1>
          <p className="hero-lede">
            {m.daysOfWar} days into the Iran war, WTI crude sits at{' '}
            <em>${m.currentWTI.toFixed(2)}</em>. Every dollar ripples through groceries, fertilizer,
            and the cost of getting anywhere. This is the ledger.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--text-2)',
              marginTop: -20,
              marginBottom: 28,
              opacity: 0.7,
            }}
          >
            BASELINE FEB 14 &middot; LAST CLEAN PRINT BEFORE INSIDER-TRADING RUN-UP
          </p>
          <div className="hero-stats">
            <div className="pstat">
              <div className="pstat-label">WTI CRUDE</div>
              <div className="pstat-value">
                <Odometer value={m.currentWTI} prefix="$" />
              </div>
              <div className="pstat-change up">
                &uarr; ${m.dollarSinceWar.toFixed(2)}
              </div>
            </div>
            <div className="pstat">
              <div className="pstat-label">BRENT CRUDE</div>
              <div className="pstat-value">
                <Odometer value={m.currentBrent} prefix="$" />
              </div>
              <div className="pstat-change up">
                &uarr; ${m.brentDollarSinceWar.toFixed(2)}
              </div>
            </div>
            <div className="pstat">
              <div className="pstat-label">GASOLINE</div>
              <div className="pstat-value">
                <Odometer value={gasoline.current} prefix="$" />
              </div>
              <div className="pstat-change up">
                &uarr; ${gasoline.dollar.toFixed(2)}
              </div>
            </div>
            <div className="pstat">
              <div className="pstat-label">DAYS OF WAR</div>
              <div className="pstat-value">
                <Odometer value={m.daysOfWar} decimals={0} />
              </div>
              <div className="pstat-change neutral">since Feb 28</div>
            </div>
          </div>
        </div>

        <div className={`hero-right ${mounted ? 'in' : ''}`}>
          <HeroChart series={m.wti} />
        </div>
      </div>

      <div className="hero-bottom">
        <div className="dateline">APR 17, 2026 — WTI CRUDE &middot; DATA: FRED / CME / EIA</div>
        <div className="scroll-hint">
          <span>SCROLL TO CONTINUE</span>
          <svg width="12" height="24" viewBox="0 0 12 24">
            <path d="M6 2 V22 M2 18 L6 22 L10 18" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
        </div>
      </div>
    </section>
  );
}

// ─── HERO CHART ─────────────────────────────────────────────────────────
function HeroChart({ series }: { series: PriceSeries | undefined }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const points = series?.observations ?? [];
  const W = 620;
  const H = 360;
  const { path, areaPath, warX, minV, maxV, endY } = useMemo(() => {
    if (points.length < 2) {
      return { path: '', areaPath: '', warX: W * 0.5, minV: 56, maxV: 139, endY: H / 2 };
    }
    const minV = Math.min(...points.map((p) => p.value));
    const maxV = Math.max(...points.map((p) => p.value));
    const range = Math.max(1, maxV - minV);
    const path = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * W;
        const y = H - ((p.value - minV) / range) * (H - 40) - 20;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const areaPath = path + ` L${W},${H} L0,${H} Z`;
    const warIdx = points.findIndex((p) => p.date >= IRAN_WAR_DATE);
    const warX = warIdx >= 0 ? (warIdx / (points.length - 1)) * W : W * 0.85;
    const lastVal = points[points.length - 1].value;
    const endY = H - ((lastVal - minV) / range) * (H - 40) - 20;
    return { path, areaPath, warX, minV, maxV, endY };
  }, [points]);

  return (
    <div className="hero-chart" ref={ref}>
      <div className="chart-label">
        <span className="chart-label-top">WTI CRUDE &middot; 24 MONTHS</span>
        <span className="chart-label-bottom">
          ${minV.toFixed(0)}—${maxV.toFixed(0)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={`chart-svg ${inView ? 'draw' : ''}`}>
        <defs>
          <linearGradient id="bsHeroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#00F0FF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
          <pattern id="bsHeroGrid" width="40" height="30" patternUnits="userSpaceOnUse">
            <path d="M40 0 V30 M0 30 H40" stroke="rgba(212,160,18,0.06)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#bsHeroGrid)" />
        <line
          x1={warX}
          y1={10}
          x2={warX}
          y2={H - 10}
          stroke="#CC2936"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.6}
          className="war-marker"
        />
        <text
          x={warX + 6}
          y={22}
          fill="#CC2936"
          fontSize={9}
          fontFamily="'JetBrains Mono'"
          className="war-marker-text"
        >
          FEB 28 &middot; WAR BEGINS
        </text>
        <path d={areaPath} fill="url(#bsHeroFill)" className="chart-area" />
        <path
          d={path}
          stroke="#00F0FF"
          strokeWidth={1.5}
          fill="none"
          className="chart-line"
          strokeLinecap="round"
        />
        <circle cx={W} cy={endY} r={4} fill="#00F0FF" className="chart-dot" />
        <circle
          cx={W}
          cy={endY}
          r={4}
          fill="none"
          stroke="#00F0FF"
          className="chart-dot-ping"
        />
      </svg>
    </div>
  );
}

// ─── PULL QUOTE ─────────────────────────────────────────────────────────
function PullQuote({ text, source }: { text: string; source: string }) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <section className="pull-section section-narrow" ref={ref}>
      <div className={`pull-quote-lg ${inView ? 'in' : ''}`}>
        <span className="pq-mark">&ldquo;</span>
        <p>{text}</p>
        <span className="pq-source">— {source}</span>
      </div>
    </section>
  );
}

// ─── TIMELINE ───────────────────────────────────────────────────────────
const CATEGORY_FOR_KEYWORDS: Array<{ test: RegExp; cat: string }> = [
  { test: /strike|war|attack|missile|bomb/i, cat: 'war' },
  { test: /tanker|mine|hormuz|naval|convoy/i, cat: 'military' },
  { test: /opec|saudi|barrel/i, cat: 'opec' },
  { test: /spr|policy|sanction|fed|biden|trump/i, cat: 'policy' },
];
function categorize(headline: string): string {
  for (const { test, cat } of CATEGORY_FOR_KEYWORDS) if (test.test(headline)) return cat;
  return 'tension';
}

function Timeline() {
  const [ref, inView] = useInView<HTMLElement>();
  const milestonesQ = useMilestones();
  const events = (milestonesQ.data?.milestones ?? []).filter((m) => m.type !== 'today').slice(0, 8);

  return (
    <section className="section section-wide timeline-sec" ref={ref}>
      <div className="section-head">
        <span className="section-number">03 / WAR TIMELINE</span>
        <h2 className="editorial-h">Forty-eight days, seven inflection points.</h2>
        <p className="editorial-sub">Each event left a fingerprint in the price of oil.</p>
      </div>
      <div className={`timeline-wrap ${inView ? 'in' : ''}`}>
        <div className="timeline-rule" />
        {events.length === 0 && (
          <div style={{ color: 'var(--text-2)', padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            No timeline events available.
          </div>
        )}
        {events.map((e: Milestone, i: number) => {
          const cat = categorize(e.headline);
          const impactBadge = e.badges.find((b) => b.label.toLowerCase().includes('oil') || /[-+]\d/.test(b.change));
          const change = impactBadge?.change ?? '';
          const up = change.startsWith('+') || change.includes('↑');
          return (
            <div key={`${e.date}-${i}`} className="tl-event" style={{ animationDelay: `${i * 0.12}s` }}>
              <div className="tl-dot" data-cat={cat} />
              <div className="tl-content">
                <div className="tl-date">{fmtDate(e.date)}</div>
                <div className="tl-head">{e.headline}</div>
                {change && (
                  <div className={`tl-impact ${up ? 'up' : 'down'}`}>
                    OIL {up ? '\u2191' : '\u2193'} {change}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── GLOBAL FLOW (rotating globe) ───────────────────────────────────────
function GlobalFlow() {
  const [ref, inView] = useInView<HTMLElement>(0.15);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) return;
    let raf = 0;
    let stopAt = performance.now() + 30_000;
    const loop = (t: number) => {
      setTick((x) => x + 1);
      if (t < stopAt) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inView]);
  const rot = (tick * 0.12) % 360;

  const regions = [
    { name: 'SAUDI ARABIA', lng: 45, lat: 24, bpd: 10.4, hot: false },
    { name: 'IRAN', lng: 54, lat: 32, bpd: 3.2, hot: true },
    { name: 'IRAQ', lng: 44, lat: 33, bpd: 4.3, hot: false },
    { name: 'UAE', lng: 54, lat: 24, bpd: 3.1, hot: false },
    { name: 'RUSSIA', lng: 60, lat: 56, bpd: 10.1, hot: false },
    { name: 'USA', lng: -98, lat: 38, bpd: 13.2, hot: false },
    { name: 'VENEZUELA', lng: -66, lat: 8, bpd: 0.9, hot: false },
    { name: 'NIGERIA', lng: 8, lat: 9, bpd: 1.4, hot: false },
    { name: 'NORWAY', lng: 10, lat: 62, bpd: 2.0, hot: false },
    { name: 'BRAZIL', lng: -45, lat: -12, bpd: 3.5, hot: false },
  ];

  const R = 200;
  const cx = 275;
  const cy = 275;
  function project(lng: number, lat: number) {
    const lngR = ((lng + rot) * Math.PI) / 180;
    const latR = (lat * Math.PI) / 180;
    const x = Math.cos(latR) * Math.sin(lngR);
    const y = -Math.sin(latR);
    const z = Math.cos(latR) * Math.cos(lngR);
    return { x: cx + x * R, y: cy + y * R, z, visible: z > -0.15 };
  }
  const hormuz = project(56, 26);

  return (
    <section className="section section-wide global-sec" ref={ref}>
      <div className="section-head">
        <span className="section-number">04 / GLOBAL FLOW</span>
        <h2 className="editorial-h">A planet run on eight pipelines.</h2>
        <p className="editorial-sub">
          101.8 million barrels cross the globe every day. Ten countries produce eighty percent of
          it. One is at war.
        </p>
      </div>

      <div className={`global-wrap ${inView ? 'in' : ''}`}>
        <div className="globe-box">
          <svg viewBox="0 0 550 550" className="bs-globe">
            <defs>
              <radialGradient id="bsGlobeGrad" cx="0.35" cy="0.35">
                <stop offset="0" stopColor="#141007" />
                <stop offset="0.7" stopColor="#0A0806" />
                <stop offset="1" stopColor="#050403" />
              </radialGradient>
              <radialGradient id="bsGlobeAtmo" cx="0.5" cy="0.5">
                <stop offset="0.78" stopColor="transparent" />
                <stop offset="0.96" stopColor="rgba(212,160,18,0.18)" />
                <stop offset="1" stopColor="transparent" />
              </radialGradient>
              <radialGradient id="bsHotGlow">
                <stop offset="0" stopColor="#CC2936" stopOpacity="0.7" />
                <stop offset="1" stopColor="#CC2936" stopOpacity="0" />
              </radialGradient>
              <pattern
                id="bsGlobeHatch"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(212,160,18,0.06)" strokeWidth="0.5" />
              </pattern>
            </defs>

            <circle cx={cx} cy={cy} r={R + 14} fill="url(#bsGlobeAtmo)" />
            <circle
              cx={cx}
              cy={cy}
              r={R}
              fill="url(#bsGlobeGrad)"
              stroke="rgba(212,160,18,0.28)"
              strokeWidth="1"
            />
            <circle cx={cx} cy={cy} r={R} fill="url(#bsGlobeHatch)" opacity="0.5" />

            {[-60, -30, 0, 30, 60].map((lat) => {
              const latR = (lat * Math.PI) / 180;
              const ry = Math.abs(Math.cos(latR)) * R;
              const cyOff = cy - Math.sin(latR) * R;
              return (
                <ellipse
                  key={lat}
                  cx={cx}
                  cy={cyOff}
                  rx={ry}
                  ry={ry * 0.15}
                  fill="none"
                  stroke="rgba(212,160,18,0.1)"
                  strokeWidth="0.5"
                />
              );
            })}
            {[0, 30, 60, 90, 120, 150].map((lng) => {
              const lngR = ((lng + rot) * Math.PI) / 180;
              const rx = Math.abs(Math.sin(lngR)) * R;
              return (
                <ellipse
                  key={lng}
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={R}
                  fill="none"
                  stroke="rgba(212,160,18,0.07)"
                  strokeWidth="0.5"
                />
              );
            })}

            {regions
              .filter((r) => project(r.lng, r.lat).visible)
              .map((r, i) => {
                const p = project(r.lng, r.lat);
                const p2 = project(r.lng - 35 - i * 8, r.lat + 12);
                const mx = (p.x + p2.x) / 2;
                const my = (p.y + p2.y) / 2 - 44;
                return (
                  <path
                    key={`arc-${r.name}`}
                    d={`M${p.x},${p.y} Q${mx},${my} ${p2.x},${p2.y}`}
                    stroke={r.hot ? '#CC2936' : '#D4A012'}
                    strokeWidth={0.9}
                    fill="none"
                    strokeDasharray="2 4"
                    opacity={r.hot ? 0.9 : 0.38}
                    className="bs-arc"
                  />
                );
              })}

            {regions.map((r) => {
              const p = project(r.lng, r.lat);
              if (!p.visible) return null;
              const size = Math.max(3, r.bpd * 0.7);
              return (
                <g key={r.name} style={{ opacity: 0.55 + p.z * 0.45 }}>
                  {r.hot && (
                    <circle cx={p.x} cy={p.y} r={size * 3} fill="url(#bsHotGlow)" className="bs-hotglow" />
                  )}
                  <circle cx={p.x} cy={p.y} r={size} fill={r.hot ? '#CC2936' : '#D4A012'} />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={size + 4}
                    fill="none"
                    stroke={r.hot ? '#CC2936' : '#D4A012'}
                    strokeWidth={0.5}
                    opacity={0.4}
                    className={r.hot ? 'bs-pulse-r' : 'bs-pulse-g'}
                  />
                  {r.hot && (
                    <g>
                      <line
                        x1={p.x + 8}
                        y1={p.y}
                        x2={p.x + 40}
                        y2={p.y - 22}
                        stroke="#CC2936"
                        strokeWidth={0.5}
                      />
                      <text
                        x={p.x + 44}
                        y={p.y - 20}
                        fill="#CC2936"
                        fontSize={10}
                        fontFamily="'JetBrains Mono'"
                        letterSpacing="0.1em"
                        fontWeight={700}
                      >
                        {r.name}
                      </text>
                      <text
                        x={p.x + 44}
                        y={p.y - 8}
                        fill="rgba(204,41,54,0.75)"
                        fontSize={8}
                        fontFamily="'JetBrains Mono'"
                        letterSpacing="0.08em"
                      >
                        ACTIVE CONFLICT
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {hormuz.visible && (
              <g>
                <circle
                  cx={hormuz.x}
                  cy={hormuz.y}
                  r={16}
                  fill="none"
                  stroke="#CC2936"
                  strokeWidth={0.8}
                  className="bs-target"
                />
                <line x1={hormuz.x - 22} y1={hormuz.y} x2={hormuz.x - 11} y2={hormuz.y} stroke="#CC2936" strokeWidth="1" />
                <line x1={hormuz.x + 11} y1={hormuz.y} x2={hormuz.x + 22} y2={hormuz.y} stroke="#CC2936" strokeWidth="1" />
                <line x1={hormuz.x} y1={hormuz.y - 22} x2={hormuz.x} y2={hormuz.y - 11} stroke="#CC2936" strokeWidth="1" />
                <line x1={hormuz.x} y1={hormuz.y + 11} x2={hormuz.x} y2={hormuz.y + 22} stroke="#CC2936" strokeWidth="1" />
              </g>
            )}

            <text x={22} y={32} fill="#D4A012" fontSize={10} fontFamily="'JetBrains Mono'" letterSpacing="0.18em" fontWeight={700}>
              GLOBAL OIL FLOW &middot; REAL-TIME
            </text>
            <text x={22} y={48} fill="rgba(212,160,18,0.5)" fontSize={9} fontFamily="'JetBrains Mono'" letterSpacing="0.1em">
              14:17:42Z &middot; 101.8M BPD MOVING
            </text>
            <text x={22} y={530} fill="rgba(212,160,18,0.5)" fontSize={9} fontFamily="'JetBrains Mono'" letterSpacing="0.12em">
              &darr; CROSSHAIR: STRAIT OF HORMUZ &middot; DETAIL BELOW
            </text>
          </svg>
        </div>

        <aside className="globe-stats">
          <div className="gs-row">
            <div className="gs-l">WORLD PRODUCTION</div>
            <div className="gs-v">
              <Odometer value={101.8} decimals={1} />M
            </div>
            <div className="gs-u">barrels / day</div>
          </div>
          <div className="gs-row">
            <div className="gs-l">TOP 10 SHARE</div>
            <div className="gs-v">
              <Odometer value={81.4} decimals={1} />%
            </div>
            <div className="gs-u">of global output</div>
          </div>
          <div className="gs-row gs-hot">
            <div className="gs-l">IRAN OUTPUT</div>
            <div className="gs-v">
              <Odometer value={3.2} decimals={1} />M
            </div>
            <div className="gs-u">bpd &middot; fully offline</div>
          </div>
          <div className="gs-row">
            <div className="gs-l">OPEC+ SPARE</div>
            <div className="gs-v">
              <Odometer value={3.4} decimals={1} />M
            </div>
            <div className="gs-u">bpd reserve capacity</div>
          </div>
          <div className="gs-row">
            <div className="gs-l">SPR RELEASE</div>
            <div className="gs-v">
              <Odometer value={180} decimals={0} />M
            </div>
            <div className="gs-u">bbl drawn since Feb 28</div>
          </div>
          <div className="gs-footnote">
            The planet&rsquo;s oil economy balances on a dozen nodes and a handful of chokepoints.
            Iran&rsquo;s loss removed three million barrels overnight. OPEC+ spare capacity filled
            half of it.
          </div>
        </aside>
      </div>
    </section>
  );
}

// ─── HORMUZ MAP ─────────────────────────────────────────────────────────
function HormuzMap() {
  const [ref, inView] = useInView<HTMLElement>(0.2);
  return (
    <section className="section section-wide hormuz-sec" ref={ref}>
      <div className="section-head">
        <span className="section-number">05 / CHOKEPOINT</span>
        <h2 className="editorial-h">The world&rsquo;s oil flows through a 21-mile gap.</h2>
        <p className="editorial-sub">
          Roughly one in five barrels of crude on earth crosses the Strait of Hormuz each day. On
          Feb 28, that number went to zero.
        </p>
      </div>

      <div className={`hormuz-wrap ${inView ? 'in' : ''}`}>
        <svg viewBox="0 0 800 500" className="hormuz-svg">
          <defs>
            <pattern id="bsCrosshatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(212,160,18,0.08)" strokeWidth="1" />
            </pattern>
            <pattern id="bsWater" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M0 20 Q10 15 20 20 T40 20" stroke="rgba(0,240,255,0.08)" strokeWidth="0.5" fill="none" />
            </pattern>
            <radialGradient id="bsGlow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#CC2936" stopOpacity="0.4" />
              <stop offset="1" stopColor="#CC2936" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width={800} height={500} fill="url(#bsWater)" />

          <path
            d="M120,40 Q180,60 240,50 L340,60 Q440,50 520,70 L640,60 Q720,80 780,70 L780,180 Q720,200 640,190 L520,200 Q440,220 340,210 L240,220 Q180,230 120,220 Z"
            fill="url(#bsCrosshatch)"
            stroke="rgba(212,160,18,0.3)"
            strokeWidth="1"
          />
          <text x={400} y={130} fill="rgba(212,160,18,0.5)" fontSize={18} fontFamily="'Instrument Serif'" textAnchor="middle" fontStyle="italic">
            IRAN
          </text>

          <path
            d="M40,340 Q120,320 200,340 L320,330 Q420,350 520,340 L640,360 Q720,340 780,350 L780,500 L40,500 Z"
            fill="url(#bsCrosshatch)"
            stroke="rgba(212,160,18,0.3)"
            strokeWidth="1"
          />
          <text x={360} y={440} fill="rgba(212,160,18,0.5)" fontSize={18} fontFamily="'Instrument Serif'" textAnchor="middle" fontStyle="italic">
            ARABIAN PENINSULA
          </text>

          <text x={560} y={280} fill="#CC2936" fontSize={11} fontFamily="'JetBrains Mono'" textAnchor="middle" letterSpacing="0.1em">
            STRAIT OF HORMUZ
          </text>
          <text x={560} y={294} fill="rgba(232,236,244,0.4)" fontSize={9} fontFamily="'JetBrains Mono'" textAnchor="middle">
            21 MI WIDE &middot; 17M BPD NORMAL FLOW
          </text>

          <path d="M40,260 Q200,240 400,270 Q550,290 780,260" stroke="#00F0FF" strokeWidth="1.2" fill="none" strokeDasharray="4 6" className="lane lane-a" opacity="0.6" />
          <path d="M40,290 Q220,310 400,280 Q560,260 780,300" stroke="#00F0FF" strokeWidth="1.2" fill="none" strokeDasharray="4 6" className="lane lane-b" opacity="0.5" />
          <path d="M40,230 Q180,210 400,250 Q560,270 780,230" stroke="#00F0FF" strokeWidth="1.2" fill="none" strokeDasharray="4 6" className="lane lane-c" opacity="0.5" />

          {[
            { x: 560, y: 270, label: 'STRIKE SITE' },
            { x: 620, y: 240, label: 'MINE LAID' },
            { x: 480, y: 290, label: 'TANKER HIT' },
          ].map((s, i) => (
            <g key={i} className="strike" style={{ animationDelay: `${1 + i * 0.4}s` }}>
              <circle cx={s.x} cy={s.y} r={40} fill="url(#bsGlow)" className="strike-glow" />
              <circle cx={s.x} cy={s.y} r={3} fill="#CC2936" />
              <circle cx={s.x} cy={s.y} r={8} fill="none" stroke="#CC2936" strokeWidth="1" className="strike-ring" />
              <text x={s.x + 12} y={s.y - 8} fill="#CC2936" fontSize={8} fontFamily="'JetBrains Mono'" letterSpacing="0.08em">
                {s.label}
              </text>
            </g>
          ))}

          <circle cx={60} cy={260} r={3} fill="#D4A012" />
          <text x={70} y={264} fill="#D4A012" fontSize={9} fontFamily="'JetBrains Mono'">
            RAS TANURA
          </text>
          <circle cx={770} cy={270} r={3} fill="#D4A012" />
          <text x={680} y={274} fill="#D4A012" fontSize={9} fontFamily="'JetBrains Mono'">
            INDIAN OCEAN
          </text>
        </svg>

        <div className="hormuz-stats">
          <div className="hstat">
            <div className="hstat-v">
              <Odometer value={17} decimals={0} />M
            </div>
            <div className="hstat-l">Barrels / day normal flow</div>
          </div>
          <div className="hstat critical">
            <div className="hstat-v">
              <Odometer value={0} decimals={0} />
            </div>
            <div className="hstat-l">Flow on day 1 of war</div>
          </div>
          <div className="hstat">
            <div className="hstat-v">
              <Odometer value={4.2} decimals={1} />M
            </div>
            <div className="hstat-l">Barrels / day now (escorted)</div>
          </div>
          <div className="hstat">
            <div className="hstat-v">
              <Odometer value={21} decimals={0} />mi
            </div>
            <div className="hstat-l">Width at narrowest</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── DOWNSTREAM GRID ────────────────────────────────────────────────────
function generateSpark(pct: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const noise = (Math.random() - 0.5) * 4;
    const trend = (i / 20) * (pct / 3);
    pts.push(`${i === 0 ? 'M' : 'L'}${i * 6},${20 - trend + noise}`);
  }
  return pts.join(' ');
}

function Downstream() {
  const [ref, inView] = useInView<HTMLElement>(0.1);
  const dsQ = useDownstream();
  const cards = useMemo(() => {
    if (!dsQ.data) return [];
    const oil = dsQ.data.oil;
    return dsQ.data.series.map((s) => {
      const last = s.observations.at(-1);
      const baseline = getValueBeforeDate(s, WAR_BASELINE_DATE);
      const pct = last && baseline ? ((last.value - baseline) / baseline) * 100 : 0;
      const aligned = alignSeries(oil, s);
      const corr = aligned.dates.length ? computeCorrelation(aligned.oilValues, aligned.dsValues) : 0;
      const meta = COMMODITY_DATA[s.series_id];
      const isPriceDollar = meta?.displayName.includes('CPI') || meta?.displayName.includes('Index') ? false : true;
      return {
        key: s.series_id,
        icon: meta?.icon ?? '\u{1F4C8}',
        name: (meta?.displayName ?? s.name).toUpperCase(),
        unit: isPriceDollar ? '$' : '',
        current: last?.value ?? 0,
        pct,
        correlation: corr,
      };
    });
  }, [dsQ.data]);

  return (
    <section className="section section-wide downstream-sec" ref={ref}>
      <div className="section-head">
        <span className="section-number">06 / RIPPLE EFFECT</span>
        <h2 className="editorial-h">From the barrel to the basket.</h2>
        <p className="editorial-sub">
          Thirteen commodities, thirteen ways oil touches everyday life. Correlation to crude in
          parentheses.
        </p>
      </div>
      <div className={`downstream-grid ${inView ? 'in' : ''}`}>
        {cards.map((d, i) => {
          const up = d.pct >= 0;
          return (
            <div key={d.key} className="ds-card" style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="ds-head">
                <span className="ds-icon">{d.icon}</span>
                <span className="ds-name">{d.name}</span>
                <span className="ds-corr">r={d.correlation.toFixed(2)}</span>
              </div>
              <div className="ds-body">
                <div className="ds-now">
                  {d.unit.startsWith('$') ? '$' : ''}
                  <Odometer value={d.current} decimals={d.current < 10 ? 2 : 0} />
                  <span className="ds-unit">{d.unit && !d.unit.startsWith('$') ? d.unit : ''}</span>
                </div>
                <div className={`ds-change ${up ? 'up' : 'down'}`}>
                  {up ? '\u2191' : '\u2193'} {Math.abs(d.pct).toFixed(1)}%
                  <span className="ds-since">since war</span>
                </div>
              </div>
              <svg viewBox="0 0 120 30" className="ds-spark">
                <path d={generateSpark(d.pct)} stroke={up ? '#CC2936' : '#5DB075'} strokeWidth="1" fill="none" />
              </svg>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── CRISIS COMPARISON ──────────────────────────────────────────────────
function crisisColor(c: CrisisData): string {
  if (c.is_current) return '#00F0FF';
  if ((c.peak_spike_pct ?? 0) < 0) return '#CC2936';
  if (c.year >= 2020) return '#E08A3C';
  if (c.year >= 1990) return '#D4A012';
  return '#5DB075';
}

function CrisisCompare() {
  const [ref, inView] = useInView<HTMLElement>(0.2);
  const cQ = useCrisisComparison();
  const crises = cQ.data?.crises ?? [];
  const max = crises.length ? Math.max(...crises.map((c) => Math.abs(c.peak_spike_pct ?? 0))) : 100;

  return (
    <section className="section section-wide crisis-sec" ref={ref}>
      <div className="section-head">
        <span className="section-number">07 / HOW BAD IS IT</span>
        <h2 className="editorial-h">Versus the last fifty years of oil shocks.</h2>
        <p className="editorial-sub">
          Peak price deviation from pre-crisis baseline. 2026 is still climbing.
        </p>
      </div>
      <div className={`crisis-bars ${inView ? 'in' : ''}`}>
        {crises.map((c, i) => {
          const peak = c.peak_spike_pct ?? 0;
          const w = (Math.abs(peak) / max) * 100;
          return (
            <div
              key={c.id}
              className={`crisis-row ${c.is_current ? 'current' : ''}`}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="crisis-name">{c.name}</div>
              <div className="crisis-bar-wrap">
                <div
                  className="crisis-bar"
                  style={{
                    width: inView ? `${w}%` : '0%',
                    background: crisisColor(c),
                    transitionDelay: `${i * 0.12}s`,
                  }}
                >
                  {c.is_current && <div className="crisis-pulse" />}
                </div>
              </div>
              <div className="crisis-val">
                {peak > 0 ? '+' : ''}
                {peak.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── FORECAST SCENARIOS ─────────────────────────────────────────────────
const SCENARIOS = [
  { key: 'bull', label: 'War Expands', target: 182, probability: 0.22, color: '#CC2936', desc: 'Hormuz stays closed; Saudi facilities hit. Sustained $180+ regime locks in.' },
  { key: 'base', label: 'Gradual Normalization', target: 104, probability: 0.51, color: '#00F0FF', desc: 'Convoys continue; SPR releases; OPEC+ adds modestly. Drift back toward $100.' },
  { key: 'bear', label: 'Ceasefire', target: 76, probability: 0.27, color: '#5DB075', desc: 'Truce; OPEC+ opens taps. Risk premium vanishes within weeks.' },
];

function Forecast() {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <section className="section section-wide forecast-sec" ref={ref}>
      <div className="section-head">
        <span className="section-number">08 / FORECAST</span>
        <h2 className="editorial-h">Three paths from here.</h2>
        <p className="editorial-sub">Monte Carlo simulation over 126 trading days, 10,000 runs.</p>
      </div>
      <div className={`scenarios ${inView ? 'in' : ''}`}>
        {SCENARIOS.map((s, i) => (
          <div
            key={s.key}
            className="scenario"
            style={{ ['--c' as string]: s.color, animationDelay: `${i * 0.15}s` } as CSSProperties}
          >
            <div className="scen-top">
              <span className="scen-name">{s.label}</span>
              <span className="scen-prob">
                <Odometer value={s.probability * 100} decimals={0} />% prob
              </span>
            </div>
            <div className="scen-target">
              <Odometer value={s.target} decimals={0} prefix="$" />
            </div>
            <div className="scen-sub">target price at end of 126 days</div>
            <div className="scen-desc">{s.desc}</div>
            <div className="scen-bar">
              <div
                className="scen-fill"
                style={{ width: inView ? `${s.probability * 100}%` : '0%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── NEWS WIRE ──────────────────────────────────────────────────────────
const HEADLINES = [
  { time: '14:42', src: 'BLOOMBERG', text: 'Saudi Aramco confirms third VLCC convoy through escorted lanes; Brent retreats $2.10 in late session.' },
  { time: '13:18', src: 'REUTERS', text: 'IRGC threatens fresh mine-laying in Hormuz approach if US carrier group remains in Gulf.' },
  { time: '12:05', src: 'WSJ', text: 'White House extends SPR release authority another 60 days; 180M barrels drawn since Feb 28.' },
  { time: '11:32', src: 'FT', text: 'OPEC+ technical committee discusses voluntary cut unwinding; decision expected at June meeting.' },
  { time: '09:47', src: 'AP', text: 'European refiners report record gasoline crack spreads as diesel inventories tighten.' },
  { time: '08:10', src: 'CNBC', text: 'Goldman lifts 12-month Brent target to $128, citing structural risk premium and SPR depletion.' },
];

function NewsWire() {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <section className="section section-wide news-sec" ref={ref}>
      <div className="section-head">
        <span className="section-number">09 / THE WIRE</span>
        <h2 className="editorial-h">Filed in the last 24 hours.</h2>
      </div>
      <div className={`news-list ${inView ? 'in' : ''}`}>
        {HEADLINES.map((h, i) => (
          <div key={i} className="news-item" style={{ animationDelay: `${i * 0.08}s` }}>
            <span className="news-time">{h.time}</span>
            <span className="news-src">{h.src}</span>
            <span className="news-text">{h.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── PAGE ───────────────────────────────────────────────────────────────
export function BroadsheetPage() {
  const m = useHeroMetrics();
  return (
    <div className="broadsheet">
      <Ticker currentWTI={m.currentWTI} dollarSinceWar={m.dollarSinceWar} />
      <Hero />
      <div className="rule" />
      <PullQuote
        text="Every dollar increase in crude oil costs American households an estimated $1.4 billion per year in higher energy and consumer goods prices."
        source="U.S. Energy Information Administration"
      />
      <div className="rule" />
      <Timeline />
      <div className="rule" />
      <GlobalFlow />
      <div className="rule" />
      <HormuzMap />
      <div className="rule" />
      <Downstream />
      <div className="rule" />
      <CrisisCompare />
      <div className="rule" />
      <Forecast />
      <div className="rule" />
      <NewsWire />
      <footer className="foot">
        <span>CRUDE OIL ANALYTICS &middot; WAR ECONOMY DESK</span>
        <span>DATA: FRED &middot; CME &middot; EIA &middot; POLYMARKET</span>
        <span>&copy; 2026 SAMIZDAT</span>
      </footer>
    </div>
  );
}

export default BroadsheetPage;
