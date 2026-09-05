# Session handoff — 2026-09-05

State of play for whoever (or whatever) picks this up next. Supersedes the 2026-08-02
handoff; the V4 ledger described there as "briefed but not implemented" shipped on
2026-08-17 and was overhauled today.

## Where things stand

**Built, tested, screenshotted.** The V4 ledger page now renders entirely from the data
snapshot — no figure is typed into JSX. Three new sections (the squeeze, the gold leaving
New York, less is moving), a Hormuz simulation running on measured daily closes and IMF
PortWatch transit counts, and a THESIS.md update sourcing every new figure.

**Refresh the site** (this is the whole process; ~2 minutes):
```
cd backend  && py scripts/build_snapshot.py
cd frontend && npm run build
```
Then `git push`. Cloudflare Pages builds from `main`.

**Tests:** `py -m pytest backend/tests/ -q` → 28 pass. Frontend: `npx tsc --noEmit -p
tsconfig.app.json` clean; eslint has a pre-existing false positive on `ref={r.status}` in
HormuzSimulation and scoped `no-explicit-any` disables on the snapshot consumers.

## What changed today, and why

1. **`frontend/src/v4/ledger-data.ts`** — `deriveFigures(snapshot) -> Figures`. The page
   was stale within a month because every number was a literal. Now the masthead chart is
   every daily close, the crossing chart is all 45 months, the shelf reads BLS average
   prices plus EIA diesel, the jobs bars read the term means, and so on. Diesel is on the
   shelf because it hit a series record.
2. **`backend/services/macro.py`** — latest / handover / pre-war readouts for ~30 FRED
   series and 12-month changes computed **by calendar month** (the missing October 2025
   made positional indexing span 13 months — the bug that produced 3.73% vs 3.53%).
   Tested in `tests/test_macro.py`.
3. **`backend/services/portwatch.py`** — IMF PortWatch ArcGIS FeatureServer, chokepoint6.
   Free, no key, daily since 2015. Pre-war baseline Jan 2025–Feb 2026: **83.1 vessels/day
   (46.6 tankers)**. Late August: 3–7 a day. This resolved the "not wired in" item that
   had stood since the design handoff.
4. **`backend/data/context_figures.json`** — curated, tiered figures that are not on FRED
   (Fed Table 3.13 earmarked gold, DNB/BdF/RBI moves, ECB reserve shares, the Fed's
   3 Sep FEDS note, WTO, IEA Aug OMR, Drewry, IATA, Kpler/Lloyd's transits, US official
   claims, war-risk quotes, Michigan final August, CME hike odds, Dallas Fed WP 2624).
   Mirrored in THESIS.md "September 2026 update". Rule: if it disagrees with FRED, FRED wins.
5. **`backend/data/war_milestones.json`** — ten July–September entries. One is
   `study: true` (1 Sep strikes, sign +1); its description says it was added with the
   price path visible and is not pre-registered like the first six.
6. **`engine.js`** — `configureTimeline({prices, transits})`, dated `EVENTS` (day offsets
   derived, not hand-counted), span extends to the latest close/transit/event, price
   readout holds the last close on non-trading days and says "LAST PUBLISHED CLOSE" past
   the last print. Drawing maths untouched.
7. **Correction surfaced:** the crude peak is **$114.58 on 7 Apr**, not $114.01 on 6 Apr.
   Now on the page under "Corrections" and in THESIS.md.

## The most important findings this month

- **The strait never reopened.** IEA: "effectively closed again in early July". PortWatch
  confirms single-digit daily transits through 30 Aug. The President's "30 ships every
  night" is drawn as a hatched bar next to the measured counts and labelled as a claim.
- **The US–euro gap narrowed to +0.43 in July — because Europe's inflation rose** (Aug
  flash 3.3%, energy +14.3%). This strengthens the global-oil-shock reading and weakens any
  "America-specific 2026 excess" framing. §03 says so explicitly. Do not revert to the
  spring's +1.11 without saying why.
- **Gold: the defensible claim is the Fed's own custody table**, not the price and not
  "everyone is leaving". Table 3.13 at the statutory $42.22/oz: 5,919 t (Aug 2025) →
  5,760 t (Jun 2026), every month ≤ 0. Germany has moved nothing. Gold is *down* 20%
  from January; the dollar is *up* since the war began. The Fed's 3 Sep note is quoted
  in the honest-part panel.
- **August payrolls +162k** is stated in §05's first paragraph and in "the other side".
  Term mean 42,474 vs 320,938. One month does not unfreeze hires (3.2%) or quits (1.9%).
- **The Fed is leaning toward a hike** (57.5% for September per FedWatch after Warsh at
  Jackson Hole). 10-year 4.77%. Mortgages 6.71%, lower than the handover — shown as such.

## Immediate next steps

1. **Rebuild the snapshot after 10–11 Sep** (August CPI) and after the FOMC (16–17 Sep).
   FRED will also have filled the 2–5 Sep crude closes by then.
2. **Consider a Claude Design pass on §07 and §08.** They were built without a design
   handoff, in the V4 idiom, and hold up — but the gold "vault" chart and the trade tiles
   could carry more. A brief would name: the ounce-denominated custody chart as the hero,
   the claim-vs-measured Hormuz bars, and the honest-part panel as non-negotiable.
3. **Mines figure.** "Over 100 suspected mines" is sourced only to the Wikipedia summary
   of contemporaneous reporting. Find the CNN/Reuters original or soften the wording.
4. **Tier 1 source for Kpler/Lloyd's transit counts** — currently via Al Jazeera (Tier 2).
   PortWatch already gives a Tier 1 count; the Kpler bar is corroboration.
5. **PortWatch tanker split** is in the snapshot (`tanker` per day) but only the total
   drives the simulation. A tanker-only readout is a small addition.

## Standing decisions (unchanged)

- Zero fabrication. Missing data says "no data".
- Show the rows that cut against us, at full size.
- War and tariff effects are never summed.
- No queue count. The vessel layer is illustrative and labelled.
- The insider-trading probe never shares a visual frame with the paper-physical spread.
- `docs/THESIS.md` governs every claim on the page. Read it before writing copy.
- Do NOT use git worktrees in this OneDrive folder.
