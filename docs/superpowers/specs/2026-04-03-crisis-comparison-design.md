# "How Bad Is It?" Historical Crisis Comparison

## Context

The Oil Tracking Dashboard visualizes the 2026 Iran War's impact on oil prices and downstream consumer goods. It uses React 19 + TypeScript + Vite + Tailwind v4 on the frontend and FastAPI + SQLite-cached FRED data on the backend.

The dashboard currently flows: Hero (live price) -> Forecast (Monte Carlo + scenarios) -> Prediction Markets (crowd odds) -> Stats Band -> Risk (volatility) -> Supply Chain Flow -> War Timeline -> Downstream Correlations -> Raw Data.

What is missing is **historical perspective**. The user sees that oil is up X% since the Iran War started, but has no intuitive way to answer: "Is this worse than the Gulf War? The 2008 super-spike? The '73 embargo?" This section answers that question with animated horizontal bars comparing 7 major oil crises, plus expandable day-by-day trajectory charts.

**Baseline constant:** `IRAN_WAR_DATE = '2026-02-28'` (defined in `frontend/src/lib/commodity-data.ts` and `backend/routers/milestones.py`).

---

## Section Placement

Between **WarTimelineSection** and **DownstreamSection** in `App.tsx`. The narrative flow becomes:

1. War Timeline -- "Here's what happened week by week"
2. **Crisis Comparison** -- "Here's how it compares to history"
3. Downstream -- "Here's how it's hitting your wallet"

In `App.tsx`, the import and JSX insertion:

```tsx
import { CrisisComparisonSection } from './components/sections/CrisisComparisonSection';

// ... inside DashboardContent, between WarTimelineSection and DownstreamSection:
<WarTimelineSection />
<CrisisComparisonSection />
<DownstreamSection />
```

---

## The 7 Crises

| # | ID | Name | Start | End | Notes |
|---|-----|------|-------|-----|-------|
| 1 | `1973_embargo` | Arab Oil Embargo | 1973-10-17 | 1974-03-18 | The original oil shock. OAPEC embargo against Israel-supporting nations. Pre-FRED era -- hardcoded data. |
| 2 | `1979_revolution` | Iranian Revolution | 1979-01-16 | 1980-06-30 | Shah flees, production collapses from 6M to 1.5M bpd. Parallel to current Iran situation. Pre-FRED -- hardcoded data. |
| 3 | `1990_gulf_war` | Gulf War | 1990-08-02 | 1991-02-28 | Iraq invades Kuwait. Quick, violent spike from $17 to $41. FRED data available. |
| 4 | `2008_superspike` | Price Super-Spike | 2007-01-02 | 2008-07-11 | Speculation-driven run to $147/bbl. FRED data available. |
| 5 | `2014_opec_war` | OPEC Price War | 2014-06-20 | 2016-02-11 | Saudi Arabia vs US shale. Prices **collapsed** -- shows the other direction. FRED data available. |
| 6 | `2022_russia_ukraine` | Russia-Ukraine War | 2022-02-24 | 2022-06-14 | Most recent memory. Russian invasion, sanctions, supply fears. FRED data available. |
| 7 | `2026_iran` | Iran War (NOW) | 2026-02-28 | null (ongoing) | Live pulsing bar. The punchline. FRED data available (live). |

---

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/components/sections/CrisisComparisonSection.tsx` | Section wrapper with scroll reveal, editorial header, metric toggle state, loading skeleton |
| `frontend/src/components/crisis/CrisisBar.tsx` | Single animated bar row with expand/collapse for detail panel |
| `frontend/src/components/crisis/CrisisTrajectoryChart.tsx` | Small Plotly dual-line chart (historical crisis vs 2026 Iran War) |
| `frontend/src/lib/crisis-data.ts` | Crisis definitions, hardcoded pre-FRED data points, context blurbs, color mappings |
| `frontend/src/hooks/useCrisisComparison.ts` | TanStack React Query hook for `GET /api/crisis/comparison` |
| `backend/routers/crisis.py` | FastAPI router with `GET /api/crisis/comparison` endpoint |
| `backend/services/crisis_analysis.py` | Compute peak spikes, durations, gas impacts, and trajectories from FRED + hardcoded data |

### Modified Files

| File | Change |
|------|--------|
| `backend/main.py` | Register `crisis` router: `from routers import crisis` then `app.include_router(crisis.router)` |
| `backend/models/schemas.py` | Add `CrisisTrajectoryPoint`, `CrisisData`, `CrisisComparisonResponse` Pydantic models |
| `frontend/src/types/index.ts` | Add `CrisisTrajectoryPoint`, `CrisisData`, `CrisisComparisonResponse` TypeScript interfaces |
| `frontend/src/lib/api.ts` | Add `fetchCrisisComparison()` function |
| `frontend/src/App.tsx` | Import and render `<CrisisComparisonSection />` between WarTimelineSection and DownstreamSection |

---

## Data Model

### Backend Pydantic Schemas

Add to `backend/models/schemas.py`:

```python
# ---------------------------------------------------------------------------
# Crisis comparison models
# ---------------------------------------------------------------------------

