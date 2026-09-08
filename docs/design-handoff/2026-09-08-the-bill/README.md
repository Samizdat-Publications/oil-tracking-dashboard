# Handoff: The Bill

A scroll-driven, eleven-block data story ("The Bill") that prices the Iran war and the re-imposed tariffs in government data: ship counts through Hormuz, crude oil, fourteen household prices, hiring, the Pentagon's cost, what the lost aircraft equal in consumer goods, gold leaving the New York Fed, and a shareable summary card. Every number on screen is read from the bundled JSON snapshots; every block has a "Show the work" panel.

## About the design files

`The Bill.dc.html` is a **design reference built in HTML** — a working prototype that shows the intended look and behaviour. It is not production code to ship. Recreate it in the target codebase (the repo referenced in `github.md` uses a `frontend/` React app) using that codebase's patterns and libraries. Where no equivalent exists, choose the closest idiom (e.g. a React component per block, one `requestAnimationFrame` loop shared by all canvases, `IntersectionObserver` for block entry).

The prototype opens directly in a browser (`The Bill.dc.html` + `support.js` in the same folder, plus the JSON files). Read it for exact values; the logic class at the bottom of the file is plain JavaScript and each block's drawing routine (`stepSeis`, `stepStrait`, `stepPrices`, `stepCrowd`, `stepWar`, `stepBuy`, `stepVault`, `stepStamps`, `stepCard`, and `paint`/`readout` for the globe) can be ported almost line for line.

## Fidelity

**High fidelity.** Colours, typography, spacing, copy, animation timings and data mappings are final. Reproduce them exactly. The only open item is a dedicated mobile pass; the prototype has working `max-width: 640px` rules but they were not tuned by hand.

## Page structure

Full-width page, `overflow: clip`, `scroll-snap-type: y proximity` on `html`. Blocks alternate with cream "Show the work" bands:

| # | Block (`data-screen-label`) | Ground | Height | Animation |
|---|---|---|---|---|
| 00 | The globe | navy `#0B1E3F` | 160vh (sticky 100vh) | **scroll-driven** (progress = scroll through the block) |
| — | Show the work · the globe | cream `#F7F5F0` | auto | `<details>` |
| 01 | Two dates | red `#6E1B27` | 100vh | timed 3.5 s |
| 02 | Oil doubled | navy | 100vh | timed 8 s |
| — | Show the work | cream | | |
| 03 | The strait | navy | 100vh | timed 9 s |
| — | Show the work | cream | | |
| 04 | Your prices | navy | 100vh | timed 6 s |
| — | Show the work | cream | | |
| 05 | Nobody is hiring | navy | 100vh | timed 9 s |
| — | Show the work | cream | | |
| 06 | What the war cost | red `#6E1B27` | 100vh | timed 9 s |
| — | Show the work | cream | | |
| 07 | What it buys (lost aircraft) | navy | 100vh | timed 30.3 s, **loops** |
| — | Show the work | cream | | |
| 08 | The world backs away (gold) | navy | 100vh | timed 8 s |
| — | Show the work | cream | | |
| 09 | Your bill (share card) | cream `#F7F5F0` | 100vh | timed 3 s |
| 10 | Check our work | cream | auto | static |

Every 100vh block has `scroll-snap-align: start` and a `SCROLL` cue (IBM Plex Mono 11px, letter-spacing .2em, 50% cream, centred 14px from the bottom) that fades in (`opacity .5s`) when its animation reaches the end.

### Playback model (applies to blocks 01–09)

```
playProgress(section, key, durationSeconds, now, loop):
  rect = section.getBoundingClientRect()
  if rect.top < 0.4·vh and rect.bottom > 0.6·vh:   start[key] ??= now      # block fills the viewport → start clock
  else if rect.bottom < 0 or rect.top > vh:         start[key] = undefined  # fully gone → rewind, replays on return
  raw = (now − start[key]) / (duration·1000)
  return loop ? raw : min(1, raw)                   # 0 when never started
```
Each block's step function receives `P` (0→1) and paints the state for that moment. Blocks are only stepped when within 200px of the viewport. `prefers-reduced-motion: reduce` forces `P = 1` everywhere. Canvases are DPR-aware (cap 2×), redrawn every frame from a single `requestAnimationFrame` loop, and each begins by filling its ground colour.

