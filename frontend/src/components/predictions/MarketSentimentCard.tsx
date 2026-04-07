import type { PolymarketCategory } from '../../types';

interface CategoryCardProps {
  category: PolymarketCategory;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/** Color based on probability — high risk = red, medium = orange, low = green */
function riskColor(p: number): string {
  if (p >= 0.5) return '#CC2936';
  if (p >= 0.25) return '#FF8800';
  return '#5DB075';
}

export function CategoryCard({ category }: CategoryCardProps) {
  const highlight = category.highlight;
  const highlightProb = highlight?.yes_probability ?? 0;
  const color = riskColor(highlightProb);

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: 'rgba(8,14,24,0.6)', borderColor: 'rgba(212,160,18,0.06)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{category.icon}</span>
        <span className="font-[family-name:var(--font-display)] text-sm tracking-wider uppercase text-text-primary">
          {category.name}
        </span>
        <span className="ml-auto font-[family-name:var(--font-mono)] text-xs text-text-secondary">
          {formatVolume(category.total_volume)} volume
        </span>
      </div>

      {/* Description */}
      <p className="text-base text-text-secondary mb-3">{category.description}</p>

      {/* Fed distribution special rendering */}
      {category.fed_distribution && category.fed_distribution.length > 0 ? (
        <FedDistribution distribution={category.fed_distribution} />
      ) : null}

      {/* Oil price distribution */}
      {category.oil_price_distribution && category.oil_price_distribution.length > 0 ? (
        <OilPriceDistribution distribution={category.oil_price_distribution} />
      ) : null}

      {/* Market list */}
      <div className="space-y-2">
        {category.markets.map((m) => {
          const pct = m.yes_probability * 100;
          const mColor = riskColor(m.yes_probability);
          return (
            <div key={m.id}>
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-base text-text-primary leading-tight flex-1">
                  {m.source_url ? (
                    <a
                      href={m.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-accent transition-colors"
                    >
                      {m.question}
                    </a>
                  ) : (
                    m.question
                  )}
                </span>
                <span
                  className="font-[family-name:var(--font-mono)] text-sm font-semibold shrink-0"
                  style={{ color: mColor }}
                >
                  {formatPct(m.yes_probability)}
                </span>
              </div>
              {/* Probability bar */}
              <div className="w-full h-1.5 rounded-full" style={{ background: '#0A0E18' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    background: mColor,
                    boxShadow: pct >= 50 ? `0 0 6px ${mColor}40` : 'none',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Visual distribution of oil price target probabilities */
function OilPriceDistribution({ distribution }: { distribution: { price: number; probability: number }[] }) {
  if (!distribution.length) return null;

  const peak = distribution.reduce((a, b) => (b.probability > a.probability ? b : a));

  return (
    <div className="mb-3 p-3 rounded" style={{ background: 'rgba(255,136,0,0.03)' }}>
      <div className="font-[family-name:var(--font-mono)] text-xs text-text-secondary uppercase tracking-wider mb-2">
        Price Target Probability
      </div>
      <div className="flex items-end gap-1" style={{ height: 48 }}>
        {distribution.map((d) => {
          const barHeight = Math.max(d.probability * 100 * 1.5, 3);
          const isPeak = d.price === peak.price;
          return (
            <div key={d.price} className="flex flex-col items-center flex-1 gap-0.5">
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${barHeight}%`,
                  minHeight: 3,
                  background: isPeak ? '#FF8800' : 'rgba(255,136,0,0.2)',
                  boxShadow: isPeak ? '0 0 8px rgba(255,136,0,0.3)' : 'none',
                }}
              />
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">
                ${d.price}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">price target</span>
        <span className="font-[family-name:var(--font-mono)] text-[10px]" style={{ color: '#FF8800' }}>
          Most likely ceiling: ${peak.price} ({(peak.probability * 100).toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

/** Visual distribution of Fed rate cut probabilities */
function FedDistribution({ distribution }: { distribution: { cuts: number; probability: number }[] }) {
  if (!distribution.length) return null;

  // Find the most likely outcome
  const peak = distribution.reduce((a, b) => (b.probability > a.probability ? b : a));

  return (
    <div className="mb-3 p-3 rounded" style={{ background: 'rgba(0,240,255,0.03)' }}>
      <div className="font-[family-name:var(--font-mono)] text-xs text-text-secondary uppercase tracking-wider mb-2">
        Rate Cut Probability Distribution
      </div>
      <div className="flex items-end gap-1" style={{ height: 48 }}>
        {distribution.map((d) => {
          const barHeight = Math.max(d.probability * 100 * 1.5, 3);
          const isPeak = d.cuts === peak.cuts;
          return (
            <div key={d.cuts} className="flex flex-col items-center flex-1 gap-0.5">
              <div
                className="w-full rounded-t transition-all duration-500"
                style={{
                  height: `${barHeight}%`,
                  minHeight: 3,
                  background: isPeak ? '#00F0FF' : 'rgba(0,240,255,0.2)',
                  boxShadow: isPeak ? '0 0 8px rgba(0,240,255,0.3)' : 'none',
                }}
              />
              <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">
                {d.cuts}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">cuts</span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-accent">
          Most likely: {peak.cuts} cut{peak.cuts !== 1 ? 's' : ''} ({(peak.probability * 100).toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}
