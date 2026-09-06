# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Oil Price Tracking Dashboard — a full-stack app that visualizes how oil price increases from the 2026 Iran War impact downstream consumer goods. Built for a general audience to understand "kitchen table economics" — how oil prices affect everyday costs like groceries, gas, and airline tickets.

**Repo:** github.com/Samizdat-Publications/oil-tracking-dashboard
**Iran War baseline date:** 2026-02-28 (constant `IRAN_WAR_DATE` in `lib/commodity-data.ts`)


## V4 ledger (the page at `/`) — read this first

The default route is `frontend/src/pages/LedgerPage.tsx`, the V4 "ledger". Everything
above about sections, Plotly, Zustand and the ticker describes the legacy V1 dashboard
(`?view=dashboard`) and is kept for that view only.

**Nothing on the V4 page is typed in.** `frontend/src/v4/ledger-data.ts` derives a
`Figures` object from `frontend/public/data-snapshot.json`; the page renders it. To update
the site after new data:

```bash
cd backend  && py scripts/build_snapshot.py     # FRED + IMF PortWatch + context JSON
cd frontend && npm run build                     # tsc, vite, og.png from the snapshot
```

Then commit, push, and deploy — the Cloudflare Pages project is NOT git-connected:
`npx --prefix frontend wrangler pages deploy frontend/dist --project-name trumps-economy-ledger --branch main`.
Do not edit numbers in JSX; if a figure is wrong, fix the series
or `backend/data/context_figures.json` and rebuild.

**Snapshot blocks:** `international`, `staples`, `jobs`, `breadth`, `scorecard`,
`event_study`, `receipt`, `administrations`, `macro` (services/macro.py: latest /
handover / pre-war per series, 12-month changes by calendar month), `crude_daily`,
`hormuz_transits` (services/portwatch.py, IMF PortWatch chokepoint6, baseline 83.1
vessels/day), `war_milestones`, `context` (curated tiered figures not on FRED; every
entry has source, url, tier; mirrored in docs/THESIS.md).

**The simulation** (`src/v4/hormuz/engine.js`) runs on `configureTimeline({prices,
transits})`. `EVENTS` and `RISK_READ` are dated ISO strings; day offsets are derived.
`SPAN` is `export let` and extends to the latest close / transit / event. Do not rewrite
the drawing maths or coastline arrays.

**Refresh is automated.** `.github/workflows/refresh-and-deploy.yml` rebuilds the snapshot,
gates it (`backend/scripts/validate_snapshot.py`), tests, builds, deploys to Pages and commits
the snapshot back every weekday 13:00 UTC. Needs repo secrets FRED_API_KEY, EIA_API_KEY,
CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Locally the same sequence is:
`py scripts/build_snapshot.py && py scripts/validate_snapshot.py ../frontend/public/data-snapshot.json`,
then `npm test && npm run build`, then the wrangler deploy.

**Schema v2 blocks (Sept 2026):** `eia` (services/eia.py: SPR, refinery utilisation, crude
exports, gasoline for 29 areas, diesel by PADD, residential electricity by state),
`fiscal` (services/fiscal.py: debt to the penny, MTS customs duties net of refunds, interest
expense), `chain` (services/chain.py: crude->diesel->truck PPI->food; crude->jet->fares;
EU gas->fertiliser, each with a pre-war pass-through elasticity via
`attribution.passthrough_pair`), `receipt_inputs` (attribution.receipt_inputs + EIA regions;
the browser recomputes the household receipt in `frontend/src/v4/receipt.ts`, pinned to
Python by `backend/tests/fixtures/receipt_fixture.json` -- regenerate with
`py tests/make_receipt_fixture.py`), soft blocks `chokepoints` (six PortWatch straits),
`nowcast` (Cleveland Fed scrape), `polymarket` (services/odds.py curated questions).
`frontend/src/v4/live.ts` patches debt and the Hormuz count live in the browser.

**Screenshots for the README:** `npx vite preview --port 4193` then
`node scripts/shoot.mjs http://localhost:4193/ ../docs/screenshots`.

**Section ids** (for shoot.mjs and anchors): masthead, shelf, crossing, choices, work,
squeeze, gold, trade, strait, other-side, sources.

**Rules that are load-bearing:** zero fabrication; rows that cut against the argument
stay at full size; war and tariff effects are never summed; no queue count; official
claims are drawn next to measured data and labelled as claims; the crude peak is
$114.58 on 7 Apr 2026 (the series), not $114.01.

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
9. **CrisisComparisonSection** — "How Bad Is It?" 7 oil crises since 1973, animated bars, metric toggle, expandable trajectory charts.
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

**Section pattern:** All sections use `useScrollReveal()` hook, `scroll-reveal` class, `section-wide` container, `section-number` + `editorial-header` + `editorial-subhead` + `section-rule`. All wrapped in `<SectionErrorBoundary>` in App.tsx. Below-fold sections are lazy-loaded via `React.lazy()` + `<Suspense>`.