## Design tokens

Colours
- Navy ground `#0B1E3F`; deeper panel navy `#061530`; panel highlight `#10264D` / `#173261`; land `#2F4573`, land gradient `#4E5F86 → #2F4573`
- Red ground `#6E1B27` (scrim `rgba(110,27,39,…)`); mark red `#B22234`; bright red text `#E04B5C`
- Cream `#F7F5F0` (text, cream grounds); muted cream `rgba(247,245,240,.55–.75)`
- Gold `#D4A017`; gold light `#F2C94C`; gold dark `#C2921A`; ingot base `#B8871A`; August-jobs highlight `#FFE08A`
- Blue accent `#6C8CD5` (ceasefires, price falls, Treasuries, the Fed's answer)
- Cream-ground text `#0B1E3F`; cream-ground gold `#8a6a0c`

Type (Google Fonts)
- Display numbers: Barlow Condensed 700, `clamp(88px, 22vh, 240px)` (globe/strait) or `clamp(88px, 22vh, 200px)`, line-height .86, letter-spacing −.02em, gold, `text-shadow 0 0 40px rgba(212,160,23,.35)`, tabular numerals
- Number labels: Barlow Condensed 600, `clamp(18px, 3.6vh, 34px)`, uppercase, letter-spacing .02em, cream; secondary line at 60% cream
- Kicker (headline for skim readers): Barlow Condensed 600, `clamp(15px, 2.2vh, 21px)`, uppercase, letter-spacing .12em, cream, preceded by a 9px square (`#B22234`, or `#F7F5F0` on red grounds), gap 10px, margin-bottom `clamp(4px,1vh,10px)`
- Body sentence: Source Serif 4 400, `clamp(16px, 2.7vh, 24px)`, line-height 1.35, max-width 640–760px, `text-wrap: pretty`
- Data captions (HTML): IBM Plex Mono 400, 14px, letter-spacing .14em (top-left date/event); 12px, .14em, 55% cream, right-aligned, line-height 1.7 (top-right caption)
- Data captions (canvas): IBM Plex Mono 500 at 13px (chart titles), 14px (labels), 12px (footnotes); canvas sub-heads Barlow Condensed 700 at 20/24/30px
- Show the work: Source Serif 4 17px/1.5 body, 15px/1.55 for method notes, IBM Plex Mono 12–13px tables and source lines; summary row IBM Plex Mono 13px, .16em, 1px navy rules top and bottom, gold 10px square

Spacing
- Block padding 28px 36px top, 0 36px 36px bottom (mobile 20px / 0 20px 28px)
- Bottom cluster: kicker → number row (gap 18px, baseline aligned) → sentence (margin-top `clamp(8px,2vh,18px)`)
- Show the work band: padding 56px 36px 72px, content max-width 820px, gap 22px

Radii & shadows: split-flap cells 3px (total 5px), pump 8px, stamps 6px, share card 8px; card shadow `0 40px 120px rgba(0,0,0,.5)`; pump shadow `inset 0 0 0 1px rgba(247,245,240,.1), 0 20px 60px rgba(0,0,0,.35)`.

Scrims: each canvas ends with a vertical gradient from transparent at ~50–62% height to ground colour at ~.9 alpha at the bottom, so the readout stays legible.

## Blocks

### 00 · The globe (scroll-driven)
- Orthographic globe (d3-geo) over Natural Earth land (world-atlas 110m; 50m for the box [22,−12]–[92,48] as the camera pushes in). Six straits as schematic routes that run coast to coast or into the next lane (Hormuz continues past India to the Malacca approach at [75,7]; Bab el-Mandeb starts at [66,9.5]; Suez runs to Gibraltar [−4,36]; the Cape route from [74,6] round to Morocco [−14,34]; Malacca to [121,26]; Panama [−62,18]→[−100,−2]). Gold particles spawn at a rate ∝ ships/day, fade in/out over the first and last 7% of a lane, and slow as the count falls (30% speed at 5% of baseline, slowest on the approach to the strait).
- Timeline over scroll progress P: 0–.04 hold before the war; .04–.30 runs 27 Feb → 30 Aug 2026 day by day; from .30 the camera pushes in on Hormuz (smoothstep), finishing with the 33 km gate ≈ a fifth of the frame tall.
- Hormuz closes with a pulsing red bar between Musandam and Larak (`#B22234`, width 10→20px + glow), a red flash for 10 days after the strike, and `HORMUZ · CLOSED` label.
- Readout: date (or `BEFORE THE WAR · 1 JAN 2025 – 27 FEB 2026`), event line (red for his acts, blue for ceasefires), big number = Hormuz ships/day, legend of the other five straits (now / baseline) at right. Kicker: `HIS WAR SHUT THE STRAIT OF HORMUZ`.
- Data: `globe-data.json` (`items.<strait>.baseline.total_per_day`, `.observations`, `hormuz_daily`). Baseline = 423-day mean 1 Jan 2025–27 Feb 2026; other straits' pre-3-May gap is a straight line from baseline to first observed week.

### 01 · Two dates (3.5 s, red ground)
Two cream double-bordered "stamps" slam in (scale 1.8→1, opacity, rotation −4° / +3°, cubic ease-out) at P=.12 and .30: `ORDERED / 28 FEB 2026 / He ordered the strike` and `IMPOSED / 24 FEB 2026 / He re-imposed the tariffs a court had struck down`. At P>.42 a mono note appears (`STRUCK DOWN · 20 FEB 2026 · SUPREME COURT, 6–3 · IMPOSED AGAIN FOUR DAYS LATER`), at P>.5 the sentence `Every red mark on this page traces back to these two dates.` Stamp type: Barlow Condensed 700 `clamp(64px,15vh,160px)`; landed stamps get `box-shadow 0 0 0 1px rgba(247,245,240,.3), 0 0 60px rgba(247,245,240,.18)`.

### 02 · Oil doubled (8 s)
Seismograph: paper band (`#10264D`) from 20% to 54% height; the needle sits at 70% width and the paper slides left at max(4.5, .0055·W) px per day as P runs 2 Jan → last close (P .02–.80). Trace: gold `#F2C94C` 2.2px over a 7px 35%-alpha glow; y maps $50–$120. Red ticks for his acts (24 Feb, 28 Feb, 8 Jul, 1 Sep), blue for ceasefires (7 Apr, 18 Jun), labelled in 13px mono, alternating rows. On the strike day the whole canvas shakes (±9px, decaying over .5 s) and the paper flashes red for six days. Readout: `$NN` a barrel with sub-line by phase (`before his war` / `after his strike` / `the peak · five weeks after the strike` in red / `under the ceasefires` / `the ceasefire broken` / final `now · $57 in January · $115 at the peak`). Kicker `OIL DOUBLED IN FIVE WEEKS`. Data: `crude-data.json` (FRED DCOILWTICO).

### 03 · The strait (9 s)
Real coastline (`frontend/src/v4/hormuz/coast.json` rings, bbox, labels, Traffic Separation Scheme lane, gate) scaled so the gate anchors at (56% W, 34% H). Zoom is `max(1.3× fit (mobile 2.2×), the zoom at which all four edges of the coastline box fall off-canvas ×1.04)` so the clipped box edges never render as a shoreline. Lane: 26px gold band whose alpha follows the count, dashed edges ±.026 offset; the lane is extrapolated straight beyond both ends of the box (s from −0.6 to 1.6) so it runs off-screen. Ships (hull `#F2C94C`, navy bridge) spawn off-screen at s=−0.6 / 1.6 at rate .12·flow, crawl at `0.3+0.7·frac^0.6`. Gate: `33 KM` label; when closed, pulsing red bar + `CLOSED`. From 18 Aug a side-by-side appears top-right: `HE SAYS · 30 A NIGHT · 18 AUG` as 30 dashed ghost hulls over `COUNTED · N A DAY · 7-DAY MEAN` in filled hulls. Readout `83 → 4 ships a day`, kicker `HE SAYS IT IS OPEN. THE SATELLITES SAY NO.`

### 04 · Your prices (6 s)
Left: a split-flap departures board, 14 rows (diesel first, then 13 BLS staples sorted by % change, eggs last). Columns: name/unit, JAN 2025, NOW (flap cells), CHANGE. Rows start flipping at P = .04 + i·(.66/14); each cell cycles 0–9 every 45 ms and settles left-to-right (0.18 s + 0.07 s per column); the CHANGE column fades from 15% to 100% on landing. Up = gold, down = blue. Cell: `#061530`, 3px radius, inset 1px cream 8% ring, a 1px dark mid-line and a 50%-height top "flap" highlight (12% cream) that blinks while flipping. Eggs row carries a blue note: `· avian flu ended, not policy`.
Right: a mechanical odometer for diesel (Barlow 700, `clamp(64px,15vh,150px)`, gold): three wheels; the cents wheel turns continuously through every EIA week 20 Jan 2025 → 31 Aug 2026 over P .02–.72; higher wheels only turn as the one below passes 9; wheels rest on whole cents; wheel shading `linear-gradient(180deg, rgba(6,21,48,.75), transparent 12%, transparent 88%, rgba(6,21,48,.75))`. Under it `WAS $3.72 WHEN HE TOOK OFFICE · <week>`.
Bottom: the household total as split-flap cells (`+$NNN.NN`, starts at P .76) with `a month for a household in <place> / $N over 17.3 months since 20 Jan 2025`, and a state `<select>` (dark, gold chevron) that re-flips fuel, electricity and the total. Data: `prices-data.json` (`items`, `diesel.points`, `receipt`, `receipt_inputs`).

### 05 · Nobody is hiring (9 s)
Two "stands" (1px cream 18% outline) from 15% to 47% height. Left: `AT THE PREVIOUS PACE · 2021–25 AVERAGE / +320,938 A MONTH`; right: `WHAT HAPPENED · SINCE 20 JAN 2025 / +N IN <MONTH>` (gold). One standing figure = 10,000 jobs: head circle r=.2w plus a rounded body .64w × 1.15w; figure width `w = sqrt(standW·standH·0.88 / (1.9·N_left))` so the previous-pace crowd fills its stand; the actual crowd uses the same scale. Months pour one at a time (P .02–.72, 19 months from Feb 2025); figures drop in (120px, ease-out over .4 s); negative months remove the most recent figures in red (fade .5 s, then release their slot); August 2026 figures are `#FFE08A`. Below (desktop): `OF EVERY 100 OUT OF WORK, OUT SIX MONTHS OR MORE` — 100 small figures, lit share = long-term unemployed % (`27 · WAS 21`); and `YOUR RAISE, AFTER PRICES · YEAR TO JULY 2026` `−0.1%` with `PAY +3.2% · PRICES +3.4%`. Readout: running mean `42,000 new jobs a month since he took office · was 321,000`; kicker `HIRING HAS NEARLY STOPPED`. Data: `bill-data.json` (`jobs`, `ltu`, `pay`).

### 06 · What the war cost (9 s, red ground)
A four-row ledger from 11% to 68% height (mobile: three rows to 62%). Left column (min(28% W, 360px)): big gold number (Barlow 700, min(.55·rowH, 96px)) with a cream unit at .3× beside it, then one or two 14px mono labels (auto-shrunk to fit the column). Right column: the pictograph. Rows, in sequence P .02–.20 / .20–.42 / .42–.66 / .66–.86:
1. `18 DEAD` — 18 five-point cream stars (two rows of nine, glow) light one by one. Labels `US SERVICE MEMBERS KILLED` / `NBC NEWS · 28 AUG 2026 · INJURED: HUNDREDS`.
2. `42 AIRCRAFT` — 42 plane silhouettes, 21 per row; 17 manned filled cream, 25 drones (MQ-9, MQ-4C) outlined. Labels `LOST OR DAMAGED · 17 MANNED · 25 DRONES` / `CRS · 13 MAY 2026`.
3. `$37.5bn SPENT` — counter runs to 37.5 over the first 70% of the row; a gold bar (scale = spent + ask) fills, then a dashed cream outline extends by $67.1bn (the supplemental request) with a navy `#0B1E3F` slice for the $21bn munitions line. Captions `SPENT · $37.5BN`, `ASKED FOR · $67.1BN MORE`, `$21BN OF IT TO REPLACE MUNITIONS`. Labels `PENTAGON COST · TO 21 JUL 2026` / `HE SAID FOUR TO FIVE WEEKS`.
4. `1 in 3 LEFT` (desktop) — 100 slim triangles across the column; 67 fade to 15%. Under them, 15px mono: `THE SECRETARY OF DEFENSE DISPUTES THIS ESTIMATE · 5 AUG` and, dimmer, `HIS OWN BUDGET REQUEST ASKS $21BN FOR MUNITIONS TO REPLACE THEM`. Labels `PATRIOT INTERCEPTORS LEFT · CSIS, 27 JUL` / `REBUILDING TAKES THREE YEARS OR MORE`.
Kicker `SEVEN MONTHS IN. HE SAID FIVE WEEKS.` (cream square). Sentence as in the file. Data: `bill-data.json → war_cost`.

### 07 · What the lost aircraft cost (30.3 s, loops)
Left of a large gold `=`: the aircraft. Right: a pile rectangle (from 46% W to the right margin; top = max(13% H, 112px), bottom 55% H) into which gold squares rain (fall from above the canvas over .5 s with ease-in, landing row by row bottom-up, shuffled within each row). Five beats of 4.7 s (2.2 s rain, .5 s fall, ~2 s hold), then a 6.8 s finale, then restart:
0. One big F-35A silhouette (`ONE F-35A · $82.5 MILLION`) = 150 squares of 1,000 PS5s → readout `150,003 PlayStation 5s / for one F-35A · $82.5 million`.
1–4. The 42 lost aircraft (7 × 6 grid, manned filled, drones outlined; caption `42 AIRCRAFT LOST OR DAMAGED · $2.6 BILLION · 17 MANNED, 25 DRONES`) = $2.6bn in: PlayStation 5s (10,000 per square; `one for every 28 households in America`), gallons of diesel (1M per square; `3 days of every gallon America burns`), years of in-state tuition (500 per square; `in-state, public four-year, at $11,610`), Costco hot dogs (5M per square; `5 for every American`).
Finale: red-outlined squares (`rgba(224,75,92,.9)`) rain at the same scale for the whole war's $37.5bn (≈14× the pile) and run off the top; readout turns red: `$37.5bn / the war so far / 14 times the aircraft · and he has asked for $67.1bn more`. Captions on the pile: `EACH SQUARE IS …` top-left, `$2.6BN ÷ $549.99` bottom-right. Readout number counts with landed squares and formats as `N`, `N.N million` or `N.N billion`. Kicker `WHAT THE LOST AIRCRAFT COST`. Reference prices are constants in `setupBuy()`: PS5 $549.99, tuition $11,610, hot dog $1.50, F-35A $82.5M, US households 132.2M, US population 340M, distillate 3.9M bbl/day × 42.

### 08 · The world backs away (8 s)
A vault cage (62% of width, 14%–48% height, 12 vertical rules) holding one ingot per tonne of foreign gold (100 columns): trapezoid `#B8871A` with a `#F2C94C` lit top face. Months advance over P .04–.70; each month's outflow leaves from the top of the stack (bars slide right 260px, rise 40px and fade over .7 s, staggered 12 ms). Caption `FOREIGN GOLD IN THE VAULT · N TONNES`. Right (desktop): `TREASURIES HELD FOR FOREIGN OFFICIALS` as a blue `#6C8CD5` stack shrinking against a 25% ghost of the January level, value `$2.62tn` inside the bar, `JUN 2026 · WAS $2.78TN IN JAN` below; when complete, the Fed's answer in blue Barlow 20px (three lines) with `FEDS NOTES · COLIN WEISS · 3 SEP 2026`. Readout `N tonnes of gold taken out of New York · ten months · none came in`; date line `MONTH YEAR · −N T THIS MONTH`. Kicker `THE WORLD IS TAKING ITS GOLD HOME`. Data: `bill-data.json → gold.earmarked` (tonnes = $M ÷ 42.22 × 31.1035), `gold.treasuries`.

### 09 · Your bill (3 s, cream ground)
A 1200×630 share card (navy, 1px cream 25% border, 8px radius, red/cream stripe 6px at top, container queries for type). Header `THE BILL` / `IN THE GOVERNMENT'S OWN NUMBERS · 6 SEP 2026`. Eight tiles in a 4-column grid fade up (24px, .16 s each, staggered .07): household +$/month, crude $57→$115, ships/day, diesel, jobs/month, `18 dead` (cream), gold tonnes, `28 Feb · 24 Feb` (red). Footer `Ordered by Trump.` (red) `Paid by you.` / `GOVERNMENT DATA · EVERY SOURCE BELOW`.

### 10 · Check our work
Cream, 820px column: intro, then `The missing month`, `Not a record, and not policy`, `What the counts are, and are not`, `What we will not do`, and the full source list. Consumer-facing: no process notes, no revision history.

## Show the work panels
`<details>` with a mono summary row; content is Source Serif 17px paragraphs, mono tables (grid, 1px rules, gold values), and a mono source line. All figures in them are holes filled from the same JSON as the canvases (see `renderVals()`, `billVals()`, `buyVals()`).

## State
- `state`: selected state code (`US` default) → rebuilds the board and receipt (`receiptFor`, `buildBoard(keepPhase)`)
- Per-block play clocks (`plays[key]`), particle arrays (globe `routes[k].parts`, strait `strShips`, crowd `cLeft/cRight`, vault `vGone`), split-flap row phases (`start | flipping | done`), cached layouts (`buyL`, globe background bitmap `bg`)
- `reduced` from `prefers-reduced-motion`

## Data files (bundled)
- `globe-data.json` — IMF PortWatch daily transit estimates, six straits, `as_of`
- `crude-data.json` — FRED DCOILWTICO daily closes 2026, `peak`
- `prices-data.json` — BLS average prices, EIA diesel weekly, receipt method, state/PADD gasoline and state electricity
- `bill-data.json` — payrolls, long-term unemployment, pay, war_cost (casualties, aircraft, cost, munitions), gold (earmarked, treasuries), against
- `strait-coast.json`, `frontend/src/v4/hormuz/coast.json` — gate, TSS lane, coastline rings/labels for the strait block
- External at runtime: `d3@7`, `topojson-client@3`, `world-atlas@2` land-110m/land-50m, Google Fonts (Barlow Condensed 600/700, Source Serif 4 400/500, IBM Plex Mono 400/500)

## Files in this package
- `README.md` — this document
- `The Bill.dc.html` — the whole design: template (top) + logic class (bottom). Open it next to `support.js` and the JSON files to run the prototype locally (serve the folder over HTTP; it fetches the JSON).
- `support.js` — the prototype's template runtime; not needed in the target codebase
- `globe-data.json`, `crude-data.json`, `prices-data.json`, `bill-data.json`, `strait-coast.json`, `frontend/src/v4/hormuz/coast.json` — the data snapshots every number is read from (schemas described above and self-evident in the files)
- `frontend/public/data-snapshot.json` — the repo's combined snapshot (schema v2) the individual files were cut from
- `github.md` — the source repository this project is associated with

## Implementation order (suggested)
1. Page shell: fonts, grounds, scroll-snap, the shared rAF loop and `playProgress`, the SCROLL cue.
2. Data loading: fetch the five JSON files + world-atlas; derive baselines, day indices, receipt, board rows exactly as `componentDidMount`, `setupSim`, `setupSeis`, `setupBill`, `setupBuy`, `buildBoard`.
3. Blocks in page order; port each `step*` routine to a canvas component. The globe (`paint`, `stepParts`, `readout`) is the largest.
4. Show-the-work panels and Check our work (static markup + the same derived values).
5. Share card, then the mobile pass.
