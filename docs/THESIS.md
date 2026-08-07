# V3.0 Thesis — what the data actually supports

**Written 2026-08-02.** This is the source of truth for every claim the dashboard makes.
No copy ships that isn't backed by a line in this file. Tier labels are load-bearing:

- **TIER 1** — Federal Reserve research, BLS, EIA, IEA, IMF, CBO, NBER, peer-reviewed
- **TIER 2** — Reuters, Bloomberg, FT, WSJ, S&P Global Platts, Argus, Lloyd's List, Baltic Exchange
- **TIER 3** — trade blogs, advocacy, partisan think tanks. **Never load-bearing.**

---

## The claim we're testing

> "2026 price increases are Biden-era inflation, not the Iran war."

## The finding

**The entire 2026 inflation excursion is an energy shock.** Not inherited inflation, not
(net) tariffs. And the strongest evidence isn't a counterfactual model — it's the breadth
of the price distribution, which no modeling choice can spin.

### 1. The breadth test — the decisive evidence

Broad monetary or demand-driven inflation raises the **median** price change. A
relative-price shock moves only the **tail**. As of June 2026:

| Measure | Value | Source |
|---|---|---|
| Headline CPI y/y | **3.5%** (peaked 4.2% in May) | BLS — TIER 1 |
| **Core CPI y/y** | **2.6%** | BLS — TIER 1 |
| **Trimmed-mean PCE** | **2.2%** | Dallas Fed — TIER 1 |
| **Median CPI** | **2.7%** | Cleveland Fed — TIER 1 |
| **16% trimmed-mean CPI** | **2.6%** | Cleveland Fed — TIER 1 |
| Energy y/y | **+15.7%** | BLS — TIER 1 |
| Gasoline y/y | **+26.7%** | BLS — TIER 1 |

Core, median, and both trimmed means are **at or near the 2% target**. The overshoot lives
entirely in the tails, and the tails are energy. There is no clean rebuttal to this.

Headline path 2026: Jan 2.4% → Feb ~2.4% → Mar 3.3% → Apr 3.8% → **May 4.2%** → Jun 3.5%.
Core over the same span: 2.5% → 2.6%. **Core barely moved across the entire episode.**

### 2. There is no "inherited" component

- Inflation was ~3% at the January 2025 handover, down from the 9.1% peak of June 2022.
  (PolitiFact, FactCheck.org — TIER 1/2)
- **January 2026: 2.4% headline / 2.5% core — *lower* than at the handover.** (BLS — TIER 1)
- FactCheck.org rated the February 2026 claim of inheriting "inflation at record levels"
  **false**. (TIER 2, non-partisan)
- Energy was actively **disinflationary** through 2025: WTI closed 2025 at $57.7, down ~20%
  on the year — the steepest annual decline since 2020. Retail gasoline fell $3.14 → $2.796.
  (FRED `DCOILWTICO`, `GASREGW` — TIER 1)

Inflation was at target on the eve of the shock. There is nothing to inherit.

### 3. No demand engine — the steelman fails on its own numbers

The strongest good-faith alternative is "AI-capex demand boom + accommodative Fed." It
fails four independent tests:

| Test | Result | Source |
|---|---|---|
| Wages | **Unit labor costs +0.5% y/y**; labor share **53.7%, lowest since 1947**; real private wages −0.4% | BLS Q1 2026 — TIER 1 |
| Fiscal | **Subtracted 0.2pp** from Q2 2026 GDP; "moderately restrictive" | Brookings Hutchins FIM — TIER 1 |
| Growth | Real GDP **1.5% annualized — below potential** | TIER 1 |
| Expectations | 5y5y forward **2.30%**, 10y breakeven **2.28%** — anchored | TIER 1 |

ULC growth of 0.5% is consistent with inflation *below* 2%. You cannot run an overheating
story on a below-potential economy with a record-low labor share.

### 4. Tariffs are not the 2026 headline story either — and saying so is the point

