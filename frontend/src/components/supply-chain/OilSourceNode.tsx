import { useMemo } from 'react';
import { useOilSparkline } from '../../hooks/useOilPrices';
import { IRAN_WAR_DATE, getValueBeforeDate } from '../../lib/commodity-data';
import type { PriceSeries } from '../../types';

interface OilSourceNodeProps {
  oilData: PriceSeries;
}

export function OilSourceNode({ oilData }: OilSourceNodeProps) {
  const { data: sparkData } = useOilSparkline('wti');

  const latest = oilData.observations.at(-1);
  const warBaseline = getValueBeforeDate(oilData, IRAN_WAR_DATE);
  const sinceWarPct = warBaseline && latest
    ? ((latest.value - warBaseline) / warBaseline) * 100
    : null;

  // Build SVG sparkline points
  const sparkPoints = useMemo(() => {
    if (!sparkData?.observations?.length) return '';
    const obs = sparkData.observations;
    const vals = obs.map((o) => o.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return obs
      .map((o, i) => {
        const x = (i / (obs.length - 1)) * 120;
        const y = 28 - ((o.value - min) / range) * 26;
        return `${x},${y}`;
      })
      .join(' ');
  }, [sparkData]);

  if (!latest) return null;

  return (
    <div className="relative flex items-center gap-5 p-5 rounded-[10px] border border-border-active overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(212,160,18,0.06), rgba(0,240,255,0.02))' }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, #00F0FF, rgba(0,240,255,0.1))' }}
      />

      <span className="text-[44px] shrink-0">{'\u{1F6E2}\uFE0F'}</span>

      <div className="flex-1">
        <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.15em] uppercase text-accent mb-0.5">
          Source
        </div>
        <div className="font-[family-name:var(--font-display)] text-2xl tracking-[0.05em] text-text-primary">
          WTI CRUDE OIL
        </div>
        <div className="flex items-baseline gap-3 mt-0.5">
          <span className="font-[family-name:var(--font-mono)] text-[32px] font-bold text-text-primary">
            ${latest.value.toFixed(2)}
          </span>
          {sinceWarPct !== null && (
            <span className={`font-[family-name:var(--font-mono)] text-sm font-semibold ${sinceWarPct >= 0 ? 'text-red' : 'text-green'}`}>
              {sinceWarPct >= 0 ? '\u2191' : '\u2193'} {sinceWarPct >= 0 ? '+' : ''}{sinceWarPct.toFixed(1)}% since Iran War
            </span>
          )}
        </div>
        <div className="font-[family-name:var(--font-mono)] text-[11px] text-text-secondary mt-0.5">
          {new Date(latest.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Sparkline */}
      {sparkPoints && (
        <div className="w-[140px] h-12 rounded-md border border-border bg-[rgba(0,240,255,0.03)] relative shrink-0">
          <span className="absolute top-1 right-1.5 font-[family-name:var(--font-mono)] text-[8px] text-text-secondary uppercase tracking-[0.1em]">
            1Y
          </span>
          <svg viewBox="0 0 120 30" className="absolute bottom-1.5 left-2 right-2 h-7 w-[calc(100%-16px)]">
            <polyline
              points={sparkPoints}
              fill="none"
              stroke="#00F0FF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