class CrisisTrajectoryPoint(BaseModel):
    day: int
    pct_change: float

class CrisisData(BaseModel):
    id: str
    name: str
    year: int
    start_date: str
    end_date: str | None = None
    peak_spike_pct: float | None = None
    duration_months: float | None = None
    gas_impact_pct: float | None = None
    context: str
    trajectory: list[CrisisTrajectoryPoint]
    is_current: bool

class CrisisComparisonResponse(BaseModel):
    crises: list[CrisisData]
    updated_at: str
```

### Frontend TypeScript Types

Add to `frontend/src/types/index.ts`:

```typescript
// Crisis comparison types
export interface CrisisTrajectoryPoint {
  day: number;
  pct_change: number;
}

export interface CrisisData {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string | null;
  peak_spike_pct: number | null;
  duration_months: number | null;
  gas_impact_pct: number | null;
  context: string;
  trajectory: CrisisTrajectoryPoint[];
  is_current: boolean;
}

export interface CrisisComparisonResponse {
  crises: CrisisData[];
  updated_at: string;
}
```

---

## Backend

### `services/crisis_analysis.py`

This service computes crisis comparison data from two sources:

1. **FRED WTI daily data** (series `DCOILWTICO`) -- available from 1986-01-02 onward. Covers crises 3-7.
2. **Hardcoded historical data** -- for crises 1-2 (pre-FRED era). Well-documented historical prices from EIA records.

#### Hardcoded Data for Pre-FRED Crises

```python
# 1973 Arab Oil Embargo
# Pre-embargo WTI ~$3.56/bbl, peak ~$11.65/bbl (Jan 1974)
# Monthly data points from EIA historical tables
EMBARGO_1973_TRAJECTORY = [
    {"day": 0, "pct_change": 0.0},       # Oct 17, 1973 - $3.56
    {"day": 30, "pct_change": 33.7},      # Nov 1973 - $4.76
    {"day": 60, "pct_change": 98.6},      # Dec 1973 - $7.07
    {"day": 90, "pct_change": 227.2},     # Jan 1974 - $11.65 (peak)
    {"day": 120, "pct_change": 196.1},    # Feb 1974 - $10.54
    {"day": 152, "pct_change": 176.7},    # Mar 1974 - $9.85 (embargo ends)
]

