# Handoff for a fresh Claude Design session — V5, "The bill Trump handed you"

**Revised 2026-09-06 by the engineering session**, after reading the previous Design session's
handoff package and the user's defect screenshots. This file supersedes that session's
`HANDOFF.md` (archived at `docs/design-handoff/2026-09-06-v5-first-pass/`). Where the two
disagree, this one wins. Where this one and the brief disagree, the brief wins
(`docs/design-briefs/2026-09-05-v5-the-bill.md`).

Repo: `Samizdat-Publications/oil-tracking-dashboard` (main) · Live V4: https://trumps-economy-ledger.pages.dev
Data: `frontend/public/data-snapshot.json` — **pull it fresh from main**; the copy in the
previous session's package is a day old and missing blocks.

---

## 0. Why there is a fresh session

The previous run produced a competent page and the wrong page. Thirteen chapters, each a
chart with axes, flags on polylines, hatched bands, percentage tiles, and "TIER 1" labels on
the surface. Then several rounds of polishing those charts. The user's verdict: a reskin,
and every chart a downgrade. Eight hours went into refining a structure that should have
been thrown out at hour one.

The failure was not craft. It was **starting from the chapter list instead of from the
reader.** This handoff exists to make that impossible to repeat.

**Do not open the previous prototype until you have finished §3 of this document.**

## 1. The reader, and what "digestible" means here

Someone on a phone, on a bus, who has heard "prices are up" and wants to know what
happened and whose fault it is. They will give this page sixty to ninety seconds. They know
what a gallon of gas costs, what eggs cost, what their rent is. They do not know what PCE
is, and they never will.

The page is for them first. The analyst who wants the method gets everything — every
series, every source, every falsifier — one tap below, under **Show the work**. Nothing
analytical appears on the surface.

**Surface vocabulary is banned:** "y/y", "pts", "bps", "CPI", "PCE", "HICP", "index",
"elasticity", "nowcast", "TIER 1/2", "FRED", any snapshot key, any series ID, any "as of"
string longer than a month name. Say "prices". Say "a year ago". Say "the government's own
numbers". Sources and tiers live in Show the work.

**Test for every screen:** read only the big number and the one sentence. If a fourteen-
year-old cannot say what happened and who did it, the screen is not done.

## 2. The story in one breath

This is the whole page. Every beat below is one screen, one number, one sentence, one
moving picture. If you cannot say a beat in a sentence a stranger repeats back correctly,
cut it or merge it.

> He started a war and picked five trade fights. Oil doubled in five weeks. The strait he
> shut is still shut. Diesel hit a record. Your groceries cost more. Nobody is hiring, and
> your raise did not keep up. Other countries are pulling their ships and their gold away
> from America. Eighteen Americans are dead and forty-two aircraft are gone. Here is your
> bill.

### The beats (nine, plus the bill and the receipts)

| # | Beat | The number (bound key) | The sentence | The picture — an OBJECT, not a chart |
|---|---|---|---|---|
| 0 | **Your bill** | `receipt.monthly_usd` → **+$83 a month**, counting up | *He ordered a war. He imposed tariffs. This is what it costs your household every month, in the government's own numbers.* | The total, alone, at poster size. Then the scroll cue. |
| 1 | **He did this** | Two dates: **28 Feb** and **20 Feb / 24 Jul** | *On 28 February he ordered the strike. On 24 July he re-imposed the tariffs a court had struck down. Everything below follows from those two dates.* | Two red stamps on cream. The only red on the page is his dated acts. |
| 2 | **Oil doubled** | `crude_daily` → **$57 → $115** in five weeks | *Crude doubled after the strike, fell back when he agreed a ceasefire, and is $91 now that he broke it.* | Not a chart with flags. A **gas-pump price display** that rolls as you scroll, or a single line that draws itself with nothing on it but the three dates. |
| 3 | **The strait is still shut** | `hormuz_transits` → **4 ships a day, was 83** | *He says thirty a night. The satellites count four.* | **The simulation** — the real engine, restyled. The quality bar for the whole page. |
| 4 | **Your receipt** | `staples` + `receipt_inputs` → **diesel $5.60, a record**; 15 lines | *Fifteen things you buy, January 2025 against now. Four went down. We show those too.* | A **till receipt that prints** line by line, total at the bottom. State picker, miles, household size — your receipt, not the average one. |
| 5 | **Nobody is hiring** | `jobs` → **42,000 a month, was 321,000**; `macro.series.real_ahe` → **your raise −0.2% after prices** | *Few people are being fired, but if you lose a job you stay out longer than at any point since he took office, and your paycheck buys less than a year ago.* | A **paycheck stub** or a **jobs board**: two columns, not a bar chart. |
| 6 | **The world is backing away** | `chokepoints` + `context.gold` → **4 ships a day through Hormuz; 159 tonnes of gold out of New York** | *Ships go the long way round Africa now. Central banks are taking their gold out of the New York Fed for the first time in fifty years, and the ones that say why say "geopolitical unrest".* | A **vault emptying** (ten months, every one negative) beside a **map with the ships gone**. |
| 7 | **What the war cost America** | `context.war_cost` → **18 dead · 42 aircraft · $37.5bn** | *He said four to five weeks. Seven months on: eighteen service members dead, forty-two aircraft lost or damaged, a Navy resupplying from 2,200 miles away, and a third of the missile interceptors left. The Secretary of Defense disputes that last number; his own budget request asks for $21 billion to replace them.* | A **typographic tally**. No silhouettes, no map. The denial printed beside the estimate. |
| 8 | **Against us** | six numbers in blue | *What went right, at full size. Eggs are down. August added 162,000 jobs. The stock market is up. Mortgages are cheaper than when he took office. The dollar is up. We are not hiding any of it.* | Six plain cards. Same size as everything else. |
| 9 | **The bill** | eight numbers | The completed receipt. ORDERED BY: Trump. PAID BY: you. | The shareable card and the OG image, one component. |
| 10 | **Check our work** | — | Every source, the missing month, the two corrections we made to ourselves. | Plain. This is where Show the work lives for the page as a whole. |