- **SCOTUS struck down the IEEPA tariffs 2026-02-20** (*Learning Resources v. Trump*, 6–3).
  Collection ended Feb 24. (TIER 1, Federal Register)
- Replaced by a **§122 blanket 10% surcharge Feb 24 — which expired 2026-07-24.**
  Current baseline is §301 forced-labor tariffs at 10%/12.5%.
- **Dallas Fed (2026-06-02): the SCOTUS ruling cut average tariffs ~4.8pp (−0.1 to −0.2pp
  core PCE), and the Hormuz shipping-cost increase completely offsets it — net effect
  through 2026 "close to zero."** (TIER 1)
- Credible tariff estimates cluster at **0.4–0.8pp of core PCE** — real, but core only
  moved 0.1pp total. (Fed Board FEDS Notes 2026-04-08 — TIER 1)
- **Energy was never tariffed.** Proclamation 11012 exempts "energy and energy products"
  verbatim; §301 exempts crude. The lone exception, Canadian energy at 10% under IEEPA,
  died 2026-02-24. **No tariff channel into crude prices at any point in 2025–26.**

**This symmetry is the credibility asset.** The same chart that refutes "it's inherited
inflation" also refutes "it's all the tariffs." Both partisan framings fail against it.
Lead with that.

### 5. The war signature — prices track it in both directions

The identification isn't a model, it's a reversal. Verified from FRED:

| Date | WTI | Event |
|---|---|---|
| 2026-01-02 | **$57.21** | 12-month low, falling for a year |
| 2026-02-28 | — | US/Israel strike Iran; Hormuz closes |
| 2026-04-06 | **$114.01** | peak |
| 2026-06-18 | — | 60-day ceasefire / MoU |
| **2026-07-01** | **$69.74** | **fully round-trips to pre-war** |
| 2026-07-08 | — | US strikes resume; ceasefire "over" |
| 2026-07-27 | **$84.25** | re-escalation |

Inflation does not switch off on the day of a ceasefire and back on three weeks later.
Neither do tariffs. Tested formally as an event study with pre-classified event signs
(exact binomial, six events).

---

## What we will NOT claim

Discipline here is what makes the rest credible.

| Do not claim | Why |
|---|---|
| A $40–50/bbl paper-physical spread | TIER 1 ceiling is **$35/bbl** (IEA, mid-April 2026). EIA independently: >$25/bbl early April. The $40–50 figure is TIER 3 only. |
| That the paper-physical wedge is open now | It **closed** — $3/bbl by early May (IEA), contango by July. |
| That the futures market was "wrong" | The curve priced a short disruption; the strait reopened 18 June and Brent averaged $85. **The curve was largely right.** |
| Manipulation of the paper-physical wedge | **No regulator, exchange, PRA, or academic body has alleged it.** Even most TIER 3 sources don't. |
| "Diesel in Asia hit 141" | Unverifiable at any tier. Do not use. |
| "~325 stranded tankers" / "2,000 ships" | Unsourceable / IMO's own figure is ~1,600. |
| A point estimate for the tariff share | No credible import-content weight per CPI category is available to us. Ship a bound. |
| That any single administration set the price | Euro-area energy prices moved with the same shock. |

### The insider-trading probe — firewalled

There **is** a real CFTC probe (~2026-04-15) and a DOJ probe into suspiciously timed oil
futures trades ahead of White House Iran announcements — including a ~$950M position on
falling prices placed hours before the 2026-04-07 ceasefire (prices then fell ~15%).
(Bloomberg, NBC — TIER 2; congressional letters.)

**This is a separate story from the paper-physical wedge and must never share a visual
frame with it.** No finding, no enforcement action, no adjudication. Presenting them
together invites a causal inference no evidence supports, and that is exactly where
hostile scrutiny would land hardest.

### The paper-physical story we CAN tell

Not "the paper market is lying" — **"the mechanical cost stack doesn't close the gap."**

At the April peak, against a $25–35/bbl wedge:
- Added freight ≈ **$11.25/bbl** (TD3C WS137→WS525; Baltic Exchange TIER 1 endpoints,
  Kpler TIER 2 conversion)
