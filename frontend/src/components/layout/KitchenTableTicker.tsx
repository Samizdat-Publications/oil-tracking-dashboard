import { useMemo } from 'react';
import { useTicker } from '../../hooks/useOilPrices';
import type { TickerItem as TickerApiItem } from '../../types';

/** Series keys that have real dollar prices (not CPI index values) */
const DOLLAR_PRICED = new Set(['gasoline', 'diesel', 'natural_gas']);

/** Ticker item definitions — icon/label mapping in display order. */
const TICKER_ITEMS: { key: string; icon: string; name: string }[] = [
  { key: 'wti', icon: '\u{1F6E2}\uFE0F', name: 'Crude Oil' },
  { key: 'gasoline', icon: '\u26FD', name: 'Gasoline' },
  { key: 'diesel', icon: '\u{1F69A}', name: 'Diesel' },
  { key: 'natural_gas', icon: '\u{1F525}', name: 'Natural Gas' },
  { key: 'airline_fares', icon: '\u2708\uFE0F', name: 'Flights' },
  { key: 'eggs_meat', icon: '\u{1F95A}', name: 'Eggs & Meat' },
  { key: 'food_at_home', icon: '\u{1F6D2}', name: 'Groceries' },
  { key: 'cpi_energy', icon: '\u26A1', name: 'Energy CPI' },
  { key: 'cpi_all', icon: '\u{1F4B0}', name: 'CPI All Items' },
];

interface DisplayItem {
  icon: string;
  name: string;
  price: string | null;
  changeLabel: string | null;
  changeValue: number | null;
  awaiting: boolean;
}

function computeDisplay(key: string, api: TickerApiItem | undefined): Omit<DisplayItem, 'icon' | 'name'> {
  const none = { price: null, changeLabel: null, changeValue: null, awaiting: false };
  if (!api || api.latest_value === null) return none;

  const isDollar = DOLLAR_PRICED.has(key) || key === 'wti';
  const price = isDollar ? `$${api.latest_value.toFixed(2)}` : null;

  if (api.war_baseline === null) {
    return { price, changeLabel: null, changeValue: null, awaiting: false };
  }

  if (!api.has_post_war_data) {
    return { price, changeLabel: null, changeValue: null, awaiting: true };
  }

  const diff = api.latest_value - api.war_baseline;
  const changeLabel = isDollar
    ? `${diff >= 0 ? '+' : ''}$${Math.abs(diff).toFixed(2)} since war`
    : `${diff >= 0 ? '+' : ''}${Math.abs(diff).toFixed(1)} pts since war`;

  return { price, changeLabel, changeValue: diff, awaiting: false };
}

export function KitchenTableTicker() {
  const { data: ticker, isError } = useTicker();

  const items: DisplayItem[] = useMemo(() => {
    const byKey = new Map<string, TickerApiItem>();
    for (const it of ticker?.items ?? []) byKey.set(it.key, it);
    return TICKER_ITEMS.map(({ key, icon, name }) => ({
      icon,
      name,
      ...computeDisplay(key, byKey.get(key)),
    }));
  }, [ticker]);

  if (isError) return null;

  const isLoading = !ticker;

  const renderItems = (keyPrefix: string) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="flex items-center gap-2 shrink-0">
        <span className="text-base">{item.icon}</span>
        <span className="font-[family-name:var(--font-mono)] text-sm text-text-secondary">
          {item.name}
        </span>
        {isLoading ? (
          <span
            className="inline-block h-4 w-20 rounded skeleton-shimmer"
            style={{ background: 'rgba(212,160,18,0.06)' }}
          />
        ) : (
          <>
            {item.price && (
              <strong className="font-[family-name:var(--font-mono)] text-sm text-text-primary">
                {item.price}
              </strong>
            )}
            {item.awaiting ? (
              <span className="font-[family-name:var(--font-mono)] text-sm text-text-secondary italic">
                awaiting data
              </span>
            ) : item.changeLabel ? (
              <span
                className="font-[family-name:var(--font-mono)] text-sm font-semibold"
                style={{ color: item.changeValue !== null && item.changeValue >= 0 ? '#CC2936' : '#5DB075' }}
              >
                {item.changeLabel}
              </span>
            ) : null}
          </>
        )}
        {i < items.length - 1 && <span className="text-border-hover mx-4">|</span>}
      </span>
    ));

  return (
    <div className="ticker-bar">
      <div className="ticker-track">
        {/* Two copies for seamless loop */}
        {renderItems('a')}
        {renderItems('b')}
      </div>
    </div>
  );
}