**Code splitting:** HeroSection, KitchenTableTicker, and EditorialLayout are eagerly imported. All other sections (ForecastSection, PredictionMarketsSection, StatsBand, RiskSection, SupplyChainSection, WarTimelineSection, CrisisComparisonSection, DownstreamSection, DataTable, EventManager, CommodityDetailPanel, CollapsibleSection) are lazy-loaded.

**Error handling:** Each section shows a visible error/empty state (never returns `null`). `SectionErrorBoundary` catches render crashes per-section. `fetchJson()` has 30s timeout via AbortController.

**Ticker positioning:** Rendered BEFORE `<EditorialLayout>` in App.tsx. Body has `padding-top: 36px`. Fixed-position overlays must be at App level (CSS transforms create containing blocks).

**Simulation engine:** `services/monte_carlo.py` — GBM and jump-diffusion models. Parameter estimation from historical returns with jump detection (>3σ). 7 percentile bands over 126 trading days.

## Design System — "War Room Broadsheet"

Dark theme, editorial newspaper aesthetic. Two-temperature color system: warm editorial + cool data.

**Color Tiers** (Tailwind v4 CSS custom properties in `index.css`):
- Background: `#04060C`, Surface: `#0A0E18`, Card: `#0C1220`
- Editorial accent (gold): `#D4A012` — headlines, rules, section markers, borders (`--color-accent`)
- Data accent (cyan): `#00F0FF` — charts, numerical values, interactive controls (`--color-data`)
- War/alert red: `#CC2936` — LIVE indicator, war events, bearish scenarios
- Stabilizing green: `#5DB075` — positive indicators, bullish scenarios
- Borders/chrome use warm gold tint: `rgba(212, 160, 18, x%)`

**Typography**:
- Display: **Instrument Serif** (editorial headlines — serif on dark = distinctive)
- Body: **Plus Jakarta Sans** (warm geometric sans)
- Data: **JetBrains Mono** (technical monospace for numbers/labels)
- Referenced via: `font-[family-name:var(--font-display)]`, `var(--font-mono)`, etc.

**Editorial Elements**:
- Section numbers: `<span className="section-number">01 / Forecast</span>` before headers
- Pull quotes: `<div className="pull-quote">` with gold left border (Instrument Serif italic)
- Dateline in hero: wire-service format (`APR 5, 2026 — WTI CRUDE OIL`)
- Editorial lede: auto-generated sentence below price in hero
- Source attributions: `<p className="source-attribution">` (italic serif)
- Section rules: left-aligned gold gradient (asymmetric, not centered)
- LIVE indicator: red pulse (war urgency), not green (generic status)

**Textures**:
- Grain overlay: 0.035 opacity (visible analog texture)
- No scan-line effects (removed — was gratuitous)
- Background: warm gold/red radial gradients (not cyan/green)
- Crosshatch utility: `.crosshatch-bg` for military-map texture on risk sections

## Performance

**LCP optimized to ~2.3s** (down from 3.8s):
- `checkSetup()` no longer blocks initial render — dashboard renders immediately
- 12 below-fold sections lazy-loaded via `React.lazy()` + `<Suspense>` in App.tsx
- Font preloads removed (font swap handles it; new fonts from Google Fonts with `display=swap`)
- Changing `@theme` in `index.css` requires Vite dev server restart (Tailwind v4 caching)

## Conventions

- All emoji in TypeScript: Unicode escapes (`'\u{1F6E2}\uFE0F'`), never literal — literals break JSON serialization.
- All emoji in Python: `\U000XXXXX` format (e.g., `\U0001F4C9`).
- Tailwind v4 arbitrary values: bracket syntax `duration-[350ms]` not `duration-350`.
- Fixed-position overlays at App level, not inside `scroll-reveal` sections.
- Geopolitical events in `lib/constants.ts` (20 events, 1973-2026) with category-based colors.
- **Update memory files at every git commit** — user frequently starts new sessions.
- **Do NOT use git worktrees** — OneDrive sync locks `.git/worktrees/` metadata and causes persistent permission issues. Work directly on main branch.
- **cache.db is critical** — if deleted, must re-configure FRED API key via `/api/setup/configure` or restart backend with `.env` present. Without it, all data endpoints return null.
- **Always run dev servers from main repo**, not worktrees. Vite HMR only picks up changes in the directory it was started from.

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

## Frozen V4 (do not break)

The V4 ledger as of 2026-09-06 is frozen at tag `v4-ledger-frozen-2026-09-06` / branch
`v4-frozen` and deployed permanently at https://trumps-economy-ledger-v4.pages.dev
(Pages project `trumps-economy-ledger-v4`, production branch `v4-frozen`). It must stay
deployable regardless of the V5 redesign. To redeploy it:

    git checkout v4-frozen
    cd frontend && npm ci && npm run build
    npx wrangler pages deploy dist --project-name trumps-economy-ledger-v4 --branch v4-frozen

V5 (Design's animated rebuild) lands as a separate page/project; `main` and the daily
refresh workflow keep serving V4 at trumps-economy-ledger.pages.dev until V5 is accepted.
