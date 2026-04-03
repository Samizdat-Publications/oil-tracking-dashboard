import type { PriceSeries } from '../types';

export const IRAN_WAR_DATE = '2026-02-28';

export interface CommodityInfo {
  icon: string;
  why: string;
  detail: string;
  displayName: string;
}

// Keyed by backend series ID (matching fred_client.py SERIES_IDS keys)
export const COMMODITY_DATA: Record<string, CommodityInfo> = {
  diesel: {
    displayName: 'US Diesel Prices',
    icon: '\u{1F69A}',
    why: 'Every product you buy was delivered by a diesel truck. Higher diesel = higher prices on shelves.',
    detail: 'Diesel fuels the freight industry. Every product on a shelf arrived by diesel truck. A 10% increase in diesel prices adds roughly 2-3% to retail goods costs across the board.',
  },
  gasoline: {
    displayName: 'Gasoline (Regular)',
    icon: '\u26FD',
    why: 'Directly tied to crude oil. What you pay at the pump moves within days of oil price changes.',
    detail: 'Gasoline is the most direct downstream product of crude oil. Refining margins and crude costs make up roughly 55% of what you pay at the pump. When oil spikes due to geopolitical events, gas prices follow within days.',
  },
  food_at_home: {
    displayName: 'Groceries (Food at Home)',
    icon: '\u{1F6D2}',
    why: 'Food requires fuel to grow, process, refrigerate, and ship. Oil touches every step of the supply chain.',
    detail: 'The average grocery item travels 1,500 miles from farm to store. Oil costs are embedded in farming, processing, packaging (plastic), refrigeration, and transportation. A sustained $20 oil increase typically adds 3-5% to grocery bills over 6 months.',
  },
  eggs_meat: {
    displayName: 'Eggs, Meat & Poultry',
    icon: '\u{1F95A}',
    why: 'Feed prices, farm equipment fuel, refrigerated transport \u2014 all driven by energy costs.',
    detail: 'The egg on your plate is touched by oil at every stage: fuel for tractors growing feed corn, energy for processing plants, diesel for refrigerated trucks, and electricity for cold storage at the store.',
  },
  natural_gas: {
    displayName: 'Natural Gas',
    icon: '\u{1F525}',
    why: 'Heating your home, generating electricity, and making fertilizer all depend on natural gas prices.',
    detail: 'Natural gas powers home heating, electricity generation, and is the primary feedstock for nitrogen fertilizer. While not directly derived from crude oil, natural gas prices often move in tandem with oil due to shared energy market dynamics.',
  },
  fertilizer: {
    displayName: 'Fertilizer Price Index',
    icon: '\u{1F33E}',
    why: 'Natural gas is the #1 input for nitrogen fertilizer. Expensive energy = expensive food production.',
    detail: 'Nitrogen fertilizer is manufactured using the Haber-Bosch process, which requires enormous amounts of natural gas. When energy prices rise, fertilizer costs spike, raising the cost of growing every crop from corn to wheat.',
  },
  cpi_energy: {
    displayName: 'CPI Energy',
    icon: '\u26A1',
    why: "The government's measure of what households pay for all energy \u2014 gas, electricity, heating.",
    detail: 'The Consumer Price Index for Energy tracks what households pay for gasoline, electricity, natural gas, and heating oil. It is the most direct measure of how energy costs hit family budgets.',
  },
  airline_fares: {
    displayName: 'Airline Fares CPI',
    icon: '\u2708\uFE0F',
    why: 'Jet fuel is 20-30% of airline costs. Oil spikes hit ticket prices within weeks.',
    detail: 'Jet fuel makes up 20-30% of airline operating costs. Airlines use hedging strategies, but sustained oil price increases inevitably flow through to ticket prices within 4-8 weeks.',
  },
  cpi_all: {
    displayName: 'CPI All Items',
    icon: '\u{1F4B0}',
    why: 'Overall inflation. Oil is embedded in the cost of producing and transporting virtually everything.',
    detail: 'The broadest measure of consumer inflation. Oil price changes ripple through every sector of the economy because energy is an input to producing and transporting virtually all goods and services.',
  },
  food_index: {
    displayName: 'Global Food Price Index',
    icon: '\u{1F30D}',
    why: 'From tractors to cargo ships to processing plants \u2014 global food production runs on oil.',
    detail: 'The FAO Global Food Price Index captures worldwide food commodity prices. Oil affects food costs globally through farming mechanization, international shipping, food processing, and fertilizer production.',
  },
  cotton: {
    displayName: 'Cotton Price Index',
    icon: '\u{1F455}',
    why: 'Cotton farming, processing, and global shipping are all energy-intensive operations.',
    detail: 'Cotton requires fuel-intensive farming (irrigation, harvesting machines), energy-heavy processing (ginning, spinning), and global shipping. Synthetic fiber alternatives are also petroleum-derived, so oil affects both sides.',
  },
  aluminum: {
    displayName: 'Aluminum Price Index',
    icon: '\u{1F6E0}\uFE0F',
    why: 'Smelting aluminum uses massive amounts of electricity. Energy costs are ~40% of production.',
    detail: 'Aluminum smelting consumes roughly 15,000 kWh per ton. Energy costs represent about 40% of production costs. When energy markets tighten, aluminum prices follow.',
  },
  plastics: {
    displayName: 'Plastics Price Index',
    icon: '\u{1F4E6}',
    why: 'Crude oil IS the raw material for plastics. Packaging, containers, everything plastic.',
    detail: 'Crude oil is literally the raw material for plastics. Ethylene and propylene, derived from oil refining, are the building blocks of packaging, containers, auto parts, and countless consumer products.',
  },
};