- Added war-risk insurance ≈ **$4.87/bbl** (0.25% → 10% of a $100M hull ÷ 2M bbl;
  calibrated against Strauss Center TIER 1)
- **Total documented cost stack ≈ $16/bbl**

That leaves roughly a third to a half of the wedge as **scarcity rent for barrels that
physically could not be delivered** — which is a real, quantifiable, defensible point about
what benchmarks do and don't capture during a chokepoint closure. Plus a structural break:
**Platts suspended all Hormuz-transiting grades from the Dubai benchmark on 2026-03-02**,
cutting deliverable grades from five to two.

**And the enduring 2026 story is refining, not crude.** By July, crude was in *contango*
while diesel cracks sat at four-year highs (IEA — TIER 1). NYMEX 3-2-1 crack ~$64/bbl in
mid-July broke the June 2022 record. The binding constraint is conversion capacity.

---

## Landmines that will break the code or the credibility

1. **⚠️ October 2025 CPI does not exist.** Not delayed — **never collected** during the
   43-day shutdown (2025-10-01 → 2025-11-12). BLS returns `"-"`, FRED returns blank.
   Missing for headline, core goods, apparel, appliances, furniture, and `EIUIR`.
   Survivors: new vehicles, gasoline. November used imputation. **Every 12-month change
   through Oct 2026 is undefined and MoM annualization breaks twice.** Requires an
   explicit, disclosed interpolation policy shown on the page.
2. **⚠️ Gasoline and diesel (`GASREGW`/`GASDESW`) are NOT seasonally adjusted.** Gasoline
   rises every Jan→May on summer-blend changeover and driving season. Part of
   $2.796 → $4.452 is ordinary seasonality. **Not netting this out is the single easiest
   way for a competent critic to kill the dashboard.** Fourier seasonal terms, with the
   seasonal contribution shown as its own line item.
3. **Core PCE (3.3%) > core CPI (2.6%)** in June 2026 — an inversion. The largest supercore
   contributor is *imputed portfolio-management fees*, which track equity prices and have
   no CPI counterpart. Disclose which index we use and why, before someone else finds it.
4. **Use GROSS customs duties, not net.** Refunds hit $21.97B in May and $49.18B in June
   2026; net receipts went **negative**. Net duties would make the tariff series nonsense.
5. **Use `IREXPET` (imports ex-petroleum), not `IR`** — otherwise the oil shock is
   double-counted inside the tariff measure.
6. **SCOTUS (Feb 20) and the strikes (Feb 28) are eight days apart.** Do not claim clean
   separation in Q1 2026. The Dallas Fed "they roughly cancel" framing is the honest one.
7. **The war is ongoing** (re-escalated 2026-07-08). Any "post-shock" framing ages badly.
8. `B235RC1M027SBEA` (monthly customs duties) is a 404 — quarterly `B235RC1Q027SBEA` only.

---

## Identification strategies we use

| Strategy | What it establishes | Source of method |
|---|---|---|
| **Breadth (trimmed-mean vs headline)** | Tail shock, not broad inflation | Dallas/Cleveland Fed — TIER 1 |
| **Event study on pre-classified war events** | Prices track the war in both directions | Standard finance event study |
| **Blind structural break detection** | A detector never told the war date picks late Feb | sup-Wald + wild bootstrap |
| **Placebo battery on oil-insensitive CPI** | Policy inflation would move these; it didn't | Same counterfactual, same code path |
| **Positive control (jet fuel)** | The detector fires when it should | — |
| **Dose-response on oil intensity** | Excess inflation sorts by oil content | BEA IO energy cost shares |
| **Distributed-lag pass-through + asymmetry** | Rockets-and-feathers quantified | Bacon 1991; Borenstein-Cameron-Gilbert 1997 |
| **Import Price Index wedge** | BLS measures import prices **FOB foreign port, excluding duties** — confirmed verbatim by BLS. `CPI_goods − IREXPET` = tariff + margin wedge | Brookings Trade Tracker; Gopinath & Neiman NBER 34620 |
| **Energy counterfactual** | Published, citable scenario coefficients | **Dallas Fed WP 2609** (Kilian, Plante, Richter & Zhou) |

