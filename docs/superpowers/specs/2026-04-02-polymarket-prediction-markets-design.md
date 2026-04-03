# Polymarket Prediction Markets Integration

## Context

The Oil Tracking Dashboard shows historical and forecasted oil prices using FRED data and Monte Carlo simulations. What's missing is a forward-looking **crowd intelligence** signal — what do traders with real money on the line think will happen to oil prices?

Polymarket is the world's largest prediction market platform. It currently hosts **154 active oil-related markets** with ~$19.9M in aggregate trading volume, covering WTI price targets, crude oil futures, daily directional bets, and geopolitical oil events. Prices on these markets directly represent crowd-sourced probability estimates (e.g., if "Yes" trades at $0.69, the crowd assigns a 69% probability to that outcome).

Polymarket exposes **two public, unauthenticated REST APIs** suitable for read-only data ingestion:

- **Gamma API** (`https://gamma-api.polymarket.com`) — market discovery, metadata, outcome prices, volume, liquidity
- **CLOB API** (`https://clob.polymarket.com`) — real-time pricing (midpoints, order books, last trades, spreads)

No API key is required for read endpoints. No authentication, no signup, no rate-limit key. The APIs return JSON and support standard query parameters.

This feature adds a new "Prediction Markets" section to the dashboard showing Polymarket crowd odds on oil price targets, complementing the existing FRED actuals and Monte Carlo forecasts with real market sentiment.

---

## API Reference

### Gamma API — Market Discovery

Base URL: `https://gamma-api.polymarket.com`

| Endpoint | Purpose | Key params |
|----------|---------|------------|
| `GET /markets` | List/filter markets | `closed=false`, `tag=oil`, `limit=50` |
| `GET /events` | Events with grouped outcome markets | `slug={slug}` |
| `GET /events/{id}` | Single event with all outcomes | — |
| `GET /search` | Keyword search across markets/events | `query=crude+oil` |
| `GET /tags` | Browse available topic tags | — |

**Market object fields of interest:**
```json
{
  "id": "abc123",
  "question": "Will WTI hit $120 in April 2026?",
  "conditionId": "0x1234...",
  "outcomes": ["Yes", "No"],
  "outcomePrices": "[0.69, 0.31]",
  "bestBid": 0.68,
  "bestAsk": 0.70,
  "volume": "4200000.00",
  "liquidity": "804000.00",
  "openInterest": 150000,
  "category": "Finance",
  "active": true,
  "closed": false,
  "startDate": "2026-03-15T00:00:00Z",
  "endDate": "2026-04-30T00:00:00Z"
}
```

The `outcomePrices` field is a JSON-encoded array of floats. Index 0 = "Yes" probability, index 1 = "No" probability. These sum to ~1.0.

### CLOB API — Real-Time Pricing

Base URL: `https://clob.polymarket.com`

| Endpoint | Purpose | Key params |
|----------|---------|------------|
| `GET /midpoint` | Midpoint price (avg of best bid/ask) | `token_id={id}` |
| `GET /last-trade-price` | Most recent executed trade price | `token_id={id}` |
| `GET /book` | Full order book (bids + asks) | `token_id={id}` |
| `GET /spread` | Bid-ask spread | `token_id={id}` |
| `GET /price-history` | Historical price data | `token_id={id}`, interval: `1h`, `1d`, `1w` |

The `token_id` comes from the market's condition tokens (linked from the Gamma market object). For batch queries, use `GET /midpoint-prices`, `GET /last-trade-prices` etc. which accept up to 500 token IDs.

### Market Discovery Strategy

Oil markets on Polymarket follow predictable naming patterns. To find them:

1. **Primary:** `GET /markets?tag=oil&closed=false&limit=100` (tag-based filtering)
2. **Fallback:** `GET /search?query=WTI+crude+oil` (keyword search)
3. **Targeted:** Search for specific event slugs like `wti-up-or-down-on-april-2-2026`, `will-crude-oil-cl-hit-by-end-of-june`

The backend should use a combination of tag filtering and keyword search, then filter results client-side for relevance (e.g., only markets with "WTI", "crude", "oil", "brent" in the question text).

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `backend/services/polymarket_client.py` | Async Polymarket API client (Gamma + CLOB), following `fred_client.py` pattern |
| `backend/routers/polymarket.py` | FastAPI endpoints for prediction market data |
| `frontend/src/hooks/usePolymarket.ts` | React Query hooks for Polymarket data |
| `frontend/src/components/sections/PredictionMarketsSection.tsx` | Main section component |
| `frontend/src/components/predictions/PriceTargetBar.tsx` | Individual price target probability bar |
| `frontend/src/components/predictions/MarketSentimentCard.tsx` | Summary sentiment card |

