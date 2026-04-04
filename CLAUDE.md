# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Oil Price Tracking Dashboard — a full-stack app that visualizes how oil price increases from the 2026 Iran War impact downstream consumer goods. Built for a general audience to understand "kitchen table economics" — how oil prices affect everyday costs like groceries, gas, and airline tickets.

**Repo:** github.com/Samizdat-Publications/oil-tracking-dashboard
**Iran War baseline date:** 2026-02-28 (constant `IRAN_WAR_DATE` in `lib/commodity-data.ts`)

## Commands

**Backend (FastAPI, port 8000):**
```bash
cd backend
py -m uvicorn main:app --reload --port 8000
```

**Frontend (Vite dev server, port 5173):**
```bash
cd frontend
npx vite --port 5173        # dev server (proxies /api/* to :8000)
npx tsc --noEmit             # type check only
npm run build                # tsc + vite production build
npm run lint                 # eslint
```

Python is `py` on this Windows system (not `python` or `python3`).
PowerShell uses `;` not `&&` for command chaining.
`export PATH="$PATH:/c/Program Files/GitHub CLI"` needed before `gh` / `git push`.

## Architecture

```
frontend/          React 19 + TypeScript + Vite + Tailwind v4
  src/
    App.tsx        Main orchestrator — renders all sections in order
    index.css      Design system, CSS animations (tickerScroll, milestoneReveal, todayPulse)
    components/
      layout/      EditorialLayout, KitchenTableTicker (sticky marquee), ScrollProgress
      hero/        Hero section with fan chart
      charts/      HeroFanChart (Plotly), VolatilityChart, DistributionChart
      sections/    StatsBand, ForecastSection, PredictionMarketsSection, RiskSection,
                   SupplyChainSection, WarTimelineSection, DownstreamSection,
                   CrisisComparisonSection
      ui/          SectionErrorBoundary (per-section error boundary), collapsible-section
      predictions/ MarketSentimentCard (CategoryCard + FedDistribution)
      supply-chain/ OilSourceNode, FlowConnector, BranchGrid, CommodityDetailPanel
      timeline/    TimelineMilestone (per-card IntersectionObserver)
    hooks/         React Query hooks: useOilPrices, useSimulation, useDownstream,
                   useMilestones, usePolymarket
    stores/        Zustand store (dashboardStore.ts) — single store for all UI state
    lib/           api.ts, commodity-data.ts, constants.ts, plotly.ts
    types/         TypeScript interfaces

backend/           FastAPI + Python
    main.py        App entry, CORS, lifespan
    routers/       prices, simulation, correlations, milestones, polymarket, crisis
    services/      fred_client, monte_carlo, polymarket_client, statistics, cache
    models/        Pydantic schemas
    data/          cache.db (SQLite), war_milestones.json, default_events.json
```

## Section Flow (top to bottom)

1. **KitchenTableTicker** — Sticky marquee (outside EditorialLayout, fixed top, z-110). 9 commodities with prices.
2. **HeroSection** — Full-viewport fan chart (WTI/Brent), date picker, Monte Carlo overlay.
3. **ForecastSection** — Simulation controls, scenario tabs, SMA/ERA toggles.
4. **PredictionMarketsSection** — Polymarket war-economy markets (recession, Fed, geopolitical).
5. **StatsBand** — Thin stats bar (prices, spreads, volatility).
6. **RiskSection** — Volatility chart + simulated price distribution (VaR/CVaR).
7. **SupplyChainSection** — Animated oil -> downstream flow with detail panels.
8. **WarTimelineSection** — Vertical timeline (editorial + auto-detected milestones).
9. **CrisisComparisonSection** — "How Bad Is It?" 7 oil crises compared with animated bars.
10. **DownstreamSection** — "Ripple Effect" correlation charts for 13 commodities.
11. **Raw Data** — Collapsible DataTable.

## Data Flow

**FRED API** → `fred_client.py` (async httpx) → SQLite cache (24h TTL) → FastAPI endpoints → React Query → Plotly/CSS charts

