import { useScrollReveal } from '../../hooks/useScrollReveal';
import { usePolymarketSummary } from '../../hooks/usePolymarket';
import { MarketSentimentCard } from '../predictions/MarketSentimentCard';
import { PriceTargetBar } from '../predictions/PriceTargetBar';

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

export function PredictionMarketsSection() {
  const { data, isLoading, isError } = usePolymarketSummary();
  const ref = useScrollReveal();

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <h2 className="editorial-header">What Traders Think</h2>
          <p className="editorial-subhead mb-4">Loading prediction market data...</p>
          <div className="section-rule" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="h-3 w-40 bg-surface rounded animate-pulse mb-1.5" />
                <div className="h-2 w-full bg-surface rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Hide section entirely if API fails or returns no useful data.
  // Polymarket may not always have active oil-price markets — the section
  // auto-appears when markets exist and hides gracefully when they don't.
  if (isError || !data) return null;

  const hasTargets = data.price_targets.length > 0;
  const hasMarkets = data.top_markets_count > 0;

  // Nothing to show — hide section
  if (!hasTargets && !hasMarkets) return null;

  return (
    <section className="py-24 scroll-reveal" ref={ref}>
      <div className="section-reading">
        <h2 className="editorial-header">What Traders Think</h2>
        <p className="editorial-subhead">
          Real-money prediction markets show where traders are putting their bets on oil prices.
          Powered by Polymarket {'\u2014'} the world's largest prediction market.
        </p>
        <div className="section-rule" />

        {/* Sentiment Card */}
        <div className="mt-6">
          <MarketSentimentCard
            sentiment={data.sentiment}
            totalVolume={data.total_volume}
            marketCount={data.top_markets_count}
          />
        </div>

        {/* Price Target Bars */}
        {hasTargets ? (
          <div className="mt-4">
            <h3 className="font-[family-name:var(--font-display)] text-sm tracking-wider uppercase text-text-secondary mb-4">
              Price Target Odds
            </h3>
            <div className="p-4 rounded-lg border border-border" style={{ background: 'rgba(8,14,24,0.6)' }}>
              {data.price_targets.map((pt, i) => (
                <PriceTargetBar key={`${pt.target}-${pt.direction}-${i}`} target={pt} />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 rounded-lg border border-border" style={{ background: 'rgba(8,14,24,0.6)' }}>
            <p className="text-sm text-text-secondary italic">
              No active oil price target markets found on Polymarket.
            </p>
          </div>
        )}

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
          <span>{data.top_markets_count} active markets tracked</span>
        </div>
      </div>
    </section>
  );
}
