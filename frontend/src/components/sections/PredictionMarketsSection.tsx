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
        <div className="section-reading">
          <h2 className="editorial-header">What Markets Are Pricing In</h2>
          <p className="editorial-subhead mb-4">Loading prediction market data...</p>
          <div className="section-rule" />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
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
      </section>
    );
  }

  // Hide if API fails or no data
  if (isError || !data || !data.categories.length) return null;

  return (
    <section className="py-24 scroll-reveal" ref={ref}>
      <div className="section-reading">
        <h2 className="editorial-header">What Markets Are Pricing In</h2>
        <p className="editorial-subhead">
          Real-money prediction markets show what traders with skin in the game think happens next {'\u2014'}{' '}
          from recession odds to Fed policy to geopolitical escalation.
        </p>
        <div className="section-rule" />

        {/* Summary stats bar */}
        <div className="mt-4 mb-6 flex items-center gap-6 text-xs font-[family-name:var(--font-mono)]">
          <div>
            <span className="text-text-secondary uppercase tracking-wider text-[10px]">Markets tracked </span>
            <span className="text-text-primary font-medium">{data.market_count}</span>
          </div>
          <div>
            <span className="text-text-secondary uppercase tracking-wider text-[10px]">Total volume </span>
            <span className="text-text-primary font-medium">{formatVolume(data.total_volume)}</span>
          </div>
        </div>

        {/* Category cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {data.categories.map((cat) => (
            <CategoryCard key={cat.key} category={cat} />
          ))}
        </div>

        {/* Source Attribution */}
        <div className="mt-4 flex items-center justify-between text-[10px] font-[family-name:var(--font-mono)] text-text-secondary">
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
