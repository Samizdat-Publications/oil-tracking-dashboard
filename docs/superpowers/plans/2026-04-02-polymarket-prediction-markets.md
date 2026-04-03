# Polymarket Prediction Markets Integration — Plan

## Goal

Add a "Prediction Markets" section to the dashboard that shows real-money crowd odds on oil price targets from Polymarket's public API. No API key required — both the Gamma API (market discovery) and CLOB API (real-time pricing) are public and unauthenticated for read access.

## Implementation Steps

### Step 1: Backend — Polymarket client service

Create `backend/services/polymarket_client.py` following the `fred_client.py` pattern (async httpx + SQLite cache).

Key functions:
- `search_oil_markets()` — `GET https://gamma-api.polymarket.com/markets?tag=oil&closed=false`; fallback to `GET /search?query=crude+oil+WTI`; filter results for oil-price-related markets
- `get_market_prices(token_ids)` — batch midpoint prices from `GET https://clob.polymarket.com/midpoint-prices`
- `get_oil_prediction_summary()` — orchestrates discovery + pricing into grouped summary

Cache with 10-minute TTL (use synthetic series_id like `"polymarket:oil_markets"` with existing cache infrastructure). Either add optional `ttl` param to `cache.py` or check staleness manually.

### Step 2: Backend — Pydantic schemas

Add to `backend/models/schemas.py`: `PolymarketOutcome`, `PolymarketMarket`, `PolymarketMarketsResponse`, `PriceTarget`, `MarketSentiment`, `PolymarketSummaryResponse`.

### Step 3: Backend — Router

Create `backend/routers/polymarket.py` with prefix `/api/polymarket`:
- `GET /markets` — returns all active oil prediction markets with outcomes and probabilities
- `GET /summary` — returns aggregated price targets + computed sentiment (bullish/bearish/neutral weighted by volume)

Register in `backend/main.py`.

### Step 4: Frontend — Types and API

Add TypeScript interfaces to `frontend/src/types/index.ts`. Add `fetchPolymarketMarkets()` and `fetchPolymarketSummary()` to `frontend/src/lib/api.ts`.

### Step 5: Frontend — React Query hooks

Create `frontend/src/hooks/usePolymarket.ts` with `usePolymarketMarkets()` and `usePolymarketSummary()` hooks. 5-minute staleTime (prediction markets move faster than FRED data).

### Step 6: Frontend — Section component

Create `frontend/src/components/sections/PredictionMarketsSection.tsx`:
- Standard section pattern: `useScrollReveal()`, `editorial-header`, `editorial-subhead`, `section-rule`
- Header: "What Traders Think"
- Three zones: sentiment card (bullish/bearish indicator), price target probability bars (horizontal bars showing crowd odds), source attribution footer

Create helper components:
- `frontend/src/components/predictions/PriceTargetBar.tsx` — horizontal probability bar for each price target
- `frontend/src/components/predictions/MarketSentimentCard.tsx` — summary card with direction + confidence

### Step 7: Wire into App.tsx

Add `<PredictionMarketsSection />` between `<ForecastSection />` and `<StatsBand />`.

## Design spec

Full design spec with API endpoint details, response schemas, component layouts, styling, and error handling: `docs/superpowers/specs/2026-04-02-polymarket-prediction-markets-design.md`