# 1979 Iranian Revolution
# Pre-revolution WTI ~$14.00/bbl, peak ~$39.50/bbl (Apr 1980)
REVOLUTION_1979_TRAJECTORY = [
    {"day": 0, "pct_change": 0.0},       # Jan 16, 1979 - $14.00
    {"day": 30, "pct_change": 7.1},       # Feb 1979 - $15.00
    {"day": 60, "pct_change": 14.3},      # Mar 1979 - $16.00
    {"day": 90, "pct_change": 35.7},      # Apr 1979 - $19.00
    {"day": 150, "pct_change": 71.4},     # Jun 1979 - $24.00
    {"day": 210, "pct_change": 107.1},    # Aug 1979 - $29.00
    {"day": 270, "pct_change": 142.9},    # Oct 1979 - $34.00
    {"day": 330, "pct_change": 164.3},    # Dec 1979 - $37.00
    {"day": 365, "pct_change": 171.4},    # Jan 1980 - $38.00
    {"day": 455, "pct_change": 182.1},    # Apr 1980 - $39.50 (peak)
    {"day": 530, "pct_change": 150.0},    # Jun 1980 - $35.00
]
```

#### Key Functions

```python
"""Crisis analysis service — computes historical oil crisis comparisons."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from services.fred_client import fetch_series
from services.cache import get_cached, set_cached

IRAN_WAR_DATE = "2026-02-28"
CACHE_KEY = "crisis:comparison"


async def get_crisis_comparison() -> dict:
    """Build the full crisis comparison response."""
    ...


async def _compute_fred_crisis(
    series_id: str,
    crisis_start: str,
    crisis_end: str | None,
) -> tuple[float, list[dict]]:
    """
    Fetch FRED WTI data for a date range, compute:
    - peak_spike_pct: max % increase from day-0 price to any price in the range
    - trajectory: list of {day, pct_change} points normalized to day 0

    For the 2026 Iran War (crisis_end=None), fetches up to today.
    """
    ...


async def _compute_gas_impact(crisis_start: str, crisis_end: str | None) -> float | None:
    """
    Compute % increase in retail gasoline prices during the crisis.
    Uses FRED series GASREGW (weekly regular gasoline, available from 1990).
    For 1973/1979: return hardcoded values.
    For crises where gas data is unavailable: return None.
    """
    ...


def _compute_duration_months(start: str, end: str | None) -> float | None:
    """Return duration in months. None if ongoing (end is None)."""
    ...
```

#### Computation Logic

For each FRED-era crisis (1990 onward):

1. Fetch DCOILWTICO data from `crisis_start - 5 days` through `crisis_end + 5 days` (buffer for weekends/holidays).
2. Find the first available price on or after `crisis_start` -- this is the Day 0 baseline price.
3. Compute `pct_change = ((price - baseline) / baseline) * 100` for each subsequent trading day.
4. `peak_spike_pct` = max of all `pct_change` values in the range.
5. Build trajectory array: sample every trading day, with `day` = calendar days since crisis start.

For the **2014 OPEC Price War** specifically: `peak_spike_pct` will be **negative** (prices fell), and this is intentional. The bar should extend leftward.

For the **2026 Iran War**: `crisis_end` is None, so fetch through today. `duration_months` is None (ongoing). `peak_spike_pct` and `gas_impact_pct` are computed live from the latest available data.

#### Gas Impact Data

| Crisis | Gas Source | Hardcoded? |
|--------|-----------|------------|
| 1973 Embargo | 43% at pump (historical record) | Yes |
| 1979 Revolution | 80% at pump (historical record) | Yes |
| 1990 Gulf War | FRED GASREGW | No -- computed |
| 2008 Super-Spike | FRED GASREGW | No -- computed |
| 2014 OPEC War | FRED GASREGW (negative) | No -- computed |
| 2022 Russia-Ukraine | FRED GASREGW | No -- computed |
| 2026 Iran War | FRED GASREGW (live) | No -- computed |

#### Caching Strategy

Use the existing SQLite cache (`services/cache.py`). Cache key: `"crisis:comparison"`. Date range: `"1973-01-01"` to today's date. TTL: standard 24h (FRED data only updates daily). The cache stores the full `CrisisComparisonResponse` JSON.

On cache miss or stale:
1. Compute all 7 crises (hardcoded ones are instant, FRED ones require API calls).
2. FRED data for historical crises (1990-2022) is already cached individually by `fred_client.py`, so the per-series cache hits will be fast.
3. Only the 2026 Iran War trajectory needs fresh FRED data (which is also likely cached from other dashboard sections).

### `routers/crisis.py`

```python
"""Crisis comparison endpoint."""

from fastapi import APIRouter

from services.crisis_analysis import get_crisis_comparison

router = APIRouter(prefix="/api/crisis", tags=["crisis"])


@router.get("/comparison")
async def crisis_comparison():
    """
    Returns comparison data for 7 major oil crises:
    peak price spike %, crisis duration, gas price impact,
    and day-by-day price trajectories normalized to % change from Day 0.
    """
    return await get_crisis_comparison()
```

### Register Router in `main.py`

```python
from routers import prices, simulation, correlations, milestones, polymarket, crisis

# ... existing includes ...
app.include_router(crisis.router)
```

### API Response Shape

`GET /api/crisis/comparison`

```json
{
  "crises": [
    {
      "id": "1973_embargo",
      "name": "Arab Oil Embargo",
      "year": 1973,
      "start_date": "1973-10-17",
      "end_date": "1974-03-18",
      "peak_spike_pct": 227.2,
      "duration_months": 5,
      "gas_impact_pct": 43.0,
      "context": "OAPEC proclaimed an oil embargo against nations supporting Israel in the Yom Kippur War. Oil prices quadrupled in six months, triggering the first global energy crisis and long gas station lines across America.",
      "trajectory": [
        {"day": 0, "pct_change": 0.0},
        {"day": 30, "pct_change": 33.7},
        {"day": 60, "pct_change": 98.6},
        {"day": 90, "pct_change": 227.2},
        {"day": 120, "pct_change": 196.1},
        {"day": 152, "pct_change": 176.7}
      ],
      "is_current": false
    },
    {
      "id": "1979_revolution",
      "name": "Iranian Revolution",
      "year": 1979,
      "start_date": "1979-01-16",
      "end_date": "1980-06-30",
      "peak_spike_pct": 182.1,
      "duration_months": 17,
      "gas_impact_pct": 80.0,
      "context": "The Shah fled Iran as revolution swept the country. Iranian oil production collapsed from 6 million to 1.5 million barrels per day. The direct historical parallel to the current Iran conflict.",
      "trajectory": [
        {"day": 0, "pct_change": 0.0},
        {"day": 30, "pct_change": 7.1},
        {"day": 455, "pct_change": 182.1}
      ],
      "is_current": false
    },
    {
      "id": "1990_gulf_war",
      "name": "Gulf War",
      "year": 1990,
      "start_date": "1990-08-02",
      "end_date": "1991-02-28",
      "peak_spike_pct": null,
      "duration_months": 7,
      "gas_impact_pct": null,
      "context": "Iraq invaded Kuwait and Saddam Hussein torched oil fields. Prices spiked from $17 to $41 in weeks \u2014 a fast, violent shock. The war itself was quick but the price impact was immediate.",
      "trajectory": [],
      "is_current": false
    },
    {
      "id": "2008_superspike",
      "name": "Price Super-Spike",
      "year": 2008,
      "start_date": "2007-01-02",
      "end_date": "2008-07-11",
      "peak_spike_pct": null,
      "duration_months": 18,
      "gas_impact_pct": null,
      "context": "Speculation and surging demand drove oil from $50 to $147/bbl \u2014 the all-time record. Goldman Sachs coined the term 'super-spike.' The subsequent crash to $32 was equally dramatic.",
      "trajectory": [],
      "is_current": false
    },
    {
      "id": "2014_opec_war",
      "name": "OPEC Price War",
      "year": 2014,
      "start_date": "2014-06-20",
      "end_date": "2016-02-11",
      "peak_spike_pct": null,
      "duration_months": 20,
      "gas_impact_pct": null,
      "context": "Saudi Arabia refused to cut production, flooding the market to crush US shale competitors. Oil crashed from $107 to $26. A reminder that oil can collapse just as violently as it spikes.",
      "trajectory": [],
      "is_current": false
    },
    {
      "id": "2022_russia_ukraine",
      "name": "Russia-Ukraine War",
      "year": 2022,
      "start_date": "2022-02-24",
      "end_date": "2022-06-14",
      "peak_spike_pct": null,
      "duration_months": 4,
      "gas_impact_pct": null,
      "context": "Russia invaded Ukraine and the West imposed sweeping sanctions. Oil spiked above $120 on fears of Russian supply disappearing. The most recent crisis in collective memory.",
      "trajectory": [],
      "is_current": false
    },
    {
      "id": "2026_iran",
      "name": "Iran War",
      "year": 2026,
      "start_date": "2026-02-28",
      "end_date": null,
      "peak_spike_pct": null,
      "duration_months": null,
      "gas_impact_pct": null,
      "context": "US military strikes on Iran closed the Strait of Hormuz to tanker traffic, removing ~20% of global oil transit. The crisis you are living through right now.",
      "trajectory": [],
      "is_current": true
    }
  ],
  "updated_at": "2026-04-03T14:30:00Z"
}
```

Note: `peak_spike_pct`, `gas_impact_pct`, and `trajectory` for FRED-era crises are computed dynamically (shown as `null`/`[]` above as placeholders). The 2026 Iran War entry always has `is_current: true` and `end_date: null`.

---

## Frontend

### API Function

Add to `frontend/src/lib/api.ts`:

```typescript
import type { CrisisComparisonResponse } from '../types';

/** Fetch historical crisis comparison data */
export function fetchCrisisComparison(): Promise<CrisisComparisonResponse> {
  return fetchJson<CrisisComparisonResponse>(`${BASE}/crisis/comparison`);
}
```

### React Query Hook -- `hooks/useCrisisComparison.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchCrisisComparison } from '../lib/api';
import type { CrisisComparisonResponse } from '../types';

export function useCrisisComparison() {
  return useQuery<CrisisComparisonResponse>({
    queryKey: ['crisis', 'comparison'],
    queryFn: fetchCrisisComparison,
    staleTime: 30 * 60 * 1000, // 30 min -- historical data rarely changes
    retry: 2,
  });
}
```

### Crisis Data Constants -- `lib/crisis-data.ts`

This file stores **client-side constants** for the crisis bars: colors, category labels, and ordering. It does NOT duplicate the backend data but provides rendering metadata.

```typescript
export type CrisisMetric = 'peak_spike' | 'duration' | 'gas_impact';

export const METRIC_LABELS: Record<CrisisMetric, string> = {
  peak_spike: 'Peak Price Spike',
  duration: 'Crisis Duration',
  gas_impact: 'Gas Price Impact',
};

export const METRIC_UNITS: Record<CrisisMetric, string> = {
  peak_spike: '%',
  duration: 'mo',
  gas_impact: '%',
};

export const CRISIS_COLORS: Record<string, string> = {
  '1973_embargo': '#FF8800',
  '1979_revolution': '#FF8800',
  '1990_gulf_war': '#FF3366',
  '2008_superspike': '#FF3366',
  '2014_opec_war': '#00FF88',   // Green for collapse (different direction)
  '2022_russia_ukraine': '#FF3366',
  '2026_iran': '#00F0FF',       // Cyan accent, pulsing
};

/**
 * Returns the numeric value for a given crisis and metric.
 * Used to determine bar width (proportional to max across all crises).
 */
export function getCrisisMetricValue(
  crisis: { peak_spike_pct: number | null; duration_months: number | null; gas_impact_pct: number | null },
  metric: CrisisMetric,
): number | null {
  switch (metric) {
    case 'peak_spike': return crisis.peak_spike_pct;
    case 'duration': return crisis.duration_months;
    case 'gas_impact': return crisis.gas_impact_pct;
  }
}
```

### Section Component -- `CrisisComparisonSection.tsx`

```typescript
// Pseudocode structure — not final implementation

import { useState } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useCrisisComparison } from '../../hooks/useCrisisComparison';
import { CrisisBar } from '../crisis/CrisisBar';
import type { CrisisMetric } from '../../lib/crisis-data';
import { METRIC_LABELS } from '../../lib/crisis-data';

export function CrisisComparisonSection() {
  const ref = useScrollReveal();
  const { data, isLoading, isError } = useCrisisComparison();
  const [metric, setMetric] = useState<CrisisMetric>('peak_spike');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // If API fails entirely, hide the section (same pattern as PredictionMarketsSection)
  if (isError) return null;

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <h2 className="editorial-header">How Bad Is It?</h2>
          <p className="editorial-subhead">Loading crisis data...</p>
          <div className="section-rule" />
          <div className="mt-8 space-y-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-3 w-16 bg-surface rounded animate-pulse" />
                <div
                  className="h-8 bg-surface rounded animate-pulse"
                  style={{ width: `${90 - i * 8}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const crises = data?.crises ?? [];
  const iranWar = crises.find((c) => c.is_current);

  return (
    <section className="py-24 scroll-reveal" ref={ref}>
      <div className="section-reading">
        <h2 className="editorial-header">How Bad Is It?</h2>
        <p className="editorial-subhead">
          Seven oil crises since 1973, stacked against the one you're living through now.
        </p>
        <div className="section-rule" />
      </div>

      <div className="section-wide mt-8">
        {/* Crisis bars */}
        <div className="space-y-2">
          {crises.map((crisis, index) => (
            <CrisisBar
              key={crisis.id}
              crisis={crisis}
              metric={metric}
              index={index}
              maxValue={/* max absolute metric value across all crises */}
              expanded={expandedId === crisis.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === crisis.id ? null : crisis.id)
              }
              iranWarTrajectory={iranWar?.trajectory ?? []}
            />
          ))}
        </div>

        {/* Metric toggle */}
        <div className="flex justify-center gap-2 mt-8">
          {(['peak_spike', 'duration', 'gas_impact'] as CrisisMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-4 py-2 rounded text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider transition-colors ${
                metric === m
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'bg-surface text-secondary hover:text-primary border border-transparent'
              }`}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
```

### CrisisBar Component -- `crisis/CrisisBar.tsx`

Each bar row renders:

1. **Year badge** -- 4-digit year in mono font, left-aligned
2. **Crisis name** -- Outfit font, secondary text
3. **Animated horizontal bar** -- width proportional to metric value / maxValue
4. **Value label** -- at the end of the bar, e.g., "+227%" or "5 mo"
5. **Expand indicator** -- subtle chevron or "+" icon

Layout (single row):

```
[1973] Arab Oil Embargo  [=============================] +227%  [v]
```

On click, the row expands to show:
- 1-2 sentence editorial context blurb
- Small Plotly dual-line trajectory chart (this crisis vs 2026 Iran War)

#### Bar Behavior by Metric

| Metric | Bar Direction | Bar Color | Value Format |
|--------|--------------|-----------|-------------|
| Peak Spike | Right (positive) | Crisis color from `CRISIS_COLORS` | `+227%` |
| Peak Spike (2014 OPEC) | **Left** (negative) | Green `#00FF88` | `-75%` |
| Duration | Right | Crisis color | `5 mo` |
| Gas Impact | Right (positive) | Crisis color | `+43%` |
| Gas Impact (2014 OPEC) | **Left** (negative) | Green `#00FF88` | `-48%` |

The 2026 Iran War bar is always cyan (`#00F0FF`) and has a pulsing animation. If a metric value is `null` (e.g., duration for an ongoing crisis), show "ongoing" text instead of a bar.

#### Expand/Collapse Animation

```css
.crisis-detail-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 400ms ease-out;
}

.crisis-detail-panel.expanded {
  grid-template-rows: 1fr;
}

.crisis-detail-panel > div {
  overflow: hidden;
}
```

This CSS grid trick allows smooth height animation from 0 to auto without needing a fixed max-height.

### CrisisTrajectoryChart -- `crisis/CrisisTrajectoryChart.tsx`

A small Plotly chart shown inside the expanded detail panel.

**Two traces:**
1. **Historical crisis** -- red/orange line (color matches bar), label = crisis name
2. **2026 Iran War** -- cyan line (`#00F0FF`), label = "Iran War (2026)"

**Both normalized to % change from Day 0** on the Y-axis. X-axis = "Days since crisis start."

```typescript
import Plot from 'react-plotly.js';
import { PLOTLY_DARK_LAYOUT, PLOTLY_CONFIG } from '../../lib/constants';
import type { CrisisTrajectoryPoint } from '../../types';

interface Props {
  crisisName: string;
  crisisColor: string;
  crisisTrajectory: CrisisTrajectoryPoint[];
  iranWarTrajectory: CrisisTrajectoryPoint[];
}

export function CrisisTrajectoryChart({
  crisisName,
  crisisColor,
  crisisTrajectory,
  iranWarTrajectory,
}: Props) {
  if (!crisisTrajectory.length) {
    return (
      <div className="h-48 flex items-center justify-center text-secondary text-sm font-[family-name:var(--font-mono)]">
        Trajectory data unavailable for this crisis
      </div>
    );
  }

  const traces = [
    {
      x: crisisTrajectory.map((p) => p.day),
      y: crisisTrajectory.map((p) => p.pct_change),
      name: crisisName,
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: crisisColor, width: 2 },
    },
    {
      x: iranWarTrajectory.map((p) => p.day),
      y: iranWarTrajectory.map((p) => p.pct_change),
      name: 'Iran War (2026)',
      type: 'scatter' as const,
      mode: 'lines' as const,
      line: { color: '#00F0FF', width: 2, dash: 'dot' as const },
    },
  ];

  const layout = {
    ...PLOTLY_DARK_LAYOUT,
    height: 200,
    margin: { l: 50, r: 20, t: 10, b: 40 },
    xaxis: {
      ...PLOTLY_DARK_LAYOUT.xaxis,
      title: { text: 'Days since crisis start', font: { size: 10 } },
    },
    yaxis: {
      ...PLOTLY_DARK_LAYOUT.yaxis,
      title: { text: '% change', font: { size: 10 } },
      ticksuffix: '%',
    },
    legend: {
      orientation: 'h' as const,
      y: -0.25,
      font: { size: 10 },
    },
    showlegend: true,
  };

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ ...PLOTLY_CONFIG, displayModeBar: false }}
      style={{ width: '100%' }}
    />
  );
}
```

---

## Styling

### Design System Compliance

All styling follows the established dashboard design system:

| Element | Style |
|---------|-------|
| Section wrapper | `className="py-24 scroll-reveal"` with `ref={useScrollReveal()}` |
| Header | `editorial-header` class: "How Bad Is It?" |
| Subhead | `editorial-subhead` class |
| Divider | `section-rule` class |
| Content width | `section-wide` for the bar chart area, `section-reading` for header |
| Bar background track | `#0A0E18` (Surface color) |
| Expanded panel bg | `rgba(0, 240, 255, 0.03)` -- same tint used in FedDistribution panels |
| Data labels | `font-[family-name:var(--font-mono)]` (IBM Plex Mono) |
| Crisis year badges | `font-[family-name:var(--font-mono)]` |
| Metric toggle buttons | Same styling pattern as SMA toggle buttons in ForecastSection |

### Color Palette for Bars

```
1973 Embargo:         #FF8800 (orange)
1979 Revolution:      #FF8800 (orange)
1990 Gulf War:        #FF3366 (red)
2008 Super-Spike:     #FF3366 (red)
2014 OPEC War:        #00FF88 (green -- different direction, collapse)
2022 Russia-Ukraine:  #FF3366 (red)
2026 Iran War:        #00F0FF (cyan accent -- pulsing, the current crisis)
```

The color logic: orange for older crises, red for modern spikes, green for the anomalous collapse, and cyan for "you are here."

### Bar Gradients

Each bar fill uses a left-to-right gradient for visual depth:

```css
/* Example for a red-category crisis */
background: linear-gradient(90deg, #FF3366 0%, rgba(255, 51, 102, 0.6) 100%);

/* Cyan pulsing bar for 2026 */
background: linear-gradient(90deg, #00F0FF 0%, rgba(0, 240, 255, 0.6) 100%);
```

---

## Animations

### Bar Entry Animation

Bars stagger in on scroll reveal, matching the `TimelineMilestone` pattern:

- Each bar has a `150ms` staggered delay based on its index (`index * 150ms`).
- Bar width animates from `0%` to final value over `800ms` with `ease-out` timing.
- Implemented via inline `style` with `transition` and a `visible` state toggled by the section's scroll-reveal status.

```css
.crisis-bar-fill {
  width: 0%;
  transition: width 800ms ease-out;
}

.scroll-revealed .crisis-bar-fill {
  /* Width set via inline style based on metric value */
}
```

With stagger delay per bar:

```typescript
style={{
  transitionDelay: `${index * 150}ms`,
  width: revealed ? `${barWidthPercent}%` : '0%',
}}
```

### Pulsing Current Crisis Bar

The 2026 Iran War bar pulses with a subtle glow animation:

```css
@keyframes crisisPulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
  }
  50% {
    opacity: 0.85;
    box-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
  }
}

.crisis-bar-current {
  animation: crisisPulse 2s ease-in-out infinite;
}
```

### Metric Toggle Animation

When the user switches metrics, bars re-animate:

1. All bars transition to `width: 0%` over `300ms`.
2. After a `50ms` gap, bars animate to new widths with the same staggered `150ms` pattern.
3. Implemented by toggling a `key` or `animationReset` state that forces React to re-render the bars.

### Trajectory Chart Fade-In

After the expand animation completes (400ms), the Plotly chart fades in:

```css
.crisis-trajectory-chart {
  opacity: 0;
  transition: opacity 300ms ease-in 400ms; /* 400ms delay = wait for expand */
}

.crisis-detail-panel.expanded .crisis-trajectory-chart {
  opacity: 1;
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `GET /api/crisis/comparison` returns HTTP error | Section renders `null` (hidden). Same pattern as `PredictionMarketsSection`. |
| API returns empty `crises` array | Section renders `null` (hidden). |
| Individual crisis has empty `trajectory` array | Expanded view shows "Trajectory data unavailable for this crisis" text instead of chart. |
| Individual crisis has `null` metric value (e.g., `duration_months: null` for ongoing crisis) | Bar shows "ongoing" label. No bar fill rendered. |
| FRED API down during backend computation | Backend returns hardcoded data for 1973/1979 crises + error for others. Frontend gracefully handles partial data -- bars with `null` metrics show "N/A". |
| Network timeout | React Query retries 2x (configured in hook). On final failure, section hides. |

### Key Guarantee

The 1973 and 1979 crises **always work** regardless of FRED API availability, because their data is fully hardcoded in `crisis_analysis.py`. The 2026 Iran War bar depends on FRED data (same data the rest of the dashboard uses), so if FRED is down, this section will hide along with most other sections.

---

## Interaction Flow

1. User scrolls to the section. IntersectionObserver triggers.
2. "How Bad Is It?" header fades in, then bars stagger in top-to-bottom (7 bars, ~1s total).
3. The 2026 Iran War bar (last) arrives with a cyan pulse. It is the visual punchline.
4. Default metric is "Peak Price Spike" -- bars show % increase (or decrease for 2014).
5. User can click any bar to expand it. Only one bar expanded at a time.
6. Expanded panel shows context blurb + trajectory chart (this crisis vs 2026 superimposed).
7. User clicks metric toggle buttons at bottom to switch between Peak Spike / Duration / Gas Impact. Bars re-animate with new values.
8. Clicking the same expanded bar again collapses it.

---

## Section Order After Changes

1. Kitchen Table Ticker (sticky)
2. Hero Section
3. Forecast Section
4. Prediction Markets
5. Stats Band
6. Risk Section
7. Supply Chain Flow
8. War Impact Timeline
9. **Crisis Comparison** (new)
10. Downstream Correlations
11. Raw Data

---

## Testing

### Backend

- Verify `GET /api/crisis/comparison` returns 7 crisis objects.
- Verify hardcoded crises (1973, 1979) always have non-null `peak_spike_pct`, `trajectory`, and `gas_impact_pct`.
- Verify FRED-era crises (1990+) compute `peak_spike_pct` correctly (spot-check known values: 2008 should show ~190% spike from $50 to $147).
- Verify 2014 OPEC crisis returns **negative** `peak_spike_pct`.
- Verify 2026 Iran War has `is_current: true`, `end_date: null`, `duration_months: null`.
- Verify trajectory arrays are sorted by `day` ascending.
- Verify caching works (second request within TTL returns cached response).
- Verify graceful degradation when FRED is unreachable (hardcoded crises still return).

### Frontend

- Verify section renders with scroll-reveal animation.
- Verify 7 bars appear with staggered animation.
- Verify 2026 bar pulses with cyan glow.
- Verify 2014 bar extends leftward (negative direction) for Peak Spike and Gas Impact metrics.
- Verify clicking a bar expands the detail panel with smooth animation.
- Verify only one bar can be expanded at a time.
- Verify trajectory chart shows two lines (historical + 2026).
- Verify metric toggle switches bar values and re-animates.
- Verify "ongoing" label appears for 2026 duration.
- Verify section hides on API error (no broken UI).
- Verify loading skeleton shows 7 shimmer bars.

### Integration

- Verify the Vite dev proxy forwards `/api/crisis/*` to the backend (existing `/api/*` wildcard covers it).
- Verify crisis data loads independently of other sections (FRED cache sharing does not cause conflicts).
- Verify section renders correctly between WarTimelineSection and DownstreamSection.

---

## Emoji Convention

All emoji or icon strings in TypeScript files must use Unicode escapes per project convention. For example, if a context blurb includes an emoji, use `\u{1F4A5}` not a literal character. The context blurbs in `crisis-data.ts` and `crisis_analysis.py` should avoid emoji entirely (plain text editorial prose).
