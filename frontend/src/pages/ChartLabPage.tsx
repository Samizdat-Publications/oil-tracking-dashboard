import { useMemo, useState } from 'react';
import { useOilPrices } from '../hooks/useOilPrices';
import {
  IRAN_WAR_DATE,
  WAR_BASELINE_DATE,
  getValueBeforeDate,
} from '../lib/commodity-data';
import type { PricePoint, PriceSeries } from '../types';
import { ViewToggle } from '../components/ui/ViewToggle';
import '../styles/broadsheet.css';
import './ChartLabPage.css';

/**
 * ChartLabPage — isolated canvas for iterating on the Hero chart before
 * merging the winning design back into BroadsheetPage.tsx.
 *
 * Access via `?view=chart-lab`. The broadsheet and dashboard views are
 * untouched — this is a design sandbox only.
 *
 * What's tunable here:
 *   - Window length (how many days of history to plot)
 *   - Chart dimensions + stroke weight
 *   - War-marker placement (derived, shown as a stat for feedback)
 *   - Peak-price call-out
 *   - Horizontal baseline rule at WAR_BASELINE_DATE
 *
 * Once a combination looks right, lift the `LabChart` component (and any
 * changed constants/styles) back into BroadsheetPage's `HeroChart`.
 */

// ─── window options ─────────────────────────────────────────────────────
type WindowOption = { days: number; label: string; note: string };
const WINDOWS: WindowOption[] = [
  { days: 60, label: '2 MONTHS', note: 'Tightest — war dominates the frame.' },
  { days: 90, label: '3 MONTHS', note: 'Minimal pre-war context; maximum drama.' },
  { days: 120, label: '4 MONTHS', note: 'Balanced — flat baseline + steep spike. Recommended.' },
  { days: 180, label: '6 MONTHS', note: 'More context; war starts at ~70% across.' },
  { days: 365, label: '12 MONTHS', note: 'Catches non-Iran peaks from 2025.' },
  { days: 730, label: '24 MONTHS', note: 'Current broadsheet default.' },
];

function windowObservations(obs: PricePoint[], days: number): PricePoint[] {
  if (!obs.length) return obs;
  const last = new Date(obs[obs.length - 1].date).getTime();
  const cutoff = last - days * 86_400_000;
  return obs.filter((p) => new Date(p.date).getTime() >= cutoff);
}

// ─── LabChart: mirror of HeroChart with configurable window ─────────────
interface LabChartProps {
  series: PriceSeries | undefined;
  windowDays: number;
  windowLabel: string;
  showBaseline: boolean;
  showPeakLabel: boolean;
  strokeWidth: number;
}

