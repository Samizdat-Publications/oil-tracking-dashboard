# Research brief for Cowork deep research

**Requested by:** Claude Code, 2026-08-02
**Purpose:** Fill verification gaps for the Oil Dashboard V3.0 public data page.
**Standing instruction:** This underpins a public dashboard that will be shared and
attacked. **Verify claims that FAVOR our thesis just as skeptically as ones that don't,
and say plainly when something doesn't hold up.** A single unsupported claim discredits
the whole page. "We looked and found no credible evidence" is a valuable, publishable
answer — do not stretch to confirm.

**Tier every source:**
- **TIER 1** — Fed/BLS/EIA/IEA/IMF/OECD/CBO/NBER, peer-reviewed, court filings, Federal
  Register, regulator statements
- **TIER 2** — Reuters, Bloomberg, FT, WSJ, Economist, S&P Platts, Argus, Lloyd's List
- **TIER 3** — advocacy, partisan think tanks, Substack, trade blogs, opinion

Note political lean where relevant **in both directions**.

---

## PRIORITY 1 — Oil price manipulation: the two distinct claims

These must be researched **separately**. Conflating them is the single biggest
credibility risk on the page.

### 1A. Announcement timing / insider trading (believed WELL SUPPORTED — confirm and detail)

Known so far: a CFTC probe opened ~2026-04-15 into oil futures trades placed ahead of
White House Iran announcements; a parallel DOJ probe; a ~$950M position on falling prices
placed hours before the 2026-04-07 ceasefire announcement (prices fell ~15%); a $760M
trade before Iran's Hormuz announcement; a $500M position minutes before a strike-delay
announcement. Congressional letters from Warren + Whitehouse (2026-04-09), Warnock et al.
(2026-05-27), Rep. Ritchie Torres.

**Questions:**
1. Current status of the CFTC and DOJ probes as of August 2026. Any subpoenas, filings,
   enforcement actions, settlements, named parties, or public testimony?
2. Get the **primary documents** — the congressional letters themselves, any CFTC or DOJ
   statements, any CME/ICE statements about producing trading data.
3. Has any journalist or academic **quantified the pattern** the user describes — that
   escalation/de-escalation announcements cluster by day of week, or that announcements
   systematically precede large futures moves? Is there a published event study,
   Bloomberg/Reuters data analysis, or working paper on the timing of 2026 Iran
   announcements versus oil futures moves? Exact dates and times of announcements versus
   price moves would be extremely valuable — we can run our own event study if we can
   get a sourced announcement timeline with timestamps.
4. Who specifically has been named, if anyone? Be careful and precise; do not repeat
   unproven allegations against named individuals.

### 1B. Coordinated suppression of the paper price (believed UNSUPPORTED — test hard)

The claim to test: *that a group of billionaires / large traders colluded to hold the
reported futures price of crude artificially low, so that the headline "price of a barrel"
understates the true delivered cost.*

Established context (do not re-research): a record physical-over-futures premium did occur
— **$35/bbl peak mid-April 2026 per IEA (TIER 1)**, >$25/bbl early April per EIA — with
documented mechanical causes (war-risk insurance, freight, rerouting, the Platts
suspension of Hormuz grades from the Dubai benchmark on 2026-03-02). It collapsed to
$3/bbl by early May and flipped to contango by July.

**Questions:**
1. Has **any** regulator (CFTC, FCA, ESMA, IOSCO), exchange (CME, ICE), price reporting
   agency (Platts, Argus), academic, or major news organization alleged or investigated
   **deliberate coordination to suppress the futures price** in 2026? Name and date
   anything found. If the answer is no, state that unambiguously.
2. Who is actually making this claim, and at what tier? Trace it to its origin. Is it
   Substack/YouTube commentary, or is there a named analyst, fund manager, or industry
   figure on the record?
3. **The strongest legitimate version:** is there credible analysis that futures price
   discovery *failed* or was *impaired* in 2026 — as distinct from being manipulated?
   Specifically find the **OIES paper "Brent and WTI Dynamics during the Hormuz Crisis:
   Positioning and the Expanding Role of Options" (May 2026)** — we could not access the
   PDF and it is the best TIER 1 mechanism source. Also look for work on declining Brent
   open interest, managed-money retrenchment, and impaired benchmark deliverability.
4. Did the **coordinated 400M-barrel IEA/SPR release (agreed 2026-03-11)** measurably
   suppress the futures price relative to physical? Any credible quantification beyond the
   ~$2/bbl consensus estimate for SPR effects? This is the most defensible version of
   "policy held the paper price down" — it's a documented government action, not a
   conspiracy.
5. Is there documented evidence of large traders or physical players **benefiting** from
   the paper-physical gap — e.g. buying paper cheap while selling physical dear? Any
   reporting on who profited?

### 1C. What the delivered cost actually was
1. Best available figures for **delivered/landed cost of crude to US and Asian refiners**
   during the peak versus the benchmark price. EIA publishes "refiner acquisition cost"
   (series `R0000____3` composite, `R1200____3` domestic, `R1300____3` imported) — get the
   actual monthly values Jan 2026 through the latest.
2. Verify or refute: Saudi Aramco's May-loading Arab Light OSP at **+$19.50/bbl** over
   Oman/Dubai (vs +$9.35 in May 2022). TIER 3 only so far.
3. Verify or refute: TotalEnergies taking **77 of 82 Dubai partials in March 2026 (~$4bn)**.
   TIER 3 only so far.
