# Handoff to the next Claude Design session — read this and the brief before anything else

**Written 2026-09-05 by the engineering session.** Companion to the HANDOFF.md the previous
Design session produced. That file has its direction memo and lessons; this one has what
changed in the data and code today, what the last Design run got wrong from our side of the
fence, and the correction to the direction.

Repo: `Samizdat-Publications/oil-tracking-dashboard` · Live: https://trumps-economy-ledger.pages.dev
Brief: `docs/design-briefs/2026-09-05-v5-the-bill.md` (rev 2 + war-cost and data-inventory
additions). Screenshots of the current page: `docs/screenshots/01-…11-*.png`.

---

## 1. The correction to the direction

The last Design run **reskinned the existing eleven sections** and downgraded the charts.
That is the one outcome the brief forbids. The brief asks for a new information
architecture — a tally, one number per screen, a receipt rail — not the V4 layouts in new
colours. If the artboards still have the V4 section list, the run has failed before it starts.

The second correction is **tone and reading level.** We have gone too far toward the
analyst. The page must land with someone who will never open "Show the work":

- **One number per screen, and it is a number they pay or feel.** $83 a month out of your
  pocket. Diesel at a record $5.60. Four ships a day through a strait that carried 83.
  42,000 jobs a month against 321,000. 18 service members dead. Not elasticities, not
  indices, not "pts".
- **Every sentence readable by a fourteen-year-old.** The number, who did it, what it
  costs you. The analysis exists — all of it — one disclosure below, for the reader who wants it.
- **The chain in plain words, not in coefficients.** "He shut the strait → oil doubled →
  diesel hit a record → trucks now charge 50% more for fuel → your groceries, about four
  months later." The elasticities in the `chain` block back every arrow; they belong in
  "Show the work", not on the surface.
- **Charts are simple shapes drawn from the data.** One line. Two bars. A row of ten bars
  hanging down. They are generated from the snapshot series, never hand-drawn or
  approximated — the last run's charts were a downgrade precisely because they stopped
  being the data.

Everything else in the brief stands: the tally concept, the receipt rail, red means *he
decided this* and nothing else, the honest rows at full size, no number that is not bound
to a snapshot key.

## 2. What is new since the brief was written (all live in the snapshot today)

Every one of these is an additive block in `frontend/public/data-snapshot.json`
(schema v2, 20 blocks) and rebuilds automatically. Bind to them; do not retype them.

| Block | What it carries | The plain-English line it supports |
|---|---|---|
| `eia.series.spr` | Strategic Petroleum Reserve, weekly: **286.6M bbl** (28 Aug), from 394.6M at the handover | "He drained the emergency reserve to its lowest since 1983 to hold the price down." |
| `eia.series.refinery_util` | **98%** utilisation | "Refineries are flat out. There is no slack, which is why diesel leads." |
| `eia.series.crude_exports` | **4.5 mb/d** | "American producers sold into the shortage while you paid." |
| `eia.gasoline_by_area` / `electricity_by_state` | 29 areas weekly; 52 states monthly | The receipt's state picker. |
| `fiscal.debt` | **$40.10tn** (3 Sep), live in the browser | "Forty trillion." |
| `fiscal.customs` | Monthly customs receipts **net of refunds: negative in May, June and July** | "His tariffs took in less than the Treasury paid back." |
| `fiscal.interest` | **$1.27tn** interest FYTD (all categories); $982bn on public issues | "Interest is the fastest-growing line in the budget." |
| `chain` | Six links, each with a pre-war elasticity and lag: crude→diesel 0.38; diesel→trucking 0.13; trucking→food at home 0.42 (**~4 months**); crude→jet 0.65; jet→fares 0.18; EU gas→fertiliser 0.30 (**~2 months**) | The arrows in the chain, in "Show the work". |
| `chokepoints` | Six straits: **Hormuz 5%** of pre-war; Bab el-Mandeb 78%; Suez 111%; Cape of Good Hope 103% | "Where the ships went." (Suez/Bab el-Mandeb baselines were already depressed by 2024–25 — say so.) |
| `nowcast` | Cleveland Fed daily nowcast: **August CPI 3.38%**, September 3.43% | "What next week's number will probably say." Labelled model estimate. |
| `polymarket` | Six curated odds: **Fed hike in September ~50%**; blockade ends by 30 Sep 17.5%; regime falls before 2027 6.5% | Labelled *odds*, never data, never summed. |
| `receipt_inputs` | Baselines, staple moves, regional prices, sourced assumptions | The browser recomputes the receipt (`frontend/src/v4/receipt.ts`) with **state picker, miles slider, household size**. No geolocation. |
| `context.war_cost` | DoD **$37.5bn**; **$67.1bn** supplemental ($21bn munitions); **18 killed**; **42 aircraft** lost or damaged (CRS), $2.6bn; Bahrain hub struck day one; interceptor estimates *with Hegseth's denial beside them*; Planet Labs imagery suspension at government request | The new chapter "What the war cost America". Sober. No adjectives. The word "cover-up" does not appear. |
| `context.trade_disputes` | Canada **50% Section 338** (20 Jul → in force 22 Aug → Canada retaliates 8 Sep); Brazil 25%; §301 forced-labour 10/12.5%; pharma, drones, polysilicon §232 | "He picked five new fights since spring." |
| `context.energy_supply.fertilizer` | Urea +80% to $850/t; Ras Laffan 3–5 years to repair; US farmers hold 60% of 2026 nitrogen | "Next year's food prices start here." |
| `macro.series` additions | U-6 **7.7%**; **real wages −0.2% y/y**; continued claims 1.78M; sentiment by party (Republicans −19% vs pre-war) | "Your raise did not keep up." |