**Dallas Fed WP 2609 gives us a published counterfactual for the energy component** —
current scenario 2026 Q4/Q4 headline PCE +0.6pp, core +0.2pp; one-quarter Hormuz closure
+5.2pp annualized in March decaying to +0.35pp by Q4. Far better than a home-made rule.

---

---

## The data-integrity question — settled, and sharper than the rumour

The instinct that "the inflation number is being gamed" resolves into three separate
claims. Two are true and one is not, and the page must say exactly which is which.

### (a) The machinery is being starved — VERIFIED, TIER 1

- **All 13 federal statistical agencies cut staff since January 2025. Six lost ≥1/3 of
  their workforce; two lost >2/3. Only 6 of 13 have permanent, non-acting leaders.**
  (American Statistical Association, 2026 Midyear Update, 2026-07-28)
- **October 2025 CPI does not exist and never will** — 43-day shutdown, no collection,
  BLS "was unable to retroactively collect these data." A permanent hole in the series.
- ~15% of the CPI sample suspended across 72 metros; collection ended entirely in
  Lincoln NE, Provo UT, Buffalo NY.
- ~350 **PPI** indexes discontinued August 2025 with **no stated rationale**.
- Different-cell imputation hit 32–40% of CPI prices in 2025, the highest on record.
- Public trust in federal statistics fell 57% → 52% between June and September 2025.

### (b) The BLS Commissioner was fired over a jobs report — VERIFIED, TIER 1/2

**2025-08-01:** Commissioner **Erika McEntarfer** fired hours after the July jobs report
showed 73,000 jobs and large downward revisions. Trump, verbatim: *"In my opinion, today's
Jobs Numbers were RIGGED in order to make the Republicans, and ME, look bad."* **No
evidence was offered, then or since.**

- **Friends of the BLS** — co-chaired by **William Beach (BLS Commissioner 2019–23,
  appointed by Trump)** and Erica Groshen (2013–17, Obama) — called it a *"baseless,
  damaging claim"* and part of *"unprecedented attacks on the independence and integrity
  of the federal statistical system."* Beach separately: *"totally groundless."*
- Nominee **E.J. Antoni** (Heritage) withdrawn September 2025; *National Review* — a
  conservative outlet — wrote he was *"nowhere near qualified."*
- **As of August 2026 there is still no Senate-confirmed BLS Commissioner.**
- Nominee **Brett Matsumoto publicly contradicted Trump's fabrication claim** during his
  own confirmation process.

### (c) The published numbers are manipulated — NO EVIDENCE FOUND. We do not claim it.

Every directional indicator runs against it:

- **Truflation**, an independent measure built on 15M+ daily price points, reads
  **1.4–2.4pp BELOW official CPI**. If BLS were suppressing measured inflation,
  independent measures would read *higher*. They read lower. **This is the decisive test.**
- BLS **published its own study** (Monthly Labor Review, May 2026) showing that its
  October shelter imputation produced the **lowest** of five possible values. An agency
  manipulating data does not publish that.
- BLS's own simulation of the sample suspension: **<0.01pp average effect on 12-month
  CPI, and symmetric** — 14 months higher, 11 lower.
- **GAO-26-107538** (2026-06-02): BLS *"met its goals for the data's precision and the
  size of the revisions"* FY2020–2025. **No finding of political interference.**
- **Powell**, 2025-07-30: *"we're getting the data that we need to do our jobs."*
- The one concrete manipulation allegation (a December 2025 OER errata) was investigated
  by Friends of BLS, who *"found no evidence of political motivation"* — a *"correctible
  error."*

> **The framing:** the integrity threat is real but it is **institutional, not
> arithmetic**. The numbers are honest; the machinery producing them is being starved —
> and the President fired the statistician for reporting a number he didn't like. The only
> documented accusation of manipulation in this entire record is his own, and it was made
> without evidence and rejected by his own former appointee.

