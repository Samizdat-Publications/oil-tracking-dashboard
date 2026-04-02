# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Oil Price Tracking Dashboard — a full-stack app that visualizes oil prices, downstream consumer goods impacts, and Monte Carlo price forecasts using FRED API data. Built for a general audience to understand how oil prices affect everyday costs.

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

## Architecture

```
frontend/          React 19 + TypeScript + Vite + Tailwind v4
  src/
    components/    UI organized by section (hero, sections, charts, supply-chain)
    hooks/         React Query hooks (useOilPrices, useSimulation, useDownstream)
    stores/        Zustand store (dashboardStore.ts) — single store for all UI state
    lib/           API client, Plotly wrapper, shared constants, commodity-data
    types/         TypeScript interfaces (PriceSeries, SimulationBands, GeoEvent, etc.)

backend/           FastAPI + Python
    main.py        App entry, CORS, setup endpoints, lifespan
    routers/       prices.py, simulation.py, correlations.py
    services/      fred_client.py, monte_carlo.py, statistics.py, cache.py
    models/        Pydantic schemas
    data/          cache.db (SQLite), default_events.json
```

**Data flow:** FRED API → `fred_client.py` (async httpx) → SQLite cache (24h TTL) → FastAPI endpoints → React Query → Plotly charts

**API keys** live in `backend/.env` (gitignored). FRED key required; EIA key optional.

## Key Patterns

**Vite proxy:** `frontend/vite.config.ts` proxies `/api/*` to `http://localhost:8000`. Both servers must be running.

**State management:** Single Zustand store (`dashboardStore.ts`) controls series selection, date range, simulation params, event visibility, SMA toggles, and supply chain panel state.

**Data hooks:** All API data flows through TanStack React Query hooks in `hooks/`. The `useDownstream()` hook is shared between DownstreamSection and SupplyChainSection — React Query deduplicates the request.

**Shared commodity data:** `lib/commodity-data.ts` contains the 13 downstream commodity definitions (keyed by backend series ID), category groupings, and utility functions (`alignSeries`, `computeCorrelation`, `getValueBeforeDate`). Both the Ripple Effect and Supply Chain sections import from here.

**Simulation engine:** `services/monte_carlo.py` implements GBM and jump-diffusion models. Parameter estimation from historical returns with jump detection (returns > 3σ). Output is 7 percentile bands over 126 trading days.

## Design System

Dark theme only. Colors defined as Tailwind v4 CSS custom properties in `index.css`:
- Background: `#04060C`, Surface: `#0A0E18`, Card: `#0C1220`
- Accent: `#00F0FF` (cyan), Green: `#00FF88`, Red: `#FF3366`
- Fonts: Outfit (body), Bebas Neue (display headings), IBM Plex Mono (data/labels)
- Referenced via Tailwind classes: `text-accent`, `bg-surface`, `font-[family-name:var(--font-mono)]`

## Conventions

- All emoji in TypeScript must use Unicode escapes (`'\u{1F6E2}\uFE0F'`), never literal emoji characters — literals cause unpaired UTF-16 surrogates that break JSON serialization.
- Tailwind v4 arbitrary values use bracket syntax: `duration-[350ms]` not `duration-350`.
- Fixed-position overlays (modals, slide-out panels) must be rendered at the App level in `App.tsx`, not inside sections that use `scroll-reveal` (CSS transforms create new containing blocks).
- Section components follow a consistent pattern: `useScrollReveal()` hook, `scroll-reveal` class, `section-wide` container, `editorial-header` + `editorial-subhead` + `section-rule` for headers.
- Geopolitical events are defined in `lib/constants.ts` (`DEFAULT_EVENTS` array, 20 events from 1973-2026) with category-based color coding.

## FRED API Series IDs

The backend defines series in `services/fred_client.py`. The key mapping (`wti` → `DCOILWTICO`, `gasoline` → `GASREGW`, etc.) is the source of truth. Frontend display names come from `lib/commodity-data.ts` which must stay in sync.
