import { usePriceSummary } from '../../hooks/useOilPrices';
import { formatCurrency, formatPercent } from '../../lib/utils';
import type { SimulationBands, PriceSummaryItem } from '../../types';

interface CurrentPricesStripProps {
  simulationResult: SimulationBands | null;
}

function findSeries(data: PriceSummaryItem[] | undefined, series: string): PriceSummaryItem | undefined {
  return data?.find((d) => d.series === series);
}

interface StatItemProps {
  label: string;
  value: string | null;
  change?: number | null;
  pctChange?: number | null;
}

function StatItem({ label, value, change, pctChange }: StatItemProps) {
  const isPositive = change != null && change >= 0;
  return (
    <div className="flex-1 min-w-0 py-3 px-4">
      <div className="text-[10px] uppercase tracking-[0.15em] text-text-secondary mb-1 font-[family-name:var(--font-display)]">{label}</div>
      <div className="number-display text-lg font-semibold text-text-primary">{value ?? '--'}</div>
      {change != null && (
        <div
          className="number-display text-[11px] mt-0.5"
          style={{ color: isPositive ? '#00FF88' : '#FF3366' }}
        >
          {change >= 0 ? '+' : ''}{formatCurrency(change)} ({formatPercent(pctChange ?? 0)})
        </div>
      )}
    </div>
  );
}

export function CurrentPricesStrip({ simulationResult }: CurrentPricesStripProps) {
  const { data: summary, isLoading } = usePriceSummary();

  const wti = findSeries(summary?.data, 'wti');
  const brent = findSeries(summary?.data, 'brent');
  const diesel = findSeries(summary?.data, 'diesel');

  const spread = wti?.current_price != null && brent?.current_price != null
    ? brent.current_price - wti.current_price
    : null;

  const vol30d = simulationResult?.params?.sigma != null
    ? (simulationResult.params.sigma * 100).toFixed(1) + '%'
    : null;

  if (isLoading) {
    return (
      <div className="px-6 py-3">
        <div className="signal-card rounded-lg animate-signal-in">
          <div className="flex items-center divide-x divide-border h-20">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex-1 px-4 py-3">
                <div className="skeleton-shimmer h-2.5 w-16 rounded mb-2" />
                <div className="skeleton-shimmer h-5 w-20 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-3">
      <div className="signal-card rounded-lg animate-slide-reveal flex items-stretch">
        <StatItem
          label="WTI Crude"
          value={wti?.current_price != null ? formatCurrency(wti.current_price) : null}
          change={wti?.daily_change ?? null}
          pctChange={wti?.pct_change ?? null}
        />
        <div className="stat-divider" />
        <StatItem
          label="Brent Crude"
          value={brent?.current_price != null ? formatCurrency(brent.current_price) : null}
          change={brent?.daily_change ?? null}
          pctChange={brent?.pct_change ?? null}
        />
        <div className="stat-divider" />
        <StatItem
          label="Brent-WTI Spread"
          value={spread != null ? formatCurrency(spread) : null}
        />
        <div className="stat-divider" />
        <StatItem
          label="30d Volatility"
          value={vol30d ?? null}
        />
        <div className="stat-divider" />
        <StatItem
          label="Diesel"
          value={diesel?.current_price != null ? formatCurrency(diesel.current_price) : null}
          change={diesel?.daily_change ?? null}
          pctChange={diesel?.pct_change ?? null}
        />
      </div>
    </div>
  );
}