### Modified files

| File | Change |
|------|--------|
| `backend/main.py` | Register `polymarket` router |
| `backend/models/schemas.py` | Add Polymarket Pydantic models |
| `frontend/src/types/index.ts` | Add Polymarket TypeScript interfaces |
| `frontend/src/lib/api.ts` | Add `fetchPolymarketMarkets()` and `fetchPolymarketSummary()` functions |
| `frontend/src/App.tsx` | Add `<PredictionMarketsSection />` between ForecastSection and StatsBand |
| `frontend/src/stores/dashboardStore.ts` | Add `polymarketTimeframe` filter state (optional) |

---

## Backend

### `services/polymarket_client.py`

Follow the exact pattern of `fred_client.py`: async httpx client, uses the existing SQLite cache from `services/cache.py`, but with a **shorter TTL** since prediction markets update much faster than FRED data.

```python
"""Async Polymarket API client with caching."""

from __future__ import annotations

import json
import re
from datetime import date

import httpx

from services.cache import get_cached, set_cached

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"

# Cache TTL for Polymarket data: 10 minutes (vs 24h for FRED)
# The existing cache.py uses a global 24h TTL. Polymarket results
# should use a prefix in the series_id to distinguish them, and the
# router should check freshness more aggressively.
POLYMARKET_CACHE_TTL = 600  # 10 minutes

# Keywords to filter oil-related markets
OIL_KEYWORDS = re.compile(
    r'\b(wti|brent|crude\s*oil|oil\s*price|petroleum|barrel|opec)\b',
    re.IGNORECASE,
)
```

**Key functions:**

1. `async def search_oil_markets() -> list[dict]` — Hits `GET /markets` with tag=oil and closed=false, then keyword-searches as fallback. Filters results to only oil-price-related markets (not political/geopolitical unless price-impacting). Returns normalized market objects.

2. `async def get_market_prices(token_ids: list[str]) -> dict[str, float]` — Batch-fetches midpoint prices from the CLOB API for up to 500 token IDs.

3. `async def get_oil_prediction_summary() -> dict` — Orchestrator function that combines market discovery + pricing into a structured summary. Groups markets by type (price targets, directional, geopolitical) and timeframe (daily, weekly, monthly).

**Caching strategy:** Use the existing `get_cached`/`set_cached` functions from `cache.py`. Use a synthetic series_id like `"polymarket:oil_markets"` and `"polymarket:summary"` so the cache keys don't collide with FRED data. Since `cache.py` uses a global 24h TTL, the polymarket client should check the timestamp itself and treat anything older than 10 minutes as stale (fetch the `ts` column and compare against `POLYMARKET_CACHE_TTL` rather than the global `CACHE_TTL`).

Alternatively (simpler): add an optional `ttl` parameter to `get_cached()` / `set_cached()` that defaults to `CACHE_TTL` but can be overridden. This is a minor, backward-compatible change to `cache.py`.

### `routers/polymarket.py`

```python
router = APIRouter(prefix="/api/polymarket", tags=["polymarket"])
```

| Endpoint | Response | Purpose |
|----------|----------|---------|
| `GET /api/polymarket/markets` | `PolymarketMarketsResponse` | All active oil prediction markets with current odds |
| `GET /api/polymarket/summary` | `PolymarketSummaryResponse` | Aggregated sentiment: key price targets with probabilities, overall market direction |

#### `GET /api/polymarket/markets` response structure

Returns all active oil-related markets, normalized and sorted by volume (highest first):

```json
{
  "markets": [
    {
      "id": "abc123",
      "question": "What will WTI Crude Oil (WTI) hit in April 2026?",
      "outcomes": [
        { "label": "Up $120", "probability": 0.69, "token_id": "tok_1" },
        { "label": "Up $110", "probability": 0.85, "token_id": "tok_2" },
        { "label": "Down $60", "probability": 0.08, "token_id": "tok_3" }
      ],
      "volume": 4200000,
      "liquidity": 804000,
      "end_date": "2026-04-30",
      "category": "price_target",
      "source_url": "https://polymarket.com/event/..."
    }
  ],
  "updated_at": "2026-04-02T14:30:00Z"
}
```

