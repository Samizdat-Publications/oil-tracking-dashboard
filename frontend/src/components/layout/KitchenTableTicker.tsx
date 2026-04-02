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

/** Order of items in the ticker */
const TICKER_ORDER = [
  '_oil', // special key for crude oil
  'gasoline',
  'diesel',
  'natural_gas',
  'airline_fares',
  'eggs_meat',
  'food_at_home',
  'cpi_energy',
  'cpi_all',
];

interface TickerItem {
  icon: string;
  name: string;
  price: string | null;
  changeLabel: string | null;
  changeValue: number | null;
  awaiting: boolean;
}

export function KitchenTableTicker() {
  const { data: downstream, isError } = useDownstream();

  const items: TickerItem[] = useMemo(() => {
    if (!downstream?.oil?.observations?.length) return [];

    const result: TickerItem[] = [];

    for (const key of TICKER_ORDER) {
      if (key === '_oil') {
        // Crude oil — always dollar-priced
        const oil = downstream.oil;
        const latest = oil.observations.at(-1);
        const warBaseline = getValueBeforeDate(oil, IRAN_WAR_DATE);
        const postWar = hasDataAfter(oil, IRAN_WAR_DATE);
        const dollarChange = warBaseline && latest && postWar
          ? latest.value - warBaseline
          : null;

        result.push({
          icon: '\u{1F6E2}\uFE0F',
          name: 'Crude Oil',
          price: latest ? `$${latest.value.toFixed(2)}` : null,
          changeLabel: dollarChange !== null
            ? `${dollarChange >= 0 ? '+' : ''}$${Math.abs(dollarChange).toFixed(2)} since war`
            : null,
          changeValue: dollarChange,
          awaiting: !postWar && warBaseline !== null,
        });
        continue;
      }

      const info = COMMODITY_DATA[key];
      if (!info) continue;

      const ds = downstream.series.find((s) => s.name === info.displayName);
      if (!ds || !ds.observations.length) continue;

      const latest = ds.observations.at(-1);
      const warBaseline = getValueBeforeDate(ds, IRAN_WAR_DATE);
      const postWar = hasDataAfter(ds, IRAN_WAR_DATE);
      const isDollar = DOLLAR_PRICED.has(key);

      let price: string | null = null;
      let changeLabel: string | null = null;
      let changeValue: number | null = null;
      const isAwaiting = !postWar && warBaseline !== null;

      if (latest && isDollar) {
        price = `$${latest.value.toFixed(2)}`;
      }

      if (warBaseline && latest && postWar) {
        const diff = latest.value - warBaseline;
        changeValue = diff;
        if (isDollar) {
          changeLabel = `${diff >= 0 ? '+' : ''}$${Math.abs(diff).toFixed(2)} since war`;
        } else {
          changeLabel = `${diff >= 0 ? '+' : ''}${Math.abs(diff).toFixed(1)} pts since war`;
        }
      }

      result.push({
        icon: info.icon,
        name: info.displayName,
        price,
        changeLabel,
        changeValue,
        awaiting: isAwaiting,
      });
    }

    return result;
  }, [downstream]);

  // Don't render if API failed
  if (isError) return null;

  // Loading skeleton
  if (!items.length) {
    return (
      <div className="ticker-bar">
        <div className="ticker-track" style={{ animation: 'none', padding: '0 24px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="inline-block h-3 rounded animate-pulse"
              style={{ width: `${80 + i * 10}px`, background: 'rgba(0,240,255,0.08)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Render items as a function so we can duplicate for seamless loop
  const renderItems = (keyPrefix: string) =>
    items.map((item, i) => (
      <span key={`${keyPrefix}-${i}`} className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm">{item.icon}</span>
        <span className="font-[family-name:var(--font-mono)] text-xs text-text-secondary">
          {item.name}
        </span>
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
