# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"The Bill": a public, static data story on what the 2026 Iran war and the tariffs cost
an American household, measured only in government series and cited, tiered figures.
Live at https://trumps-economy-the-bill.pages.dev; the landing page about the project is
https://samizdat-publications.github.io/oil-tracking-dashboard/ (`docs/index.html`,
GitHub Pages from `/docs`).

**Repo:** github.com/Samizdat-Publications/oil-tracking-dashboard
**Two dates:** tariffs re-imposed 2026-02-24, the strike 2026-02-28.
**Working copy:** `C:\Users\stewa\Documents\Claude\Oil Traacking Dashboard\oil-dashboard`,
never the OneDrive copy
(see Conventions).

## V5 "The Bill" (the page at `/`) -- read this first

`frontend/src/main.tsx` picks the page from `?view=` (only `ledger` means anything now)
and mounts `frontend/src/pages/TheBillPage.tsx`, which mounts
`frontend/src/v5/TheBill.jsx`: an eleven-block scroll-driven data story ported from
`docs/design-handoff/2026-09-08-the-bill/`. **It is a port, not an interpretation.**
The logic class is Design's prototype class carried over almost line for line, and
`render()` is its template converted mechanically by
`frontend/scripts/template-to-jsx.py`. If markup or copy needs to change, change it in
the handoff and re-run the converter; logic changes go into both the port and the
handoff class. Do not retype markup by hand. That is exactly how the V4 redesign drifted.

Data lives in `frontend/public/v5/*.json`, cut from `data-snapshot.json` by
`backend/scripts/build_v5_data.py`, plus the two `world-atlas` land files (land-50m is
clipped to the Gulf by `scripts/clip-land.mjs`). Nothing is fetched from a CDN, and V5
loads no Tailwind, no `index.css` and no Google Fonts: those belong to V4 only.

Source Serif 4 is declared as an `@font-face` against the **variable** woff2 (`opsz`
axis) in `the-bill.css`. The static @fontsource cut sets the same string 15% wider.

Verify a change by diffing against the prototype rather than by eye:

```bash
cd docs/design-handoff/2026-09-08-the-bill && py -m http.server 4300   # the prototype
cd frontend && npx vite preview --port 4315                            # the port
```
Capture both under `reducedMotion: 'reduce'` (the page maps that to P=1, every block at
its end state) and compare. Since `index.css` left V5 (2026-09-23), 8 of 11 blocks match
at 0.00 to 0.44%. The residual: block 09 carries the deliberate red below; blocks 02 and
04 move a little run to run (the seismograph paper and the split-flap run on elapsed
time, not on P); and the computed copy of 2026-09-23 differs from Design's typed text on
purpose.

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

The same pass (2026-09-23) moved every other moving figure onto the data, in these
render-value methods (all mirrored in the handoff): `jobsVals` (negative-month count,
"the best month in N" and the bright month, "the highest of his term" only while
true, the pay month, the jobless-claims note), `againstRows` (block 10's "What cuts
against this page": stocks, mortgages, layoffs, the latest jobs month, core CPI,
customs receipts, falling oil; each row drops out when it stops being true),
`dateVals` (series labels, "now" month, globe through-date, Cape and Bab el-Mandeb
percentages, the Treasuries sentence), `warVals` (Pentagon cost and its history via
`who`/`cite` fields in `context_figures.json`, casualty count and date, the
Washington Post count beside the denial), `labelVals` (canvas aria-labels: the
converter's `CANVAS_LABELS` take `${name}` holes), `freshVals` ("UPDATED" in the
globe header and "How fresh this is" in block 10). `bill-data.against` is now built
from the snapshot by `against()` in `build_v5_data.py`; it used to be copied forward
from Design's file and never refreshed.

**The strait (block 03) is two states, not a replay.** Before (pre-war mean) and now
(latest 7-day mean), with one ship on screen per ship a day and a short fall between.
Replaying the daily counts made the number bounce and left pre-war ships crawling
through a gate marked CLOSED. Surplus ships fade out; the survivors are spread along
the lane and crawl, so the few left stay in view. The globe (block 00) still replays
the daily series, which suits its scroll-driven timeline.

**Resilience and accessibility.** The eight V5 JSON files load independently
(`allSettled`, content-type check, one retry); each block sets up from what arrived and
a `role="alert"` notice names what failed. The root is `role="main"` with an h1, each
block has a visually hidden h2 (`.v5-sr`), all emitted by the converter. Under reduced
motion nothing drifts or pulses once the first frames have placed particles and ships.

