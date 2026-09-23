# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Oil Price Tracking Dashboard — a full-stack app that visualizes how oil price increases from the 2026 Iran War impact downstream consumer goods. Built for a general audience to understand "kitchen table economics" — how oil prices affect everyday costs like groceries, gas, and airline tickets.

**Repo:** github.com/Samizdat-Publications/oil-tracking-dashboard
**Iran War baseline date:** 2026-02-28 (constant `IRAN_WAR_DATE` in `lib/commodity-data.ts`)


## V5 "The Bill" (the page at `/`) — read this first

The default route is `frontend/src/pages/TheBillPage.tsx`, which mounts
`frontend/src/v5/TheBill.jsx`: an eleven-block scroll-driven data story ported from
`docs/design-handoff/2026-09-08-the-bill/`. **It is a port, not an interpretation.**
The logic class is Design's prototype class carried over almost line for line, and
`render()` is its template converted mechanically by
`frontend/scripts/template-to-jsx.py`. If a figure or a style needs to change, change
it in the handoff and re-run the converter — do not retype markup by hand. That is
exactly how the V4 redesign drifted.

Data lives in `frontend/public/v5/*.json` (cut from `data-snapshot.json` by Design)
plus the two bundled `world-atlas` land files. Nothing is fetched from a CDN.

Three integration rules that are load-bearing, all in `src/v5/the-bill.css`:

- `body.v5-bill` (added in `componentDidMount`) undoes three rules from the shared
  `index.css` reset — `padding-top:48px`, `letter-spacing:-.01em` and font smoothing.
  They shorten every 100vh block and retrack the type.
- The V5 subtree is **`box-sizing: content-box`**. The prototype declares no
  box-sizing; `index.css` forces `border-box` for the other views. Under border-box
  the 1200x630 share card renders 1200x630 instead of the intended 1265x686.
- Source Serif 4 is declared as an `@font-face` against the **variable** woff2
  (`opsz` axis). The static @fontsource cut sets the same string 15% wider.

Verify a change by diffing against the prototype rather than by eye:

```bash
cd docs/design-handoff/2026-09-08-the-bill && py -m http.server 4300   # the prototype
cd frontend && npx vite preview --port 4315                            # the port
```
Capture both under `reducedMotion: 'reduce'` (the page maps that to P=1, every block
at its end state) and compare. At 1440x900 the mean per-block pixel difference is
**~1.9%**. Anything materially above that is a regression. What makes up the residual:

- blocks 01 and 04 are sub-pixel grid-row distribution, not drift;
- block 04 also drifts a little run to run because the split-flap advances on real
  elapsed time rather than on P, so it does not always settle on the same frame;
- block 09 carries the one deliberate colour deviation, below.

**The one colour deviation.** `MARK_RED` at the top of `TheBill.jsx` is `#D93B4A`,
not the `#B22234` Design specified. Every red mark on the page sits on the navy
ground, where Old Glory Red measures 2.49:1 -- under the 3:1 floor for non-text
contrast, which made the red marks the least legible thing on a page arguing that
"every red mark on this page traces back to these two dates". `#D93B4A` measures
3.68:1. To revert, set that one constant back.

`og.png` is block 09 rendered from the built site by `frontend/scripts/build-og.mjs`,
not a separate card -- Design drew that block at 1200x630 so it could be the share
image, and rendering the real block means the two can never disagree.

**The mobile pass** (`@media (max-width: 640px)` at the foot of `the-bill.css`) is the
one item Design left open. Every rule in it fixes a measured violation of the brief's
own constraints at 390x844 -- the SCROLL cue printing over the closing sentence of
eight blocks, and labels under the 11px floor -- rather than re-designing a block. Re-audit
after any layout change; both were found by measuring, not by looking.

**Copy that states a verdict about a moving number is computed, never typed**
(2026-09-23). Design's prototype typed "Diesel at $5.60 is the highest since 2022,
not a record"; EIA's weekly diesel passed its 2022 peak ($5.81) on 7 Sep 2026 and
the page kept saying "not a record" for two refreshes. Now:
`series_record()` in `services/macro.py` runs on the whole GASDESW history (from
1994) in `build_snapshot.py` and lands as `diesel.record` in `prices-data.json`;
`dieselVals()` / `hormuzNow()` in `TheBill.jsx` (mirrored in the handoff
`The Bill.dc.html`, whose template now has `{{ dieselHead }}`, `{{ dieselNote }}`,
`{{ dieselHeadPolicy }}`, `{{ hormuzNow }}` holes) build the sentences, the card
date reads `globe-data.as_of`, and the strait/globe timeline ends at the last
PortWatch day instead of a typed 30 Aug. The share text in `index.html` uses
`{{og.*}}` holes filled by the `ogFigures` plugin in `vite.config.ts`. Before adding
any sentence with a number in it, ask whether the next refresh can make it false.

**The converter camel-cases event attributes.** HTMLParser lowercases `onChange` to
`onchange`, which React ignores silently: the state picker shipped dead until
2026-09-23. `EVENTS` in `template-to-jsx.py` maps them and the script exits on an
unmapped lowercase `on*`. ESLint does not cover `.jsx`, so nothing else catches this.

