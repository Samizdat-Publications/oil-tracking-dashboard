# Supply Chain Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated Supply Chain Flow section showing oil price impacts on downstream consumer goods, with slide-out detail panels, plus fix the date range bug.

**Architecture:** Extract shared commodity data/utilities from DownstreamSection into a new `commodity-data.ts` module. Build 5 new components (OilSourceNode, FlowConnector, BranchGrid, CommodityDetailPanel, SupplyChainSection) that consume the existing `useDownstream()` hook data. Fix date range by wiring existing props into `useOilPrices()` call.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Zustand, Plotly.js, Vite

**Spec:** `docs/superpowers/specs/2026-04-01-supply-chain-flow-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/lib/commodity-data.ts` | Create | Shared constants, utility functions, category groupings |
| `frontend/src/components/supply-chain/FlowConnector.tsx` | Create | Pure CSS animated connector |
| `frontend/src/components/supply-chain/OilSourceNode.tsx` | Create | Oil barrel source card with sparkline |
| `frontend/src/components/supply-chain/BranchGrid.tsx` | Create | 3-column category grid with clickable items |
| `frontend/src/components/supply-chain/CommodityDetailPanel.tsx` | Create | Slide-out panel with stats + Plotly chart |
| `frontend/src/components/sections/SupplyChainSection.tsx` | Create | Section orchestrator |
| `frontend/src/index.css` | Modify | Add `flowDown` keyframe animation |
| `frontend/src/stores/dashboardStore.ts` | Modify | Add supply chain panel state + date range default fix (both in Task 2) |
| `frontend/src/hooks/useOilPrices.ts` | Modify | Add `useOilSparkline()` hook |
| `frontend/src/components/sections/DownstreamSection.tsx` | Modify | Import from shared `commodity-data.ts` |
| `frontend/src/App.tsx` | Modify | Insert SupplyChainSection |
| `frontend/src/components/charts/HeroFanChart.tsx` | Modify | Date range fix (one line) |
| `frontend/src/App.tsx` | Modify | Also render CommodityDetailPanel at app level (not inside section) |

---

### Task 1: Extract shared commodity data

**Files:**
- Create: `frontend/src/lib/commodity-data.ts`
- Modify: `frontend/src/components/sections/DownstreamSection.tsx`

- [ ] **Step 1: Create `commodity-data.ts` with extracted constants and utilities**

Create `frontend/src/lib/commodity-data.ts` with:

```typescript
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
```

- [ ] **Step 2: Update DownstreamSection to import from shared module**

In `frontend/src/components/sections/DownstreamSection.tsx`:

Replace the top of the file — remove the local `IRAN_WAR_DATE`, `COMMODITY_CONTEXT`, `computeCorrelation`, `alignSeries`, and `getValueBeforeDate` definitions. Replace with imports:

```typescript
import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useDownstream } from '../../hooks/useOilPrices';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  IRAN_WAR_DATE,
  computeCorrelation,
  alignSeries,
  getValueBeforeDate,
  getContextByDisplayName,
} from '../../lib/commodity-data';
import type { PriceSeries } from '../../types';
```

In the `panels` useMemo, change the context lookup from:
```typescript
const context = COMMODITY_CONTEXT[ds.name] || { icon: '\u{1F4C8}', why: 'Tracks the relationship...' };
```
to:
```typescript
const context = getContextByDisplayName(ds.name) || { icon: '\u{1F4C8}', why: 'Tracks the relationship between crude oil and this indicator.' };
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/commodity-data.ts frontend/src/components/sections/DownstreamSection.tsx
git commit -m "refactor: extract shared commodity data and utilities to commodity-data.ts"
```

---