Also: the strait simulation now draws the **real Natural Earth coastline** (label: "stretched
to fit · vessel positions are a model"). The sim engine, lane, gate and vessel model are
finished; restyle its chrome, do not redraw it.

## 3. What works on the current page (keep the idea, not the skin)

- The masthead crude chart drawn from every daily close, with the dated acts flagged.
- The shelf in actual dollars. (Expand to the fifteen-line till receipt per the brief.)
- The strait simulation — the most engaging thing on the page; its readouts are measured.
- The claim-vs-measured Hormuz bars (the President's "30 ships a night" hatched beside 4.3).
- The gold "ounces leaving every month" bars and the honest panel beneath them.
- "What this shows" callouts — right sentences, wrong position (below the chart; move above).

## 4. What does not work (and what the last run repeated)

- Eleven full-bleed posters in alternating colours: the skimmer is numb by the fourth.
- Numbers explained after the chart instead of before it.
- Analyst vocabulary on the surface ("pts", "y/y", "elasticity", "HICP").
- Charts redrawn by hand or approximated. Every chart must come from the series.
- Reskinning. The section list must change, not the palette.

## 5. Technical constraints that are not negotiable

- **Every figure is bound.** Write numbers on artboards as `{snapshot.key}` or mark them
  `PLACEHOLDER`. Engineering binds; Design never types a real number.
- **Zero fabrication.** If a figure is not in the snapshot or `context_figures.json`, it is
  not on the page.
- **Red = he decided this.** Dated acts only. No red bars, no red numbers.
- **Honest rows at full size, never collapsed:** eggs −56%, August +162,000 jobs, S&P +29%,
  mortgages lower than the handover, dollar up since the war, gold down 20% from its
  record, the Fed's counter-argument on gold, the mortgage tile in "your money".
- **War and tariff effects are never summed.** **No queue count.** Odds are odds.
- Self-hosted fonts only; container-query sizing; 390px with zero horizontal overflow;
  controls ≥ 44px; reduced motion = complete end state.
- Animation stack the build will use: CSS scroll-driven animations as the base, GSAP 3 +
  ScrollTrigger (free) for pinned/scrubbed sequences. Design for scroll-driven reveal,
  once, then still.

## 6. What to deliver

1. Two or three complete variants as `.dc.html` artboards, every chapter at 1400 and 390,
   in the chapter order in the brief §4 (now with "What the war cost America" between "What
   he did to your money" and "The world routed around America").
2. The system: tokens with their *meanings*, type ramp, rail, disclosure, chapter template.
3. Full specs for chapters 00, 02, 03, 07, 08, the war chapter, and the end card.
4. Copy for every H1, kicker, sentence and rail line in the voice rules (§1 of the brief),
   with numbers written as `{keys}`.
5. A title decision or two finalists.

Acceptance is in the brief §9. The first test is the simplest: a phone reader who scrolls
for sixty seconds and opens nothing can say what it costs them a month, what happened to
the price of oil, how many ships get through, and what left the New York Fed.
