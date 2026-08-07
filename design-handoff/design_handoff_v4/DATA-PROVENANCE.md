# Data provenance — read before wiring anything

Every figure on the page falls into one of three tiers. The design keeps them **visually
distinct on purpose**, and that distinction is the page's credibility asset. Do not flatten it.

- **TIER A — verified.** In `docs/THESIS.md` or the 2026-08-03 brief, sourced to BLS, BEA,
  EIA, FRED, Cleveland Fed, Dallas Fed, Brookings, Eurostat, NBER, GAO, IEA.
- **TIER B — cited in-page but not in `THESIS.md`.** Real citations, outside the repo's
  tier-graded set. **These need THESIS.md entries before publication.**
- **TIER C — illustrative, labelled as such in the UI.** Never presented as data.

---

## 1. BLOCKER — three brief-vs-THESIS conflicts

Recorded in `v4-data.js` as `CONFLICTS`. The design uses the brief's values (newer by one
day). Each appears in **more than one place**, so resolve once, centrally.

| Figure | Brief §1 | THESIS.md | Used in design | Appears in |
|---|---|---|---|---|
| US headline CPI y/y, Jun 2026 | **3.73%** | 3.53% | brief | §03 chart, OG card |
| Euro-area headline y/y, Jun 2026 | **2.73%** | 2.8% | brief | §03 chart |
| Headline CPI (breadth) | **3.7%** | 3.5% (peak 4.2% May) | brief | §04 war bars |

## 2. BLOCKER — TIER B figures needing THESIS.md entries

All are in §07. They are cited in the page's sources line (IEA, Marsh, Strauss Center) and
the two prices already render with `approx.` / `derived` captions, so nothing overstates its
certainty. But none is in `THESIS.md`, so the "every figure sourced" claim in the masthead is
not yet literally true for them.

| Figure | Value | Cited to | Where |
|---|---|---|---|
| Pre-war gross transit | 13.8 mb/d (~20% of world oil trade) | IEA | Transit readout, §07 event |
| Transit while closed | 0.0 mb/d | IEA | Transit readout |
| Transit, late June | 4.8 mb/d (35% of baseline) | IEA / CNBC | Transit readout |
| War-risk premium, pre-war | 0.25% of hull | Strauss Center | Risk readout |
| War-risk premium, 15 Apr | 10% of a $100M hull (~$4.87/bbl) | IEA / Marsh | Risk readout |
| War-risk premium, early Jul | 1–3% | Marsh | Risk readout |
| War-risk premium, 23 Jul | 7.5–10% | Marsh | Risk readout, §07 event |
| IEA coordinated release | 400M bbl, largest in 52 years, ~$2/bbl effect | IEA | §07 event |
| WTI, 28 Feb 2026 | ~$67.00 — **marked `approx.` in the UI** | — | Price anchor |
| WTI, 8 Jul 2026 | $73.52 (+4.4%); Brent $78.02 (+5.2%) | — | Price anchor, §07 event |
| Brent above $90 on escalation threats | — | — | §07 event |
| Attacks on Saudi tankers, 23 Jul | — | — | §07 event |

Note the 8 Jul figure does not reconcile arithmetically: $69.74 × 1.044 = $72.81, not $73.52.
One of the two numbers is off, or the base is a different close. Worth checking.

The `$96.91` anchor at 7 Apr is **derived**, labelled as such: 114.01 × 0.85, from THESIS.md's
note that prices fell ~15% after the 7 Apr ceasefire. Fine as long as the label stays.

## 3. TIER A — verified, safe to ship

**Prices (FRED `DCOILWTICO`)** — 2025 close $57.70 · 2 Jan $57.21 · 6 Apr peak $114.01 ·
1 Jul $69.74 · 27 Jul $84.25.

**Event dates** — SCOTUS strikes IEEPA tariffs 20 Feb · §122 surcharge 24 Feb · strikes and
closure 28 Feb · Platts pulls Hormuz grades from Dubai 2 Mar (deliverable grades 5 → 2) ·
peak 6 Apr · ceasefire and reopening 18 Jun · strikes resume 8 Jul · §122 expires 24 Jul.

**April cost stack** — added freight $11.25/bbl (TD3C WS137 → WS525, Baltic Exchange) ·
war-risk insurance $4.87/bbl · documented stack ≈ $16/bbl against a $25–35/bbl wedge
(IEA ceiling $35) · wedge closed to $3/bbl by early May (IEA) · 3-2-1 crack ≈ $64/bbl
mid-July, breaking the June 2022 record.

**Administrations** — US-specific inflation excess: Clinton +1.12 · Bush +0.44 · Obama +0.23
· Trump I +0.72 · Biden +0.25 · Trump II +0.77.

**Oct 2022 vs Jun 2026** — US 7.76 / euro area 10.62 (US 2.86 below) → US 3.73 / euro area
2.73 (US 1.00 above).

**Breadth, Jun 2026** — core CPI 2.6% · median CPI 2.7% · 16% trimmed 2.6% · trimmed-mean PCE
2.2% · energy +15.7% · gasoline +26.7%.