**Build strictness.** `build_v5_data.py` exits 2 when a block keeps its previous values
(pass `--allow-stale` to publish anyway). `validate_snapshot.py` also fails a fully
failed `chain`, an errored EIA part, empty `receipt_inputs`, and stale MTS customs or
interest. `build_snapshot.py` builds with a throwaway cache (`CACHE_DB_PATH` to
override): the shared 24h cache made a same-day second refresh report "nothing moved".

**Screenshots and clips** for the README and the landing page (`docs/index.html`, served
by GitHub Pages from `/docs`): `npx vite preview --port 4315`, then
`node scripts/shoot-v5.mjs http://localhost:4315/ ../docs/screens` and
`py scripts/frames-to-media.py ../docs/screens`. Clips are stepped on Playwright's fake
clock, so frames are even; output is GIF for the README and animated WebP for the page.

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

The V4 "ledger" is `frontend/src/pages/LedgerPage.tsx`, served at `?view=ledger`. It is the
only page that loads `index.css` (Tailwind). The V1 dashboard and the V2/V3 views called a
FastAPI backend that was never deployed; they were removed on 2026-09-23.

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
Uncommitted work is stashed for the switch and popped afterwards. The two branches have different `package.json`s since 2026-09-23 (main dropped the V1
packages), so the pass runs `npm ci` on each side of the switch; stop any `vite preview`
running from `frontend/` first, or Windows locks a native module and `npm ci` fails.

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

```bash
cd backend
py scripts/build_snapshot.py            # every source -> frontend/public/data-snapshot.json
py scripts/validate_snapshot.py ../frontend/public/data-snapshot.json
py scripts/build_v5_data.py             # the four V5 files; exits 2 if a block kept old values
py -m pytest tests -q

cd frontend
npx vite --port 5173                    # dev server
npm run build                           # tsc, vite, og.png from block 09
npm test                                # vitest (the receipt pin)
npm run lint                            # eslint, including TheBill.jsx
```

Or the whole thing, deploy and commit included: `.\backend\scripts\refresh.ps1` (see
"Refresh is on demand" above).

Python is `py` on this Windows system (not `python` or `python3`).
PowerShell uses `;` not `&&` for command chaining.
`export PATH="$PATH:/c/Program Files/GitHub CLI"` needed before `gh` / `git push`.

`backend/main.py` and `backend/routers/` are the old FastAPI app. Nothing deployed uses
them; `build_snapshot.py` calls the `services/` modules directly.

## Conventions

- All emoji in Python: `\U000XXXXX` format (e.g., `\U0001F4C9`).
- **Update memory files at every git commit**: the user frequently starts new sessions.
- **Never use an em dash** in anything written here (code, comments, copy, commits).
- **Work from `C:\Users\stewa\Documents\Claude\Oil Traacking Dashboard\oil-dashboard`,
  not `OneDrive\Documents\Claude\...`.** The Claude folders stopped syncing through
  OneDrive in September 2026 and were split to `Documents\Claude`. With the OneDrive
  client stopped, files in the old copy are cloud-only placeholders (`attrib` shows `O`):
  git fails with `fatal: mmap failed` and other tools with "Permission denied". The old
  copy is not corrupt, just unreadable until OneDrive downloads it. `backend/.env` and
  `backend/data/cache.db` are untracked and live only in the working copy.
- **Do NOT use git worktrees.** Work directly on main.
- **Always run dev servers from main repo**, not worktrees. Vite HMR only picks up changes in the directory it was started from.

## Series IDs

FRED series are listed where they are fetched: `backend/services/macro.py`
(`MACRO_SERIES`), `services/series_catalog.py` and `services/chain.py`. Check a key
against the snapshot before wiring it to a block (see "Check series keys" above).

## Frozen V4 (do not break)

The V4 ledger as of 2026-09-06 is frozen at tag `v4-ledger-frozen-2026-09-06` / branch
`v4-frozen` and deployed permanently at https://trumps-economy-ledger-v4.pages.dev
(Pages project `trumps-economy-ledger-v4`, production branch `v4-frozen`). It must stay
deployable regardless of the V5 redesign. To redeploy it:

    git checkout v4-frozen
    cd frontend && npm ci && npm run build
    npx wrangler pages deploy dist --project-name trumps-economy-ledger-v4 --branch v4-frozen

V5 was accepted on 2026-09-11 and is now what `main` builds. It serves from two
projects, `trumps-economy-the-bill` and `trumps-economy-ledger`, and the refresh
deploys to both. `refresh.ps1` also carries the new snapshot to `v4-frozen` and
redeploys V4 (skip with `-SkipV4`); V4's code only changes by hand on that branch.