#### `GET /api/polymarket/summary` response structure

A distilled view optimized for the dashboard UI:

```json
{
  "price_targets": [
    { "target": "$120", "direction": "above", "probability": 0.69, "timeframe": "April 2026", "volume": 4200000 },
    { "target": "$110", "direction": "above", "probability": 0.85, "timeframe": "June 2026", "volume": 7000000 },
    { "target": "$100", "direction": "above", "probability": 0.92, "timeframe": "June 2026", "volume": 3500000 },
    { "target": "$60", "direction": "below", "probability": 0.08, "timeframe": "April 2026", "volume": 1200000 }
  ],
  "sentiment": {
    "direction": "bullish",
    "confidence": 0.78,
    "description": "Markets see 69% chance WTI hits $120 by end of April"
  },
  "top_markets_count": 12,
  "total_volume": 19900000,
  "updated_at": "2026-04-02T14:30:00Z"
}
```

The `sentiment` object is computed from the weighted average of directional markets (up vs down), weighted by volume. `confidence` is the volume-weighted average probability of the dominant direction.

### Pydantic schemas (add to `models/schemas.py`)

```python
# ---------------------------------------------------------------------------
# Polymarket prediction models
# ---------------------------------------------------------------------------

class PolymarketOutcome(BaseModel):
    label: str
    probability: float
    token_id: str | None = None

class PolymarketMarket(BaseModel):
    id: str
    question: str
    outcomes: list[PolymarketOutcome]
    volume: float
    liquidity: float
    end_date: str | None = None
    category: str  # "price_target", "directional", "geopolitical"
    source_url: str | None = None

class PolymarketMarketsResponse(BaseModel):
    markets: list[PolymarketMarket]
    updated_at: str

class PriceTarget(BaseModel):
    target: str
    direction: str  # "above" or "below"
    probability: float
    timeframe: str
    volume: float

class MarketSentiment(BaseModel):
    direction: str  # "bullish", "bearish", "neutral"
    confidence: float
    description: str

class PolymarketSummaryResponse(BaseModel):
    price_targets: list[PriceTarget]
    sentiment: MarketSentiment
    top_markets_count: int
    total_volume: float
    updated_at: str
```

### Register router in `main.py`

```python
from routers import prices, simulation, correlations, polymarket

# ... existing router includes ...
app.include_router(polymarket.router)
```

---

## Frontend

### TypeScript types (add to `types/index.ts`)

```typescript
// Polymarket prediction market types
export interface PolymarketOutcome {
  label: string;
  probability: number;
  token_id: string | null;
}

export interface PolymarketMarket {
  id: string;
  question: string;
  outcomes: PolymarketOutcome[];
  volume: number;
  liquidity: number;
  end_date: string | null;
  category: string;
  source_url: string | null;
}

export interface PriceTarget {
  target: string;
  direction: 'above' | 'below';
  probability: number;
  timeframe: string;
  volume: number;
}

export interface MarketSentiment {
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  description: string;
}

export interface PolymarketSummary {
  price_targets: PriceTarget[];
  sentiment: MarketSentiment;
  top_markets_count: number;
  total_volume: number;
  updated_at: string;
}
```

### API functions (add to `lib/api.ts`)

```typescript
/** Fetch Polymarket oil prediction markets */
export function fetchPolymarketMarkets(): Promise<{ markets: PolymarketMarket[]; updated_at: string }> {
  return fetchJson(`${BASE}/polymarket/markets`);
}

/** Fetch Polymarket aggregated summary */
export function fetchPolymarketSummary(): Promise<PolymarketSummary> {
  return fetchJson<PolymarketSummary>(`${BASE}/polymarket/summary`);
}
```

### React Query hooks — `hooks/usePolymarket.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchPolymarketMarkets, fetchPolymarketSummary } from '../lib/api';
import type { PolymarketMarket, PolymarketSummary } from '../types';

export function usePolymarketMarkets() {
  return useQuery<{ markets: PolymarketMarket[]; updated_at: string }>({
    queryKey: ['polymarket', 'markets'],
    queryFn: fetchPolymarketMarkets,
    staleTime: 5 * 60 * 1000,  // 5 min — prediction markets move faster
    retry: 2,
  });
}