4. An exact **Baltic Dirty Tanker Index** value for February 2026 (pre-crisis baseline).
   We have the 2026-03-30 record of 3,723 from a single outlet and could not find a Feb
   baseline at any tier.

---

## PRIORITY 2 — The handoff comparison (currently unresearched, and load-bearing)

The dashboard's central rebuttal is to *"Trump inherited a horrible economy and turned it
into a golden age."* We need a clean, fair, side-by-side of the economy **as of January
2021** versus **as of January 2025** versus **now (mid-2026)**, TIER 1 sources only:

- Headline CPI and core CPI (y/y)
- Unemployment rate, labor force participation, prime-age EPOP
- Real GDP growth, real disposable personal income
- Real average hourly earnings (y/y), labor share of income
- Consumer sentiment (UMich), and note it has become politically polarized — say so
- S&P 500 level, business investment
- Federal deficit as % of GDP, debt/GDP
- Gas price, average grocery basket if available

**Be scrupulously fair.** Where the current economy is genuinely strong, say so. The page
concedes real strengths — that is what makes the rest credible. We need the honest ledger,
not a hit piece.

---

## PRIORITY 3 — Was post-COVID inflation global? (partially researched, needs completion)

1. Peak headline inflation **rate and month** for each G7 country plus the euro area in
   the 2021–23 episode. Prefer OECD or IMF harmonized data; **name the exact database and
   series so we can pull it programmatically.**
2. **Verify or refute this specific claim: "US inflation fell faster than any other G7
   country."** Give a direct answer with numbers — months from peak to under 3%. If it's
   true only on certain measures or windows, say exactly which.
3. Quantify how much of any US-vs-Europe gap is **methodological** (US CPI includes
   owners' equivalent rent; euro-area HICP does not). If the US looks worse on raw CPI but
   comparable on harmonized measures, we need to know and say so.
4. **Attribution of the 2021–22 US surge:** the credible range of estimates splitting
   global supply chains vs. energy/food vs. US fiscal stimulus (ARP) vs. monetary policy.
   Find the **San Francisco Fed supply-vs-demand decomposition of PCE inflation**. Known
   anchors: Furman put ARP at 1–4pp, Strain (AEI) at ~3pp. **Fiscal stimulus did
   contribute — the question is how much relative to global factors.** Do not zero it out.

---

## PRIORITY 4 — The Inflation Reduction Act (needs honest verification)

**Verify or refute:** that the IRA meaningfully reduced inflation.

Our current understanding is that CBO scored its near-term inflation effect as roughly
negligible and Penn Wharton found effects statistically indistinguishable from zero. **If
the honest finding is that the IRA had little to do with the disinflation — which was
mostly supply-chain normalization plus Fed tightening — we need to know that BEFORE it
goes on a dashboard.** Do not tell us what we want to hear. Get the CBO score, the Penn
Wharton Budget Model analysis, and any peer-reviewed evaluation.

---

## PRIORITY 5 — BLS data integrity (HIGHEST LIABILITY — needs independent corroboration)

The user believes inflation statistics are currently being "gamed" to look low. We will
**not** publish a manipulation claim without evidence. We need to know precisely which of
these three is true:

**(a) Documented degradation of data quality.** Believed true, needs corroboration:
- October 2025 CPI was **never collected** (43-day shutdown, 2025-10-01 to 2025-11-12) and
  is permanently suppressed; 864 import/export indexes likewise
- ~15% of the CPI sample suspended across 72 areas; collection ended entirely in
  Lincoln NE, Provo UT, Buffalo NY
- ~400 CPI series discontinued (believed mostly local-area energy/utilities)
- ~350 PPI indexes discontinued Aug 2025
- No CE survey data collected Oct–Nov 2025, which feeds **2027** CPI weights

**(b) Legitimate methodology that happens to flatter the number.** Believed true:
- Core and trimmed-mean measures exclude energy — exactly what spiked
- Core PCE's largest supercore contributor is **imputed portfolio-management fees**, which
  track equity prices and have no CPI counterpart. Verify this and quantify it.

**(c) Deliberate political manipulation.** **We have found NO evidence. Test this
properly:**
- Was the BLS Commissioner fired, replaced, or pressured at any point in 2025–26? Get the
  facts and dates.
- Any documented political interference in BLS/BEA/Census statistical production?
- Statements from the **American Statistical Association**, former BLS commissioners, the
  Committee on National Statistics, or the Federal Statistical System on data integrity?
- Any change to CPI methodology or weighting that was imposed rather than professionally
  adopted?

**If (c) has no support, say so unambiguously.** We will publish (a) and (b), which are
both real and both damaging, and we will explicitly decline to claim (c).

---

## PRIORITY 6 — Does official CPI understate household experience?

Independent of manipulation. Look for:
1. Work on the gap between measured CPI and household inflation *perceptions*
2. Whether energy's CPI weight understates its budget share for **lower-income
   households** — the distributional/"inflation inequality" literature (Cravino–Levchenko
   and related). Get specific numbers on inflation rates by income quintile for 2026.
3. Any Fed or academic work on household-specific inflation rates during this episode

This is the honest, defensible version of "the official number doesn't match what people
feel at the pump," and it may be the strongest thing in this section.

---

## Output format requested

For each priority: findings with tier labels, a blunt **VERIFIED / PARTLY TRUE /
REFUTED / NO EVIDENCE FOUND** verdict on each specific claim, exact data series
identifiers where programmatic access exists, and a closing section titled
**"Claims this dashboard should NOT make"** listing everything that did not survive
scrutiny.
