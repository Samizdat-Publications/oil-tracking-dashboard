import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { cn, formatCurrency, formatPercent } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: number | null;
  change?: number;
  pctChange?: number;
  prefix?: string;
  suffix?: string;
  loading?: boolean;
  formatAsCurrency?: boolean;
}

export function StatCard({
  label,
  value,
  change,
  pctChange,
  loading = false,
  formatAsCurrency = true,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-text-secondary mb-1">{label}</p>
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-surface" />
        ) : (
          <>
            <p className="text-2xl font-bold text-text-primary">
              {value !== null ? (formatAsCurrency ? formatCurrency(value) : value.toFixed(2)) : '--'}
            </p>
            {change !== undefined && (
              <div className="flex items-center gap-1.5 mt-1">
                {isPositive && <TrendingUp className="h-3.5 w-3.5 text-green" />}
                {isNegative && <TrendingDown className="h-3.5 w-3.5 text-red" />}
                {isNeutral && <Minus className="h-3.5 w-3.5 text-text-secondary" />}
                <span
                  className={cn(
                    'text-xs font-medium',
                    isPositive && 'text-green',
                    isNegative && 'text-red',
                    isNeutral && 'text-text-secondary',
                  )}
                >
                  {formatCurrency(Math.abs(change))}
                </span>
                {pctChange !== undefined && (
                  <span
                    className={cn(
                      'text-xs',
                      isPositive && 'text-green',
                      isNegative && 'text-red',
                      isNeutral && 'text-text-secondary',
                    )}
                  >
                    ({formatPercent(pctChange)})
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