/** Look up commodity info by display name (for DownstreamSection backward compat) */
export function getContextByDisplayName(name: string): { icon: string; why: string } | undefined {
  for (const info of Object.values(COMMODITY_DATA)) {
    if (info.displayName === name) return { icon: info.icon, why: info.why };
  }
  return undefined;
}

export interface CommodityCategory {
  key: string;
  icon: string;
  name: string;
  series: string[]; // keys into COMMODITY_DATA
}

export const COMMODITY_CATEGORIES: CommodityCategory[] = [
  { key: 'transportation', icon: '\u{1F69A}', name: 'Transportation', series: ['gasoline', 'diesel', 'airline_fares'] },
  { key: 'food', icon: '\u{1F33E}', name: 'Food & Agriculture', series: ['fertilizer', 'eggs_meat', 'food_at_home', 'natural_gas', 'food_index'] },
  { key: 'materials', icon: '\u{1F3ED}', name: 'Materials & Energy', series: ['plastics', 'aluminum', 'cpi_energy', 'cotton', 'cpi_all'] },
];

export function computeCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 0 ? num / den : 0;
}

export function alignSeries(oil: PriceSeries, ds: PriceSeries) {
  const oilDates: string[] = [];
  const oilVals: number[] = [];
  const dsVals: number[] = [];
  if (ds.observations.length > 0 && oil.observations.length > 0) {
    if (ds.observations.length < oil.observations.length / 5) {
      for (const dp of ds.observations) {
        let bestOil: number | null = null;
        let bestDist = Infinity;
        for (const op of oil.observations) {
          const dist = Math.abs(new Date(op.date).getTime() - new Date(dp.date).getTime());
          if (dist < bestDist) { bestDist = dist; bestOil = op.value; }
        }
        if (bestOil !== null) { oilDates.push(dp.date); oilVals.push(bestOil); dsVals.push(dp.value); }
      }
    } else {
      const dsMap = new Map<string, number>();
      for (const p of ds.observations) dsMap.set(p.date, p.value);
      for (const op of oil.observations) {
        const dsVal = dsMap.get(op.date);
        if (dsVal !== undefined) { oilDates.push(op.date); oilVals.push(op.value); dsVals.push(dsVal); }
      }
    }
  }
  return { dates: oilDates, oilValues: oilVals, dsValues: dsVals };
}

/** Find the last value ON or BEFORE a target date */
export function getValueBeforeDate(series: PriceSeries, targetDate: string): number | null {
  if (!series.observations.length) return null;
  const target = new Date(targetDate).getTime();
  let best: { date: string; value: number } | null = null;
  for (const obs of series.observations) {
    const obsTime = new Date(obs.date).getTime();
    if (obsTime <= target) best = obs;
  }
  if (!best) return null;
  const dist = target - new Date(best.date).getTime();
  if (dist > 90 * 24 * 60 * 60 * 1000) return null;
  return best.value;
}

/** Check if a series has any observations AFTER a target date */
export function hasDataAfter(series: PriceSeries, targetDate: string): boolean {
  const target = new Date(targetDate).getTime();
  return series.observations.some(obs => new Date(obs.date).getTime() > target);
}
