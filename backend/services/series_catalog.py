"""Series catalogue for the V3 attribution engine.

Extends the 18 series in `fred_client.SERIES_IDS` with everything the causal
argument needs. Kept separate so the V2 endpoints keep working untouched.

Four groups, each doing a specific job in the argument:

* **STAPLES** -- BLS *average price* series. These are actual dollars per pound
  or per dozen, not index points. "Ground beef was $3.96, it's now $6.83" needs
  no economics training to evaluate, and it comes straight from BLS. The most
  persuasive data on the page is also the least sophisticated.

* **CONTROLS** -- CPI categories with near-zero oil intensity. If broad
  monetary or fiscal inflation were driving 2026, these would move too. The
  placebo battery runs the identical counterfactual on them.

* **TARIFF_DETECTORS** -- high import content, low energy intensity. If these
  break on tariff dates while energy-linked goods break on 2026-02-28, the two
  confounds are separated *empirically* rather than by assertion.

* **MACRO** -- the two-term scorecard. Deliberately includes series that cut
  against the thesis (equities, unemployment). A ledger that concedes the
  strong rows is the only kind a skeptic will read past.

Every ID here was validated against FRED's /series endpoint on 2026-08-02, but
IDs get revised, so `validate_catalog()` re-checks at startup and drops any that
404 **with a logged warning**. Silence would be worse than failure: an empty
placebo battery renders as "all placebos passed."
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Group = Literal["staple", "control", "tariff_detector", "positive_control", "macro", "tariff", "international"]


@dataclass(frozen=True)
class SeriesSpec:
    key: str
    fred_id: str
    name: str
    group: Group
    unit: str  # "usd" | "index" | "pct" | "usd_gal" | "ratio"
    #: Higher value = worse for a household? Drives colour direction in the UI.
    higher_is_worse: bool = True
    #: Seasonally adjusted at source. NSA series need Fourier seasonal terms --
    #: see docs/THESIS.md landmine 2.
    sa: bool = True
    #: Can the value be <= 0? If so it is never log-transformed.
    positive: bool = True
    note: str = ""


# ---------------------------------------------------------------------------
# Staples -- BLS average prices, US city average. Actual dollars.
# ---------------------------------------------------------------------------

STAPLES: list[SeriesSpec] = [
    SeriesSpec("beef_ground", "APU0000703112", "Ground beef", "staple", "usd", sa=False,
               note="per lb. Cattle herd at multi-decade lows plus tariffs on imported beef."),
    SeriesSpec("steak_round", "APU0000703613", "Round steak", "staple", "usd", sa=False,
               note="per lb"),
    SeriesSpec("chicken_breast", "APU0000FF1101", "Chicken breast", "staple", "usd", sa=False,
               note="per lb, boneless"),
    SeriesSpec("bacon", "APU0000704111", "Bacon", "staple", "usd", sa=False, note="per lb, sliced"),
    SeriesSpec("eggs", "APU0000708111", "Eggs", "staple", "usd", sa=False,
               note="grade A large, per dozen. The 2022-25 spike was avian influenza, "
                    "not policy -- and the subsequent fall is real. We say so."),
    SeriesSpec("milk", "APU0000709112", "Milk", "staple", "usd", sa=False, note="whole, per gallon"),
    SeriesSpec("bread", "APU0000702111", "Bread", "staple", "usd", sa=False, note="white, per lb"),
    SeriesSpec("coffee", "APU0000717311", "Coffee", "staple", "usd", sa=False,
               note="ground roast, per lb"),
    SeriesSpec("bananas", "APU0000711211", "Bananas", "staple", "usd", sa=False, note="per lb"),
    SeriesSpec("potatoes", "APU0000712311", "Potatoes", "staple", "usd", sa=False, note="per lb"),
    SeriesSpec("gasoline_ap", "APU000074714", "Gasoline at the pump", "staple", "usd", sa=False,
               note="unleaded regular, per gallon"),
    SeriesSpec("electricity", "APU000072610", "Electricity", "staple", "usd", sa=False,
               note="per KWH"),
    SeriesSpec("utility_gas", "APU000072620", "Utility gas", "staple", "usd", sa=False,
               note="per therm"),
]

# ---------------------------------------------------------------------------
# Placebo controls -- oil-insensitive CPI categories.
# ---------------------------------------------------------------------------

CONTROLS: list[SeriesSpec] = [
    SeriesSpec("shelter", "CUSR0000SAH1", "Shelter", "control", "index",
               note="~1/3 of CPI. Decelerating through 2026 -- a disinflationary tailwind."),
    SeriesSpec("medical", "CPIMEDSL", "Medical care", "control", "index"),
    SeriesSpec("services_less_energy", "CUSR0000SASLE", "Services less energy", "control", "index"),
    SeriesSpec("apparel", "CPIAPPSL", "Apparel", "control", "index",
               note="Dual role: oil-insensitive but tariff-exposed."),
    SeriesSpec("education", "CUSR0000SAE1", "Education", "control", "index"),
    SeriesSpec("rent_primary", "CUSR0000SEHA", "Rent of primary residence", "control", "index"),
    SeriesSpec("core_cpi", "CPILFESL", "Core CPI (ex food & energy)", "control", "index",
               note="Partial control -- contains second-round energy effects and tariffs."),
]

# ---------------------------------------------------------------------------
# Tariff detectors and the positive control.
# ---------------------------------------------------------------------------

TARIFF_DETECTORS: list[SeriesSpec] = [
    SeriesSpec("new_vehicles", "CUSR0000SETA01", "New vehicles", "tariff_detector", "index",
               note="Highest tariff exposure of any CPI category, yet ran +0.5% y/y in "
                    "June 2026. The most awkward data point for a simple tariff story -- "
                    "which is exactly why it is on the page."),
    SeriesSpec("used_vehicles", "CUSR0000SETA02", "Used cars & trucks", "tariff_detector", "index"),
    SeriesSpec("toys", "CUSR0000SERE01", "Toys", "tariff_detector", "index"),
]

POSITIVE_CONTROLS: list[SeriesSpec] = [
    SeriesSpec("jet_fuel_ppi", "WPU0572", "Jet fuel (PPI)", "positive_control", "index", sa=False,
               note="SHOULD break at the war date. Without a positive control, "
                    "'the placebos passed' is unfalsifiable -- maybe the test never "
                    "rejects anything."),
]

# ---------------------------------------------------------------------------
# Tariff measurement.
# ---------------------------------------------------------------------------

TARIFF_SERIES: list[SeriesSpec] = [
    SeriesSpec("import_prices_ex_petroleum", "IREXPET", "Import prices ex-petroleum",
               "tariff", "index", sa=False,
               note="BLS measures import prices FOB foreign port, EXCLUDING duties. So "
                    "this is the foreign exporter's price before any tariff. Flat here "
                    "while shelf prices rise = exporters did not absorb the tariff."),
    SeriesSpec("import_prices_all", "IR", "Import prices, all commodities", "tariff", "index",
               sa=False),
    SeriesSpec("import_prices_fuels", "IR10", "Import prices, fuels & lubricants", "tariff",
               "index", sa=False,
               note="Jan->Jun 2026 this ran 321->360 while China-origin import prices sat "
                    "flat at 98.9. The entire import price rise is the fuels line."),
    SeriesSpec("import_prices_china", "CHNTOT", "Import prices, China origin", "tariff", "index",
               sa=False),
    SeriesSpec("customs_duties", "B235RC1Q027SBEA", "Customs duties (quarterly)", "tariff", "usd",
               note="GROSS duties. Net went negative in mid-2026 as refunds hit $49B in "
                    "June alone -- net would make the series nonsense."),
    SeriesSpec("goods_imports", "BOPGIMP", "Goods imports (BOP)", "tariff", "usd",
               note="Denominator for the effective tariff rate."),
]

# ---------------------------------------------------------------------------
# International control group.
# ---------------------------------------------------------------------------

INTERNATIONAL: list[SeriesSpec] = [
    SeriesSpec("euro_energy_hicp", "CP0450EZ19M086NEST", "Euro area energy prices",
               "international", "index", sa=False,
               note="No US administration sets the price of diesel in Rotterdam. If the "
                    "shock is global, a domestic-policy explanation cannot carry it."),
]

# ---------------------------------------------------------------------------
# Macro scorecard -- the two-term ledger.
# Includes rows that cut AGAINST the thesis. That is the point.
# ---------------------------------------------------------------------------

MACRO: list[SeriesSpec] = [
    SeriesSpec("cpi_headline", "CPIAUCSL", "Headline CPI", "macro", "index"),
    SeriesSpec("cpi_core", "CPILFESL", "Core CPI", "macro", "index"),
    # Use the INDEX-level variants (M094), not the "% change at annual rate"
    # variants (M158). M158 is a single month annualised -- it read 0.13% in
    # June 2026, which is month-to-month noise, not the inflation rate. We
    # compute 12-month changes from the index ourselves, exactly as for
    # headline CPI, so every line on the breadth chart is the same statistic.
    SeriesSpec("median_cpi", "MEDCPIM094SFRBCLE", "Median CPI (Cleveland Fed)", "macro", "index",
               note="THE breadth test. Broad monetary inflation raises the median. "
                    "It didn't move."),
    SeriesSpec("trimmed_cpi", "TRMMEANCPIM094SFRBCLE", "16% trimmed-mean CPI", "macro",
               "index"),
    SeriesSpec("real_earnings", "LES1252881600Q", "Median real weekly earnings", "macro", "usd",
               higher_is_worse=False,
               note="Median rather than average -- the mean is pulled by the top of the "
                    "distribution and is not what a typical worker experiences."),
    SeriesSpec("labor_share", "PRS85006173", "Labor share of income", "macro", "index",
               higher_is_worse=False,
               note="53.7% in Q1 2026 -- lowest since the series began in 1947."),
    SeriesSpec("unemployment", "UNRATE", "Unemployment rate", "macro", "pct"),
    SeriesSpec("prime_epop", "LNS12300060", "Prime-age employment ratio", "macro", "pct",
               higher_is_worse=False),
    SeriesSpec("real_gdp", "GDPC1", "Real GDP", "macro", "usd", higher_is_worse=False),
    SeriesSpec("real_dpi", "DSPIC96", "Real disposable personal income", "macro", "usd",
               higher_is_worse=False),
    SeriesSpec("sp500", "SP500", "S&P 500", "macro", "index", higher_is_worse=False, sa=False,
               note="Genuinely up. Concede it plainly -- a scorecard that hides the "
                    "opposing rows is not a scorecard."),
    SeriesSpec("sentiment", "UMCSENT", "Consumer sentiment", "macro", "index",
               higher_is_worse=False, sa=False,
               note="Has become politically polarised since 2020; respondents' partisanship "
                    "predicts their answer. Flag this rather than leaning on it."),
    SeriesSpec("unit_labor_costs", "ULCNFB", "Unit labor costs", "macro", "index",
               note="+0.5% y/y -- consistent with inflation BELOW 2%. Kills the "
                    "wage-price-spiral story."),
    SeriesSpec("saving_rate", "PSAVERT", "Personal saving rate", "macro", "pct",
               higher_is_worse=False,
               note="2.7% in June 2026, a two-decade low, down from 5.5% in April 2025. "
                    "Households are covering higher prices by saving less."),
    SeriesSpec("long_term_unemployed", "LNS13025703", "Long-term unemployed share",
               "macro", "pct",
               note="27.3% of the unemployed have been jobless 27+ weeks, up from 21.1% "
                    "in January 2025. Hiring is frozen even though layoffs are low."),
    SeriesSpec("participation", "CIVPART", "Labor force participation", "macro", "pct",
               higher_is_worse=False),
    SeriesSpec("real_ahe", "CES0500000013", "Real average hourly earnings", "macro", "usd",
               higher_is_worse=False,
               note="All employees, CPI-deflated. Note CES0500000032 is the "
                    "production/nonsupervisory series -- a different measure."),
]

ALL_SPECS: list[SeriesSpec] = (
    STAPLES + CONTROLS + TARIFF_DETECTORS + POSITIVE_CONTROLS
    + TARIFF_SERIES + INTERNATIONAL + MACRO
)

BY_KEY: dict[str, SeriesSpec] = {s.key: s for s in ALL_SPECS}


def specs_in(group: Group) -> list[SeriesSpec]:
    return [s for s in ALL_SPECS if s.group == group]


# ---------------------------------------------------------------------------
# Administration boundaries -- for the two-term scorecard.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Term:
    key: str
    label: str
    holder: str
    start: str
    end: str | None  # None = ongoing
    party: Literal["D", "R"] = "D"
    #: Major shock inherited or encountered, shown as a standing caveat. Presidents
    #: do not control the economy on a four-year clock, and a comparison tool that
    #: pretends otherwise is not honest. The UI surfaces this on every row.
    context: str = ""


#: Every administration from Clinton forward. Chosen because the daily oil series
#: (DCOILWTICO) starts in 1986 and the modern CPI category structure is stable from
#: the early 1990s, so all metrics are comparable across the whole span.
TERMS: list[Term] = [
    Term("clinton", "Clinton", "Bill Clinton", "1993-01-20", "2001-01-20", "D",
         "Dot-com expansion; recession began March 2001, weeks after leaving office."),
    Term("bush_43", "Bush", "George W. Bush", "2001-01-20", "2009-01-20", "R",
         "Inherited the dot-com bust; 9/11; ended amid the 2008 financial crisis."),
    Term("obama", "Obama", "Barack Obama", "2009-01-20", "2017-01-20", "D",
         "Inherited the financial crisis at its trough; unemployment peaked 10% in Oct 2009."),
    Term("trump_1", "Trump I", "Donald Trump", "2017-01-20", "2021-01-20", "R",
         "Ended with the COVID-19 shock; unemployment hit 14.8% in April 2020."),
    Term("biden", "Biden", "Joe Biden", "2021-01-20", "2025-01-20", "D",
         "Inherited the COVID reopening; global supply-chain and energy shocks drove a "
         "worldwide inflation surge, peaking 9.1% June 2022."),
    Term("trump_2", "Trump II", "Donald Trump", "2025-01-20", None, "R",
         "2026 tariffs; the Iran war from February 2026 took oil from $57 to $114."),
]

PARTY_LABEL = {"D": "Democratic", "R": "Republican"}

#: Terms shorter than this are flagged in-progress/too-short rather than ranked as
#: though they were complete. Trump II is ~19 months against 48-month terms, and
#: annualising alone does not make a partial term fully comparable.
MIN_COMPLETE_YEARS = 3.5

#: The comparison anchor. Everything in the scorecard is measured from here.
HANDOVER_DATE = "2025-01-20"


async def validate_catalog(fetch_meta) -> dict[str, dict]:
    """Check every catalogue ID against FRED metadata.

    `fetch_meta(series_id)` should return the /series payload or None.
    Returns ``{key: metadata}`` for IDs that resolved. Callers must treat a
    missing key as an error to surface, never as a silent pass -- see the
    module docstring.
    """
    import logging

    log = logging.getLogger(__name__)
    resolved: dict[str, dict] = {}
    for spec in ALL_SPECS:
        try:
            meta = await fetch_meta(spec.fred_id)
        except Exception as exc:  # network hiccup, not a bad ID
            log.warning("catalog: could not validate %s (%s): %s",
                        spec.key, spec.fred_id, exc)
            continue
        if not meta:
            log.warning("catalog: FRED has no series %s for key %s -- DROPPING. "
                        "Any analysis depending on it will report unavailable.",
                        spec.fred_id, spec.key)
            continue

        # A NSA series treated as SA silently injects seasonality into the
        # counterfactual, so verify our assumption rather than trusting it.
        adj = (meta.get("seasonal_adjustment_short") or "").upper()
        if adj:
            actual_sa = adj == "SA"
            if actual_sa != spec.sa:
                log.warning("catalog: %s declared sa=%s but FRED reports %s -- "
                            "seasonal handling may be wrong", spec.key, spec.sa, adj)
        resolved[spec.key] = meta
    return resolved