### Task 2: Add CSS animation and store state

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/stores/dashboardStore.ts`
- Modify: `frontend/src/hooks/useOilPrices.ts`

- [ ] **Step 1: Add `flowDown` keyframe to `index.css`**

After the existing `@keyframes countTick` block (around line 103), add:

```css
@keyframes flowDown {
  0% { top: -4px; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
```

And after the `.animate-count-tick` class (around line 131), add:

```css
.animate-flow-down {
  animation: flowDown 1.8s linear infinite;
}
```

- [ ] **Step 2: Add supply chain panel state to Zustand store**

In `frontend/src/stores/dashboardStore.ts`, add to the `DashboardState` interface (after `showEras` / `toggleEras`):

```typescript
  supplyChainPanelOpen: boolean;
  selectedCommodityKey: string | null;
  openCommodityPanel: (key: string) => void;
  closeCommodityPanel: () => void;
```

And in the `create<DashboardState>` body, add:

```typescript
  supplyChainPanelOpen: false,
  selectedCommodityKey: null,
  openCommodityPanel: (key) => set({ supplyChainPanelOpen: true, selectedCommodityKey: key }),
  closeCommodityPanel: () => set({ supplyChainPanelOpen: false, selectedCommodityKey: null }),
```

**Also apply date range fixes in the same file** (to avoid split store edits):

Change line 17 from `case 'ALL': return undefined;` to:
```typescript
    case 'ALL': return '1986-01-01';
```

Change line 54-55 defaults from `'2Y'` to `'ALL'`:
```typescript
  dateRangePreset: 'ALL',
  dateRangeStart: getStartDate('ALL'),
```

- [ ] **Step 3: Add `useOilSparkline` hook**

In `frontend/src/hooks/useOilPrices.ts`, add after the existing `useDownstream` function:

```typescript
export function useOilSparkline(series: string = 'wti') {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const startStr = start.toISOString().split('T')[0];

  return useQuery<PriceSeries>({
    queryKey: ['sparkline', series, startStr],
    queryFn: () => fetchPrices(series, startStr),
    staleTime: 30 * 60 * 1000, // 30 min — sparkline doesn't need to be super fresh
    retry: 1,
  });
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/index.css frontend/src/stores/dashboardStore.ts frontend/src/hooks/useOilPrices.ts
git commit -m "feat: add flow animation, store state, and sparkline hook for supply chain"
```

---

### Task 3: Build FlowConnector component

**Files:**
- Create: `frontend/src/components/supply-chain/FlowConnector.tsx`

- [ ] **Step 1: Create `FlowConnector.tsx`**

```typescript
export function FlowConnector() {
  return (
    <div className="relative h-[60px] flex items-center justify-center">
      {/* Vertical trunk */}
      <div
        className="absolute top-0 bottom-0 left-1/2 w-[2px]"
        style={{ background: 'linear-gradient(to bottom, rgba(0,240,255,0.4), rgba(0,240,255,0.1))' }}
      />

      {/* Animated particles */}
      <div className="absolute top-0 left-1/2 w-[2px] h-full overflow-hidden">
        {[0, 0.6, 1.2].map((delay) => (
          <div
            key={delay}
            className="absolute w-1 h-1 -left-[1px] rounded-full bg-accent animate-flow-down"
            style={{
              boxShadow: '0 0 8px #00F0FF',
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      {/* Label */}
      <span className="relative z-[2] bg-background px-3 font-[family-name:var(--font-mono)] text-[9px] tracking-[0.12em] uppercase text-text-secondary">
        price pressure flows downstream
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/supply-chain/FlowConnector.tsx
git commit -m "feat: add FlowConnector animated particle component"
```

---

### Task 4: Build OilSourceNode component

**Files:**
- Create: `frontend/src/components/supply-chain/OilSourceNode.tsx`

- [ ] **Step 1: Create `OilSourceNode.tsx`**

```typescript
import { useMemo } from 'react';
import { useOilSparkline } from '../../hooks/useOilPrices';
import { IRAN_WAR_DATE, getValueBeforeDate } from '../../lib/commodity-data';
import type { PriceSeries } from '../../types';

interface OilSourceNodeProps {
  oilData: PriceSeries;
}

export function OilSourceNode({ oilData }: OilSourceNodeProps) {
  const { data: sparkData } = useOilSparkline('wti');

  const latest = oilData.observations.at(-1);
  const warBaseline = getValueBeforeDate(oilData, IRAN_WAR_DATE);
  const sinceWarPct = warBaseline && latest
    ? ((latest.value - warBaseline) / warBaseline) * 100
    : null;

  // Build SVG sparkline points
  const sparkPoints = useMemo(() => {
    if (!sparkData?.observations?.length) return '';
    const obs = sparkData.observations;
    const vals = obs.map((o) => o.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    return obs
      .map((o, i) => {
        const x = (i / (obs.length - 1)) * 120;
        const y = 28 - ((o.value - min) / range) * 26;
        return `${x},${y}`;
      })
      .join(' ');
  }, [sparkData]);

  if (!latest) return null;

  return (
    <div className="relative flex items-center gap-5 p-5 rounded-[10px] border border-border-active overflow-hidden"
      style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.06), rgba(0,240,255,0.02))' }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, #00F0FF, rgba(0,240,255,0.1))' }}
      />

      <span className="text-[44px] shrink-0">{'\u{1F6E2}\uFE0F'}</span>

      <div className="flex-1">
        <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.15em] uppercase text-accent mb-0.5">
          Source
        </div>
        <div className="font-[family-name:var(--font-display)] text-2xl tracking-[0.05em] text-text-primary">
          WTI CRUDE OIL
        </div>
        <div className="flex items-baseline gap-3 mt-0.5">
          <span className="font-[family-name:var(--font-mono)] text-[32px] font-bold text-text-primary">
            ${latest.value.toFixed(2)}
          </span>
          {sinceWarPct !== null && (
            <span className={`font-[family-name:var(--font-mono)] text-sm font-semibold ${sinceWarPct >= 0 ? 'text-red' : 'text-green'}`}>
              {sinceWarPct >= 0 ? '\u2191' : '\u2193'} {sinceWarPct >= 0 ? '+' : ''}{sinceWarPct.toFixed(1)}% since Iran War
            </span>
          )}
        </div>
        <div className="font-[family-name:var(--font-mono)] text-[11px] text-text-secondary mt-0.5">
          {new Date(latest.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Sparkline */}
      {sparkPoints && (
        <div className="w-[140px] h-12 rounded-md border border-border bg-[rgba(0,240,255,0.03)] relative shrink-0">
          <span className="absolute top-1 right-1.5 font-[family-name:var(--font-mono)] text-[8px] text-text-secondary uppercase tracking-[0.1em]">
            1Y
          </span>
          <svg viewBox="0 0 120 30" className="absolute bottom-1.5 left-2 right-2 h-7 w-[calc(100%-16px)]">
            <polyline
              points={sparkPoints}
              fill="none"
              stroke="#00F0FF"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/supply-chain/OilSourceNode.tsx
git commit -m "feat: add OilSourceNode with sparkline and war-change badge"
```

---

### Task 5: Build BranchGrid component

**Files:**
- Create: `frontend/src/components/supply-chain/BranchGrid.tsx`

- [ ] **Step 1: Create `BranchGrid.tsx`**

```typescript
import { useDashboardStore } from '../../stores/dashboardStore';
import { COMMODITY_CATEGORIES, COMMODITY_DATA } from '../../lib/commodity-data';

export interface DownstreamItemData {
  seriesKey: string;
  displayName: string;
  icon: string;
  why: string;
  changePct: number | null;
  correlation: number;
}

interface BranchGridProps {
  items: DownstreamItemData[];
}

function CorrelationLabel({ r }: { r: number }) {
  const abs = Math.abs(r);
  if (abs > 0.7) return <span className="text-green">r={r.toFixed(2)}</span>;
  if (abs > 0.4) return <span className="text-accent">r={r.toFixed(2)}</span>;
  return <span className="text-text-secondary">r={r.toFixed(2)}</span>;
}

export function BranchGrid({ items }: BranchGridProps) {
  const openPanel = useDashboardStore((s) => s.openCommodityPanel);

  const itemMap = new Map(items.map((it) => [it.seriesKey, it]));

  return (
    <div className="relative">
      {/* Horizontal connector */}
      <div
        className="absolute top-0 h-[1px]"
        style={{
          left: 'calc(16.67%)',
          right: 'calc(16.67%)',
          background: 'linear-gradient(90deg, rgba(0,240,255,0.05), rgba(0,240,255,0.15), rgba(0,240,255,0.05))',
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COMMODITY_CATEGORIES.map((cat) => (
          <div key={cat.key} className="relative pt-6">
            {/* Vertical stub from horizontal line */}
            <div className="absolute top-0 left-1/2 w-[1px] h-6 bg-border-hover hidden md:block" />

            {/* Category header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <span className="text-lg">{cat.icon}</span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-accent">
                {cat.name}
              </span>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-1.5">
              {cat.series.map((seriesKey) => {
                const item = itemMap.get(seriesKey);
                if (!item) return null;
                return (
                  <button
                    key={seriesKey}
                    onClick={() => openPanel(seriesKey)}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-md bg-card-solid border border-border text-left transition-all duration-200 hover:border-border-hover hover:bg-[#0E1528] hover:translate-x-1 relative overflow-hidden"
                  >
                    {/* Left accent on hover */}
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent transition-all duration-200 group-hover:bg-accent group-hover:shadow-[0_0_8px_rgba(0,240,255,0.3)]" />

                    <span className="text-[22px] shrink-0">{item.icon}</span>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-text-primary">{item.displayName}</div>
                      <div className="text-[10px] text-text-secondary truncate">{item.why}</div>
                    </div>

                    <div className="text-right shrink-0">
                      {item.changePct !== null && (
                        <div className={`font-[family-name:var(--font-mono)] text-sm font-bold ${item.changePct >= 0 ? 'text-red' : 'text-green'}`}>
                          {item.changePct >= 0 ? '\u2191' : '\u2193'} {Math.abs(item.changePct).toFixed(1)}%
                        </div>
                      )}
                      <div className="font-[family-name:var(--font-mono)] text-[9px] text-text-secondary mt-0.5">
                        <CorrelationLabel r={item.correlation} />
                      </div>
                    </div>

                    {/* Arrow */}
                    <span className="text-sm text-accent/40 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
                      {'\u203A'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/supply-chain/BranchGrid.tsx
git commit -m "feat: add BranchGrid with category columns and clickable items"
```

---

### Task 6: Build CommodityDetailPanel

**Files:**
- Create: `frontend/src/components/supply-chain/CommodityDetailPanel.tsx`

- [ ] **Step 1: Create `CommodityDetailPanel.tsx`**

```typescript
import { useEffect, useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useDownstream } from '../../hooks/useOilPrices';
import {
  COMMODITY_DATA,
  IRAN_WAR_DATE,
  alignSeries,
  computeCorrelation,
  getValueBeforeDate,
} from '../../lib/commodity-data';

export function CommodityDetailPanel() {
  const isOpen = useDashboardStore((s) => s.supplyChainPanelOpen);
  const commodityKey = useDashboardStore((s) => s.selectedCommodityKey);
  const closePanel = useDashboardStore((s) => s.closeCommodityPanel);
  const { data: downstream } = useDownstream();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closePanel]);

  const info = commodityKey ? COMMODITY_DATA[commodityKey] : null;

  const panelData = useMemo(() => {
    if (!info || !downstream?.oil || !commodityKey) return null;

    const ds = downstream.series.find((s) => s.name === info.displayName);
    if (!ds) return null;

    const aligned = alignSeries(downstream.oil, ds);
    const corr = computeCorrelation(aligned.oilValues, aligned.dsValues);
    const warBaseline = getValueBeforeDate(ds, IRAN_WAR_DATE);
    const latestVal = ds.observations.at(-1)?.value ?? null;
    const sinceWarPct = warBaseline && latestVal ? ((latestVal - warBaseline) / warBaseline) * 100 : null;

    // Format price
    let priceStr = latestVal !== null ? latestVal.toFixed(2) : 'N/A';
    if (['gasoline', 'diesel', 'natural_gas'].includes(commodityKey) && latestVal !== null) {
      priceStr = '$' + latestVal.toFixed(2);
    } else if (latestVal !== null) {
      priceStr = 'Index ' + latestVal.toFixed(1);
    }

    return { ds, aligned, corr, sinceWarPct, latestVal, priceStr };
  }, [info, downstream, commodityKey]);

  const corrLabel = panelData ? (Math.abs(panelData.corr) > 0.7 ? 'Strong' : Math.abs(panelData.corr) > 0.4 ? 'Moderate' : 'Weak') : '';
  const corrColor = panelData ? (Math.abs(panelData.corr) > 0.7 ? '#00FF88' : Math.abs(panelData.corr) > 0.4 ? '#00F0FF' : '#4A5568') : '#4A5568';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(4,6,12,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 bottom-0 w-[520px] z-[101] bg-surface border-l border-border overflow-y-auto transition-[right] duration-[350ms] ${isOpen ? 'right-0' : '-right-[520px]'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' }}
      >
        {/* Close button */}
        <button
          onClick={closePanel}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded bg-accent-glow border border-border-hover text-text-secondary hover:text-text-primary hover:bg-[rgba(0,240,255,0.12)] transition-all z-10"
        >
          {'\u2715'}
        </button>

        {info && panelData && (
          <>
            {/* Header */}
            <div className="p-6 pb-4 border-b border-border">
              <span className="text-4xl block mb-2">{info.icon}</span>
              <div className="font-[family-name:var(--font-display)] text-[28px] tracking-[0.05em] text-text-primary">
                {info.displayName}
              </div>
              <div className="text-sm text-text-secondary mt-1.5 leading-relaxed">{info.why}</div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
              <div className="text-center p-3 rounded-md bg-accent-glow">
                <div className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.1em] uppercase text-text-secondary mb-1">Current Price</div>
                <div className="font-[family-name:var(--font-mono)] text-xl font-bold text-text-primary">{panelData.priceStr}</div>
              </div>
              <div className="text-center p-3 rounded-md bg-accent-glow">
                <div className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.1em] uppercase text-text-secondary mb-1">Since Iran War</div>
                <div className="font-[family-name:var(--font-mono)] text-xl font-bold" style={{ color: panelData.sinceWarPct !== null && panelData.sinceWarPct >= 0 ? '#FF3366' : '#00FF88' }}>
                  {panelData.sinceWarPct !== null ? `${panelData.sinceWarPct >= 0 ? '\u2191' : '\u2193'}${Math.abs(panelData.sinceWarPct).toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div className="text-center p-3 rounded-md bg-accent-glow">
                <div className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.1em] uppercase text-text-secondary mb-1">Correlation</div>
                <div className="font-[family-name:var(--font-mono)] text-base font-bold" style={{ color: corrColor }}>
                  {corrLabel} {panelData.corr.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="p-4 border-b border-border">
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-accent mb-2">
                Price History vs Oil
              </div>
              {panelData.aligned.dates.length >= 3 ? (
                <Plot
                  data={[
                    {
                      x: panelData.aligned.dates, y: panelData.aligned.oilValues,
                      type: 'scatter', mode: 'lines', name: 'Oil',
                      line: { color: '#33F5FF', width: 2 }, yaxis: 'y',
                      hovertemplate: 'Oil: $%{y:.2f}<extra></extra>',
                    },
                    {
                      x: panelData.aligned.dates, y: panelData.aligned.dsValues,
                      type: 'scatter', mode: 'lines', name: info.displayName,
                      line: { color: '#00FF88', width: 2 }, yaxis: 'y2',
                      hovertemplate: `${info.displayName}: %{y:.2f}<extra></extra>`,
                    },
                  ]}
                  layout={{
                    paper_bgcolor: '#060A14', plot_bgcolor: '#0A0E18',
                    font: { color: '#E8ECF4', family: 'Outfit, sans-serif', size: 10 },
                    xaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', type: 'date' as const },
                    yaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', title: { text: 'Oil ($)', font: { size: 9, color: '#33F5FF' } }, tickprefix: '$', side: 'left' as const },
                    yaxis2: { gridcolor: 'transparent', linecolor: 'rgba(0,240,255,0.04)', title: { text: info.displayName, font: { size: 9, color: '#00FF88' } }, side: 'right' as const, overlaying: 'y' as const },
                    margin: { l: 50, r: 50, t: 10, b: 30 },
                    hovermode: 'x unified' as const,
                    hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(0,240,255,0.15)', font: { color: '#E8ECF4', size: 10 } },
                    showlegend: false,
                    shapes: [{ type: 'line' as const, x0: IRAN_WAR_DATE, x1: IRAN_WAR_DATE, y0: 0, y1: 1, yref: 'paper' as const, line: { color: '#FF3366', width: 1.5, dash: 'dash' as const } }],
                    annotations: [{ x: IRAN_WAR_DATE, y: 1.03, yref: 'paper' as const, text: 'Iran War', showarrow: false, font: { size: 9, color: '#FF3366' } }],
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%', height: '220px' }}
                  useResizeHandler
                />
              ) : (
                <div className="h-[220px] flex items-center justify-center text-text-secondary text-sm font-[family-name:var(--font-mono)]">
                  Insufficient data for chart
                </div>
              )}
            </div>

            {/* Context */}
            <div className="p-5">
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-accent mb-2">
                Why Oil Matters Here
              </div>
              <div className="text-sm text-[#8B95A5] leading-relaxed">{info.detail}</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/supply-chain/CommodityDetailPanel.tsx
git commit -m "feat: add CommodityDetailPanel slide-out with stats and Plotly chart"
```

---

### Task 7: Build SupplyChainSection and wire into App

**Files:**
- Create: `frontend/src/components/sections/SupplyChainSection.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `SupplyChainSection.tsx`**

```typescript
import { useMemo } from 'react';
import { useDownstream } from '../../hooks/useOilPrices';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  COMMODITY_DATA,
  IRAN_WAR_DATE,
  alignSeries,
  computeCorrelation,
  getValueBeforeDate,
} from '../../lib/commodity-data';
import { OilSourceNode } from '../supply-chain/OilSourceNode';
import { FlowConnector } from '../supply-chain/FlowConnector';
import { BranchGrid } from '../supply-chain/BranchGrid';
import type { DownstreamItemData } from '../supply-chain/BranchGrid';

export function SupplyChainSection() {
  const { data: downstream, isLoading } = useDownstream();
  const ref = useScrollReveal();

  const items: DownstreamItemData[] = useMemo(() => {
    if (!downstream?.oil?.observations?.length || !downstream?.series?.length) return [];

    return Object.entries(COMMODITY_DATA).map(([key, info]) => {
      const ds = downstream.series.find((s) => s.name === info.displayName);
      if (!ds || !ds.observations.length) return null;

      const aligned = alignSeries(downstream.oil, ds);
      const corr = computeCorrelation(aligned.oilValues, aligned.dsValues);
      const warBaseline = getValueBeforeDate(ds, IRAN_WAR_DATE);
      const latestVal = ds.observations.at(-1)?.value ?? null;
      const changePct = warBaseline && latestVal ? ((latestVal - warBaseline) / warBaseline) * 100 : null;

      return {
        seriesKey: key,
        displayName: info.displayName,
        icon: info.icon,
        why: info.why,
        changePct,
        correlation: corr,
      } satisfies DownstreamItemData;
    }).filter((x): x is DownstreamItemData => x !== null);
  }, [downstream]);

  if (isLoading) {
    return (
      <section className="py-16 scroll-reveal" ref={ref as any}>
        <div className="section-wide">
          <h2 className="editorial-header">The Supply Chain</h2>
          <p className="editorial-subhead mb-4">Loading supply chain data...</p>
          {/* Skeleton matching the flow layout */}
          <div className="rounded-[10px] border border-border h-24 bg-surface animate-pulse mb-4" />
          <div className="h-[60px]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-6 bg-surface animate-pulse rounded w-32" />
                <div className="h-14 bg-surface animate-pulse rounded" />
                <div className="h-14 bg-surface animate-pulse rounded" />
                <div className="h-14 bg-surface animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!items.length || !downstream?.oil) return null;

  return (
    <section className="py-16 scroll-reveal" ref={ref as any}>
      <div className="section-wide">
        <div className="mb-8">
          <h2 className="editorial-header">The Supply Chain</h2>
          <p className="editorial-subhead mb-4">Follow the money from the oil barrel to your kitchen table. Click any item to explore.</p>
          <div className="section-rule" />
        </div>

        <OilSourceNode oilData={downstream.oil} />
        <FlowConnector />
        <BranchGrid items={items} />
      </div>

    </section>
  );
}
```

- [ ] **Step 2: Add SupplyChainSection to App.tsx**

In `frontend/src/App.tsx`, add the imports:

```typescript
import { SupplyChainSection } from './components/sections/SupplyChainSection';
import { CommodityDetailPanel } from './components/supply-chain/CommodityDetailPanel';
```

Insert `<SupplyChainSection />` between `<DownstreamSection />` (line 95) and the Raw Data div (line 98):

```typescript
      {/* Section 5: Downstream correlations — editorial grid */}
      <DownstreamSection />

      {/* Section 6: Supply Chain Flow — animated downstream visualization */}
      <SupplyChainSection />

      {/* Section 7: Raw data — collapsible, narrow */}
```

And render `<CommodityDetailPanel />` at the app level, as a sibling to `<EventManager>` (after line 108), NOT inside the section:

```typescript
      {/* Event manager dialog */}
      <EventManager open={eventManagerOpen} onOpenChange={setEventManagerOpen} />

      {/* Commodity detail slide-out (must be at app level for fixed positioning) */}
      <CommodityDetailPanel />
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Start dev server and visual check**

Run: `cd frontend && npx vite --port 5173`

Open `http://localhost:5173` and verify:
- Supply Chain section appears below the Ripple Effect section
- Oil source node shows current price with sparkline
- Animated particles flow in the connector
- All 13 commodities appear in 3 category columns
- Clicking an item opens the slide-out panel with chart
- Escape and overlay click close the panel

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/sections/SupplyChainSection.tsx frontend/src/App.tsx
git commit -m "feat: add Supply Chain Flow section with animated flow and detail panels"
```

---

### Task 8: Fix date range bug

**Files:**
- Modify: `frontend/src/components/charts/HeroFanChart.tsx`

Note: The store defaults (`'ALL'` preset, `'1986-01-01'` start) were already changed in Task 2.

- [ ] **Step 1: Fix HeroFanChart to pass date props to query**

In `frontend/src/components/charts/HeroFanChart.tsx` line 40, change:

```typescript
  const { data: priceData, isLoading } = useOilPrices(selectedSeries);
```

to:

```typescript
  const { data: priceData, isLoading } = useOilPrices(selectedSeries, dateFrom, dateTo);
```

- [ ] **Step 2: Verify the fix**

Reload the dashboard. The hero chart should now show the full historical range back to 1986. Change the date picker between 1M, 1Y, 5Y, ALL and confirm the chart updates each time. With "ALL" selected, event annotations from the 1990s and 2000s should be visible.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/charts/HeroFanChart.tsx
git commit -m "fix: wire date picker to chart query so date range actually works"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full build check**

Run: `cd frontend && npx tsc --noEmit && npx vite build`
Expected: No errors, clean build

- [ ] **Step 2: End-to-end walkthrough**

1. Load dashboard — full historical chart visible with event annotations
2. Change date picker to 1Y, 5Y — chart updates correctly
3. Scroll to Supply Chain section — animated particles visible
4. Oil source node shows price, sparkline, war-change badge
5. All 13 commodities in 3 columns
6. Click "Gasoline" — panel slides in with stats, chart, context
7. Click overlay or press Escape — panel closes
8. Scroll up to Ripple Effect section — still works correctly with shared data

- [ ] **Step 3: Final commit and tag**

```bash
git add -A
git commit -m "chore: verify clean build for supply chain flow feature"
git tag v1.1-supply-chain-flow
```