**Where it is deployed.** Two Pages projects serve the same V5 build, and a third
holds V4. None are git-connected; `backend/scripts/refresh.sh` and the workflow
deploy to both V5 projects and never touch V4.

| URL | What | Project |
|---|---|---|
| https://trumps-economy-the-bill.pages.dev | V5, the dedicated URL | `trumps-economy-the-bill` |
| https://trumps-economy-ledger.pages.dev | V5, the original URL | `trumps-economy-ledger` |
| https://trumps-economy-ledger-v4.pages.dev | V4, frozen at `v4-frozen` | `trumps-economy-ledger-v4` |

The V4 ledger is also reachable from either V5 URL at `?view=ledger`.

## V4 ledger (`?view=ledger`)

The V4 "ledger" is `frontend/src/pages/LedgerPage.tsx`, served at `?view=ledger`. Everything
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

**Refresh is on demand, not scheduled.** There is no cron. The page is published
once and updated after events that actually move it -- a strike, a ceasefire, a jobs
print, a tariff ruling. Two equivalent ways to run it:

```powershell
.\oil-dashboard\backend\scripts\refresh.ps1            refresh and publish V5 and V4
.\oil-dashboard\backend\scripts\refresh.ps1 -SkipV4    V5 only
.\oil-dashboard\backend\scripts\refresh.ps1 -Dry       build everything, publish nothing
```

**Use the `.ps1` on this machine, not the `.sh`.** PowerShell here resolves `bash` to
WSL's `bash.exe`, and no WSL distribution is installed, so `bash ...refresh.sh` fails
with "Windows Subsystem for Linux has no installed distributions" -- it never reaches
Git Bash. `refresh.sh` is kept as the POSIX equivalent for Linux. Both scripts locate
the repo from their own path, so neither cares which directory you are in.

Two PowerShell 5.1 traps the `.ps1` works around, worth knowing before editing it:
a failing native exe does not stop the script on its own (every external command goes
through `Invoke-Step`, which checks `$LASTEXITCODE`), and piping a native command's
stderr with `2>&1` turns ordinary build warnings into terminating `NativeCommandError`s
-- so do not wrap the script in a pipe to filter its output.

or the `refresh-and-deploy` workflow from the Actions tab (`workflow_dispatch` only).
Both need FRED_API_KEY and EIA_API_KEY; the workflow also needs CLOUDFLARE_API_TOKEN
and CLOUDFLARE_ACCOUNT_ID.

**Every refresh is recorded.** `backend/scripts/record_refresh.py` appends a row to
`docs/refresh-history.csv`: crude, the Hormuz seven-day mean, diesel, the staples,
jobs a month, long-term unemployment, the household receipt, the US-specific
inflation excess and the Pentagon figure. The sites only ever show the latest
numbers, so that file is the only place the history exists. It also prints what
moved since the previous row, which is the part worth reading.

**V4 refreshes in the same run.** `frontend/src/v4` and the backend services are
identical on `main` and `v4-frozen`, so V4 reads the current schema v2 snapshot with
no code change. The script carries the snapshot across, rebuilds, deploys to
`trumps-economy-ledger-v4`, commits on that branch and returns to where it started.
Uncommitted work is stashed for the switch and popped afterwards.

**Check series keys against the snapshot, not against what the block is called.**
`build_v5_data.py` originally looked for `long_term_unemployed_share` and `ahe_yoy`;
the real keys are `ltu_share` and `ahe`. The missing-series fallback then kept the
values Design shipped, so the file still looked right and `--check` still passed
while block 05 could never refresh. A missing series now warns on stderr. `pay` is
derived in `pay_block()` rather than read, and its twelve-month change is matched by
calendar date, never by position.

`backend/scripts/build_v5_data.py` is the step that matters for V5: it cuts
`frontend/public/v5/{globe,crude,prices,bill}-data.json` out of the snapshot. Without
it a refresh ships fresh data behind a page still showing Design's original figures.
`--check` compares without writing, and against the snapshot Design worked from all
four files come back identical -- that is the test that the cut is faithful. The
other three V5 files (strait-coast, hormuz-coast, the two world-atlas land files) are
fixed geography and are never rewritten.

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
- **Work from `C:\Users\stewa\dev\oil-tracking-dashboard`, not the OneDrive copy.**
  On 2026-09-23 the OneDrive checkout's `.git` had hundreds of unreadable loose objects
  (`fatal: mmap failed`) and OneDrive refused reads on dozens of working files. GitHub
  was complete, so a fresh clone outside OneDrive replaced it. `backend/.env` and
  `backend/data/cache.db` are untracked: copy them across by hand.
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

V5 was accepted on 2026-09-11 and is now what `main` builds. It serves from two
projects -- `trumps-economy-the-bill` and `trumps-economy-ledger` -- and the refresh
deploys to both. V4 is untouched by that path; it only moves if you redeploy it by
hand from `v4-frozen`, as above.
