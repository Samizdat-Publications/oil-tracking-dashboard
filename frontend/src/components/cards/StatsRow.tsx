import { StatCard } from './StatCard';
import { usePriceSummary } from '../../hooks/useOilPrices';
import type { SimulationBands, PriceSummaryItem } from '../../types';

interface StatsRowProps {
  simulationResult?: SimulationBands | null;
}

function findSeries(data: PriceSummaryItem[] | undefined, series: string): PriceSummaryItem | undefined {
  return data?.find((d) => d.series === series);
}

export function StatsRow({ simulationResult }: StatsRowProps) {
  const { data: summary, isLoading } = usePriceSummary();

  const wti = findSeries(summary?.data, 'wti');
  const brent = findSeries(summary?.data, 'brent');
  const diesel = findSeries(summary?.data, 'diesel');

  const spread =
    wti?.current_price != null && brent?.current_price != null
      ? brent.current_price - wti.current_price
      : null;

  const simMedian = simulationResult?.bands.p50
    ? simulationResult.bands.p50[simulationResult.bands.p50.length - 1]
    : null;

  const volatility30d = simulationResult?.params.sigma
    ? simulationResult.params.sigma * 100
    : null;

  return (
    <div className="flex gap-3 overflow-x-auto px-6 py-3">
      <StatCard
        label="WTI Crude"
        value={wti?.current_price ?? null}
        change={wti?.daily_change ?? undefined}
        pctChange={wti?.pct_change ?? undefined}
        loading={isLoading}
      />
      <StatCard
        label="Brent Crude"
        value={brent?.current_price ?? null}
        change={brent?.daily_change ?? undefined}
        pctChange={brent?.pct_change ?? undefined}
        loading={isLoading}
      />
      <StatCard
        label="Brent-WTI Spread"
        value={spread}
        loading={isLoading}
      />
      <StatCard
        label="30d Volatility"
        value={volatility30d}
        formatAsCurrency={false}
        loading={!simulationResult && isLoading}
      />
      <StatCard
        label="Diesel (No. 2)"
        value={diesel?.current_price ?? null}
        change={diesel?.daily_change ?? undefined}
        pctChange={diesel?.pct_change ?? undefined}
        loading={isLoading}
      />
      <StatCard
        label="Sim Median (End)"
        value={simMedian}
        loading={false}
      />
    </div>
  );
}
