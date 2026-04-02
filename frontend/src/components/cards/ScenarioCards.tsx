import { useMemo } from 'react';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { SCENARIO_THRESHOLDS } from '../../lib/constants';
import type { SimulationBands } from '../../types';

interface ScenarioCardsProps {
  simulationResult: SimulationBands | null;
  isSimulating: boolean;
  currentPrice: number | null;
}

function estimateCdfAtPrice(bands: SimulationBands['bands'], price: number): number {
  const idx = bands.p50.length - 1;
  const points = [
    { pct: 0.01, val: bands.p1[idx] },
    { pct: 0.05, val: bands.p5[idx] },
    { pct: 0.25, val: bands.p25[idx] },
    { pct: 0.50, val: bands.p50[idx] },
    { pct: 0.75, val: bands.p75[idx] },
    { pct: 0.95, val: bands.p95[idx] },
    { pct: 0.99, val: bands.p99[idx] },
  ];
  if (price <= points[0].val) return 0;
  if (price >= points[points.length - 1].val) return 1;
  for (let i = 0; i < points.length - 1; i++) {
    if (price >= points[i].val && price <= points[i + 1].val) {
      const frac = (price - points[i].val) / (points[i + 1].val - points[i].val);
      return points[i].pct + frac * (points[i + 1].pct - points[i].pct);
    }
  }
  return 0.5;
}

export function ScenarioCards({ simulationResult, isSimulating, currentPrice }: ScenarioCardsProps) {
  const probabilities = useMemo(() => {
    if (!simulationResult) return null;
    const { bands } = simulationResult;
    const idx = bands.p50.length - 1;
    const medianPrice = bands.p50[idx];
    const bullCdf = estimateCdfAtPrice(bands, SCENARIO_THRESHOLDS.bull);
    const bearCdf = estimateCdfAtPrice(bands, SCENARIO_THRESHOLDS.bear);
    return {
      medianPrice,
      bullPct: (1 - bullCdf) * 100,
      basePct: (bullCdf - bearCdf) * 100,
      bearPct: bearCdf * 100,
    };
  }, [simulationResult]);

  const showPulse = isSimulating && !simulationResult;

  const delta = probabilities && currentPrice != null
    ? probabilities.medianPrice - currentPrice
    : null;

  const cards = [
    {
      label: 'Median',
      color: '#00F0FF',
      value: probabilities ? formatCurrency(probabilities.medianPrice) : '--',
      sub: delta != null ? (
        <span className="number-display text-[10px]" style={{ color: delta >= 0 ? '#00FF88' : '#FF3366' }}>
          {delta >= 0 ? '\u2191' : '\u2193'}{formatPercent(currentPrice ? (delta / currentPrice) * 100 : 0)}
        </span>
      ) : null,
    },
    {
      label: 'Bull',
      color: '#00FF88',
      value: probabilities ? `${probabilities.bullPct.toFixed(1)}%` : '--',
      sub: <span className="text-[10px] text-text-secondary">&gt;${SCENARIO_THRESHOLDS.bull}</span>,
    },
    {
      label: 'Base',
      color: '#00F0FF',
      value: probabilities ? `${probabilities.basePct.toFixed(1)}%` : '--',
      sub: <span className="text-[10px] text-text-secondary">${SCENARIO_THRESHOLDS.bear}-${SCENARIO_THRESHOLDS.bull}</span>,
    },
    {
      label: 'Bear',
      color: '#FF3366',
      value: probabilities ? `${probabilities.bearPct.toFixed(1)}%` : '--',
      sub: <span className="text-[10px] text-text-secondary">&lt;${SCENARIO_THRESHOLDS.bear}</span>,
    },
  ];

  if (showPulse) {
    return (
      <div className="flex items-center gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center px-4">
            <div className="skeleton-shimmer h-3 w-12 rounded mb-1 mx-auto" />
            <div className="skeleton-shimmer h-6 w-10 rounded mx-auto" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {cards.map((card, idx) => (
        <div
          key={card.label}
          className="text-center px-4 py-2 border-l border-border first:border-l-0"
          style={{ animationDelay: `${idx * 0.08}s` }}
        >
          <div className="font-[family-name:var(--font-display)] text-[10px] tracking-[0.1em] uppercase text-text-secondary mb-0.5">
            {card.label}
          </div>
          <div
            className="number-display text-xl font-semibold"
            style={{ color: card.color }}
          >
            {card.value}
          </div>
          {card.sub && <div className="mt-0.5">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}