**Core PCE creep** — 2.61% (Apr 2025) → 3.42% (May 2026), a +0.81pp persistent creep with no
energy component. Credible tariff estimates cluster at **0.4–0.8pp of core PCE** — ship the
bound, never a point estimate.

**Labour** — job creation 320,938/mo → 42,118/mo (−87%) · long-term unemployed 21.1% → 27.3%
· hiring rate 3.3% (vs ~3.9% pre-2020) · quits 1.9% · U-3 4.0 → 4.2 · U-6 7.5 → 7.9 ·
Trump I cycle-adjusted jobs: none −57,604, ex_covid +180,135, ex_recession +418,667.

**Staples** — ground beef $5.55 → $6.83 · coffee $7.02 → $9.46 · gasoline $3.21 → $4.20 ·
eggs −45%/yr.

**Dallas Fed, 2 Jun 2026** — the SCOTUS ruling cut average tariffs ~4.8pp (−0.1 to −0.2pp
core PCE) and the Hormuz shipping-cost increase completely offsets it; net effect through
2026 "close to zero". **This is why the war and tariff effects are never summed.**

## 4. TIER C — illustrative, must keep its labels

| Layer | Label in the UI |
|---|---|
| Coastline geometry | "ILLUSTRATIVE GEOMETRY" |
| Vessel positions | "VESSEL POSITIONS ARE NOT AIS DATA" |
| Queue count | "No verified queue count exists at any tier, so we do not publish one." |
| Chart paths between anchors | "DRAWN STRAIGHT BETWEEN CLOSES" legend + dashed stroke |

`THESIS.md` explicitly forbids the circulating "~325 stranded tankers" and "2,000 ships"
figures as unsourceable (the IMO's own figure is ~1,600). **Do not publish a queue count.**

## 5. Landmines that will break the code or the credibility

1. **October 2025 CPI does not exist and never will.** Never collected during the 43-day
   shutdown; BLS returns `"-"`, FRED returns blank. **Every 12-month change through Oct 2026
   is undefined** and MoM annualisation breaks twice. Render gaps as gaps — `v4-data.js` uses
   `null` for missing values; keep that convention.
2. **Gasoline and diesel (`GASREGW`/`GASDESW`) are not seasonally adjusted.** Part of every
   Jan→May rise is summer-blend changeover. The team has chosen to leave this unannotated on
   the shelf section; that is a deliberate decision, but it is the single easiest way for a
   competent critic to attack the number, so know it is there.
3. **Use gross customs duties, not net.** Refunds hit $21.97B in May and $49.18B in June 2026;
   net receipts went negative.
4. **Use `IREXPET`, not `IR`** — otherwise the oil shock is double-counted inside the tariff
   measure.
5. **SCOTUS (20 Feb) and the strikes (28 Feb) are eight days apart.** Do not claim clean
   separation in Q1 2026. The Dallas Fed "they roughly cancel" framing is the honest one.
6. **The war is ongoing** (re-escalated 8 Jul). Any "post-shock" framing ages badly.
7. **Eurostat renamed everything in Feb 2026.** `prc_hicp_manr` is frozen at 2025-12; live
   data is `prc_hicp_minr` with `coicop18` / `TOTAL`. A dashboard on the old code silently
   stops updating.
8. **No harmonised US series after Dec 2024.** Any like-for-like chart stops there or
   reconstructs CPI-U ex-OER. Plotting CPI-U against HICP without saying so is worth ~1pp of
   spurious gap — OER is 24% of the US basket and 0% of the euro-area HICP basket.
9. **Core PCE (3.3%) > core CPI (2.6%)** in June 2026 — an inversion driven by imputed
   portfolio-management fees. Disclose which index you use, before someone else finds it.
10. `B235RC1M027SBEA` (monthly customs duties) is a 404 — quarterly only.

## 6. Not wired in

- **Monthly US vs peer CPI, 2015-01 → 2026-06.** §03 is designed to accept it with no
  redesign. Sources: FRED `CPIAUCSL` (compute y/y); Eurostat `prc_hicp_minr`,
  `coicop18=TOTAL`, `geo=EA|FR|DE|IT`; OECD for Canada/Japan/UK (⚠ split dataflows — the
  wrong flow returns 404, not an obvious error).
- **Daily crude**, for the §01 and §07 charts. Currently four to eight verified closes with
  straight lines between them, labelled.
- **IMF PortWatch transit volumes** — free, no key. This is the one that upgrades the vessel
  layer from illustrative to real.
- **Peer countries beyond the euro area and France** for the control-group section.
- **S&P 500 and initial-claims point estimates** for §06 — the brief gives direction only.
- **Tanker day rates** — genuinely unavailable at reasonable cost. Design around volumes and
  barrels, per brief §6.

## 7. One claim the design does not make, and should not

`THESIS.md` documents a real CFTC probe and a DOJ probe into suspiciously timed oil futures
trades. It also states this **must never share a visual frame** with the paper-physical wedge:
there is no finding, no enforcement action, no adjudication, and presenting them together
invites a causal inference no evidence supports. The design keeps them apart. Keep it that way.