function LabChart({
  series,
  windowDays,
  windowLabel,
  showBaseline,
  showPeakLabel,
  strokeWidth,
}: LabChartProps) {
  const allPoints = series?.observations ?? [];
  const points = useMemo(
    () => windowObservations(allPoints, windowDays),
    [allPoints, windowDays],
  );
  const W = 620;
  const H = 360;

  const {
    path,
    areaPath,
    warX,
    warXPct,
    minV,
    maxV,
    endY,
    baselineY,
    peakX,
    peakY,
    peakValue,
  } = useMemo(() => {
    if (points.length < 2) {
      return {
        path: '',
        areaPath: '',
        warX: W * 0.5,
        warXPct: 50,
        minV: 56,
        maxV: 139,
        endY: H / 2,
        baselineY: null as number | null,
        peakX: W,
        peakY: H / 2,
        peakValue: 0,
      };
    }
    const minV = Math.min(...points.map((p) => p.value));
    const maxV = Math.max(...points.map((p) => p.value));
    const range = Math.max(1, maxV - minV);
    const yOf = (v: number) => H - ((v - minV) / range) * (H - 40) - 20;
    const path = points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * W;
        const y = yOf(p.value);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const areaPath = path + ` L${W},${H} L0,${H} Z`;
    const warIdx = points.findIndex((p) => p.date >= IRAN_WAR_DATE);
    const warX = warIdx >= 0 ? (warIdx / (points.length - 1)) * W : W * 0.85;
    const warXPct = (warX / W) * 100;
    const lastVal = points[points.length - 1].value;
    const endY = yOf(lastVal);

    // Baseline (Feb 14) as a horizontal rule
    const baselineVal = series ? getValueBeforeDate(series, WAR_BASELINE_DATE) : null;
    const baselineY = baselineVal != null ? yOf(baselineVal) : null;

    // Peak price in the window
    const peakIdx = points.reduce(
      (best, p, i) => (p.value > points[best].value ? i : best),
      0,
    );
    const peakX = (peakIdx / (points.length - 1)) * W;
    const peakY = yOf(points[peakIdx].value);
    const peakValue = points[peakIdx].value;

    return {
      path,
      areaPath,
      warX,
      warXPct,
      minV,
      maxV,
      endY,
      baselineY,
      peakX,
      peakY,
      peakValue,
    };
  }, [points, series]);

  return (
    <div className="lab-chart">
      <div className="chart-label">
        <span className="chart-label-top">WTI CRUDE &middot; {windowLabel}</span>
        <span className="chart-label-bottom">
          ${minV.toFixed(0)}—${maxV.toFixed(0)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg draw">
        <defs>
          <linearGradient id="labHeroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#00F0FF" stopOpacity="0.35" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </linearGradient>
          <pattern id="labHeroGrid" width="40" height="30" patternUnits="userSpaceOnUse">
            <path d="M40 0 V30 M0 30 H40" stroke="rgba(212,160,18,0.06)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#labHeroGrid)" />

        {showBaseline && baselineY != null && (
          <>
            <line
              x1={0}
              y1={baselineY}
              x2={W}
              y2={baselineY}
              stroke="#D4A012"
              strokeWidth={0.75}
              strokeDasharray="4 4"
              opacity={0.55}
            />
            <text
              x={8}
              y={baselineY - 6}
              fill="#D4A012"
              fontSize={9}
              fontFamily="'JetBrains Mono'"
              letterSpacing="0.12em"
            >
              FEB 14 BASELINE
            </text>
          </>
        )}

        <line
          x1={warX}
          y1={10}
          x2={warX}
          y2={H - 10}
          stroke="#CC2936"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.7}
        />
        <text
          x={warX + 6}
          y={22}
          fill="#CC2936"
          fontSize={9}
          fontFamily="'JetBrains Mono'"
          letterSpacing="0.1em"
        >
          FEB 28 &middot; WAR BEGINS
        </text>

        <path d={areaPath} fill="url(#labHeroFill)" />
        <path
          d={path}
          stroke="#00F0FF"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showPeakLabel && peakValue > 0 && (
          <>
            <circle cx={peakX} cy={peakY} r={3} fill="#CC2936" />
            <text
              x={peakX}
              y={peakY - 10}
              fill="#E8ECF4"
              fontSize={10}
              fontFamily="'JetBrains Mono'"
              textAnchor="middle"
              fontWeight={700}
            >
              ${peakValue.toFixed(2)}
            </text>
          </>
        )}

        <circle cx={W} cy={endY} r={4} fill="#00F0FF" />
        <circle cx={W} cy={endY} r={4} fill="none" stroke="#00F0FF" opacity={0.5} />
      </svg>

      <div className="lab-chart-stats">
        <span>WAR AT {warXPct.toFixed(0)}% ACROSS</span>
        <span className="lab-chart-stats-sep">·</span>
        <span>{points.length} OBSERVATIONS</span>
        <span className="lab-chart-stats-sep">·</span>
        <span>
          RANGE ${minV.toFixed(2)} → ${maxV.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

// ─── PAGE ───────────────────────────────────────────────────────────────
export function ChartLabPage() {
  const wtiQ = useOilPrices('wti');
  const [windowIdx, setWindowIdx] = useState(2); // default 4 MONTHS
  const [showBaseline, setShowBaseline] = useState(true);
  const [showPeakLabel, setShowPeakLabel] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(1.5);
  const win = WINDOWS[windowIdx];

  // Derived hero metrics (same math as the broadsheet — "since first strike")
  const metrics = useMemo(() => {
    const wti = wtiQ.data;
    if (!wti) return null;
    const obs = wti.observations;
    if (!obs.length) return null;
    const current = obs[obs.length - 1].value;
    const baseline = getValueBeforeDate(wti, WAR_BASELINE_DATE) ?? current;
    return {
      current,
      baseline,
      deltaDollar: current - baseline,
      deltaPct: ((current - baseline) / baseline) * 100,
    };
  }, [wtiQ.data]);

  return (
    <div className="broadsheet chart-lab">
      <ViewToggle current="broadsheet" />

      <header className="lab-header">
        <div className="lab-header-left">
          <div className="section-kicker">CHART LAB &middot; INTERNAL</div>
          <h1 className="lab-title">Hero chart — window iteration</h1>
          <p className="lab-sub">
            Pick the window that tells the Iran-war story cleanest. The goal is a
            flat-ish pre-war baseline on the left, a sharp ascent starting at the
            red Feb&nbsp;28 rule, and a visible peak on the right. Changes here
            are isolated — merge the winner back into{' '}
            <code>HeroChart</code> in <code>BroadsheetPage.tsx</code>.
          </p>
        </div>
        <div className="lab-header-right">
          {metrics && (
            <div className="lab-metrics">
              <div className="lab-metric">
                <span className="lab-metric-label">CURRENT</span>
                <span className="lab-metric-value">${metrics.current.toFixed(2)}</span>
              </div>
              <div className="lab-metric">
                <span className="lab-metric-label">BASELINE</span>
                <span className="lab-metric-value">${metrics.baseline.toFixed(2)}</span>
              </div>
              <div className="lab-metric lab-metric-delta">
                <span className="lab-metric-label">SINCE FEB 14</span>
                <span className="lab-metric-value">
                  +${metrics.deltaDollar.toFixed(2)} ({metrics.deltaPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="lab-controls">
        <div className="lab-control-group">
          <span className="lab-control-label">Window</span>
          <div className="lab-toggle-row">
            {WINDOWS.map((w, i) => (
              <button
                key={w.days}
                type="button"
                className={`lab-toggle ${i === windowIdx ? 'active' : ''}`}
                onClick={() => setWindowIdx(i)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <span className="lab-control-note">{win.note}</span>
        </div>

        <div className="lab-control-group">
          <span className="lab-control-label">Overlays</span>
          <div className="lab-toggle-row">
            <button
              type="button"
              className={`lab-toggle ${showBaseline ? 'active' : ''}`}
              onClick={() => setShowBaseline((v) => !v)}
            >
              Feb 14 baseline
            </button>
            <button
              type="button"
              className={`lab-toggle ${showPeakLabel ? 'active' : ''}`}
              onClick={() => setShowPeakLabel((v) => !v)}
            >
              Peak call-out
            </button>
          </div>
        </div>

        <div className="lab-control-group">
          <span className="lab-control-label">Stroke width</span>
          <div className="lab-toggle-row">
            {[1, 1.5, 2, 2.5].map((s) => (
              <button
                key={s}
                type="button"
                className={`lab-toggle ${strokeWidth === s ? 'active' : ''}`}
                onClick={() => setStrokeWidth(s)}
              >
                {s}px
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lab-canvas">
        {wtiQ.isLoading ? (
          <div className="lab-loading">Loading WTI series…</div>
        ) : wtiQ.error ? (
          <div className="lab-error">Failed to load WTI series.</div>
        ) : (
          <LabChart
            series={wtiQ.data}
            windowDays={win.days}
            windowLabel={win.label}
            showBaseline={showBaseline}
            showPeakLabel={showPeakLabel}
            strokeWidth={strokeWidth}
          />
        )}
      </div>

      <footer className="lab-footer">
        <span>CHART LAB &middot; ISOLATED DESIGN SURFACE</span>
        <span>SWITCH WITH ?view=chart-lab &middot; RETURN VIA TOGGLE</span>
      </footer>
    </div>
  );
}

export default ChartLabPage;
