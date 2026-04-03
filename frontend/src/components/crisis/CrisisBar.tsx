import { useState, useRef, useEffect } from 'react';
import type { CrisisData, CrisisTrajectoryPoint } from '../../types';
import { type CrisisMetric, CRISIS_COLORS, getMetricValue, METRIC_UNITS } from '../../lib/crisis-data';
import { CrisisTrajectoryChart } from './CrisisTrajectoryChart';

interface Props {
  crisis: CrisisData;
  metric: CrisisMetric;
  /** Max absolute value for scaling bar widths */
  maxAbsValue: number;
  /** Current (2026) crisis trajectory for comparison */
  currentTrajectory: CrisisTrajectoryPoint[];
  /** Stagger delay in ms */
  delay: number;
}

export function CrisisBar({ crisis, metric, maxAbsValue, currentTrajectory, delay }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Scroll-triggered reveal
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setRevealed(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  const value = getMetricValue(crisis, metric);
  const barColor = CRISIS_COLORS[crisis.id] || '#FF8800';
  const isNegative = value !== null && value < 0;
  const absValue = value !== null ? Math.abs(value) : 0;
  const barWidth = maxAbsValue > 0 ? (absValue / maxAbsValue) * 100 : 0;
  const unit = METRIC_UNITS[metric];

  const canExpand = !crisis.is_current && crisis.trajectory.length >= 2;

  return (
    <div ref={ref} className="group">
      {/* Main bar row */}
      <div
        className={`flex items-center gap-3 py-2 rounded-lg px-3 transition-colors ${canExpand ? 'cursor-pointer hover:bg-white/[0.02]' : ''}`}
        onClick={() => canExpand && setExpanded(!expanded)}
        role={canExpand ? 'button' : undefined}
        tabIndex={canExpand ? 0 : undefined}
        onKeyDown={(e) => {
          if (canExpand && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {/* Year */}
        <div className="w-10 shrink-0 font-[family-name:var(--font-mono)] text-xs" style={{ color: barColor }}>
          {crisis.year}
        </div>

        {/* Crisis name */}
        <div className="w-40 shrink-0">
          <div className="text-xs text-text-primary font-medium leading-tight">{crisis.name}</div>
          {crisis.is_current && (
            <div className="text-[10px] font-[family-name:var(--font-mono)] text-accent mt-0.5 tracking-wider uppercase crisis-live-badge">
              {'\u25CF'} LIVE
            </div>
          )}
        </div>

        {/* Bar area */}
        <div className="flex-1 flex items-center">
          {isNegative ? (
            /* Negative bar — grows from center-right toward left */
            <div className="w-full flex justify-end">
              <div className="w-1/2 flex justify-end">
                <div
                  className="h-5 rounded-l transition-all ease-out"
                  style={{
                    width: revealed ? `${Math.max(barWidth, 2)}%` : '0%',
                    transitionDuration: '800ms',
                    transitionDelay: '100ms',
                    background: `linear-gradient(270deg, ${barColor}, ${barColor}80)`,
                  }}
                />
              </div>
              {/* Zero divider */}
              <div className="w-px h-5 bg-text-secondary/20" />
              <div className="w-1/2" />
            </div>
          ) : (
            /* Positive bar — grows from left to right */
            <div className="w-full h-5 rounded" style={{ background: '#0A0E18' }}>
              <div
                className={`h-full rounded transition-all ease-out ${crisis.is_current ? 'crisis-pulse' : ''}`}
                style={{
                  width: revealed ? `${Math.max(barWidth, 2)}%` : '0%',
                  transitionDuration: '800ms',
                  transitionDelay: '100ms',
                  background: `linear-gradient(90deg, ${barColor}, ${barColor}80)`,
                  boxShadow: crisis.is_current ? `0 0 12px ${barColor}40` : 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Value label */}
        <div
          className="w-16 shrink-0 text-right font-[family-name:var(--font-mono)] text-sm font-semibold transition-opacity duration-500"
          style={{
            color: barColor,
            opacity: revealed ? 1 : 0,
          }}
        >
          {value !== null ? (
            <>
              {isNegative ? '' : '+'}{value.toFixed(metric === 'duration' ? 1 : 0)}{unit}
            </>
          ) : (
            <span className="text-text-secondary text-xs">{'\u2014'}</span>
          )}
        </div>

        {/* Expand indicator */}
        {canExpand && (
          <div
            className="w-4 shrink-0 text-text-secondary transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8 11L3 6h10z" />
            </svg>
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: expanded ? '280px' : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div
          className="mx-3 mb-3 p-4 rounded-lg"
          style={{ background: 'rgba(0, 240, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.06)' }}
        >
          {/* Context blurb */}
          <p className="text-xs text-text-secondary mb-3 leading-relaxed">
            {crisis.context}
          </p>

          {/* Trajectory chart */}
          <CrisisTrajectoryChart
            historicalTrajectory={crisis.trajectory}
            historicalName={`${crisis.year} ${crisis.name}`}
            historicalColor={barColor}
            currentTrajectory={currentTrajectory}
          />
        </div>
      </div>
    </div>
  );
}