**Polymarket Gamma API** → `polymarket_client.py` (scans 1000 markets, categorizes by keyword) → SQLite cache (10min TTL) → `/api/polymarket/summary` → React Query → CategoryCards

## 13 Downstream Commodities

Defined in `lib/commodity-data.ts`, keyed by backend FRED series ID:
- **Transportation:** gasoline, diesel, airline_fares
- **Food & Agriculture:** fertilizer, eggs_meat, food_at_home, natural_gas, food_index
- **Materials & Energy:** plastics, aluminum, cpi_energy, cotton, cpi_all

## Key Patterns

**Vite proxy:** `frontend/vite.config.ts` proxies `/api/*` to `http://localhost:8000`. Both servers must run.

**State management:** Single Zustand store (`dashboardStore.ts`) — series selection, date range, simulation params, event visibility, SMA toggles, supply chain panel state.

**Data hooks:** TanStack React Query hooks in `hooks/`. `useDownstream()` is shared between DownstreamSection and SupplyChainSection (React Query deduplicates).

**Shared commodity data:** `lib/commodity-data.ts` has `COMMODITY_DATA`, `COMMODITY_CATEGORIES`, `IRAN_WAR_DATE`, and utility functions (`alignSeries`, `computeCorrelation`, `getValueBeforeDate`, `hasDataAfter`).

**Section pattern:** All sections use `useScrollReveal()` hook, `scroll-reveal` class, `section-wide` container, `editorial-header` + `editorial-subhead` + `section-rule`. All wrapped in `<SectionErrorBoundary>` in App.tsx.

**Error handling:** Each section shows a visible error/empty state (never returns `null`). `SectionErrorBoundary` catches render crashes per-section. `fetchJson()` has 30s timeout via AbortController.

**Ticker positioning:** Rendered BEFORE `<EditorialLayout>` in App.tsx. Body has `padding-top: 36px`. Fixed-position overlays must be at App level (CSS transforms create containing blocks).

**Simulation engine:** `services/monte_carlo.py` — GBM and jump-diffusion models. Parameter estimation from historical returns with jump detection (>3σ). 7 percentile bands over 126 trading days.

## Design System

Dark theme only. Colors as Tailwind v4 CSS custom properties in `index.css`:
- Background: `#04060C`, Surface: `#0A0E18`, Card: `#0C1220`
- Accent: `#00F0FF` (cyan), Green: `#00FF88`, Red: `#FF3366`
- Fonts: Outfit (body), Bebas Neue (display headings), IBM Plex Mono (data/labels)
- Referenced via: `text-accent`, `bg-surface`, `font-[family-name:var(--font-mono)]`

## Conventions

- All emoji in TypeScript: Unicode escapes (`'\u{1F6E2}\uFE0F'`), never literal — literals break JSON serialization.
- All emoji in Python: `\U000XXXXX` format (e.g., `\U0001F4C9`).
- Tailwind v4 arbitrary values: bracket syntax `duration-[350ms]` not `duration-350`.
- Fixed-position overlays at App level, not inside `scroll-reveal` sections.
- Geopolitical events in `lib/constants.ts` (20 events, 1973-2026) with category-based colors.
- **Update memory files at every git commit** — user frequently starts new sessions.

## FRED API Series IDs

Source of truth: `services/fred_client.py`. Key mapping: `wti` → `DCOILWTICO`, `brent` → `DCOILBRENTEU`, `diesel` → `DSDSEL`, `gasoline` → `GASREGW`, etc. Frontend display names in `lib/commodity-data.ts` must stay in sync.

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/prices/summary` | GET | Current WTI, Brent, diesel prices |
| `/api/prices/downstream` | GET | WTI + all 13 downstream series (20Y) |
| `/api/prices/{series}` | GET | Single series with date range |
| `/api/simulation` | POST | Monte Carlo forecast |
| `/api/correlations` | GET | Rolling correlations |
| `/api/milestones` | GET | Editorial + auto-detected war milestones |
| `/api/polymarket/summary` | GET | War-economy prediction markets |
| `/api/crisis/comparison` | GET | Historical crisis comparison (7 crises) |
