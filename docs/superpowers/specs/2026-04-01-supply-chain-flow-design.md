# Supply Chain Flow Visualization

## Context

The Oil Tracking Dashboard helps users understand how oil prices impact downstream consumer goods. The existing "Ripple Effect" section uses dual-axis Plotly line charts in a grid layout to show oil-vs-commodity correlations. While informative, these charts require interpretation and don't immediately convey the causal chain from oil to everyday items.

This feature adds a new **Supply Chain Flow** section that makes the oil-to-consumer relationship instantly intuitive through an animated flowchart metaphor: oil barrel at the top, animated particles flowing downstream, branching into category groups (Transportation, Food, Materials), with clickable items that open a slide-out detail panel.

This is additive — all existing charts remain. The new section is inserted between the current Downstream/Ripple Effect section and the Raw Data table.

### Secondary fix: Date range bug

The date picker doesn't affect the historical data range. `HeroFanChart.tsx` (rendered inside `ForecastSection`) calls `useOilPrices(selectedSeries)` on line 40 without passing its `dateFrom`/`dateTo` props, so the query always fetches the default 2Y window regardless of date picker state. The backend already supports arbitrary date ranges via FRED (data available back to ~1986 for WTI). Fixing this will allow the 20 historical event annotations (1973-2026) to display correctly on the chart.

## Architecture

### New files

| File | Purpose |
|------|---------|
| `frontend/src/components/sections/SupplyChainSection.tsx` | Main section component — oil source node, flow connector, branch grid |
| `frontend/src/components/supply-chain/OilSourceNode.tsx` | Oil barrel card with price, change badge, sparkline |
| `frontend/src/components/supply-chain/FlowConnector.tsx` | Animated vertical trunk with CSS particle dots and label |
| `frontend/src/components/supply-chain/BranchGrid.tsx` | 3-column grid of category branches with downstream items |
| `frontend/src/components/supply-chain/CommodityDetailPanel.tsx` | Slide-out modal panel with stats, Plotly chart, context |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `<SupplyChainSection />` between `<DownstreamSection />` and the Raw Data collapsible |
| `frontend/src/hooks/useOilPrices.ts` | Add `useOilSparkline()` hook for compact 1Y oil data |
| `frontend/src/stores/dashboardStore.ts` | Add `supplyChainPanelOpen` and `selectedCommodity` state |
| `frontend/src/components/sections/DownstreamSection.tsx` | Remove `COMMODITY_CONTEXT`, `alignSeries`, `computeCorrelation`, `IRAN_WAR_DATE` (moved to shared `commodity-data.ts`), import from there |
| `frontend/src/components/charts/HeroFanChart.tsx` | Change `useOilPrices(selectedSeries)` on line 40 to `useOilPrices(selectedSeries, dateFrom, dateTo)` so the date picker actually affects the query (date range fix) |

### Data flow

```
useDownstream() hook (existing)
  -> returns { oil: PriceSeries, series: PriceSeries[] }
  -> SupplyChainSection receives this data
  -> Computes correlations and % changes (reuses existing alignSeries/computeCorrelation logic)
  -> Passes computed data to BranchGrid
  -> On item click: sets selectedCommodity in store
  -> CommodityDetailPanel reads selectedCommodity, renders Plotly dual-axis chart
```

The section reuses the existing `/api/prices/downstream` endpoint. No backend changes needed for the flow visualization. The date range fix only requires frontend wiring changes.

## Components

### SupplyChainSection

Top-level section component. Calls `useDownstream()` (same hook the Ripple Effect section uses — data is cached by React Query so no duplicate API call). Computes per-commodity stats and passes them to children.

- Wraps everything in `<section className="py-16 scroll-reveal">` matching existing section pattern
- Header: "The Supply Chain" with subhead and section rule (matching `editorial-header` / `editorial-subhead` classes)
- Children: OilSourceNode -> FlowConnector -> BranchGrid
- Renders CommodityDetailPanel (always mounted, visibility controlled by store state)

### OilSourceNode

