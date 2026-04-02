import type { MarketSentiment } from '../../types';

interface MarketSentimentCardProps {
  sentiment: MarketSentiment;
  totalVolume: number;
  marketCount: number;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const DIRECTION_CONFIG = {
  bullish: {
    icon: '\u2191', // ↑
    label: 'Bullish',
    color: '#00FF88',
    bg: 'rgba(0, 255, 136, 0.06)',
    border: 'rgba(0, 255, 136, 0.15)',
  },
  bearish: {
    icon: '\u2193', // ↓
    label: 'Bearish',
    color: '#FF3366',
    bg: 'rgba(255, 51, 102, 0.06)',
    border: 'rgba(255, 51, 102, 0.15)',
  },
  neutral: {
    icon: '\u2194', // ↔
    label: 'Neutral',
    color: '#8B95A5',
    bg: 'rgba(139, 149, 165, 0.06)',
    border: 'rgba(139, 149, 165, 0.15)',
  },
};

export function MarketSentimentCard({ sentiment, totalVolume, marketCount }: MarketSentimentCardProps) {
  const config = DIRECTION_CONFIG[sentiment.direction] || DIRECTION_CONFIG.neutral;

  return (
    <div
      className="rounded-lg p-5 mb-6"
      style={{ background: config.bg, border: `1px solid ${config.border}` }}
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Direction indicator */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-lg text-2xl font-bold"
            style={{ color: config.color, background: 'rgba(0,0,0,0.3)' }}
          >
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="font-[family-name:var(--font-display)] text-lg tracking-wider uppercase"
                style={{ color: config.color }}
              >
                {config.label}
              </span>
              <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary">
                {(sentiment.confidence * 100).toFixed(0)}% confidence
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-0.5">
              {sentiment.description}
            </p>
          </div>
        </div>

        {/* Volume badges */}
        <div className="flex gap-4 text-xs font-[family-name:var(--font-mono)]">
          <div className="text-center">
            <div className="text-text-secondary uppercase tracking-wider text-[10px]">Volume</div>
            <div className="text-text-primary font-medium">{formatVolume(totalVolume)}</div>
          </div>
          <div className="text-center">
            <div className="text-text-secondary uppercase tracking-wider text-[10px]">Markets</div>
            <div className="text-text-primary font-medium">{marketCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