Note for balance, and to state it before a critic does: Powell observed in December 2025
that payroll growth may be **overstated** by ~60,000/month via the birth-death model —
the direction of that bias flatters the jobs numbers, not the reverse.

---

## What killed the "IRA fixed inflation" claim

We tested it and it failed. It is **not** going on the page.

- **CBO (2022-08-04):** enacting the bill would have *"a negligible effect on inflation"*
  in 2022, and between −0.1 and +0.1pp in 2023.
- **Penn Wharton Budget Model:** *"statistically indistinguishable from zero."*
- **Moody's/Zandi** — the most IRA-favourable mainstream estimate in existence — shows a
  **0.00%** CPI effect in 2022 and **−0.01%** in 2023–24.
- **Jason Furman (Harvard, former CEA Chair):** *"I can't think of any mechanism by which
  it would have brought down inflation to date."*

**The stronger claim that survives, with better sourcing:** the 2021–22 surge was a
*supply* shock, not stimulus overheating. **Bernanke & Blanchard** (a former Fed Chair):
*"contrary to early concerns that inflation would be spurred by overheated labor markets,
most of the inflation surge that began in 2021 was the result of shocks to prices given
wages, including sharp increases in commodity prices and sectoral shortages."*

The 2022–24 disinflation is attributed in TIER 1 work to (1) supply-chain normalisation,
(2) reversal of commodity/energy shocks, (3) a **525bp** Fed tightening cycle, and (4) a
labour-supply recovery amplified by immigration. **The IRA is not among the identified
drivers in any TIER 1 decomposition.** Saying so costs us nothing and buys the reader's
trust for everything else.

---

## The international evidence — computed from Eurostat/OECD/ECB primary APIs

### REFUTED: "US inflation fell faster than any other G7 country"

Do not put this on the page. Peak → Dec 2025, share of the peak removed:
France 91%, Italy 90%, Germany 82%, euro area 82%, Canada 71%, **US 70%**, UK 69%,
Japan 51%. The US is **6th of 8** on that measure and 6th of 8 on total pp decline.
It also never achieved 12 consecutive months below 3% — it went sub-3% in June 2023
and was back above by July. The euro area held below 3% for ~30 months straight.

### VERIFIED, and better: the US 2022 peak was NOT lower than Europe's

| Measure | US | Euro area |
|---|---|---|
| National headline | 9.1% (CPI-U, Jun 2022) | — |
| **Harmonized (HICP)** | **10.1% (Jun 2022)** | **10.6% (Oct 2022)** |

The apparent 1.5pp US outperformance collapses to **0.5pp** on a like-for-like basis.
The difference is **owner's equivalent rent — 24.0% of the US CPI basket and 0% of the
euro-area HICP basket**. Reconstructing CPI-U ex-OER reproduces the published US HICP to
within 0.1pp month after month. **Roughly two-thirds of the apparent gap is measurement,
not economics.** US CPI excluding shelter entirely peaked at **10.76%**.

Corroborated by a natural experiment: the UK publishes both concepts on one basket.
CPI (no owner-occupied housing) peaked at **11.1%**; CPIH (with it) at **9.6%** — same
month, a 1.5pp gap in the same direction.

**Use this to answer "post-COVID inflation was global."** It was, and the US was not an
outlier once you measure it the same way everyone else does.

### VERIFIED: the 2026 spike is the oil shock, and it is global

| Month 2026 | US headline | US core | US CPI energy | Euro area headline |
|---|---|---|---|---|
| Feb | 2.41% | 2.47% | +0.4% | 1.9% |
| Mar | 3.26% | 2.60% | **+12.6%** | 2.6% |
| Apr | 3.81% | 2.74% | **+17.5%** | 3.0% |
| **May** | **4.25%** | 2.82% | **+23.0%** | **3.2%** |
| Jun | 3.53% | 2.57% | +15.5% | 2.8% |

