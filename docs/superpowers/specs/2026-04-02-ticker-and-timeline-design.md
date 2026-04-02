# Kitchen Table Ticker + War Impact Timeline

## Context

The Oil Tracking Dashboard helps users understand how oil prices impact downstream consumer goods. The existing sections (Supply Chain Flow, Ripple Effect) show correlations and data, but require scrolling and interpretation. Two new features make the impact immediate and narrative:

1. **Kitchen Table Ticker** — a sticky marquee bar at the top of the viewport showing everyday item prices with war-impact markups. Answers "what does this mean for my wallet?" at a glance without any scrolling.

2. **War Impact Timeline** — a vertical editorial timeline between the Supply Chain and Ripple Effect sections, telling the week-by-week story of the war's economic ripple. Combines hardcoded editorial events with auto-detected data milestones.

Both features are additive — all existing sections remain unchanged. The existing `TimelineSection.tsx` (geopolitical event annotations on the forecast chart) is unrelated and not affected — it is not currently rendered in `App.tsx`.

## Feature 1: Kitchen Table Ticker

### Behavior

A thin (~36px) bar fixed to the top of the viewport. Contains a continuously scrolling marquee of commodity items, each showing an icon, name, price (where available), and dollar change since the Iran War. The marquee loops seamlessly using duplicated content.

Items with real dollar prices from FRED (gasoline, diesel, natural gas, crude oil) show: `[icon] [name] [$price] [+$X.XX since war]`. CPI-indexed items without post-war observations show: `[icon] [name] [awaiting data]` (italic). When CPI items eventually get post-war data, they show index-point changes: `[icon] [name] [+X.X pts since war]` (not dollar amounts, since CPI values are index numbers). Items are separated by subtle cyan pipe dividers.

