/**
 * Hand-rolled SVG chart primitives for V3.
 *
 * Plotly is deliberately not used here: it is 4.6MB / 1.38MB gzipped, poor at
 * scroll-linked morphing, and overkill for the handful of shapes this page
 * needs. These render server-truthful data with no library between the numbers
 * and the pixels.
 *
 * Every component returns an explicit empty state rather than `null` when it
 * has no data. The page says "no data" — it never invents a fallback.
 */

import { useId, useMemo, useState } from 'react';

export interface Point {
  date: string;
  value: number;
}

export interface Series {
  key: string;
  name: string;
  points: Point[];
  color: string;
  dashed?: boolean;
  width?: number;
}

export interface EventMarker {
  date: string;
  label: string;
  /** +1 escalation (red), -1 de-escalation (green), 0 neutral (gold). */
  sign: number;
}

const toX = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.001; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="v3-empty" role="status">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Multi-series line chart with optional event markers
// ---------------------------------------------------------------------------

interface LineChartProps {
  series: Series[];
  height?: number;
  events?: EventMarker[];
  yLabel?: string;
  yFormat?: (v: number) => string;
  /** Draw a horizontal reference line, e.g. the 2% inflation target. */
  reference?: { value: number; label: string };
  ariaLabel: string;
}

export function LineChart({
  series,
  height = 320,
  events = [],
  yLabel,
  yFormat = (v) => v.toFixed(1),
  reference,
  ariaLabel,
}: LineChartProps) {
  const gradId = useId();
  const [hover, setHover] = useState<{ x: number; date: string } | null>(null);

  const live = series.filter((s) => s.points.length > 1);
  const geom = useMemo(() => {
    if (live.length === 0) return null;
    const all = live.flatMap((s) => s.points);
    const xs = all.map((p) => toX(p.date));
    const ys = all.map((p) => p.value);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    if (reference) {
      minY = Math.min(minY, reference.value);
      maxY = Math.max(maxY, reference.value);
    }
    const pad = (maxY - minY) * 0.12 || 1;
    return { minX, maxX, minY: minY - pad, maxY: maxY + pad };
  }, [live, reference]);

  if (!geom) return <EmptyState message="No data available for this chart." />;

  const W = 1000;
  const H = height;
  const M = { top: 16, right: 16, bottom: 30, left: 52 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const sx = (iso: string) =>
    M.left + ((toX(iso) - geom.minX) / (geom.maxX - geom.minX || 1)) * iw;
  const sy = (v: number) =>
    M.top + ih - ((v - geom.minY) / (geom.maxY - geom.minY || 1)) * ih;

  const path = (pts: Point[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.date).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');

  const ticks = niceTicks(geom.minY, geom.maxY, 5);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < M.left || px > W - M.right) return setHover(null);
    const t = geom.minX + ((px - M.left) / iw) * (geom.maxX - geom.minX);
    const ref = live[0].points;
    let best = ref[0];
    let bestD = Infinity;
    for (const p of ref) {
      const d = Math.abs(toX(p.date) - t);
      if (d < bestD) { bestD = d; best = p; }
    }
    setHover({ x: sx(best.date), date: best.date });
  };

  const hoverValues = hover
    ? live.map((s) => ({ s, p: s.points.find((p) => p.date === hover.date) }))
    : [];

  return (
    <figure className="v3-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="v3-chart-svg"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--v3-data)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--v3-data)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} className="v3-grid" />
            <text x={M.left - 8} y={sy(t)} className="v3-axis-label" textAnchor="end" dominantBaseline="middle">
              {yFormat(t)}
            </text>
          </g>
        ))}

        {reference && (
          <g>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={sy(reference.value)}
              y2={sy(reference.value)}
              className="v3-reference-line"
            />
            <text x={W - M.right} y={sy(reference.value) - 6} className="v3-reference-label" textAnchor="end">
              {reference.label}
            </text>
          </g>
        )}

        {events.map((ev) => {
          const x = sx(ev.date);
          if (x < M.left || x > W - M.right) return null;
          const cls = ev.sign > 0 ? 'escalation' : ev.sign < 0 ? 'deescalation' : 'neutral';
          return (
            <g key={`${ev.date}-${ev.label}`} className={`v3-event v3-event-${cls}`}>
              <line x1={x} x2={x} y1={M.top} y2={M.top + ih} />
              <circle cx={x} cy={M.top} r={3.5} />
            </g>
          );
        })}

        {live.map((s) => (
          <path
            key={s.key}
            d={path(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width ?? 2.25}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="v3-line"
          />
        ))}

        {hover && (
          <g>
            <line x1={hover.x} x2={hover.x} y1={M.top} y2={M.top + ih} className="v3-crosshair" />
            {hoverValues.map(({ s, p }) =>
              p ? <circle key={s.key} cx={hover.x} cy={sy(p.value)} r={4} fill={s.color} /> : null,
            )}
          </g>
        )}
      </svg>

      <div className="v3-chart-legend">
        {live.map((s) => (
          <span key={s.key} className="v3-legend-item">
            <span className="v3-legend-swatch" style={{ background: s.color }} aria-hidden />
            {s.name}
            {hover && (
              <strong>
                {(() => {
                  const p = s.points.find((q) => q.date === hover.date);
                  return p ? ` ${yFormat(p.value)}` : '';
                })()}
              </strong>
            )}
          </span>
        ))}
        {yLabel && <span className="v3-legend-unit">{yLabel}</span>}
      </div>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Paired horizontal bars — two terms compared, one row per item
// ---------------------------------------------------------------------------

export interface PairedRow {
  key: string;
  label: string;
  previous: number | null;
  current: number | null;
  note?: string;
  emphasis?: boolean;
}

export function PairedBars({
  rows,
  previousLabel,
  currentLabel,
  unit = '%/yr',
  ariaLabel,
}: {
  rows: PairedRow[];
  previousLabel: string;
  currentLabel: string;
  unit?: string;
  ariaLabel: string;
}) {
  if (rows.length === 0) return <EmptyState message="No comparison data available." />;

  const values = rows.flatMap((r) => [r.previous, r.current]).filter((v): v is number => v !== null);
  const max = Math.max(...values.map(Math.abs), 1);

  const width = (v: number | null) => (v === null ? 0 : (Math.abs(v) / max) * 50);

  return (
    <div className="v3-paired" role="table" aria-label={ariaLabel}>
      <div className="v3-paired-head" role="row">
        <span className="v3-paired-label" role="columnheader" />
        <span className="v3-paired-key" role="columnheader">
          <span className="v3-swatch v3-swatch-prev" aria-hidden /> {previousLabel}
        </span>
        <span className="v3-paired-key" role="columnheader">
          <span className="v3-swatch v3-swatch-curr" aria-hidden /> {currentLabel}
        </span>
      </div>

      {rows.map((r) => (
        <div key={r.key} className={`v3-paired-row${r.emphasis ? ' is-emphasis' : ''}`} role="row">
          <span className="v3-paired-label" role="cell">
            {r.label}
            {r.note && <em>{r.note}</em>}
          </span>
          <div className="v3-paired-track" role="cell">
            <div className="v3-paired-side v3-paired-left">
              <span
                className={`v3-bar v3-bar-prev${(r.previous ?? 0) < 0 ? ' is-negative' : ''}`}
                style={{ width: `${width(r.previous)}%` }}
              />
              <b>{r.previous === null ? '—' : `${r.previous > 0 ? '+' : ''}${r.previous.toFixed(1)}`}</b>
            </div>
            <div className="v3-paired-side v3-paired-right">
              <span
                className={`v3-bar v3-bar-curr${(r.current ?? 0) < 0 ? ' is-negative' : ''}`}
                style={{ width: `${width(r.current)}%` }}
              />
              <b>{r.current === null ? '—' : `${r.current > 0 ? '+' : ''}${r.current.toFixed(1)}`}</b>
            </div>
          </div>
        </div>
      ))}
      <p className="v3-paired-unit">Values are {unit}.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column chart for monthly flows (job changes), zero-anchored
// ---------------------------------------------------------------------------

export function ColumnChart({
  points,
  height = 260,
  splitDate,
  splitLabel,
  yFormat = (v) => `${Math.round(v / 1000)}k`,
  ariaLabel,
}: {
  points: Point[];
  height?: number;
  splitDate?: string;
  splitLabel?: string;
  yFormat?: (v: number) => string;
  ariaLabel: string;
}) {
  if (points.length === 0) return <EmptyState message="No monthly data available." />;

  const W = 1000;
  const H = height;
  const M = { top: 16, right: 16, bottom: 28, left: 56 };
  const iw = W - M.left - M.right;
  const ih = H - M.top - M.bottom;

  const ys = points.map((p) => p.value);
  const maxY = Math.max(...ys, 0);
  const minY = Math.min(...ys, 0);
  const pad = (maxY - minY) * 0.1 || 1;
  const lo = minY - pad;
  const hi = maxY + pad;

  const bw = iw / points.length;
  const sy = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;
  const zero = sy(0);
  const ticks = niceTicks(lo, hi, 4);

  const splitIdx = splitDate ? points.findIndex((p) => p.date >= splitDate) : -1;

  return (
    <figure className="v3-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="v3-chart-svg" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={sy(t)} y2={sy(t)} className="v3-grid" />
            <text x={M.left - 8} y={sy(t)} className="v3-axis-label" textAnchor="end" dominantBaseline="middle">
              {yFormat(t)}
            </text>
          </g>
        ))}

        <line x1={M.left} x2={W - M.right} y1={zero} y2={zero} className="v3-zero-line" />

        {points.map((p, i) => {
          const x = M.left + i * bw;
          const y = p.value >= 0 ? sy(p.value) : zero;
          const h = Math.max(Math.abs(sy(p.value) - zero), 0.6);
          const after = splitIdx >= 0 && i >= splitIdx;
          return (
            <rect
              key={p.date}
              x={x + bw * 0.12}
              y={y}
              width={bw * 0.76}
              height={h}
              className={`v3-col ${p.value < 0 ? 'is-negative' : 'is-positive'}${after ? ' is-after' : ''}`}
            >
              <title>{`${p.date}: ${yFormat(p.value)}`}</title>
            </rect>
          );
        })}

        {splitIdx > 0 && (
          <g className="v3-split">
            <line
              x1={M.left + splitIdx * bw}
              x2={M.left + splitIdx * bw}
              y1={M.top}
              y2={M.top + ih}
            />
            {splitLabel && (
              <text x={M.left + splitIdx * bw + 6} y={M.top + 12} className="v3-split-label">
                {splitLabel}
              </text>
            )}
          </g>
        )}
      </svg>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Diverging bars for event-study CARs
// ---------------------------------------------------------------------------

export function EventBars({
  events,
  ariaLabel,
}: {
  events: { date: string; label: string; sign: number; car_pct: number; matched: boolean }[];
  ariaLabel: string;
}) {
  if (events.length === 0) return <EmptyState message="No evaluable events in the price window." />;
  const max = Math.max(...events.map((e) => Math.abs(e.car_pct)), 1);

  return (
    <ol className="v3-eventbars" aria-label={ariaLabel}>
      {events.map((e) => {
        const w = (Math.abs(e.car_pct) / max) * 50;
        const dir = e.sign > 0 ? 'escalation' : 'de-escalation';
        return (
          <li key={e.date} className={`v3-eventbar${e.matched ? ' is-match' : ' is-miss'}`}>
            <div className="v3-eventbar-head">
              <span className="v3-eventbar-date">{e.date}</span>
              <span className={`v3-eventbar-expect v3-${e.sign > 0 ? 'up' : 'down'}`}>
                war {dir} — expected {e.sign > 0 ? 'rise' : 'fall'}
              </span>
              <span className="v3-eventbar-verdict">{e.matched ? 'moved as predicted' : 'did not'}</span>
            </div>
            <div className="v3-eventbar-track">
              <span
                className={`v3-eventbar-fill v3-${e.car_pct >= 0 ? 'up' : 'down'}`}
                style={{
                  width: `${w}%`,
                  [e.car_pct >= 0 ? 'left' : 'right']: '50%',
                } as React.CSSProperties}
              />
              <span className="v3-eventbar-axis" />
              <b className="v3-eventbar-value">
                {e.car_pct > 0 ? '+' : ''}
                {e.car_pct.toFixed(1)}%
              </b>
            </div>
            <p className="v3-eventbar-label">{e.label}</p>
          </li>
        );
      })}
    </ol>
  );
}
