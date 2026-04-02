import { usePriceSummary } from '../../hooks/useOilPrices';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useCountUp } from '../../hooks/useCountUp';
import { SERIES_LABELS } from '../../lib/constants';
import { formatCurrency, formatPercent } from '../../lib/utils';

export function HeroPriceZone() {
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);
  const { data: summary, isLoading } = usePriceSummary();

  const item = summary?.data?.find((d) => d.series === selectedSeries);
  const price = item?.current_price ?? null;
  const change = item?.daily_change ?? null;
  const pctChange = item?.pct_change ?? null;

  const animatedPrice = useCountUp(price ?? 0, 800, 2);
  const isPositive = change != null && change >= 0;

  if (isLoading) {
    return (
      <div className="px-6 py-6 animate-signal-in">
        <div className="skeleton-shimmer h-16 w-64 rounded-lg mb-2" />
        <div className="skeleton-shimmer h-4 w-32 rounded" />
      </div>
    );
  }

  return (
    <div className="px-6 py-4 animate-signal-in stagger-1">
      <div className="flex items-end gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] uppercase text-text-secondary">
              {SERIES_LABELS[selectedSeries] || selectedSeries.toUpperCase()}
            </span>
            <div className="live-indicator">
              <span className="live-dot" />
              LIVE
            </div>
          </div>
          <div className="hero-price">
            ${price != null ? animatedPrice : '--'}
          </div>
        </div>
        {change != null && (
          <div className="pb-2">
            <div
              className="number-display text-lg font-semibold"
              style={{ color: isPositive ? '#00FF88' : '#FF3366' }}
            >
              {isPositive ? '\u2191' : '\u2193'} {formatCurrency(Math.abs(change))}
            </div>
            <div
              className="number-display text-xs"
              style={{ color: isPositive ? '#00FF88' : '#FF3366' }}
            >
              {formatPercent(pctChange ?? 0)} today
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