Price increases are red (#FF3366), decreases are green (#00FF88), "awaiting data" uses secondary text color (#8B95A5 italic).

### Extensibility

The ticker item component accepts both `dollarChange` and `pctChange` props. Currently only `dollarChange` (or index-point change for CPI items) is rendered. Adding percentage display later requires only toggling which prop renders — no structural changes needed.

### Architecture

#### New files

| File | Purpose |
|------|---------|
| `frontend/src/components/layout/KitchenTableTicker.tsx` | Sticky bar component with marquee animation |

#### Modified files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `<KitchenTableTicker />` inside `DashboardContent`, as a sibling BEFORE `<EditorialLayout>` (not inside it — see fixed positioning note below) |
| `frontend/src/index.css` | Add `@keyframes tickerScroll` and `.ticker-track` animation styles. Add `body { padding-top: 36px }` to offset content. Move `.scroll-progress` to `top: 36px` so it sits below the ticker. |

#### Fixed positioning note

The `EditorialLayout` component has a child div with `animation: meshDrift` (CSS animation on the ambient gradient). While CSS animations alone don't create new containing blocks (only `transform`, `filter`, `will-change` do), the ticker must be placed as a sibling BEFORE `<EditorialLayout>` in `DashboardContent` to guarantee correct `position: fixed` behavior and avoid any future risk from ancestor style changes.

#### Z-index layering

The ticker must sit above the scroll-progress bar and below the noise overlay:

| Element | z-index | top |
|---------|---------|-----|
| Kitchen Table Ticker | 110 | 0 |
| `.scroll-progress` bar | 100 | 36px (changed from 0) |
| Noise overlay | 9999 | 0 (pointer-events: none) |
| CommodityDetailPanel overlay | 40 | — |

The `.scroll-progress` element in `index.css` must be updated from `top: 0` to `top: 36px` so it renders directly below the ticker bar.

#### Data flow

```
useDownstream() hook (existing, React Query deduplicates)
  -> KitchenTableTicker receives oil + downstream series
  -> For each entry in COMMODITY_DATA (keyed by backend series ID, e.g., 'gasoline'):
     - Find matching PriceSeries in downstream.series by comparing
       series.name === COMMODITY_DATA[key].displayName
       (same pattern used by SupplyChainSection and CommodityDetailPanel)
     - Get warBaseline via getValueBeforeDate(series, IRAN_WAR_DATE)
     - Get latestValue from series.observations.at(-1).value
     - Check hasDataAfter(series, IRAN_WAR_DATE) for post-war data
     - If dollar-priced series (gasoline, diesel, natural_gas) + has post-war data:
         dollarChange = latestValue - warBaseline
     - If CPI-indexed series + has post-war data:
         indexChange = latestValue - warBaseline (shown as "+X.X pts")
     - If no post-war data: awaiting = true
  -> Oil price comes from downstream.oil (PriceSeries), same logic
  -> Render items into duplicated marquee track
```

No new API endpoints needed. Reuses existing `useDownstream()` hook and `commodity-data.ts` utilities.

#### Ticker items

The ticker shows these items in order, matching the Supply Chain categories:

| Item | Series match (`series.name`) | Price format | Change format |
|------|------------------------------|-------------|---------------|
| Crude Oil (WTI) | `downstream.oil` | `$XXX.XX` | `+$XX.XX since war` |
| Gasoline | `"Gasoline (Regular)"` | `$X.XX` | `+$X.XX since war` |
| Diesel | `"US Diesel Prices"` | `$X.XX` | `+$X.XX since war` |
| Natural Gas | `"Natural Gas"` | `$X.XX` | `+$X.XX since war` |
| Airline Fares | `"Airline Fares CPI"` | — | `awaiting data` or `+X.X pts` |
| Eggs & Meat | `"Eggs, Meat & Poultry"` | — | `awaiting data` or `+X.X pts` |
| Groceries | `"Groceries (Food at Home)"` | — | `awaiting data` or `+X.X pts` |
| CPI Energy | `"CPI Energy"` | — | `awaiting data` or `+X.X pts` |
| CPI All Items | `"CPI All Items"` | — | `awaiting data` or `+X.X pts` |

Dollar-priced items show dollar changes. CPI-indexed items show index-point changes when post-war data is available, "awaiting data" when not.

#### Marquee animation

CSS-only continuous scroll. The ticker track contains two identical copies of the item list side by side. A `@keyframes tickerScroll` animation translates the track left by 50% (one full copy width), creating a seamless loop. Animation duration scales with content width (~30-40s for a comfortable reading speed). Uses `will-change: transform` for GPU-accelerated smooth scrolling.

```css
@keyframes tickerScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.ticker-track {
  display: flex;
  gap: 40px;
  animation: tickerScroll 35s linear infinite;
  will-change: transform;
}
```

#### Styling

- Background: `#0A0E18` (surface) with bottom border `rgba(0,240,255,0.1)`
- Font: IBM Plex Mono, 12px
- Fixed position, top: 0, z-index: 110 (above scroll-progress at 100, below noise overlay at 9999)
- Body gets `padding-top: 36px` to offset content
- No mobile-specific changes needed — the marquee animation works at all viewport widths since content scrolls continuously

### Error handling

- If `useDownstream()` is loading: ticker renders with pulsing skeleton placeholders
- If `useDownstream()` fails: ticker bar doesn't render (return null)

### Emoji convention

All emoji/icon strings in the new TypeScript file must use Unicode escapes (`'\u{26FD}'` not `⛽`) per project convention.

---

## Feature 2: War Impact Timeline

### Behavior

A vertical editorial timeline section placed between the Supply Chain and Ripple Effect sections. Displays milestone cards stacking top to bottom along a left-aligned vertical line. Each milestone has a colored dot, date label, headline, description, and optional commodity change badges.

Milestones animate in with staggered scroll-triggered animations — each card fades up and slides in as the user scrolls it into view, with incremental delays so they cascade sequentially.

### Milestone types

Three types, visually distinguished by dot color:

1. **Editorial milestones (red dot, #FF3366)** — Hardcoded geopolitical events: war starts, escalations, diplomatic milestones. Each has: date, headline, description, category.

2. **Data-detected milestones (cyan dot, #00F0FF)** — Auto-generated from FRED price data. The backend computes weekly aggregates since the war date and detects significant moves: weekly price changes >5% for any tracked commodity, or threshold crossings (e.g., diesel crosses $5, gas crosses $4). Each has: week number, headline (auto-generated), description, and commodity change badges.

3. **Today marker (green pulsing dot, #00FF88)** — Always the last milestone. Shows current date, weeks since war, latest key prices, and a note about when next monthly data is expected.

### Single source of truth

The backend owns all milestone data. The `GET /api/milestones` endpoint returns the complete merged array (editorial + data-detected + today). The frontend has no hardcoded milestones — it renders exactly what the API returns. Editorial milestones are defined in the backend only (in `backend/data/war_milestones.json`).

### Architecture

#### New files

| File | Purpose |
|------|---------|
| `frontend/src/components/sections/WarTimelineSection.tsx` | Main section component — header with `editorial-header` + `editorial-subhead` + `section-rule` div, vertical line, milestone cards |
| `frontend/src/components/timeline/TimelineMilestone.tsx` | Individual milestone card with dot, date, headline, description, badges. Each instance manages its own IntersectionObserver for scroll-triggered animation. |
| `backend/routers/milestones.py` | New endpoint: `GET /api/milestones` |
| `backend/data/war_milestones.json` | Editorial milestone definitions (single source of truth) |

#### Modified files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `<WarTimelineSection />` between `<SupplyChainSection />` and `<DownstreamSection />` |
| `frontend/src/hooks/useOilPrices.ts` | Add `useMilestones()` React Query hook |
| `frontend/src/types/index.ts` | Add `Milestone` and `MilestonesResponse` type definitions |
| `frontend/src/index.css` | Add `@keyframes milestoneReveal` and `.timeline-milestone` animation classes |
| `backend/main.py` | Register milestones router |

#### TypeScript types

Add to `frontend/src/types/index.ts`:

```typescript
export interface MilestoneBadge {
  label: string;
  change: string;
}

export interface Milestone {
  type: 'editorial' | 'data' | 'today';
  date: string;
  week: number;
  headline: string;
  description: string;
  badges: MilestoneBadge[];
}

export interface MilestonesResponse {
  milestones: Milestone[];
}
```

#### Data flow

```
GET /api/milestones
  -> Backend fetches weekly price data for all tracked series since IRAN_WAR_DATE
  -> Computes week-over-week % changes for each series
  -> Detects significant moves:
     - Weekly change > 5% for any series
     - Threshold crossings: diesel > $5, gas > $4, oil > $100, oil > $110
  -> Generates headline + description for each detected milestone
  -> Loads editorial events from backend/data/war_milestones.json
  -> Merges editorial + data milestones, sorts chronologically
  -> Appends "today" marker with current prices
  -> Returns JSON array of milestones

Frontend:
  useMilestones() hook -> WarTimelineSection
    -> Renders vertical line + TimelineMilestone cards
    -> Each card uses IntersectionObserver for scroll-triggered animation
```

#### Backend endpoint: `GET /api/milestones`

Uses the existing SQLite cache infrastructure (24hr TTL, same as other FRED endpoints) to avoid recomputing on every request.

Response schema:

```json
{
  "milestones": [
    {
      "type": "editorial",
      "date": "2026-02-28",
      "week": 0,
      "headline": "US strikes Iran; Strait of Hormuz closed to tanker traffic",
      "description": "Global oil supply loses ~5M barrels/day...",
      "badges": []
    },
    {
      "type": "data",
      "date": "2026-03-07",
      "week": 1,
      "headline": "Crude oil surges past $80 in largest weekly jump since 2022",
      "description": "WTI jumps from $66.97 to $79.16...",
      "badges": [
        { "label": "WTI", "change": "+18.2%" },
        { "label": "Brent", "change": "+15.7%" }
      ]
    },
    {
      "type": "today",
      "date": "2026-04-02",
      "week": 5,
      "headline": "5 weeks into the conflict",
      "description": "Oil at $104.69 (+56.3% since war)...",
      "badges": []
    }
  ]
}
```

The backend computes data milestones by:
1. Fetching daily observations for all downstream series since 2026-02-21 (one week before war)
2. Grouping into weekly buckets (Mon-Fri)
3. Computing week-over-week percentage change per series
4. Filtering for significant moves (>5% weekly change or threshold crossings)
5. Generating human-readable headlines using templates: "[Commodity] [crosses $X / surges X%] for first time since [context]"
6. Loading editorial milestones from `backend/data/war_milestones.json`
7. Merging all milestones, sorting by date, appending today marker

#### Scroll-triggered animations

Each `TimelineMilestone` component uses an IntersectionObserver to detect when it enters the viewport. On intersection, it adds a `revealed` class that triggers a CSS animation.

```css
@keyframes milestoneReveal {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.timeline-milestone {
  opacity: 0;
}

.timeline-milestone.revealed {
  animation: milestoneReveal 0.5s ease-out forwards;
}
```

Stagger is achieved by setting `animation-delay` based on the milestone's index within the currently visible batch. When multiple milestones enter the viewport at once (fast scroll), they cascade with 0.1s increments. The IntersectionObserver uses `threshold: 0.2` and `rootMargin: '0px 0px -50px 0px'` to trigger slightly before the card is fully visible.

Each `TimelineMilestone` manages its own observer (not using the section-level `useScrollReveal()` hook) because the timeline needs per-card stagger rather than per-section reveal.

#### Section header structure

The section header follows the existing editorial pattern:

```tsx
<div className="section-reading">
  <h2 className="editorial-header">The War's Ripple</h2>
  <p className="editorial-subhead">Week by week, here's how the Iran war reshaped prices from the barrel to your wallet.</p>
  <div className="section-rule" />
</div>
```

#### Styling

- Section header: Bebas Neue `editorial-header`, `editorial-subhead`, `section-rule` (matching existing pattern)
- Vertical line: 2px wide, cyan gradient from `#00F0FF` to `rgba(0,240,255,0.1)`, positioned left of cards
- Milestone dots: 12px circles with 2px `#04060C` border and colored glow shadow
  - Editorial: `#FF3366` with `box-shadow: 0 0 8px rgba(255,51,102,0.4)`
  - Data: `#00F0FF` with `box-shadow: 0 0 8px rgba(0,240,255,0.3)`
  - Today: `#00FF88` with pulsing animation, 18px outer ring
- Date label: IBM Plex Mono, 10px, cyan, uppercase tracking
- Headline: 15px, semibold, primary text color
- Description: 13px, secondary text color
- Badges: IBM Plex Mono 10px, red border pill with percentage change
- Container: `section-reading` max-width (1000px) for comfortable reading

### Error handling

- If `useMilestones()` is loading: show skeleton with 3 pulsing placeholder cards along the vertical line
- If `useMilestones()` fails: section doesn't render (return null)
- If no data milestones detected (unlikely but possible): show only editorial milestones + today marker

### Emoji convention

All emoji/icon strings in new TypeScript files must use Unicode escapes per project convention.

---

## Section order after changes

1. **Kitchen Table Ticker** (sticky, always visible — outside EditorialLayout)
2. Hero Section
3. Forecast Section
4. Stats Band
5. Risk Section
6. Supply Chain Flow
7. **War Impact Timeline** (new)
8. Ripple Effect (Downstream)
9. Raw Data

## Testing

### Ticker
- Verify sticky positioning at z-index 110, scroll-progress bar at top: 36px below it
- Verify body padding-top: 36px offsets hero content correctly
- Verify marquee loops seamlessly (no visible jump at seam)
- Verify real prices show dollar changes, CPI items show "awaiting data" or index-point changes
- Verify ticker updates when downstream data refreshes
- Verify ticker doesn't render if API fails

### Timeline
- Verify editorial milestones render in chronological order from backend data
- Verify data milestones auto-detect from live FRED data (>5% weekly moves, threshold crossings)
- Verify today marker always appears last with pulsing green dot
- Verify scroll animations trigger per-card with staggered delays as user scrolls
- Verify multiple cards entering viewport simultaneously cascade with 0.1s increments
- Verify badges show correct percentage changes
- Verify section doesn't render if milestones API fails
- Verify milestones endpoint uses cache (24hr TTL)