Brent ran **+38.6% / +53.6% / +62.0%** YoY in March/April/May 2026.

**The euro area moved in lockstep.** A synchronised US and European spike driven by a
~60% YoY Brent move cannot be a US-specific trade-policy effect. This is the
international control test, and it points at the war.

**And the tariff signal shows up exactly where it should — not in headline.** Core PCE
drifted from **2.61% (April 2025) to 3.42% (May 2026)**, a persistent 0.6–0.8pp creep
with no energy component, running above core CPI throughout. That is the signature of
goods-price pass-through.

> **The clean 2026 statement:** the headline spike is the war; the persistent core creep
> is the tariffs; neither is inherited. Both are consequences of decisions taken after
> January 2025.

⚠️ **Do not attach a specific tariff-contribution number without a Fed/BLS citation.**
The core-PCE creep is consistent with tariff pass-through but we have not sourced a
point estimate we can defend.

### Data-integrity warnings for implementation

- **Eurostat renamed everything in Feb 2026.** `prc_hicp_manr` is frozen at 2025-12;
  live data is `prc_hicp_minr` with `coicop18` and `TOTAL` instead of `coicop`/`CP00`.
  A dashboard pulling the old code silently stops updating.
- **The ECB discontinued the `ICP` dataset 2026-02-04**, replaced by `HICP`.
- **OECD split its price dataflows** — US and UK on the legacy flow, everyone else on
  COICOP-2018. Wrong flow returns a 404, not an obvious error.
- **There is no harmonized US series after Dec 2024** (Eurostat discontinued
  `CP0000USM086NEST`). Any like-for-like chart must stop there or reconstruct ex-OER.
- `CP0000GBM086NEST` ends Nov 2020 (Brexit). `CP0000CAM086NEST` and
  `CP0000JPM086NEST` do not exist.

---

---

## Strait of Hormuz — figures used in the simulation

Added 2026-08-07 so the page's "every figure is sourced" claim is literally true.
These were previously cited in-page but absent here, which
`design-handoff/.../DATA-PROVENANCE.md` correctly flagged as a blocker.

### Transit volumes — TIER 1 (IEA)

| Figure | Value | As of |
|---|---|---|
| Pre-war gross transit | **13.8 mb/d** (~20% of world oil trade) | to 2026-02-28 |
| Transit while closed | **0.0 mb/d** | 2026-03 to ~2026-06 |
| Transit after the MoU | **4.8 mb/d** (~35% of baseline) | late June 2026 |

Stepped values with as-of dates. **Never interpolate between them** — the strait did not
reopen gradually, and a smooth curve would assert something that did not happen.

### War-risk insurance — TIER 2 (Marsh via S&P Global; Strauss Center for calibration)

| Date | Premium, % of hull | Per transit on a $100M hull | ≈ $/bbl |
|---|---|---|---|
| Pre-war | **0.25%** | $250k | $0.13 |
| Early March | ~1% | $1.0M | $0.50 |
| Mid-March | 2.5% | $2.5M | $1.25 |
| **2026-04-15 peak** | **10%** | **$10M** | **$5.00** |
| Early July | 1–3% | $1–3M | $0.50–1.50 |
| **2026-07-23** | **7.5–10%** | $7.5–10M | $3.75–5.00 |

$/bbl derived at 2M bbl per VLCC; hull value $100M from the Strauss Center range
($100–120M). **Derived, and labelled as such.** The Joint War Committee publishes listed
areas but explicitly **not** rates — there is no war-risk premium index at any price, so
these come from trade-press reporting of broker quotes and carry that uncertainty.

### Policy response — TIER 1 (IEA)

**2026-03-11:** IEA members agreed to release **400 million barrels** — the largest
coordinated release in the agency's 52-year history, ~⅓ of government stockpiles across 32
nations; US share 172M over ~120 days. Expert estimates put the short-run price effect near
**$2/bbl**. One of three contributors the IEA names for the June price retreat.

### The April cost stack — TIER 1/2

