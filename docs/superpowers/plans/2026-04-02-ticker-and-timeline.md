# Kitchen Table Ticker + War Impact Timeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky marquee ticker showing everyday item prices with war-impact markups, and a vertical editorial timeline showing the war's week-by-week economic ripple.

**Architecture:** Two independent features sharing existing data infrastructure. The ticker reuses the `useDownstream()` hook with no new API calls. The timeline adds a new `GET /api/milestones` backend endpoint that computes data milestones from FRED series and merges them with editorial events. Both follow existing component patterns (scroll-reveal sections, editorial headers, Tailwind + CSS custom properties).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 (frontend), FastAPI + Python (backend), TanStack React Query, FRED API, SQLite cache

**Spec:** `docs/superpowers/specs/2026-04-02-ticker-and-timeline-design.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `frontend/src/components/layout/KitchenTableTicker.tsx` | Sticky marquee bar — data computation + rendering |
| `frontend/src/components/sections/WarTimelineSection.tsx` | Timeline section — header, vertical line, milestone list |
| `frontend/src/components/timeline/TimelineMilestone.tsx` | Individual milestone card with IntersectionObserver animation |
| `backend/routers/milestones.py` | `GET /api/milestones` endpoint — weekly aggregation + milestone detection |
| `backend/data/war_milestones.json` | Editorial milestone definitions |

### Modified files
| File | Change |
|------|--------|
| `frontend/src/types/index.ts` | Add `Milestone`, `MilestoneBadge`, `MilestonesResponse` types |
| `frontend/src/lib/api.ts` | Add `fetchMilestones()` function |
| `frontend/src/hooks/useOilPrices.ts` | Add `useMilestones()` hook |
| `frontend/src/App.tsx` | Add ticker before `EditorialLayout`, add timeline between Supply Chain and Downstream |
| `frontend/src/index.css` | Add ticker keyframes, milestone animations, adjust scroll-progress top, add body padding-top |
| `backend/main.py` | Register milestones router |

---

## Task 1: CSS foundation — ticker animation + milestone animations + z-index fixes

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add ticker scroll keyframes and body offset**

Add to `index.css` after the existing `@keyframes` block (after the `flowDown` animation around line 110):

```css
/* Kitchen Table Ticker marquee */
@keyframes tickerScroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.ticker-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  z-index: 110;
  background: #0A0E18;
  border-bottom: 1px solid rgba(0, 240, 255, 0.1);
  overflow: hidden;
  display: flex;
  align-items: center;
}

.ticker-track {
  display: flex;
  gap: 40px;
  white-space: nowrap;
  animation: tickerScroll 35s linear infinite;
  will-change: transform;
}

/* Timeline milestone scroll-reveal */
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

/* Today marker pulse */
@keyframes todayPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

- [ ] **Step 2: Fix scroll-progress top and add body padding**

Find the `.scroll-progress` rule in `index.css` and change `top: 0` to `top: 36px`. Then add `padding-top: 36px` to the `body` rule.

In `.scroll-progress`:
```css
top: 36px;  /* was: top: 0 — moved below ticker bar */
```

In `body`:
```css
padding-top: 36px;  /* offset content below fixed ticker */
```

- [ ] **Step 3: Verify Vite hot-reload picks up CSS changes**

Run: Open `http://localhost:5173` — page should have 36px blank space at top. Scroll-progress bar should appear below the blank area.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: add ticker and timeline CSS animations, fix z-index layering"
```

---

## Task 2: TypeScript types for milestones

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: Add milestone types**

Append to the end of `frontend/src/types/index.ts`:

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

- [ ] **Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean compile, no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "types: add Milestone and MilestonesResponse interfaces"
```

---

