# Claude Code Prompt — Polymarket Prediction Markets Integration

Copy everything below the line and paste it into Claude Code:

---

Implement the Polymarket Prediction Markets integration for the Oil Tracking Dashboard. The full design spec is at `docs/superpowers/specs/2026-04-02-polymarket-prediction-markets-design.md` and the step-by-step plan is at `docs/superpowers/plans/2026-04-02-polymarket-prediction-markets.md`. Read both files completely before writing any code.

## What to build

Add a new "Prediction Markets" dashboard section that pulls real-money crowd odds on oil price targets from Polymarket's free public APIs (no API key needed). This gives users a forward-looking "what do traders think will happen" signal alongside our existing FRED actuals and Monte Carlo forecasts.

## Implementation order

### 1. Backend service: `backend/services/polymarket_client.py`

Create an async httpx client following the exact pattern of `services/fred_client.py`. It should:

- Hit the Gamma API (`https://gamma-api.polymarket.com`) to discover active oil markets:
  - Primary: `GET /markets?tag=oil&closed=false&limit=100`
  - Fallback: `GET /search?query=WTI+crude+oil`
- Filter results to oil-price-relevant markets only (match keywords: wti, brent, crude oil, petroleum, barrel, opec in the question text)
- Extract outcome prices from the `outcomePrices` JSON string field on each market object
- Use the existing SQLite cache from `services/cache.py` with synthetic series IDs like `"polymarket:oil_markets"` and `"polymarket:summary"`. Important: Polymarket data needs a **10-minute TTL**, not the 24-hour FRED TTL. Either add an optional `ttl` parameter to `get_cached()`/`set_cached()` or check staleness manually against `time.time()`.
- Build a `get_oil_prediction_summary()` function that groups markets by type (price_target, directional, geopolitical) and computes a volume-weighted sentiment score (bullish/bearish/neutral)
- Handle Polymarket being unreachable gracefully — return empty results, never crash

### 2. Backend schemas: add to `backend/models/schemas.py`

Add these Pydantic models: `PolymarketOutcome`, `PolymarketMarket`, `PolymarketMarketsResponse`, `PriceTarget`, `MarketSentiment`, `PolymarketSummaryResponse`. See the design spec for exact field definitions.

### 3. Backend router: `backend/routers/polymarket.py`

Create router with prefix `/api/polymarket`:
- `GET /markets` → returns `PolymarketMarketsResponse` (all active oil markets with outcomes and probabilities, sorted by volume descending)
- `GET /summary` → returns `PolymarketSummaryResponse` (aggregated price targets + computed sentiment)

Register in `backend/main.py` alongside the existing routers.

### 4. Frontend types: add to `frontend/src/types/index.ts`

Add TypeScript interfaces matching the backend schemas: `PolymarketOutcome`, `PolymarketMarket`, `PriceTarget`, `MarketSentiment`, `PolymarketSummary`.

### 5. Frontend API functions: add to `frontend/src/lib/api.ts`

Add `fetchPolymarketMarkets()` and `fetchPolymarketSummary()` using the existing `fetchJson` helper.

### 6. Frontend hook: `frontend/src/hooks/usePolymarket.ts`

Create `usePolymarketMarkets()` and `usePolymarketSummary()` React Query hooks following the pattern in `useOilPrices.ts`. Use 5-minute staleTime (prediction markets move faster than FRED data).

### 7. Frontend section: `frontend/src/components/sections/PredictionMarketsSection.tsx`

Follow the existing section pattern exactly: `useScrollReveal()` hook, `scroll-reveal` class, `section-wide` container, `editorial-header` + `editorial-subhead` + `section-rule`.

- Header: "What Traders Think"
- Subhead: "Real-money prediction markets show where traders are putting their bets on oil prices. Powered by Polymarket — the world's largest prediction market."
- Three zones:
  1. **Sentiment card** — large bullish/bearish/neutral indicator with confidence %, direction arrow, total volume. Green (#00FF88) for bullish, red (#FF3366) for bearish.
  2. **Price target probability bars** — vertical stack of horizontal bars, one per price target. Each shows: target label ("$120 by April"), cyan (#00F0FF) filled bar proportional to probability, percentage at right end, volume below. Sorted by timeframe then price ascending.
  3. **Source footer** — "Data from Polymarket • Updated X minutes ago" in IBM Plex Mono 10px with link to polymarket.com/predictions/oil

Create helper components:
- `frontend/src/components/predictions/PriceTargetBar.tsx`
- `frontend/src/components/predictions/MarketSentimentCard.tsx`

### 8. Wire into App.tsx

Add `<PredictionMarketsSection />` between `<ForecastSection />` and `<StatsBand />`.

## Key constraints

- All emoji in TypeScript must use Unicode escapes (`'\u{1F4CA}'`), never literal emoji characters
- Follow the dark theme: bg-card, bg-surface, text-accent color tokens
- Font usage: IBM Plex Mono for data, Outfit for body text, Bebas Neue for editorial headers
- No new dependencies needed — httpx is already in the backend, React Query + Tailwind are already in the frontend
- The Vite proxy already forwards all `/api/*` requests, so no proxy config changes needed
- If Polymarket API is down, the section should show "Prediction market data unavailable" — not hide or crash
- Polymarket APIs are public and unauthenticated for all read endpoints. No API key, no signup, no .env changes.