Added freight ≈ **$11.25/bbl** (TD3C WS137 → WS525; Baltic Exchange endpoints, Kpler
conversion) plus war-risk ≈ **$4.87/bbl** = a documented stack of ≈**$16/bbl** against a
**$25–35/bbl** wedge (IEA ceiling $35, mid-April). The remainder is scarcity rent for
barrels that could not be delivered. Wedge closed to **$3/bbl** by early May (IEA).

### Price anchors — TIER 1 (FRED `DCOILWTICO`, Cushing spot)

2025 close $57.70 · 2026-01-02 **$57.21** · 2026-02-27 $66.96 · 2026-04-06 peak **$114.01** ·
2026-07-01 **$69.74** · 2026-07-07 $71.53 · **2026-07-08 $74.56 (+4.24%)** · 2026-07-23
$93.08 · 2026-07-27 $84.25 · 2026-07-29 $86.08 · 2026-08-03 $81.96.

⚠️ **Press figures for 8 July quote $73.52 (+4.4%). That is the front-month futures
contract, not Cushing spot.** Both are correct; they are different instruments. The page
uses FRED spot throughout for internal consistency, because every other anchor comes from
the same series. Do not mix the two on one chart.

The **2026-02-28 $67.00** anchor is `approx.` (markets closed; nearest print 02-27 $66.96).
The **2026-04-07 $96.91** anchor is `derived` — $114.01 × 0.85, from the reported ~15% fall
after the ceasefire. Both must keep their labels.

### What we still will not publish

**No queue count.** No verified figure exists at any tier. The circulating "~325 stranded
tankers" and "2,000 ships" are unsourceable; the IMO's own figure is ~1,600 *vessels of all
types inside the Gulf*, which is a different quantity. The vessel layer in the simulation is
illustrative and must keep its "NOT AIS DATA" label until IMF PortWatch transit volumes are
wired in.

---

## Key sources

- [Fed Board FEDS Notes, tariff effects Part II (2026-04-08)](https://www.federalreserve.gov/econres/notes/feds-notes/detecting-tariff-effects-on-consumer-prices-in-real-time-part-II-20260408.html)
- [Dallas Fed WP 2609 — oil shock scenarios](https://www.dallasfed.org/research/papers/2026/wp2609)
- [Dallas Fed — Hormuz/tariff offset (2026-06-02)](https://www.dallasfed.org/research/economics/2026/0602)
- [Minneapolis Fed — "Tariffs can't explain rising goods inflation"](https://www.minneapolisfed.org/article/2026/tariffs-cant-explain-rising-goods-inflation)
- [NY Fed Liberty Street — more tariff pass-through in the pipeline](https://libertystreeteconomics.newyorkfed.org/2026/07/more-tariff-pass-through-is-in-the-pipeline/)
- [Cavallo, Llamas & Vazquez, NBER WP 34496](https://www.nber.org/papers/w34496)
- [BLS MXP Q&A — import prices exclude duties](https://www.bls.gov/mxp/questions-and-answers.htm)
- [BLS — 2025 shutdown impact on CPI](https://www.bls.gov/cpi/notices/2025/2025-federal-government-shutdown-impact-on-cpi.htm)
- [FactCheck.org — 2026 State of the Union](https://www.factcheck.org/2026/02/factchecking-trumps-state-of-the-union-address/)
- [CEPR VoxEU — quantifying the Iran war's impact on US inflation](https://cepr.org/voxeu/columns/quantifying-impact-iran-war-us-inflation)
- [EIA Today in Energy — Dated Brent vs futures premium](https://www.eia.gov/todayinenergy/)

## Still to verify before publishing
- OIES May 2026 paper *"Brent and WTI Dynamics during the Hormuz Crisis"* (403'd) — best
  TIER 1 mechanism source
- Saudi Aramco May-loading Arab Light OSP at +$19.50/bbl (TIER 3 only so far)
- Exact BDTI point value for Feb 2026 (never obtained; the 3,723 March record is
  single-outlet Signal Ocean)
- Whether a published HS→CPI crosswalk exists