export function usePolymarketSummary() {
  return useQuery<PolymarketSummary>({
    queryKey: ['polymarket', 'summary'],
    queryFn: fetchPolymarketSummary,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
```

### Section component — `components/sections/PredictionMarketsSection.tsx`

Follows the existing section pattern: `useScrollReveal()` hook, `scroll-reveal` class, `section-wide` container, `editorial-header` + `editorial-subhead` + `section-rule`.

**Section header:**
```tsx
<div className="section-reading">
  <h2 className="editorial-header">What Traders Think</h2>
  <p className="editorial-subhead">
    Real-money prediction markets show where traders are putting their bets on oil prices.
    Powered by Polymarket — the world's largest prediction market.
  </p>
  <div className="section-rule" />
</div>
```

**Layout — three zones:**

1. **Sentiment Summary Card** (`MarketSentimentCard.tsx`) — Top of section. Shows the `sentiment` object: large directional indicator (bullish/bearish with arrow), confidence percentage, description text, total volume badge. Background tint: green for bullish, red for bearish, gray for neutral.

2. **Price Target Bars** (`PriceTargetBar.tsx`) — Main content. A vertical stack of horizontal probability bars, one per price target. Each bar shows:
   - Target label (e.g., "$120 by April") on the left
   - Filled bar proportional to probability (0-100%)
   - Percentage label at the right end
   - Volume indicator (subtle text below)
   - Bar color: cyan fill on dark surface (matching the accent color)
   - Bars sorted by timeframe then by target price (ascending)

   This creates a visual "probability ladder" — you can see at a glance what the market thinks is likely vs unlikely at each price level.

3. **Source Attribution + Freshness** — Bottom of section. Small text: "Data from Polymarket • Updated X minutes ago" with a link to polymarket.com/predictions/oil. Uses IBM Plex Mono, 10px, secondary text color.

### Styling

- Follows the dark theme: `bg-card` background on cards, `text-accent` for highlights
- Probability bars: `bg-accent` (#00F0FF) fill with `bg-surface` (#0A0E18) track
- Bullish indicator: `text-green` (#00FF88), Bearish: `text-red` (#FF3366)
- Font: IBM Plex Mono for data values, Outfit for labels
- Cards use the same border/shadow pattern as existing stat cards

### Error handling

- If `usePolymarketSummary()` is loading: show skeleton with pulsing placeholder bars
- If `usePolymarketSummary()` fails: section renders with a subtle "Prediction market data unavailable" message instead of hiding entirely (since this is a secondary data source, not core functionality)
- If Polymarket API is down or returns no oil markets: show "No active oil prediction markets found" state

### Emoji convention

All emoji/icon strings in new TypeScript files must use Unicode escapes per project convention.

---

## Section order after changes

1. Kitchen Table Ticker (sticky)
2. Hero Section
3. Forecast Section
4. **Prediction Markets** (new — pairs naturally with the forecast)
5. Stats Band
6. Risk Section
7. Supply Chain Flow
8. War Impact Timeline
9. Ripple Effect (Downstream)
10. Raw Data

The Prediction Markets section goes right after Forecast because they tell a complementary story: the Monte Carlo forecast shows statistical probabilities from historical data, while prediction markets show what real traders with money at stake believe will happen. Placing them adjacent invites the user to compare model vs. crowd intelligence.

---

## Testing

### Backend
- Verify `GET /api/polymarket/markets` returns active oil markets with valid probability values (0-1)
- Verify `GET /api/polymarket/summary` returns aggregated price targets and sentiment
- Verify caching works with 10-minute TTL (second request within 10 min returns cached data)
- Verify graceful handling when Polymarket API is unreachable (return empty results, don't crash)
- Verify market filtering excludes non-oil markets
- Verify sentiment computation produces valid direction/confidence values

### Frontend
- Verify section renders with scroll-reveal animation
- Verify probability bars fill proportionally to probability values
- Verify sentiment card shows correct bullish/bearish/neutral indicator
- Verify "Updated X minutes ago" timestamp refreshes correctly
- Verify section shows graceful fallback when API returns no data
- Verify Polymarket link opens in new tab
- Verify section doesn't break if placed before or after StatsBand (flexible section ordering)

### Integration
- Verify both FRED and Polymarket data load independently (one failing doesn't break the other)
- Verify the Vite proxy correctly forwards `/api/polymarket/*` to the backend (no proxy config changes needed — existing `/api/*` wildcard covers it)
