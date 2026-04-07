import { useScrollReveal } from '../../hooks/useScrollReveal';
import { usePolymarketSummary } from '../../hooks/usePolymarket';
import { CategoryCard } from '../predictions/MarketSentimentCard';

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function PredictionMarketsSection() {
  const { data, isLoading, isError } = usePolymarketSummary();
  const ref = useScrollReveal();

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-wide">
          <span className="section-number">02 / Markets</span>
          <h2 className="editorial-header">What Markets Are Pricing In</h2>
          <p className="editorial-subhead mb-4">Loading prediction market data...</p>
          <div className="section-rule" />
          <div className="mt-6 space-y-6">
            {[1, 2, 3].map((g) => (
              <div key={g}>
                <div className="h-3 w-24 bg-surface rounded animate-pulse mb-3" />
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-border p-4" style={{ background: 'rgba(8,14,24,0.6)' }}>
                      <div className="h-4 w-32 bg-surface rounded animate-pulse mb-3" />
                      <div className="h-3 w-full bg-surface rounded animate-pulse mb-2" />
                      <div className="h-3 w-3/4 bg-surface rounded animate-pulse mb-2" />
                      <div className="h-2 w-full bg-surface rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Show fallback if API fails or no matching markets found
  if (isError || !data || !data.categories.length) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-wide">
          <span className="section-number">02 / Markets</span>
          <h2 className="editorial-header">What Markets Are Pricing In</h2>
          <p className="editorial-subhead">
            Real-money prediction markets show what traders with skin in the game think happens next.
          </p>
          <div className="section-rule" />
          <div className="mt-6 rounded-lg border p-6 text-center" style={{ background: 'rgba(8,14,24,0.6)', borderColor: 'rgba(0,240,255,0.06)' }}>
            <p className="text-base text-text-secondary mb-2">
              {isError
                ? 'Unable to reach Polymarket API \u2014 prediction data temporarily unavailable.'
                : 'No matching prediction markets found at this time.'}
            </p>
            <p className="text-base font-[family-name:var(--font-mono)] text-text-secondary">
              Tracking oil prices, gas costs, inflation, recession risk, Fed policy, Iran war, tariffs, and commodities on{' '}
              <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">
                Polymarket
              </a>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 scroll-reveal" ref={ref}>
      <div className="section-wide">
        <h2 className="editorial-header">What Markets Are Pricing In</h2>
        <p className="editorial-subhead">
          Real-money prediction markets show what traders with skin in the game think happens next {'\u2014'}{' '}
          from oil price targets and gas costs to recession odds, Fed policy, and geopolitical risk.
        </p>
        <div className="section-rule" />

        {/* Summary stats bar */}
        <div className="mt-4 mb-6 flex items-center gap-6 text-base font-[family-name:var(--font-mono)]">
          <div>
            <span className="text-text-secondary uppercase tracking-wider text-xs">Markets tracked </span>
            <span className="text-text-primary font-medium">{data.market_count}</span>
          </div>
          <div>
            <span className="text-text-secondary uppercase tracking-wider text-xs">Total volume </span>
            <span className="text-text-primary font-medium">{formatVolume(data.total_volume)}</span>
          </div>
        </div>

        {/* Category cards grouped by theme */}
        {[
          { label: 'Oil & Energy', keys: ['oil_targets', 'gas_energy', 'supply_chain'] },
          { label: 'Economy', keys: ['recession', 'fed', 'inflation'] },
          { label: 'Geopolitics', keys: ['iran_war', 'geopolitical', 'tariffs'] },
        ].map((group) => {
          const groupCats = group.keys
            .map((k) => data.categories.find((c) => c.key === k))
            .filter(Boolean);
          if (!groupCats.length) return null;
          return (
            <div key={group.label} className="mb-8">
              <div className="font-[family-name:var(--font-mono)] text-xs text-text-secondary uppercase tracking-[0.2em] mb-3">
                {group.label}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {groupCats.map((cat) => (
                  <CategoryCard key={cat!.key} category={cat!} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Source Attribution */}
        <div className="mt-4 flex items-center justify-between text-xs font-[family-name:var(--font-mono)] text-text-secondary">
          <span>
            Data from{' '}
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              Polymarket
            </a>
            {' '}{'\u2022'} Updated {timeAgo(data.updated_at)}
          </span>
        </div>
      </div>
    </section>
  );
}
