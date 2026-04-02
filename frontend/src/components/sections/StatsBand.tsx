import { usePriceSummary } from '../../hooks/useOilPrices';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import type { SimulationBands, PriceSummaryItem } from '../../types';

interface StatsBandProps {
  simulationResult: SimulationBands | null;
}

function findSeries(data: PriceSummaryItem[] | undefined, series: string) {
  return data?.find((d) => d.series === series);
}

function PullStat({ label, value, change, pctChange }: {
  label: string;
  value: string | null;
  change?: number | null;
  pctChange?: number | null;
}) {
  const isPositive = change != null && change >= 0;
  return (
    <div className="pull-stat flex-1 min-w-0">
      <div className="pull-stat-label">{label}</div>
      <div className="pull-stat-value">{value ?? '--'}</div>
      {change != null && (
        <div
          className="pull-stat-change"
          style={{ color: isPositive ? '#00FF88' : '#FF3366' }}
        >
          {change >= 0 ? '+' : ''}{formatCurrency(change)} ({formatPercent(pctChange ?? 0)})
        </div>
      )}
    </div>
  );
}

export function StatsBand({ simulationResult }: StatsBandProps) {
  const { data: summary, isLoading } = usePriceSummary();
  const ref = useScrollReveal();

  const wti = findSeries(summary?.data, 'wti');
  const brent = findSeries(summary?.data, 'brent');
  const diesel = findSeries(summary?.data, 'diesel');

  const spread = wti?.current_price != null && brent?.current_price != null
    ? brent.current_price - wti.current_price
    : null;

  const vol30d = simulationResult?.params?.sigma != null
    ? (simulationResult.params.sigma * 100).toFixed(1) + '%'
    : null;

  return (
    <section className="band-dark py-8 scroll-reveal" ref={ref as any}>
      <div className="section-wide">
        <div className="flex items-stretch">
          <PullStat
            label="WTI Crude"
            value={isLoading ? null : wti?.current_price != null ? formatCurrency(wti.current_price) : null}
            change={wti?.daily_change}
            pctChange={wti?.pct_change}
          />
          <div className="stat-divider" />
          <PullStat
            label="Brent Crude"
            value={isLoading ? null : brent?.current_price != null ? formatCurrency(brent.current_price) : null}
            change={brent?.daily_change}
            pctChange={brent?.pct_change}
          />
          <div className="stat-divider" />
          <PullStat
            label="Brent-WTI Spread"
            value={isLoading ? null : spread != null ? formatCurrency(spread) : null}
          />
          <div className="stat-divider" />
          <PullStat
            label="30d Volatility"
            value={isLoading ? null : vol30d}
          />
          <div className="stat-divider" />
          <PullStat
            label="Diesel"
            value={isLoading ? null : diesel?.current_price != null ? formatCurrency(diesel.current_price) : null}
            change={diesel?.daily_change}
            pctChange={diesel?.pct_change}
          />
        </div>
      </div>
    </section>
  );
}
