/**
 * V4 chart primitives — hand-rolled SVG.
 *
 * Design's prototypes carried two caveats that no longer apply: the crude chart
 * drew straight lines between four verified closes, and the US-vs-peer chart
 * plotted two months. The snapshot now holds 394 daily closes and the full
 * monthly series, so both render real paths and the "DRAWN STRAIGHT BETWEEN
 * CLOSES" legend is gone. Where a series genuinely has gaps — the missing
 * October 2025 CPI — the line breaks rather than bridging them.
 *
 * House rules from the brief: border-radius 0, no blur, nothing below 11px at
 * 375px wide, and every chart is followed by a `WhatThisShows` callout.
 */

import { useId, useMemo } from 'react';

export interface Pt {
  date: string;
  value: number | null;
}

const t = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

function ticks(min: number, max: number, n = 4): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const raw = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = (raw / mag >= 7.5 ? 10 : raw / mag >= 3.5 ? 5 : raw / mag >= 1.5 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.001; v += step) {
    out.push(Number(v.toFixed(10)));
  }
  return out;
}

/**
 * Split a series on nulls so a gap renders as a gap.
 * The October 2025 CPI hole must not be bridged by a straight line — that would
 * draw a value nobody measured.
 */
function segments(points: Pt[]): Pt[][] {
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  for (const p of points) {
    if (p.value === null || !Number.isFinite(p.value)) {
      if (cur.length > 1) out.push(cur);
      cur = [];
    } else {
      cur.push(p);
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------

export function WhatThisShows({ children }: { children: React.ReactNode }) {
  return (
    <div className="v4-wts">
      <span className="v4-wts-label">What this shows</span>
      <p>{children}</p>
    </div>
  );
}

export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="v4-source">{children}</p>;
}

export function Empty({ msg }: { msg: string }) {
  return <div className="v4-empty" role="status">{msg}</div>;
}

// ---------------------------------------------------------------------------
// Event-annotated line chart — the crude war chart and the US-vs-peer chart
// ---------------------------------------------------------------------------

export interface Marker {
  date: string;
  label: string;
  /** +1 escalation, -1 de-escalation, 0 neutral. Drives colour only. */
  sign?: number;
}

export interface Line {
  key: string;
  name: string;
  points: Pt[];
  color: string;
  width?: number;
  dashed?: boolean;
}

export function TimeChart({
  lines,
  markers = [],
  height = 300,
  yFormat = (v: number) => v.toFixed(0),
  reference,
  ariaLabel,
  showLegend = true,
}: {
  lines: Line[];
  markers?: Marker[];
  height?: number;
  yFormat?: (v: number) => string;
  reference?: { value: number; label: string };
  ariaLabel: string;
  showLegend?: boolean;
}) {
  const uid = useId();
  const live = lines.filter((l) => l.points.some((p) => p.value !== null));

  const geo = useMemo(() => {
    const vals = live.flatMap((l) => l.points.filter((p) => p.value !== null));
    if (!vals.length) return null;
    const xs = vals.map((p) => t(p.date));
    const ys = vals.map((p) => p.value as number);
    let lo = Math.min(...ys);
    let hi = Math.max(...ys);
    if (reference) { lo = Math.min(lo, reference.value); hi = Math.max(hi, reference.value); }
    const pad = (hi - lo) * 0.12 || 1;
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: lo - pad, y1: hi + pad };
  }, [live, reference]);

  if (!geo) return <Empty msg="No data available for this chart." />;

  const W = 1000, H = height;
  const M = { t: 18, r: 14, b: 30, l: 54 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const sx = (iso: string) => M.l + ((t(iso) - geo.x0) / (geo.x1 - geo.x0 || 1)) * iw;
  const sy = (v: number) => M.t + ih - ((v - geo.y0) / (geo.y1 - geo.y0 || 1)) * ih;

  const path = (pts: Pt[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.date).toFixed(1)},${sy(p.value as number).toFixed(1)}`).join('');

  return (
    <figure className="v4-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="v4-svg" role="img" aria-label={ariaLabel}>
        {ticks(geo.y0, geo.y1).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} className="v4-grid" />
            <text x={M.l - 8} y={sy(v)} className="v4-axis" textAnchor="end" dominantBaseline="middle">
              {yFormat(v)}
            </text>
          </g>
        ))}

        {reference && (
          <g>
            <line x1={M.l} x2={W - M.r} y1={sy(reference.value)} y2={sy(reference.value)} className="v4-ref" />
            <text x={W - M.r} y={sy(reference.value) - 6} className="v4-ref-label" textAnchor="end">
              {reference.label}
            </text>
          </g>
        )}

        {markers.map((m) => {
          const x = sx(m.date);
          if (x < M.l || x > W - M.r) return null;
          const cls = (m.sign ?? 0) > 0 ? 'up' : (m.sign ?? 0) < 0 ? 'down' : 'flat';
          return (
            <g key={`${uid}-${m.date}-${m.label}`} className={`v4-marker v4-marker-${cls}`}>
              <line x1={x} x2={x} y1={M.t} y2={M.t + ih} />
              <circle cx={x} cy={M.t} r={3} />
            </g>
          );
        })}

        {live.map((l) =>
          segments(l.points).map((seg, i) => (
            <path
              key={`${l.key}-${i}`}
              d={path(seg)}
              fill="none"
              stroke={l.color}
              strokeWidth={l.width ?? 2.5}
              strokeDasharray={l.dashed ? '6 4' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )),
        )}
      </svg>

      {showLegend && (
        <div className="v4-legend">
          {live.map((l) => (
            <span key={l.key} className="v4-legend-item">
              <span className="v4-swatch" style={{ background: l.color }} aria-hidden />
              {l.name}
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Dollar bars — the shelf. Common scale so lengths are comparable.
// ---------------------------------------------------------------------------

export function DollarBars({
  rows,
  ariaLabel,
}: {
  rows: { key: string; label: string; from: number; to: number; pct: number; note?: string }[];
  ariaLabel: string;
}) {
  if (!rows.length) return <Empty msg="No price data available." />;
  const max = Math.max(...rows.map((r) => Math.max(r.from, r.to)));

  return (
    <div className="v4-bars" role="table" aria-label={ariaLabel}>
      {rows.map((r) => (
        <div key={r.key} className="v4-bar-row" role="row">
          <span className="v4-bar-label" role="cell">{r.label}</span>
          <div className="v4-bar-track" role="cell">
            <span className="v4-bar-from" style={{ width: `${(r.from / max) * 100}%` }} />
            <span
              className={`v4-bar-to${r.pct < 0 ? ' is-down' : ''}`}
              style={{ width: `${(r.to / max) * 100}%` }}
            />
          </div>
          <span className="v4-bar-nums" role="cell">
            <em>${r.from.toFixed(2)}</em>
            <b>${r.to.toFixed(2)}</b>
            <i className={r.pct < 0 ? 'is-down' : ''}>
              {r.pct > 0 ? '+' : ''}{r.pct.toFixed(0)}%
            </i>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zero-anchored monthly columns — job creation, split at the handover
// ---------------------------------------------------------------------------

export function Columns({
  points,
  splitDate,
  splitLabel,
  height = 240,
  yFormat = (v: number) => `${Math.round(v / 1000)}k`,
  ariaLabel,
}: {
  points: Pt[];
  splitDate?: string;
  splitLabel?: string;
  height?: number;
  yFormat?: (v: number) => string;
  ariaLabel: string;
}) {
  const pts = points.filter((p) => p.value !== null) as { date: string; value: number }[];
  if (!pts.length) return <Empty msg="No monthly data available." />;

  const W = 1000, H = height;
  const M = { t: 14, r: 14, b: 24, l: 56 };
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const ys = pts.map((p) => p.value);
  const hi = Math.max(...ys, 0), lo = Math.min(...ys, 0);
  const pad = (hi - lo) * 0.1 || 1;
  const y0 = lo - pad, y1 = hi + pad;
  const bw = iw / pts.length;
  const sy = (v: number) => M.t + ih - ((v - y0) / (y1 - y0)) * ih;
  const zero = sy(0);
  const splitIdx = splitDate ? pts.findIndex((p) => p.date >= splitDate) : -1;

  return (
    <figure className="v4-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="v4-svg" role="img" aria-label={ariaLabel}>
        {ticks(y0, y1, 3).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} className="v4-grid" />
            <text x={M.l - 8} y={sy(v)} className="v4-axis" textAnchor="end" dominantBaseline="middle">
              {yFormat(v)}
            </text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={zero} y2={zero} className="v4-zero" />
        {pts.map((p, i) => {
          const x = M.l + i * bw;
          const y = p.value >= 0 ? sy(p.value) : zero;
          const h = Math.max(Math.abs(sy(p.value) - zero), 0.7);
          const after = splitIdx >= 0 && i >= splitIdx;
          return (
            <rect
              key={p.date}
              x={x + bw * 0.14} y={y} width={bw * 0.72} height={h}
              className={`v4-col ${p.value < 0 ? 'neg' : 'pos'}${after ? ' after' : ''}`}
            >
              <title>{`${p.date}: ${yFormat(p.value)}`}</title>
            </rect>
          );
        })}
        {splitIdx > 0 && (
          <g className="v4-split">
            <line x1={M.l + splitIdx * bw} x2={M.l + splitIdx * bw} y1={M.t} y2={M.t + ih} />
            {splitLabel && (
              <text x={M.l + splitIdx * bw + 6} y={M.t + 11} className="v4-split-label">{splitLabel}</text>
            )}
          </g>
        )}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Administration excess — the spine. Party-coloured, ranked.
// ---------------------------------------------------------------------------

export function ExcessBars({
  rows,
  ariaLabel,
}: {
  rows: { key: string; label: string; party: 'D' | 'R'; excess: number; current?: boolean }[];
  ariaLabel: string;
}) {
  if (!rows.length) return <Empty msg="No comparison data available." />;
  const max = Math.max(...rows.map((r) => Math.abs(r.excess)), 0.1);

  return (
    <div className="v4-excess" role="table" aria-label={ariaLabel}>
      {rows.map((r) => (
        <div key={r.key} className={`v4-excess-row${r.current ? ' is-current' : ''}`} role="row">
          <span className="v4-excess-label" role="cell">
            {r.label}
            {r.current && <em>in progress</em>}
          </span>
          <div className="v4-excess-track" role="cell">
            <span
              className={`v4-excess-fill v4-party-${r.party}`}
              style={{ width: `${(Math.abs(r.excess) / max) * 100}%` }}
            />
          </div>
          <b className="v4-excess-val" role="cell">
            +{r.excess.toFixed(2)}
          </b>
        </div>
      ))}
    </div>
  );
}