## Task 3: API client + React Query hook for milestones

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/hooks/useOilPrices.ts`

- [ ] **Step 1: Add fetchMilestones to api.ts**

Add to `frontend/src/lib/api.ts`, after the existing `fetchDownstream` function. Also add the import for `MilestonesResponse`:

Update the import at the top:
```typescript
import type { PriceSeries, PriceSummary, SimulationBands, SimulationRequest, DownstreamData, MilestonesResponse } from '../types';
```

Add the function:
```typescript
/** Fetch war impact milestones (editorial + data-detected) */
export function fetchMilestones(): Promise<MilestonesResponse> {
  return fetchJson<MilestonesResponse>(`${BASE}/milestones`);
}
```

- [ ] **Step 2: Add useMilestones hook**

Add to `frontend/src/hooks/useOilPrices.ts`. Update the imports:

```typescript
import { fetchPrices, fetchSummary, fetchDownstream, fetchMilestones } from '../lib/api';
import type { PriceSeries, PriceSummary, DownstreamData, MilestonesResponse } from '../types';
```

Add the hook after `useOilSparkline`:

```typescript
export function useMilestones() {
  return useQuery<MilestonesResponse>({
    queryKey: ['milestones'],
    queryFn: fetchMilestones,
    staleTime: 30 * 60 * 1000, // 30 min — milestones don't change frequently
    retry: 1,
  });
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean compile. The hook won't be called yet, but types must align.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useOilPrices.ts
git commit -m "feat: add fetchMilestones API client and useMilestones hook"
```

---

## Task 4: Kitchen Table Ticker component

**Files:**
- Create: `frontend/src/components/layout/KitchenTableTicker.tsx`

- [ ] **Step 1: Create the ticker component**

Create `frontend/src/components/layout/KitchenTableTicker.tsx`:

```typescript
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
  const renderItems = () =>
    items.map((item, i) => (
      <span key={i} className="flex items-center gap-1.5 shrink-0">
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
        {renderItems()}
        {renderItems()}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/KitchenTableTicker.tsx
git commit -m "feat: add KitchenTableTicker component with marquee animation"
```

---

## Task 5: Wire ticker into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add ticker import and render before EditorialLayout**

Add import at top of `App.tsx`:
```typescript
import { KitchenTableTicker } from './components/layout/KitchenTableTicker';
```

In `DashboardContent`, change the return to render the ticker as a sibling BEFORE `EditorialLayout`:

```typescript
function DashboardContent({ eventManagerOpen, setEventManagerOpen }: DashboardContentProps) {
  const sim = useSimulation();

  return (
    <>
      {/* Sticky ticker — outside EditorialLayout for correct fixed positioning */}
      <KitchenTableTicker />

      <EditorialLayout>
        {/* Section 1: Full-viewport hero with price */}
        <HeroSection onOpenEventManager={() => setEventManagerOpen(true)} />
        {/* ... rest unchanged ... */}
      </EditorialLayout>
    </>
  );
}
```

- [ ] **Step 2: Verify in browser**

Run: Open `http://localhost:5173`
Expected: Sticky bar at top with commodity items scrolling. Gas, Diesel, Nat Gas show dollar prices + changes. CPI items show "awaiting data". Scroll-progress bar renders directly below ticker.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire KitchenTableTicker into DashboardContent"
```

---

## Task 6: Backend editorial milestones data file

**Files:**
- Create: `backend/data/war_milestones.json`

- [ ] **Step 1: Create the editorial milestones JSON**

Create `backend/data/war_milestones.json`:

```json
[
  {
    "date": "2026-01-15",
    "headline": "Iran tensions escalate as diplomatic channels collapse",
    "description": "Breakdown of nuclear negotiations leads to increased military posturing in the Persian Gulf. Oil markets begin pricing in supply risk."
  },
  {
    "date": "2026-02-28",
    "headline": "US strikes Iran; Strait of Hormuz closed to tanker traffic",
    "description": "Global oil supply loses ~5M barrels/day as the world's most critical shipping lane shuts down. Crude oil spikes immediately."
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add backend/data/war_milestones.json
git commit -m "data: add editorial war milestones for timeline"
```

---

## Task 7: Backend milestones endpoint

**Files:**
- Create: `backend/routers/milestones.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create the milestones router**

Create `backend/routers/milestones.py`:

```python
"""War Impact Timeline milestones endpoint."""

from __future__ import annotations

import json
import os
from datetime import date, timedelta, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from services.fred_client import SERIES_IDS, SERIES_NAMES, get_series
from services.cache import get_cached, set_cached

router = APIRouter(prefix="/api/milestones", tags=["milestones"])

IRAN_WAR_DATE = "2026-02-28"
MILESTONES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "war_milestones.json")

# Thresholds for auto-detecting price milestones
WEEKLY_CHANGE_THRESHOLD = 5.0  # percent
PRICE_THRESHOLDS: dict[str, list[float]] = {
    "wti": [80, 90, 100, 110, 120],
    "brent": [85, 95, 105, 115, 125],
    "diesel": [4.0, 4.5, 5.0, 5.5, 6.0],
    "gasoline": [3.0, 3.5, 4.0, 4.5, 5.0],
}

SERIES_FOR_MILESTONES = ["wti", "brent", "diesel", "gasoline", "natural_gas"]


class MilestoneBadge(BaseModel):
    label: str
    change: str


class Milestone(BaseModel):
    type: str  # "editorial" | "data" | "today"
    date: str
    week: int
    headline: str
    description: str
    badges: list[MilestoneBadge]


def _week_number(d: str) -> int:
    """Compute weeks since war start."""
    war = datetime.strptime(IRAN_WAR_DATE, "%Y-%m-%d")
    target = datetime.strptime(d, "%Y-%m-%d")
    return max(0, (target - war).days // 7)


def _load_editorial() -> list[Milestone]:
    """Load editorial milestones from JSON."""
    if not os.path.exists(MILESTONES_PATH):
        return []
    with open(MILESTONES_PATH, "r") as f:
        data = json.load(f)
    return [
        Milestone(
            type="editorial",
            date=evt["date"],
            week=_week_number(evt["date"]),
            headline=evt["headline"],
            description=evt["description"],
            badges=[],
        )
        for evt in data
    ]


async def _fetch_all_series() -> dict[str, list[dict]]:
    """Fetch all milestone-relevant series from FRED (or cache). Called once per request."""
    start = (datetime.strptime(IRAN_WAR_DATE, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    end = date.today().isoformat()
    all_data: dict[str, list[dict]] = {}
    for key in SERIES_FOR_MILESTONES:
        series_id = SERIES_IDS.get(key)
        if not series_id:
            continue
        try:
            all_data[key] = await get_series(series_id, start, end)
        except Exception:
            pass
    return all_data


def _detect_data_milestones(all_series_data: dict[str, list[dict]]) -> list[Milestone]:
    """Auto-detect significant price moves from pre-fetched FRED data."""
    milestones: list[Milestone] = []

    if not all_series_data:
        return milestones

    # Group observations into weekly buckets (Mon-Sun)
    war_dt = datetime.strptime(IRAN_WAR_DATE, "%Y-%m-%d")

    # Detect weekly changes per series
    seen_thresholds: dict[str, set[float]] = {k: set() for k in PRICE_THRESHOLDS}

    for key, obs in all_series_data.items():
        if len(obs) < 2:
            continue

        name = SERIES_NAMES.get(key, key)

        # Get pre-war baseline (last value before war)
        pre_war = [o for o in obs if o["date"] < IRAN_WAR_DATE]
        if not pre_war:
            continue
        baseline_val = pre_war[-1]["value"]

        # Group post-war observations by week
        post_war = [o for o in obs if o["date"] >= IRAN_WAR_DATE]
        weeks: dict[int, list[dict]] = {}
        for o in post_war:
            w = _week_number(o["date"])
            weeks.setdefault(w, []).append(o)

        prev_week_close = baseline_val
        for week_num in sorted(weeks.keys()):
            week_obs = weeks[week_num]
            week_close = week_obs[-1]["value"]

            if prev_week_close and prev_week_close != 0:
                pct_change = ((week_close - prev_week_close) / prev_week_close) * 100
            else:
                pct_change = 0

            week_date = week_obs[-1]["date"]

            # Check weekly change threshold
            if abs(pct_change) >= WEEKLY_CHANGE_THRESHOLD:
                direction = "surges" if pct_change > 0 else "drops"
                milestones.append(Milestone(
                    type="data",
                    date=week_date,
                    week=week_num,
                    headline=f"{name} {direction} {abs(pct_change):.1f}% in a single week",
                    description=f"{name} moved from ${prev_week_close:.2f} to ${week_close:.2f} in week {week_num} of the conflict.",
                    badges=[MilestoneBadge(label=name, change=f"{pct_change:+.1f}%")],
                ))

            # Check price threshold crossings
            if key in PRICE_THRESHOLDS:
                for threshold in PRICE_THRESHOLDS[key]:
                    if threshold in seen_thresholds[key]:
                        continue
                    if prev_week_close < threshold <= week_close:
                        seen_thresholds[key].add(threshold)
                        milestones.append(Milestone(
                            type="data",
                            date=week_date,
                            week=week_num,
                            headline=f"{name} crosses ${threshold:.2f}",
                            description=f"{name} broke through the ${threshold:.2f} level, reaching ${week_close:.2f} by end of week {week_num}.",
                            badges=[MilestoneBadge(label=name, change=f"${week_close:.2f}")],
                        ))

            prev_week_close = week_close

    # Deduplicate milestones on same date — keep unique by headline
    seen_headlines: set[str] = set()
    unique: list[Milestone] = []
    for m in milestones:
        if m.headline not in seen_headlines:
            seen_headlines.add(m.headline)
            unique.append(m)

    return unique


def _build_today_marker(all_data: dict[str, list[dict]]) -> Milestone:
    """Build the 'today' marker with current prices."""
    today = date.today().isoformat()
    week = _week_number(today)

    # Gather latest prices for description
    prices: list[str] = []
    for key in ["wti", "diesel", "gasoline"]:
        obs = all_data.get(key)
        if obs:
            latest = obs[-1]
            prices.append(f"{SERIES_NAMES.get(key, key)} at ${latest['value']:.2f}")

    desc = ". ".join(prices) + "." if prices else "Current market data loading."

    return Milestone(
        type="today",
        date=today,
        week=week,
        headline=f"{week} weeks into the conflict",
        description=desc,
        badges=[],
    )


@router.get("", response_model=dict)
async def get_milestones():
    """Return merged editorial + data-detected milestones, sorted chronologically."""
    # Check cache
    cache_key = "milestones_merged"
    cached = await get_cached(cache_key, IRAN_WAR_DATE, date.today().isoformat())
    if cached is not None:
        return {"milestones": cached}

    # Fetch all series data once (shared by milestone detection + today marker)
    all_data = await _fetch_all_series()

    # Load editorial milestones
    editorial = _load_editorial()

    # Detect data milestones from the pre-fetched data
    data_milestones = _detect_data_milestones(all_data)

    # Build today marker from the same data
    today_marker = _build_today_marker(all_data)

    # Merge, sort, append today
    all_milestones = editorial + data_milestones
    all_milestones.sort(key=lambda m: m.date)
    all_milestones.append(today_marker)

    # Cache the result
    result = [m.model_dump() for m in all_milestones]
    await set_cached(cache_key, IRAN_WAR_DATE, end, result)

    return {"milestones": result}
```

- [ ] **Step 2: Register the router in main.py**

In `backend/main.py`, add the import and include:

Add to imports (line 15):
```python
from routers import prices, simulation, correlations, milestones
```

Add after the existing router includes (after line 53):
```python
app.include_router(milestones.router)
```

- [ ] **Step 3: Test the endpoint**

Run: `curl -s http://localhost:8000/api/milestones | py -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"milestones\"])} milestones'); [print(f'  [{m[\"type\"]}] {m[\"date\"]}: {m[\"headline\"]}') for m in d['milestones']]"`

Expected: List of editorial + data milestones + today marker, sorted by date.

- [ ] **Step 4: Commit**

```bash
git add backend/routers/milestones.py backend/main.py
git commit -m "feat: add milestones endpoint with editorial + auto-detected events"
```

---

## Task 8: TimelineMilestone component (individual card with scroll animation)

**Files:**
- Create: `frontend/src/components/timeline/TimelineMilestone.tsx`

- [ ] **Step 1: Create the milestone card component**

Create `frontend/src/components/timeline/TimelineMilestone.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import type { Milestone } from '../../types';

interface TimelineMilestoneProps {
  milestone: Milestone;
  index: number;
}

const DOT_STYLES: Record<string, { bg: string; shadow: string }> = {
  editorial: { bg: '#FF3366', shadow: '0 0 8px rgba(255,51,102,0.4)' },
  data: { bg: '#00F0FF', shadow: '0 0 8px rgba(0,240,255,0.3)' },
  today: { bg: '#00FF88', shadow: '0 0 8px rgba(0,255,136,0.4)' },
};

export function TimelineMilestone({ milestone, index }: TimelineMilestoneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Track reveal timing to stagger cards entering viewport together
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Use a shared timestamp to batch cards entering within 200ms of each other
          const now = Date.now();
          const lastReveal = Number(document.documentElement.dataset.lastMilestoneReveal || '0');
          const batchIndex = (now - lastReveal < 200)
            ? Number(document.documentElement.dataset.milestoneBatchIdx || '0') + 1
            : 0;
          document.documentElement.dataset.lastMilestoneReveal = String(now);
          document.documentElement.dataset.milestoneBatchIdx = String(batchIndex);

          el.style.animationDelay = `${batchIndex * 0.1}s`;
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  const dot = DOT_STYLES[milestone.type] || DOT_STYLES.data;
  const isToday = milestone.type === 'today';

  // Format date label
  const dateLabel = milestone.type === 'today'
    ? `Today \u2022 ${new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : milestone.week > 0
      ? `Week ${milestone.week} \u2022 ${new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div ref={ref} className="timeline-milestone relative pl-12 mb-8" style={{ minHeight: 60 }}>
      {/* Dot */}
      {isToday ? (
        <div
          className="absolute left-0 top-1"
          style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${dot.bg}`, background: '#04060C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            style={{ width: 8, height: 8, borderRadius: '50%', background: dot.bg, animation: 'todayPulse 2s ease-in-out infinite' }}
          />
        </div>
      ) : (
        <div
          className="absolute left-[3px] top-1"
          style={{ width: 12, height: 12, borderRadius: '50%', background: dot.bg, border: '2px solid #04060C', boxShadow: dot.shadow }}
        />
      )}

      {/* Content */}
      <div
        className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] uppercase mb-1"
        style={{ color: '#00F0FF' }}
      >
        {dateLabel}
        {milestone.type === 'editorial' && (
          <span className="ml-2 text-red">{'\u2022'} Event</span>
        )}
      </div>

      <div className="text-[15px] font-semibold text-text-primary mb-1">
        {milestone.headline}
      </div>

      <div className="text-[13px] text-text-secondary">
        {milestone.description}
      </div>

      {/* Badges */}
      {milestone.badges.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {milestone.badges.map((badge, i) => (
            <span
              key={i}
              className="font-[family-name:var(--font-mono)] text-[10px] px-2 py-0.5 border rounded-sm"
              style={{ borderColor: 'rgba(255,51,102,0.3)', color: '#FF3366' }}
            >
              {badge.label} {badge.change}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/timeline/TimelineMilestone.tsx
git commit -m "feat: add TimelineMilestone component with scroll-triggered animation"
```

---

## Task 9: WarTimelineSection component

**Files:**
- Create: `frontend/src/components/sections/WarTimelineSection.tsx`

- [ ] **Step 1: Create the timeline section**

Create `frontend/src/components/sections/WarTimelineSection.tsx`:

```typescript
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useMilestones } from '../../hooks/useOilPrices';
import { TimelineMilestone } from '../timeline/TimelineMilestone';

export function WarTimelineSection() {
  const { data, isLoading, isError } = useMilestones();
  const ref = useScrollReveal();

  if (isError) return null;

  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref as any}>
        <div className="section-reading">
          <h2 className="editorial-header">The War's Ripple</h2>
          <p className="editorial-subhead mb-4">Loading timeline...</p>
          <div className="section-rule" />
          {/* Skeleton */}
          <div className="relative mt-8 pl-12">
            <div
              className="absolute left-[8px] top-0 bottom-0 w-[2px]"
              style={{ background: 'linear-gradient(180deg, rgba(0,240,255,0.2), rgba(0,240,255,0.05))' }}
            />
            {[1, 2, 3].map((i) => (
              <div key={i} className="mb-8">
                <div className="h-3 w-32 bg-surface rounded animate-pulse mb-2" />
                <div className="h-4 w-64 bg-surface rounded animate-pulse mb-1" />
                <div className="h-3 w-48 bg-surface rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const milestones = data?.milestones ?? [];
  if (!milestones.length) return null;

  return (
    <section className="py-24 scroll-reveal" ref={ref as any}>
      <div className="section-reading">
        <h2 className="editorial-header">The War's Ripple</h2>
        <p className="editorial-subhead">
          Week by week, here's how the Iran war reshaped prices from the barrel to your wallet.
        </p>
        <div className="section-rule" />

        {/* Timeline */}
        <div className="relative mt-8">
          {/* Vertical line */}
          <div
            className="absolute left-[8px] top-0 bottom-0 w-[2px]"
            style={{ background: 'linear-gradient(180deg, #00F0FF, rgba(0,240,255,0.1))' }}
          />

          {/* Milestone cards */}
          {milestones.map((m, i) => (
            <TimelineMilestone key={`${m.type}-${m.date}-${i}`} milestone={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean compile.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/sections/WarTimelineSection.tsx
git commit -m "feat: add WarTimelineSection with vertical timeline and milestone cards"
```

---

## Task 10: Wire timeline into App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add timeline import and render between Supply Chain and Downstream**

Add import at top of `App.tsx`:
```typescript
import { WarTimelineSection } from './components/sections/WarTimelineSection';
```

Add between `<SupplyChainSection />` and `<DownstreamSection />`:
```tsx
      {/* Section 5: Supply Chain Flow — animated downstream visualization */}
      <SupplyChainSection />

      {/* Section 6: War Impact Timeline — week-by-week narrative */}
      <WarTimelineSection />

      {/* Section 7: Downstream correlations — editorial grid */}
      <DownstreamSection />
```

- [ ] **Step 2: Verify in browser**

Run: Open `http://localhost:5173` and scroll to between Supply Chain and Ripple Effect.
Expected: "THE WAR'S RIPPLE" section with vertical timeline, editorial + data milestones, today marker with pulsing green dot. Cards animate in with stagger as you scroll.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire WarTimelineSection between Supply Chain and Downstream"
```

---

## Task 11: Final verification + push

- [ ] **Step 1: Full type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Clean compile, zero errors.

- [ ] **Step 2: Visual verification checklist**

Open `http://localhost:5173` and verify:
1. Sticky ticker bar at top — items scroll continuously, seamless loop
2. Gas/Diesel/Nat Gas show dollar prices + war changes in red/green
3. CPI items show "awaiting data" in grey italic
4. Scroll-progress bar renders directly below ticker (at 36px)
5. Hero content starts below ticker (no overlap)
6. Scroll down to "THE WAR'S RIPPLE" — milestones animate in on scroll
7. Editorial milestones have red dots, data milestones have cyan dots
8. Today marker has pulsing green dot and is the last item
9. Badge pills show on data milestones
10. Supply Chain → Timeline → Ripple Effect order is correct

- [ ] **Step 3: Push to remote**

```bash
export PATH="$PATH:/c/Program Files/GitHub CLI"
git push
```