Displays the oil barrel as the "source" of the flow.

- Layout: horizontal flex — oil barrel emoji, info block, mini sparkline
- Info: "SOURCE" label, "WTI CRUDE OIL" title, price in large mono font, "since Iran War" change badge, date
- Sparkline: 1Y oil price rendered as an SVG polyline (data from `useOilSparkline()` hook)
- Styled with cyan accent border, gradient background matching dashboard theme
- Top 2px accent line: `linear-gradient(90deg, #00F0FF, rgba(0,240,255,0.1))`

### FlowConnector

Pure CSS animated connector between source and branches.

- Vertical 2px trunk line with cyan gradient
- 3 animated dot particles flowing top-to-bottom using `@keyframes` with staggered `animation-delay`
- Centered label: "PRICE PRESSURE FLOWS DOWNSTREAM" in mono 9px uppercase
- Height: 60px
- Container needs `position: relative` for absolute-positioned particle dots
- No JavaScript needed — pure CSS animations

### BranchGrid

3-column grid of downstream categories.

Categories and their items (matching existing `DOWNSTREAM_SERIES` from the backend):

| Transportation | Food & Agriculture | Materials & Energy |
|---|---|---|
| Gasoline | Fertilizer | Plastics |
| Diesel | Eggs & Meat | Aluminum |
| Airline Fares | Groceries (Food at Home) | Energy CPI |
|  | Natural Gas | Cotton |
|  | Global Food Index | CPI All Items |

Each category column:
- Header: icon + category name in mono uppercase cyan
- Items: clickable rows with icon, name, one-line "why", % change badge, correlation coefficient

Item row interaction:
- Hover: left cyan accent border appears, subtle translateX(4px), background lightens
- Click: dispatches `setSelectedCommodity(item)` to Zustand store, opens detail panel

### CommodityDetailPanel

Slide-out panel from right edge of screen. 520px wide.

Sections:
1. **Header** — large emoji, commodity name (Bebas Neue), one-line explanation
2. **Stats row** — 3-column grid: Current Price, Since Iran War (% change), Correlation strength (Strong/Moderate/Weak with r value)
3. **Plotly chart** — dual-axis line chart (oil in cyan on left axis, commodity in green on right axis) with Iran War dashed vertical line annotation. Uses existing `alignSeries()` logic.
4. **Context block** — "WHY OIL MATTERS HERE" label + 2-3 sentence explanation from `COMMODITY_CONTEXT` map (already exists in DownstreamSection.tsx — extract to shared constant)

Overlay: full-screen semi-transparent backdrop with `backdrop-filter: blur(8px)`. Click overlay or X button to close.

Animation: panel slides in from right with `cubic-bezier(0.16, 1, 0.3, 1)` easing, 350ms duration.

## Shared constants to extract

Extract from `DownstreamSection.tsx` into new `frontend/src/lib/commodity-data.ts`:

- `COMMODITY_CONTEXT` — re-key from display names (e.g. `'US Diesel Prices'`) to series keys (e.g. `'diesel'`). Add a `displayName` field so `DownstreamSection` can still look up by `series.name` via a helper. Add the `detail` field (longer explanation) for the modal panel.
- `alignSeries()` and `computeCorrelation()` — currently unexported module-private functions. Export from the new file.
- `IRAN_WAR_DATE` constant — currently only in `DownstreamSection.tsx`, needed by both sections.

The category groupings (Transportation, Food, Materials) are new data. Add to the same `commodity-data.ts` file. The `series` arrays use the backend's `SERIES_IDS` keys (matching `fred_client.py`):

```typescript
export const COMMODITY_CATEGORIES = [
  { key: 'transportation', icon: '\u{1F69A}', name: 'Transportation', series: ['gasoline', 'diesel', 'airline_fares'] },
  { key: 'food', icon: '\u{1F33E}', name: 'Food & Agriculture', series: ['fertilizer', 'eggs_meat', 'food_at_home', 'natural_gas', 'food_index'] },
  { key: 'materials', icon: '\u{1F3ED}', name: 'Materials & Energy', series: ['plastics', 'aluminum', 'cpi_energy', 'cotton', 'cpi_all'] },
];

// Helper to look up context by display name (for DownstreamSection backward compat)
export function getContextByDisplayName(name: string) { ... }
```

