import { ChevronDown, Fuel, Settings } from 'lucide-react';
import { usePriceSummary } from '../../hooks/useOilPrices';
import { useDashboardStore, type DateRangePreset } from '../../stores/dashboardStore';
import { useCountUp } from '../../hooks/useCountUp';
import { SERIES_LABELS } from '../../lib/constants';
import { formatCurrency, formatPercent } from '../../lib/utils';

const DATE_RANGES: DateRangePreset[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', 'ALL'];

interface HeroSectionProps {
  onOpenEventManager: () => void;
}

export function HeroSection({ onOpenEventManager }: HeroSectionProps) {
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);
  const setSelectedSeries = useDashboardStore((s) => s.setSelectedSeries);
  const dateRangePreset = useDashboardStore((s) => s.dateRangePreset);
  const setDateRange = useDashboardStore((s) => s.setDateRange);

  const { data: summary, isLoading } = usePriceSummary();
  const item = summary?.data?.find((d) => d.series === selectedSeries);
  const price = item?.current_price ?? null;
  const change = item?.daily_change ?? null;
  const pctChange = item?.pct_change ?? null;
  const animatedPrice = useCountUp(price ?? 0, 1000, 2);
  const isPositive = change != null && change >= 0;

  return (
    <section className="hero-section">
      {/* Top bar — positioned absolutely within hero */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-6 z-20">
        {/* Left: Logo + title */}
        <div className="flex items-center gap-3">
          <Fuel className="h-5 w-5 text-accent opacity-60" />
          <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.2em] uppercase text-text-secondary">
            Crude Oil Analytics
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0 border border-border overflow-hidden">
            <button
              onClick={() => setSelectedSeries('wti')}
              className={`px-4 py-1.5 text-[10px] font-medium transition-all duration-200 font-[family-name:var(--font-mono)] tracking-wider ${
                selectedSeries === 'wti'
                  ? 'bg-accent text-background'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              WTI
            </button>
            <button
              onClick={() => setSelectedSeries('brent')}
              className={`px-4 py-1.5 text-[10px] font-medium transition-all duration-200 font-[family-name:var(--font-mono)] tracking-wider ${
                selectedSeries === 'brent'
                  ? 'bg-accent text-background'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              BRENT
            </button>
          </div>

          <div className="flex items-center gap-0 border border-border overflow-hidden">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2 py-1.5 text-[10px] font-medium transition-all duration-200 font-[family-name:var(--font-mono)] ${
                  dateRangePreset === range
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenEventManager}
            className="p-2 text-text-secondary hover:text-accent transition-all"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Center: The Price */}
      <div className="text-center">
        <div className="hero-series-label mb-3">
          {SERIES_LABELS[selectedSeries] || selectedSeries.toUpperCase()}
        </div>

        <div className={`hero-price-display${isLoading ? ' text-text-secondary animate-pulse' : ''}`}>
          {isLoading ? '---' : `$${price != null ? animatedPrice : '--'}`}
        </div>

        {change != null && !isLoading && (
          <div className="mt-3 flex items-center justify-center gap-4">
            <span
              className="number-display text-lg font-medium"
              style={{ color: isPositive ? '#00FF88' : '#FF3366' }}
            >
              {isPositive ? '\u2191' : '\u2193'} {formatCurrency(Math.abs(change))}
            </span>
            <span
              className="number-display text-sm"
              style={{ color: isPositive ? '#00FF88' : '#FF3366' }}
            >
              {formatPercent(pctChange ?? 0)} today
            </span>
          </div>
        )}
      </div>

      {/* Bottom: LIVE indicator + scroll hint */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-6">
        <div className="live-indicator">
          <span className="live-dot" />
          LIVE
        </div>
        <ChevronDown className="h-5 w-5 text-text-secondary scroll-hint" />
      </div>
    </section>
  );
}
