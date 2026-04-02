import { useMemo } from 'react';
import { useDownstream } from '../../hooks/useOilPrices';
import {
  COMMODITY_DATA,
  IRAN_WAR_DATE,
  getValueBeforeDate,
  hasDataAfter,
} from '../../lib/commodity-data';

/** Series keys that have real dollar prices (not CPI index values) */
const DOLLAR_PRICED = new Set(['gasoline', 'diesel', 'natural_gas']);

/** Ticker item definitions — known at build time, no API needed */
const TICKER_ITEMS: { key: string; icon: string; name: string }[] = [
  { key: '_oil', icon: '\u{1F6E2}\uFE0F', name: 'Crude Oil' },
  { key: 'gasoline', icon: '\u26FD', name: 'Gasoline' },
  { key: 'diesel', icon: '\u{1F69A}', name: 'Diesel' },
  { key: 'natural_gas', icon: '\u{1F525}', name: 'Natural Gas' },
  { key: 'airline_fares', icon: '\u2708\uFE0F', name: 'Flights' },
  { key: 'eggs_meat', icon: '\u{1F95A}', name: 'Eggs & Meat' },
  { key: 'food_at_home', icon: '\u{1F6D2}', name: 'Groceries' },
  { key: 'cpi_energy', icon: '\u26A1', name: 'Energy CPI' },
  { key: 'cpi_all', icon: '\u{1F4B0}', name: 'CPI All Items' },
];

interface TickerItem {
  icon: string;
  name: string;
  price: string | null;
  changeLabel: string | null;
  changeValue: number | null;
  awaiting: boolean;
}

/** Compute price data for a single ticker item from downstream API response */
function computePriceData(
  key: string,
  downstream: { oil: import('../../types').PriceSeries; series: import('../../types').PriceSeries[] } | undefined,
): Pick<TickerItem, 'price' | 'changeLabel' | 'changeValue' | 'awaiting'> {
  const none = { price: null, changeLabel: null, changeValue: null, awaiting: false };
  if (!downstream) return none;

  if (key === '_oil') {
    const oil = downstream.oil;
    if (!oil?.observations?.length) return none;
    const latest = oil.observations.at(-1)!;
    const warBaseline = getValueBeforeDate(oil, IRAN_WAR_DATE);
    const postWar = hasDataAfter(oil, IRAN_WAR_DATE);
    const dollarChange = warBaseline && postWar ? latest.value - warBaseline : null;
    return {
      price: `$${latest.value.toFixed(2)}`,
      changeLabel: dollarChange !== null
        ? `${dollarChange >= 0 ? '+' : ''}$${Math.abs(dollarChange).toFixed(2)} since war`
        : null,
      changeValue: dollarChange,
      awaiting: !postWar && warBaseline !== null,
    };
  }

  const info = COMMODITY_DATA[key];
  if (!info) return none;
  const ds = downstream.series.find((s) => s.name === info.displayName);
  if (!ds?.observations?.length) return none;

  const latest = ds.observations.at(-1)!;
  const warBaseline = getValueBeforeDate(ds, IRAN_WAR_DATE);
  const postWar = hasDataAfter(ds, IRAN_WAR_DATE);
  const isDollar = DOLLAR_PRICED.has(key);

  let price: string | null = null;
  let changeLabel: string | null = null;
  let changeValue: number | null = null;

  if (isDollar) price = `$${latest.value.toFixed(2)}`;

  if (warBaseline && postWar) {
    const diff = latest.value - warBaseline;
    changeValue = diff;
    changeLabel = isDollar
      ? `${diff >= 0 ? '+' : ''}$${Math.abs(diff).toFixed(2)} since war`
      : `${diff >= 0 ? '+' : ''}${Math.abs(diff).toFixed(1)} pts since war`;
  }

  return { price, changeLabel, changeValue, awaiting: !postWar && warBaseline !== null };
}

export function KitchenTableTicker() {
  const { data: downstream, isError } = useDownstream();

  // Build ticker items — names/icons are always available, prices fill in when data loads
  const items: TickerItem[] = useMemo(() => {
    return TICKER_ITEMS.map(({ key, icon, name }) => ({
      icon,
      name,
      ...computePriceData(key, downstream),
    }));
  }, [downstream]);

  // Don't render if API failed
  if (isError) return null;

  const isLoading = !downstream;

  // Render items — always scrolling, prices shimmer while loading
  const renderItems = (keyPrefix: string) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm">{item.icon}</span>
        <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary">
          {item.name}
        </span>
        {isLoading ? (
          <span
            className="inline-block h-3 w-16 rounded skeleton-shimmer"
            style={{ background: 'rgba(0,240,255,0.06)' }}
          />
        ) : (
          <>
            {item.price && (
              <strong className="font-[family-name:var(--font-mono)] text-xs text-text-primary">
                {item.price}
              </strong>
            )}
            {item.awaiting ? (
              <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary italic">
                awaiting data
              </span>
            ) : item.changeLabel ? (
              <span
                className="font-[family-name:var(--font-mono)] text-xs font-semibold"
                style={{ color: item.changeValue !== null && item.changeValue >= 0 ? '#FF3366' : '#00FF88' }}
              >
                {item.changeLabel}
              </span>
            ) : null}
          </>
        )}
        {i < items.length - 1 && (
          <span className="text-border-hover mx-3">|</span>
        )}
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