## Styling

All styling uses Tailwind utility classes consistent with existing components. Custom CSS only for animations.

### New CSS animations (add to `index.css`)

```css
@keyframes flowDown {
  0% { top: -4px; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
```

### Color usage

- Oil/source accents: `#00F0FF` (existing `--accent`)
- Price increases (bad for consumers): `#FF3366`
- Price decreases (good for consumers): `#00FF88`
- Correlation strong: `#00FF88`, moderate: `#00F0FF`, weak: `#4A5568`
- Backgrounds: `#04060C` (page), `#0A0E18` (surface), `#0C1220` (card)
- All colors already exist in the design system — no new colors introduced

### Typography

- Section header: Bebas Neue (existing `editorial-header` class)
- Labels/badges: IBM Plex Mono (existing `--font-mono`)
- Body text: Outfit (existing default)
- No new fonts

## Date range fix

### Problem

The hero chart always shows the same ~2 year range regardless of date picker selection. `HeroFanChart.tsx` (rendered by `ForecastSection.tsx`, not `HeroSection.tsx`) already receives `dateFrom`/`dateTo` props from `ForecastSection`'s local state. But on line 40, it calls `useOilPrices(selectedSeries)` without passing those dates, so the API query always uses the default range.

The Zustand store has `dateRangePreset` (e.g. `'2Y'`, `'ALL'`) and `dateRangeStart` (computed date string or `undefined` for `'ALL'`). There is no `endDate` field — end is always "today".

### Fix

1. In `HeroFanChart.tsx` line 40: change `useOilPrices(selectedSeries)` to `useOilPrices(selectedSeries, dateFrom, dateTo)` so the already-available props are actually used in the query
2. Change `getStartDate('ALL')` in `dashboardStore.ts` to return `'1986-01-01'` instead of `undefined`, so the FRED API gets an explicit start date that covers all available WTI data
3. Change the store's default `dateRangePreset` from `'2Y'` to `'ALL'` so the full historical range loads on first visit
4. The backend already handles arbitrary date ranges — `get_series()` in `fred_client.py` passes `observation_start` directly to the FRED API

This will make the 20 event annotations (1973 Arab Oil Embargo through 2026 Iran War) visible on the chart when zoomed out. Events before 1986 will be off-chart since WTI data starts then, but that's correct behavior.

## Interaction summary

| Action | Result |
|--------|--------|
| Page load | Supply Chain section renders with data from `useDownstream()`, particles animate continuously |
| Hover on downstream item | Left cyan border, slight right shift, arrow appears |
| Click downstream item | Slide-out panel opens from right with stats + chart + context |
| Click overlay or X | Panel closes |
| Escape key | Panel closes |
| Date picker change | Hero chart updates to show selected date range (fix) |

## Error handling

- If `useDownstream()` is loading: show skeleton with pulsing placeholders (matching existing loading state pattern in DownstreamSection)
- If `useDownstream()` fails: section doesn't render (return null, same as existing pattern)
- If a commodity has no data: omit it from the branch grid
- Detail panel chart: if alignment produces fewer than 3 data points, show "Insufficient data" message instead of chart

## Testing

- Verify section renders with all 13 downstream commodities in correct categories
- Verify particle animations run smoothly (CSS-only, no JS performance concern)
- Verify click opens panel with correct commodity data
- Verify Escape and overlay click close panel
- Verify date range fix: change date picker to "ALL" and confirm events from 1990s appear on hero chart
- Verify no duplicate API calls (React Query dedup with existing Ripple Effect section)

## Mockups

Interactive mockups in `.superpowers/brainstorm/`:
- `concepts.html` — three concept options (A: Kitchen Tags, B: Supply Chain, C: Orbit)
- `supply-chain-detail.html` — detailed mockup of chosen Concept B with slide-out panel
