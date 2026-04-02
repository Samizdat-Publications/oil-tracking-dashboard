import type { PriceTarget } from '../../types';

interface PriceTargetBarProps {
  target: PriceTarget;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function PriceTargetBar({ target }: PriceTargetBarProps) {
  const pct = Math.round(target.probability * 100);
  const isHigh = pct >= 70;
  const isMedium = pct >= 40;

  // Color based on probability: high = accent cyan, medium = orange, low = text-secondary
  const barColor = isHigh ? '#00F0FF' : isMedium ? '#FF8800' : '#8B95A5';

  return (
    <div className="mb-3 last:mb-0">
      {/* Label row */}
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-mono)] text-sm font-medium text-text-primary">
            {target.direction === 'above' ? '\u2191' : '\u2193'} {target.target}
          </span>
          {target.timeframe && (
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary uppercase tracking-wider">
              by {target.timeframe}
            </span>
          )}
        </div>
        <span
          className="font-[family-name:var(--font-mono)] text-sm font-semibold"
          style={{ color: barColor }}
        >
          {pct}%
        </span>
      </div>

      {/* Bar */}
      <div className="w-full h-2 rounded-full" style={{ background: '#0A0E18' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(pct, 2)}%`,
            background: barColor,
            boxShadow: isHigh ? `0 0 8px ${barColor}40` : 'none',
          }}
        />
      </div>

      {/* Volume */}
      <div className="mt-0.5 text-[10px] font-[family-name:var(--font-mono)] text-text-secondary">
        {formatVolume(target.volume)} volume
      </div>
    </div>
  );
}