**What got folded in, and where it lives now.** The Europe control-group chart (the old 09) is
the *proof*, not the story: it goes under Show the work in beat 9, as "Was it him?". The Fed
and rates screen (old 06) becomes one line in beat 5 and a card in Show the work. The tariff
core-inflation chart (old 04, which the user said must go) becomes the second stamp in beat 1
and a Show-the-work panel under beat 4 — the tariffs are on the receipt, not in a gauge.
Trade (old 07) and gold (old 08) merge into beat 6.

Nine beats, one bill, one receipts page. Not thirteen chapters.

## 3. Process — how to spend the hours this time

1. **Write the eleven sentences first**, in the voice rules (brief §1). Read them aloud.
   Post them to the user before drawing anything. This is a two-hour step, not a two-minute one.
2. **Storyboard three radically different visual concepts** at low fidelity — one artboard
   per beat, boxes and words, no charts. Three genuinely different worlds, for example:
   *The Receipt* (thermal paper, a till printing, a cash drawer); *The Forecourt* (everything
   is a gas station: the pump display, the price sign, the strait as the pipe that feeds it);
   *The Statement* (a bank statement, debits in red only where he acted). Show all three to
   the user. Pick one together. **Do not pick for them.**
3. **Build beat 3 (the strait) to finished quality first**, in the chosen world. It is the
   quality bar. If it does not make the user say "that", stop and rethink the world.
4. Then the rest, one beat per write, verified at 1400 and 390 with screenshots of every
   beat before each review. Read the whole page top to bottom on a phone before showing it.
5. Only now open the previous prototype, for its technical lessons (§6), not its design.

**A beat is not done if it can be described as "a chart with flags on it".** Every beat is
described as a thing that happens: the receipt prints; the pump rolls; the vault empties;
the ships thin out; the stamps land.

## 4. Decisions already taken (do not reopen)

- **Title:** *The bill Trump handed you.*
- **No fixed rail.** The previous session's black rail was "background noise" and the cream
  one is still a second page competing with the first. The running total appears as a
  **stamp at the end of each beat** ("running total · +$83/mo") and is completed in beat 9.
  On a phone the stamp is the only persistent element.
- **Ground:** cream, ink as punctuation. **Red = his dated acts, nothing else. Amber =
  measured. Blue = ceasefires, the court, and against us.** Grey hatch = a claim that is not
  data (his "thirty ships a night").
- **The strait uses the real engine** (`frontend/src/v4/hormuz/engine.js`, now on the Natural
  Earth coastline with PortWatch counts). A prototype SVG is acceptable only if it is driven by
  the same daily counts; the shipped page embeds the engine.
- **Charts are generated from the series**, never drawn by hand or approximated. Where a beat
  needs a chart it is one line or one row of bars with at most three labels.
- **Every number is bound** to a snapshot key or marked `PLACEHOLDER` in the artboard.
  Nothing internal — no keys, no "mounts here", no notes — reaches the surface.
- **Honest rows at full size, never collapsed.** War and tariff effects never summed. No
  queue count. Odds labelled as odds.

## 5. What is new in the data since the brief (bind to it)

Snapshot is **schema v2, 20 blocks**, rebuilt automatically each weekday once the user adds
four repo secrets. Blocks and the plain sentence each one supports:

| Block | Carries | Plain line |
|---|---|---|
| `eia.series.spr` | Emergency oil reserve **286.6M barrels**, lowest since 1983 | "He drained the emergency reserve to hold the price down." |
| `eia.series.refinery_util` / `crude_exports` | Refineries at **98%**; exports **4.5 mb/d** | "There is no slack, and American producers sold into the shortage." |
| `eia.gasoline_by_area` / `electricity_by_state` | 29 areas weekly; 52 states monthly | The receipt's state picker. |
| `fiscal.debt` | **$40.10 trillion**, live in the browser | "Forty trillion." |
| `fiscal.customs` | Tariff receipts **net of refunds negative** in May, June, July | "His tariffs took in less than the Treasury paid back." |
| `fiscal.interest` | **$1.27tn** interest this fiscal year so far | "Interest is the fastest-growing line in the budget." |
| `chain` | Six links with pre-war elasticities and lags — crude→diesel→trucking→**food, ~4 months later**; crude→jet→fares; gas→fertiliser | The arrows in the chain. Coefficients stay in Show the work; the surface says "about four months later". |
| `chokepoints` | Hormuz **5%**; Bab el-Mandeb 78%; Suez 111%; Cape of Good Hope 103% | "Ships go the long way round Africa now." |
| `nowcast` | Cleveland Fed: August prices **3.4%**, September 3.4% | "What next week's number will probably say." Model estimate; say so. |
| `polymarket` | Fed hike in September **~50%**; blockade ends by 30 Sep 17.5% | Odds, never data. Show the work only. |
| `receipt_inputs` | Baselines, staple moves, regional prices, sourced assumptions | The browser recomputes the receipt (`frontend/src/v4/receipt.ts`). |
| `context.war_cost` | $37.5bn; $67.1bn requested ($21bn munitions); 18 killed; 42 aircraft (CRS); Bahrain hub struck day one; interceptor estimates with Hegseth's denial; Planet Labs imagery suspension at government request | Beat 7. |
| `context.trade_disputes` | Canada 50% (20 Jul → 22 Aug → Canada retaliates 8 Sep); Brazil 25%; pharma, drones, polysilicon | "Five new trade fights since spring." |
| `context.energy_supply.fertilizer` | Urea +80%; Ras Laffan 3–5 years; farmers hold 60% of nitrogen | "Next year's food prices start here." Show the work under beat 4. |
| `macro.series` additions | U-6 **7.7%**; **real wages −0.2%**; continued claims; sentiment by party (Republicans −19% vs pre-war) | Beat 5. |

## 6. Technical lessons from the previous session (keep these)

- Build **one beat per write** with `<!--BEATxx-->` markers; large writes get interrupted.
  `run_script` with `replaceText` for batches of edits.
- `body{overflow-x:hidden}` makes body the scroll container and breaks `window.scroll` and
  `view()` timelines; `overflow-x:clip` on `html` kills scrolling. Clip per `<section>`.
- CSS `animation-timeline: view()` ranges must complete early: `entry 0% entry 100%`;
  anything keyed to `cover` finishes too late.
- Scroll-scrubbed drawings are driven in JS (`progressAll()` sets per-beat progress 0–1
  from `getBoundingClientRect`); geometry computed once, exposed as paths and positioned
  labels; readouts hidden until progress > 0.02 and clamped inside their container.
- Fonts: Google Fonts in the prototype is fine; production self-hosts. Mono floor 12px;
  body 19–22px; number type 200–320px desktop, 88–120px mobile.
- The verifier catches overlaps. It does not catch a bad idea. Look at every beat yourself.

## 7. Defects the user flagged last time (all must be absent)

Gold bars rendering as zeros; snapshot keys and build notes visible on the page; a black
rail; labels colliding at the right end of charts; legends over captions; "ordered" stamps
covering text; every chapter using the same line-plus-flags device; analyst labels ("TIER 1",
"y/y", "pts") on the surface; the page never reviewed end to end at 1400 and 390.

## 8. Deliverables

1. The eleven sentences (§3 step 1) — before any visual work.
2. Three low-fidelity storyboards, one screen per beat, radically different worlds.
3. After the user picks: beat 3 at finished quality; then all beats at 1400 and 390 as
   `.dc.html` artboards on one canvas, in the order in §2.
4. The system: tokens with meanings, type ramp, the beat template, the running-total stamp,
   the Show-the-work disclosure, the bill card.
5. Copy for every number, sentence and stamp with values written as `{snapshot.key}`.

**Acceptance.** A phone reader who scrolls for sixty seconds and opens nothing can say what
it costs them a month, what happened to oil, how many ships get through, how many Americans
died, and what left the New York Fed. A hostile reader, opening nothing, can find all six
*Against us* rows and both corrections. No red mark on the page is anything but a dated act
of his. No word from the banned list appears above a Show-the-work rule.
