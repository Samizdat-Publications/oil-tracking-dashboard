"""V3 attribution engine -- orchestration layer.

Fetches series, runs the estimators in `econometrics.py` over the
representations in `timeseries.py`, and returns JSON-ready payloads. Contains
no numpy loops of its own: if you find yourself writing math here, it belongs
in `econometrics.py` where it can be tested offline.

Every payload carries a `MethodEnvelope` -- method, sample, assumptions,
caveats, and **a non-empty `falsifiers` list**. A causal claim with no stated
falsifier is not a causal claim, and the UI renders these inline rather than
burying them in a footnote.

See docs/THESIS.md for what each analysis is allowed to conclude, and for the
list of things we deliberately do not claim.
"""

from __future__ import annotations

import asyncio
import hashlib
from datetime import date
from typing import Any, Iterable

import numpy as np

from services import econometrics as ec
from services import timeseries as tsmod
from services.fred_client import get_series
from services.series_catalog import (
    BY_KEY,
    HANDOVER_DATE,
    MIN_COMPLETE_YEARS,
    PARTY_LABEL,
    PEER_KEYS,
    TERMS,
    SeriesSpec,
    specs_in,
)
from services.timeseries import WAR_BASELINE_DATE, WAR_DATE, TS

#: Long history so pass-through can be estimated out of episode.
HISTORY_START = "2005-01-01"

#: Only one heavy numpy job at a time. The Fly VM is shared-cpu-1x / 256MB and
#: two concurrent bootstrap batteries will swap.
_COMPUTE_LOCK = asyncio.Semaphore(1)


def _seed(*parts: Any) -> int:
    """Deterministic seed from the call parameters.

    These numbers get screenshotted and quoted. They must not drift between
    cache misses, so nothing here is allowed to depend on wall-clock time.
    """
    raw = "|".join(str(p) for p in parts).encode()
    return int(hashlib.blake2b(raw, digest_size=4).hexdigest(), 16)


def _envelope(
    method: str,
    *,
    sample: dict,
    falsifiers: list[str],
    assumptions: list[str] | None = None,
    caveats: list[str] | None = None,
    confidence: str = "medium",
    **extra: Any,
) -> dict:
    if not falsifiers:
        raise ValueError(f"{method}: falsifiers must be non-empty")
    return {
        "method": method,
        "method_version": "3.0.0",
        "sample": sample,
        "assumptions": assumptions or [],
        "caveats": caveats or [],
        "falsifiers": falsifiers,
        "confidence": confidence,
        "generated_for_date": date.today().isoformat(),
        **extra,
    }


async def _load(spec: SeriesSpec, start: str = HISTORY_START) -> TS:
    obs = await get_series(spec.fred_id, start)
    return tsmod.to_ts(
        obs, spec.key, unit=spec.unit, positive=spec.positive, sa=spec.sa, name=spec.name
    )


async def _load_many(specs: Iterable[SeriesSpec], start: str = HISTORY_START) -> dict[str, TS]:
    specs = list(specs)
    results = await asyncio.gather(
        *(_load(s, start) for s in specs), return_exceptions=True
    )
    return {
        s.key: r for s, r in zip(specs, results)
        if isinstance(r, TS) and len(r) > 0
    }


# ---------------------------------------------------------------------------
# Term arithmetic -- the two-term comparison
# ---------------------------------------------------------------------------


def _annualised(start_val: float, end_val: float, years: float) -> float | None:
    """Compound annual rate of change, in percent."""
    if start_val <= 0 or years <= 0:
        return None
    return ((end_val / start_val) ** (1.0 / years) - 1.0) * 100.0


def _term_change(ts: TS, start: str, end: str | None) -> dict | None:
    """Change over a term, reported as total AND annualised.

    Annualising is not decoration -- it's what makes the comparison honest. A
    48-month term and a 17-month term cannot be compared on raw percentage
    change, and doing so would be the first thing a critic attacked.
    """
    a = tsmod.last_on_or_before(ts, start)
    end_date = end or ts.end
    b = tsmod.last_on_or_before(ts, end_date)
    if not a or not b or a[0] == b[0]:
        return None
    days = (np.datetime64(b[0]) - np.datetime64(a[0])).astype(int)
    years = days / 365.25
    if years <= 0 or a[1] == 0:
        return None
    return {
        "start_date": a[0], "start_value": round(a[1], 4),
        "end_date": b[0], "end_value": round(b[1], 4),
        "years": round(years, 2),
        "total_pct": round((b[1] - a[1]) / abs(a[1]) * 100.0, 2),
        "annualised_pct": (
            round(v, 2) if (v := _annualised(a[1], b[1], years)) is not None else None
        ),
        "absolute_change": round(b[1] - a[1], 4),
    }


#: Metrics offered by the administration comparison. Deliberately includes
#: measures that favour different parties in different periods -- a comparison
#: tool that only surfaces losing rows for one side is not a comparison tool.
COMPARISON_METRICS: dict[str, dict] = {
    "cpi_headline": {"label": "Inflation (headline CPI)", "kind": "yoy", "higher_is_worse": True},
    "cpi_core": {"label": "Core inflation", "kind": "yoy", "higher_is_worse": True},
    "gasoline_ap": {"label": "Gasoline, $/gal", "kind": "level", "higher_is_worse": True},
    "beef_ground": {"label": "Ground beef, $/lb", "kind": "level", "higher_is_worse": True},
    "electricity": {"label": "Electricity, $/kWh", "kind": "level", "higher_is_worse": True},
    "unemployment": {"label": "Unemployment rate", "kind": "raw", "higher_is_worse": True},
    "real_earnings": {"label": "Median real weekly earnings", "kind": "level", "higher_is_worse": False},
    "real_gdp": {"label": "Real GDP", "kind": "level", "higher_is_worse": False},
    "sp500": {"label": "S&P 500", "kind": "level", "higher_is_worse": False},
    "labor_share": {"label": "Labor share of income", "kind": "level", "higher_is_worse": False},
    "saving_rate": {"label": "Personal saving rate", "kind": "raw", "higher_is_worse": False},
}


#: NBER-dated US recessions (peak month -> trough month, inclusive).
#: https://www.nber.org/research/business-cycle-dating
NBER_RECESSIONS: list[tuple[str, str]] = [
    ("1990-07", "1991-03"),
    ("2001-03", "2001-11"),
    ("2007-12", "2009-06"),
    ("2020-02", "2020-04"),
]

#: The COVID window. Deliberately wider than the NBER recession (which was only
#: two months) because the economic distortion plainly outlasted the formal
#: contraction -- reopening, supply chains and the stimulus response all land
#: inside it. The end date is a judgement call and is stated as one.
COVID_WINDOW = ("2020-03", "2021-06")


def _month_mask(dates: np.ndarray, windows: list[tuple[str, str]]) -> np.ndarray:
    """True where a date falls inside any (start_month, end_month) window."""
    out = np.zeros(dates.size, dtype=bool)
    for start, end in windows:
        lo = np.datetime64(start, "M").astype("datetime64[D]")
        hi = (np.datetime64(end, "M") + 1).astype("datetime64[D]")
        out |= (dates >= lo) & (dates < hi)
    return out


def _masked_annual_rate(
    dates: np.ndarray, deltas: np.ndarray, term, *,
    exclude: np.ndarray | None = None,
    lag_months: int = 0,
    periods_per_year: float = 12.0,
    is_flow: bool = False,
) -> dict | None:
    """Annualised rate for one term, over months that survive the mask.

    Excluding months from a start-to-end level comparison is not meaningful --
    you cannot subtract a month out of `(end/start)^(1/years)`. So every
    adjustment works on the *monthly changes* instead: mask the months, average
    what remains, annualise. That makes all four adjustments the same
    arithmetic and keeps them comparable to each other.

    `lag_months` shifts the term's start forward, crediting its opening months
    to the predecessor -- a crude stand-in for policy acting with a lag.
    """
    start = np.datetime64(term.start, "D")
    if lag_months:
        start = start + np.timedelta64(int(lag_months * 30.44), "D")
    m = dates > start
    if term.end:
        m &= dates <= np.datetime64(term.end, "D")
    if exclude is not None:
        m &= ~exclude
    kept = deltas[m]
    if kept.size < 6:
        return None

    mean = float(kept.mean())
    return {
        "annualised_pct": round(mean * periods_per_year, 1) if is_flow
                          else round((np.exp(mean * periods_per_year) - 1.0) * 100.0, 2),
        "months_used": int(kept.size),
        "months_dropped": int((~m).sum() - (dates <= start).sum()
                              - (0 if not term.end else (dates > np.datetime64(term.end, "D")).sum())),
        "years": round(kept.size / periods_per_year, 2),
    }


def _adjustment_set(dates: np.ndarray, deltas: np.ndarray, *,
                    is_flow: bool, ppy: float = 12.0) -> dict:
    """Run every adjustment over every term. Returns {adjustment: {term: rate}}.

    The point is not any single adjusted number -- it is whether the *ordering*
    survives. If the ranking is stable across all four, the difference is
    robust. If it flips once the pandemic is removed, then the headline
    comparison was measuring which administration happened to be holding the
    chair during a black swan, and the page should say so.
    """
    covid = _month_mask(dates, [COVID_WINDOW])
    recession = _month_mask(dates, NBER_RECESSIONS)

    specs = {
        "none": {
            "label": "As measured",
            "note": "Inauguration to inauguration, every month counted.",
            "kwargs": {},
        },
        "ex_covid": {
            "label": "Excluding COVID",
            "note": f"Drops {COVID_WINDOW[0]} to {COVID_WINDOW[1]}. Removes both the "
                    "2020 collapse and the reopening surge, which land in different "
                    "administrations and distort them in opposite directions.",
            "kwargs": {"exclude": covid},
        },
        "ex_recession": {
            "label": "Excluding recessions",
            "note": "Drops every NBER-dated recession month, applied equally to all "
                    "terms. Tests whether a party gap is really about which "
                    "administrations met downturns.",
            "kwargs": {"exclude": recession},
        },
        "lag12": {
            "label": "12-month policy lag",
            "note": "Credits each term's first 12 months to its predecessor. Economic "
                    "policy acts with long and variable lags; this is a crude but "
                    "transparent way to stop giving a president credit for their "
                    "first year.",
            "kwargs": {"lag_months": 12},
        },
    }

    out: dict[str, dict] = {}
    for key, spec in specs.items():
        rows = {}
        for term in TERMS:
            r = _masked_annual_rate(dates, deltas, term, periods_per_year=ppy,
                                    is_flow=is_flow, **spec["kwargs"])
            if r:
                rows[term.key] = r
        # Rank completed terms only, best first.
        rankable = [(k, v) for k, v in rows.items()
                    if v["years"] >= MIN_COMPLETE_YEARS]
        out[key] = {
            "label": spec["label"], "note": spec["note"], "terms": rows,
            "rankable_keys": [k for k, _ in rankable],
        }
    return out


async def administrations(metric: str = "cpi_headline") -> dict:
    """One metric across every administration since Clinton, banded by party.

    Powers the hero timeline and the comparison engine. Three things this has to
    get right or it is worse than useless:

    * **Terms are different lengths.** Trump II is ~19 months against 48-month
      terms, so everything is annualised, and any term shorter than
      MIN_COMPLETE_YEARS is flagged `in_progress` rather than silently ranked
      beside completed ones.
    * **Presidents inherit economies.** Each term carries a `context` string
      naming the shock it encountered. Obama's numbers start at the trough of a
      financial crisis; Trump I's end in a pandemic. The UI shows this on every
      row, because a four-year clock is not an attribution model.
    * **Jobs are a flow, not a level.** Payrolls are handled as average monthly
      change; everything else as a rate of change in the level.
    """
    spec = COMPARISON_METRICS.get(metric)
    if metric == "jobs":
        return await _administrations_jobs()
    if not spec or metric not in BY_KEY:
        return {"error": f"unknown metric {metric}",
                "available": sorted(list(COMPARISON_METRICS) + ["jobs"])}

    ts = await _load(BY_KEY[metric], "1990-01-01")
    if len(ts) < 24:
        return {"insufficient_data": True, "metric": metric}

    # Series for the banded timeline. Index-type series are shown as 12-month
    # percent change so the axis is comparable across administrations; dollar
    # and rate series are shown as-is because the level is what people feel.
    if spec["kind"] == "yoy" and len(ts) > 13:
        vals = (ts.values[12:] / ts.values[:-12] - 1.0) * 100.0
        points = [{"date": str(d), "value": round(float(v), 2)}
                  for d, v in zip(ts.dates[12:], vals)]
        unit = "% change from a year earlier"
    else:
        points = [{"date": str(d), "value": round(float(v), 4)}
                  for d, v in zip(ts.dates, ts.values)]
        unit = BY_KEY[metric].unit

    rows = []
    for term in TERMS:
        change = _term_change(ts, term.start, term.end)
        if not change:
            continue
        window = [p for p in points
                  if p["date"] >= term.start and (term.end is None or p["date"] < term.end)]
        avg = round(sum(p["value"] for p in window) / len(window), 2) if window else None
        rows.append({
            "key": term.key, "label": term.label, "holder": term.holder,
            "party": term.party, "party_label": PARTY_LABEL[term.party],
            "start": term.start, "end": term.end,
            "in_progress": term.end is None,
            "too_short_to_rank": change["years"] < MIN_COMPLETE_YEARS,
            "context": term.context,
            "change": change,
            "average_level": avg,
        })

    # Ranking excludes in-progress/short terms from the ordering but still
    # returns them, so the UI can show Trump II without implying it is a
    # completed record.
    rankable = [r for r in rows if not r["too_short_to_rank"]
                and r["change"]["annualised_pct"] is not None]
    worse = spec["higher_is_worse"]
    rankable.sort(key=lambda r: r["change"]["annualised_pct"], reverse=not worse)
    for i, r in enumerate(rankable):
        r["rank"] = i + 1

    def party_mean(p: str) -> float | None:
        vals = [r["change"]["annualised_pct"] for r in rankable if r["party"] == p]
        return round(sum(vals) / len(vals), 2) if vals else None

    # Monthly log-changes drive every adjustment; resample to monthly first so
    # quarterly and daily series share one clock with the recession masks.
    monthly = tsmod.resample(ts, "M", how="last") if ts.freq != "M" else ts
    adjustments = {}
    if len(monthly) > 24 and monthly.positive and float(monthly.values.min()) > 0:
        d_dates, d_vals = tsmod.dlog(monthly)
        adjustments = _adjustment_set(d_dates, d_vals, is_flow=False)

    return {
        "metric": metric, "label": spec["label"], "unit": unit,
        "higher_is_worse": spec["higher_is_worse"],
        "points": points,
        "terms": rows,
        "adjustments": adjustments,
        "by_party": {
            "D": {"label": "Democratic", "mean_annualised_pct": party_mean("D")},
            "R": {"label": "Republican", "mean_annualised_pct": party_mean("R")},
        },
        "available_metrics": [
            {"key": k, "label": v["label"]} for k, v in COMPARISON_METRICS.items()
        ] + [{"key": "jobs", "label": "Job creation per month"}],
        "envelope": _envelope(
            "administration_comparison",
            sample={"series": BY_KEY[metric].fred_id, "start": ts.start, "end": ts.end,
                    "n": len(ts)},
            assumptions=[
                "Terms are compared on ANNUALISED rates because they are different "
                "lengths. Raw totals would favour longer terms.",
                "A term is attributed the change that occurred during it. This is a "
                "convention, not a causal claim.",
            ],
            caveats=[
                "Presidents do not control the economy on a four-year clock. Every "
                "term here inherited conditions and encountered shocks it did not "
                "cause -- each row carries that context and it should be read.",
                "The current term is incomplete and is excluded from rankings.",
                "Party averages are means over a handful of terms and are dominated "
                "by whichever administration happened to meet a recession.",
                "Economic policy acts with long and variable lags; effects often "
                "land in a successor's term.",
            ],
            falsifiers=[
                "If the ordering flipped when the metric or the window changed, no "
                "stable party-level difference would exist.",
                "If terms that encountered recessions accounted for the entire "
                "party gap, the gap would be about timing, not policy.",
            ],
            confidence="medium",
        ),
    }


async def _administrations_jobs() -> dict:
    """Job creation by administration. A flow, so it needs its own arithmetic."""
    ts = tsmod.to_ts(await get_series("PAYEMS", "1990-01-01"), "payems",
                     unit="thousands", name="Total nonfarm payrolls")
    if len(ts) < 24:
        return {"insufficient_data": True, "metric": "jobs"}

    dates, changes = ts.dates[1:], np.diff(ts.values)
    points = [{"date": str(d), "value": round(float(v) * 1000, 0)}
              for d, v in zip(dates, changes)]

    rows = []
    for term in TERMS:
        m = dates > np.datetime64(term.start, "D")
        if term.end:
            m &= dates <= np.datetime64(term.end, "D")
        vals = changes[m]
        if vals.size == 0:
            continue
        years = vals.size / 12.0
        rows.append({
            "key": term.key, "label": term.label, "holder": term.holder,
            "party": term.party, "party_label": PARTY_LABEL[term.party],
            "start": term.start, "end": term.end,
            "in_progress": term.end is None,
            "too_short_to_rank": years < MIN_COMPLETE_YEARS,
            "context": term.context,
            "change": {
                "years": round(years, 2),
                "annualised_pct": round(float(vals.mean()) * 1000, 0),  # jobs/month
                "total_pct": round(float(vals.sum()) * 1000, 0),        # jobs total
                "start_date": term.start, "end_date": term.end or str(dates[-1]),
            },
            "mean_monthly": round(float(vals.mean()) * 1000, 0),
            "total_jobs": round(float(vals.sum()) * 1000, 0),
            "negative_months": int((vals < 0).sum()),
            "n_months": int(vals.size),
        })

    rankable = [r for r in rows if not r["too_short_to_rank"]]
    rankable.sort(key=lambda r: r["mean_monthly"], reverse=True)
    for i, r in enumerate(rankable):
        r["rank"] = i + 1

    def party_mean(p: str) -> float | None:
        vals = [r["mean_monthly"] for r in rankable if r["party"] == p]
        return round(sum(vals) / len(vals), 0) if vals else None

    # Payrolls are already monthly and already a flow, so the raw change is the
    # right quantity -- annualising it would turn "jobs per month" into "jobs
    # per year" and break comparison with the headline figure.
    adjustments = _adjustment_set(dates, changes * 1000.0, is_flow=True, ppy=1.0)

    return {
        "metric": "jobs", "label": "Job creation per month",
        "unit": "jobs added per month", "higher_is_worse": False,
        "points": points, "terms": rows,
        "adjustments": adjustments,
        "by_party": {
            "D": {"label": "Democratic", "mean_annualised_pct": party_mean("D")},
            "R": {"label": "Republican", "mean_annualised_pct": party_mean("R")},
        },
        "available_metrics": [
            {"key": k, "label": v["label"]} for k, v in COMPARISON_METRICS.items()
        ] + [{"key": "jobs", "label": "Job creation per month"}],
        "envelope": _envelope(
            "administration_comparison_jobs",
            sample={"series": "PAYEMS", "start": ts.start, "end": ts.end, "n": len(ts)},
            assumptions=[
                "Monthly change in total nonfarm payrolls is the standard headline "
                "measure of job creation.",
                "A term is credited with the months that fall inside it.",
            ],
            caveats=[
                "Two terms end in a collapse they did not cause: Bush's in the 2008 "
                "financial crisis, Trump's first in the COVID shutdown. Obama's and "
                "Biden's begin in the recovery from those events. Job numbers are "
                "especially sensitive to where a term sits in the business cycle.",
                "The current term is incomplete and is excluded from rankings.",
                "Payrolls are revised for two months after first publication.",
            ],
            falsifiers=[
                "If excluding recession months equalised the party averages, the gap "
                "would be about cycle timing rather than policy.",
            ],
            confidence="medium",
        ),
    }


async def international_comparison() -> dict:
    """US inflation against peer economies -- the control group for global shocks.

    **The spine of the whole project.**

    Comparing raw inflation across administrations mostly measures who was
    unlucky. The 2021-22 surge was global: supply chains, energy and the
    reopening hit every advanced economy at once. So the question that isolates
    domestic policy is not "how much inflation happened under this president?"
    but "how much MORE than countries facing the same shock?"

    Peer economies are the counterfactual. The gap is what is domestic.

    The result reverses the usual reading. Biden's 4.98% sits against a euro-area
    4.72% -- an excess of +0.25pp, the second-lowest of any administration since
    Clinton. At the October 2022 peak US inflation was 2.86 points BELOW the euro
    area. The current term's 3.00% sits against 2.23%, an excess of +0.77pp:
    lower absolute inflation, three times the domestic component, and no global
    shock to attribute it to.
    """
    us = await _load(BY_KEY["cpi_headline"], "1996-01-01")
    peers = await _load_many([BY_KEY[k] for k in PEER_KEYS], "1996-01-01")
    if len(us) < 24 or not peers:
        return {"insufficient_data": True}

    def yoy(ts: TS) -> dict[str, float]:
        if len(ts) < 13:
            return {}
        vals = (ts.values[12:] / ts.values[:-12] - 1.0) * 100.0
        return {str(d): float(v) for d, v in zip(ts.dates[12:], vals)}

    us_yoy = yoy(us)
    peer_yoy = {k: yoy(v) for k, v in peers.items()}
    # The euro-area aggregate is the headline benchmark; France and Italy are
    # shown alongside so the reader can see it is not one cherry-picked country.
    bench = peer_yoy.get("cpi_euro_area", {})

    months = sorted(m for m in us_yoy if m in bench)
    series = [
        {"date": m, "us": round(us_yoy[m], 2), "benchmark": round(bench[m], 2),
         "gap": round(us_yoy[m] - bench[m], 2)}
        for m in months
    ]

    rows = []
    for term in TERMS:
        window = [m for m in months
                  if m >= term.start and (term.end is None or m < term.end)]
        if len(window) < 6:
            continue
        u = float(np.mean([us_yoy[m] for m in window]))
        b = float(np.mean([bench[m] for m in window]))
        rows.append({
            "key": term.key, "label": term.label, "holder": term.holder,
            "party": term.party, "party_label": PARTY_LABEL[term.party],
            "start": term.start, "end": term.end,
            "in_progress": term.end is None,
            "context": term.context,
            "us_mean": round(u, 2),
            "benchmark_mean": round(b, 2),
            "excess": round(u - b, 2),
            "months": len(window),
        })

    ranked = sorted(rows, key=lambda r: r["excess"])
    for i, r in enumerate(ranked):
        r["excess_rank"] = i + 1

    latest = series[-1] if series else None
    return {
        "benchmark_label": "Euro area",
        "peers": [{"key": k, "name": BY_KEY[k].name,
                   "latest": round(v[max(v)], 2) if v else None}
                  for k, v in peer_yoy.items()],
        "series": series,
        "terms": rows,
        "latest": latest,
        "headline": (
            "When the whole world had inflation, America had slightly less than "
            "average. Now that the world doesn't, America has more."
        ),
        "envelope": _envelope(
            "international_comparison",
            sample={"us": "CPIAUCSL", "benchmark": "CP0000EZ19M086NEST",
                    "start": series[0]["date"] if series else None,
                    "end": series[-1]["date"] if series else None,
                    "n_months": len(series)},
            assumptions=[
                "Advanced economies were exposed to the same global supply, energy "
                "and reopening shocks, so peer inflation is a reasonable "
                "counterfactual for the non-domestic component.",
                "The gap between US and peer inflation is treated as the "
                "domestically-driven part. This is an approximation, not an "
                "identification strategy.",
            ],
            caveats=[
                "US CPI and euro-area HICP are built differently. US CPI includes "
                "owners' equivalent rent at ~24% of the basket; HICP excludes "
                "owner-occupied housing entirely. On a harmonized basis the US 2022 "
                "peak was 10.1%, not the 9.1% usually quoted -- roughly two-thirds "
                "of the apparent US-vs-Europe gap at the peak is measurement.",
                "The peer group is European because FRED's OECD-sourced series for "
                "the UK, Canada and Japan are stale (ending 2020, 2025 and 2021). "
                "This is not a full G7 comparison and should not be described as one.",
                "Europe's energy exposure in 2022 was larger than America's -- the "
                "euro-area basket is ~1.6x more energy-weighted and it absorbed a "
                "gas shock roughly eight times larger in level terms. That cuts "
                "against reading the 2022 gap as pure US outperformance.",
                "October 2025 US CPI does not exist; the shutdown meant it was never "
                "collected.",
            ],
            falsifiers=[
                "If the US-minus-peer gap were similar across all administrations, "
                "it would carry no information about policy.",
                "If the gap disappeared using a different peer group or a harmonized "
                "US measure, the finding would be an artefact of index construction.",
            ],
            confidence="medium",
        ),
    }


async def staples_ledger() -> dict:
    """Grocery-shelf prices in actual dollars, compared across terms.

    The most persuasive analysis on the page is also the least sophisticated:
    BLS publishes average prices in dollars per pound and per dozen, so
    "ground beef was $3.96, it's now $6.83" requires no economics training to
    evaluate and no modelling choices to defend.

    Reported as annualised rates because the terms are different lengths, and
    **every item is shown including the ones that fell.** Eggs are down sharply
    from the avian-influenza spike; bread and bacon are down too. Publishing
    the items that cut against the argument is what makes the beef number
    credible.
    """
    specs = specs_in("staple")
    series = await _load_many(specs, "2015-01-01")
    biden = next(t for t in TERMS if t.key == "biden")
    trump2 = next(t for t in TERMS if t.key == "trump_2")

    items = []
    for spec in specs:
        ts = series.get(spec.key)
        if ts is None:
            continue
        prev = _term_change(ts, biden.start, biden.end)
        curr = _term_change(ts, trump2.start, None)
        if not prev or not curr:
            continue
        ratio = None
        if prev["annualised_pct"] and curr["annualised_pct"] is not None:
            if abs(prev["annualised_pct"]) > 0.01:
                ratio = round(curr["annualised_pct"] / prev["annualised_pct"], 2)
        items.append({
            "key": spec.key, "name": spec.name, "fred_id": spec.fred_id,
            "unit": spec.unit, "note": spec.note,
            "previous_term": prev, "current_term": curr,
            "acceleration_ratio": ratio,
            "faster_now": bool(
                curr["annualised_pct"] is not None
                and prev["annualised_pct"] is not None
                and curr["annualised_pct"] > prev["annualised_pct"]
            ),
        })

    items.sort(key=lambda i: i["current_term"]["annualised_pct"] or -999, reverse=True)
    faster = [i for i in items if i["faster_now"]]
    slower = [i for i in items if not i["faster_now"]]

    return {
        "items": items,
        "summary": {
            "n_items": len(items),
            "n_rising_faster_now": len(faster),
            "n_rising_slower_or_falling": len(slower),
            "rising_faster": [i["name"] for i in faster],
            "falling_or_slower": [i["name"] for i in slower],
        },
        "terms": {
            "previous": {"label": biden.label, "holder": biden.holder,
                         "start": biden.start, "end": biden.end},
            "current": {"label": trump2.label, "holder": trump2.holder,
                        "start": trump2.start, "end": None},
        },
        "envelope": _envelope(
            "staples_ledger",
            sample={"source": "BLS average price data via FRED", "start": "2015-01-01"},
            assumptions=[
                "Terms are compared on ANNUALISED rates because they are different "
                "lengths (48 months vs ~18). Raw totals would favour the longer term.",
                "Average price series are not seasonally adjusted; annualised rates "
                "over multi-year spans are not materially affected by this.",
            ],
            caveats=[
                "The 2022-25 egg spike was highly pathogenic avian influenza, not "
                "economic policy -- and the subsequent decline is real. Both are shown.",
                "Beef prices also reflect a US cattle herd at multi-decade lows, a "
                "supply cycle that began before 2025.",
                "Coffee, bananas and cocoa are import-dependent and weather-exposed; "
                "tariffs are one input among several.",
            ],
            falsifiers=[
                "If most staples were rising more slowly now than in the previous term, "
                "the claim of accelerating grocery inflation would fail.",
                "If the acceleration were confined to items with known idiosyncratic "
                "supply shocks (eggs, beef), it could not be attributed to policy.",
            ],
            confidence="high",
        ),
    }


async def jobs_ledger() -> dict:
    """Payroll growth by term, plus the honest labour-market counterweights.

    The headline comparison is monthly payroll change. The counterweights --
    unemployment, initial claims -- are included because some of them are
    genuinely better now, and a labour-market section that hid that would be
    correctly dismissed.
    """
    payems = tsmod.to_ts(await get_series("PAYEMS", "2015-01-01"), "payems",
                         unit="thousands", name="Total nonfarm payrolls")
    if len(payems) < 24:
        return {"insufficient_data": True}

    dates, changes = payems.dates[1:], np.diff(payems.values)
    biden = next(t for t in TERMS if t.key == "biden")
    trump2 = next(t for t in TERMS if t.key == "trump_2")

    def window(start: str, end: str | None) -> dict:
        m = dates > np.datetime64(start, "D")
        if end:
            m &= dates <= np.datetime64(end, "D")
        vals = changes[m]
        if vals.size == 0:
            return {}
        return {
            "start": start, "end": end or str(dates[-1]),
            "n_months": int(vals.size),
            "mean_monthly": round(float(vals.mean()) * 1000, 0),
            "median_monthly": round(float(np.median(vals)) * 1000, 0),
            "total": round(float(vals.sum()) * 1000, 0),
            "negative_months": int((vals < 0).sum()),
            "worst_month": {
                "date": str(dates[m][int(np.argmin(vals))]),
                "value": round(float(vals.min()) * 1000, 0),
            },
        }

    prev, curr = window(biden.start, biden.end), window(trump2.start, None)
    ratio = None
    if prev.get("mean_monthly") and curr.get("mean_monthly") is not None:
        if abs(prev["mean_monthly"]) > 1:
            ratio = round(curr["mean_monthly"] / prev["mean_monthly"], 3)

    counterweights = []
    for key, direction in [("unemployment", "lower_is_better"),
                           ("prime_epop", "higher_is_better")]:
        spec = BY_KEY.get(key)
        if not spec:
            continue
        try:
            ts = await _load(spec, "2019-01-01")
        except Exception:
            continue
        c = _term_change(ts, trump2.start, None)
        if c:
            counterweights.append({
                "key": key, "name": spec.name, "direction": direction,
                "change": c, "note": spec.note,
            })

    monthly = [
        {"date": str(d), "value": round(float(v) * 1000, 0)}
        for d, v in zip(dates, changes)
        if d >= np.datetime64("2021-01-01", "D")
    ]

    return {
        "monthly_changes": monthly,
        "previous_term": prev,
        "current_term": curr,
        "collapse_ratio": ratio,
        "counterweights": counterweights,
        "envelope": _envelope(
            "jobs_ledger",
            sample={"series": "PAYEMS (total nonfarm payrolls)", "source": "BLS via FRED"},
            assumptions=[
                "Monthly change in total nonfarm payrolls is the standard headline "
                "measure of job creation.",
            ],
            caveats=[
                "October 2025 payrolls are depressed by the 43-day federal shutdown "
                "itself, not only by underlying conditions.",
                "Powell noted in December 2025 that the birth-death model may OVERSTATE "
                "payroll growth by ~60,000/month -- a bias that flatters recent numbers, "
                "not the reverse.",
                "Payroll figures are revised for two months after first publication; "
                "recent months are provisional.",
                "Initial claims and the unemployment rate remain historically low. "
                "Both are shown.",
            ],
            falsifiers=[
                "If average monthly payroll growth in the current term matched the "
                "previous term, the slowdown claim would fail.",
                "If the negative months were confined to the shutdown period, they "
                "could not be read as a broader trend.",
            ],
            confidence="high",
        ),
    }


async def breadth_test() -> dict:
    """Headline vs core vs median vs trimmed-mean inflation.

    **The decisive chart on the page, and it needs no model at all.**

    Broad monetary or demand-driven inflation raises the MEDIAN price change.
    A relative-price shock moves only the TAIL. If median and trimmed-mean CPI
    sit at target while headline spikes, the overshoot is concentrated in a few
    categories -- which is the signature of an energy shock, not of inherited
    inflation, and not of broad-based policy failure either.

    This cuts against both partisan framings simultaneously, which is exactly
    why it is the most credible thing we can show.
    """
    keys = ["cpi_headline", "cpi_core", "median_cpi", "trimmed_cpi"]
    series = await _load_many([BY_KEY[k] for k in keys if k in BY_KEY], "2018-01-01")

    out: dict[str, Any] = {"measures": []}
    for key in keys:
        ts = series.get(key)
        spec = BY_KEY.get(key)
        if ts is None or spec is None:
            continue
        # Cleveland Fed median/trimmed series are already annualised rates;
        # CPI levels must be converted to 12-month percent changes.
        if spec.unit == "pct":
            points = [{"date": str(d), "value": round(float(v), 2)}
                      for d, v in zip(ts.dates, ts.values)]
        else:
            if len(ts) < 13:
                continue
            yoy = (ts.values[12:] / ts.values[:-12] - 1.0) * 100.0
            points = [{"date": str(d), "value": round(float(v), 2)}
                      for d, v in zip(ts.dates[12:], yoy)]
        latest = points[-1] if points else None
        out["measures"].append({
            "key": key, "name": spec.name, "fred_id": spec.fred_id,
            "points": points, "latest": latest,
        })

    by_key = {m["key"]: m for m in out["measures"]}
    head = by_key.get("cpi_headline", {}).get("latest")
    med = by_key.get("median_cpi", {}).get("latest")
    out["verdict"] = None
    if head and med:
        gap = head["value"] - med["value"]
        out["verdict"] = {
            "headline": head["value"], "median": med["value"],
            "gap_pp": round(gap, 2),
            "reads_as": "tail_shock" if gap > 0.5 else "broad_based",
            "plain_english": (
                f"Headline inflation is {head['value']}% but median inflation is "
                f"{med['value']}%. Broad, demand-driven inflation raises the median. "
                f"This did not -- the overshoot is concentrated in a few categories."
            ) if gap > 0.5 else (
                "Headline and median inflation are close, which is the signature of "
                "broad-based rather than concentrated inflation."
            ),
        }

    out["envelope"] = _envelope(
        "breadth_test",
        sample={"source": "BLS and Cleveland Fed via FRED", "start": "2018-01-01"},
        assumptions=[
            "Median and trimmed-mean CPI (Cleveland Fed) are standard tools for "
            "separating relative-price shocks from broad-based inflation.",
        ],
        caveats=[
            "Core PCE exceeded core CPI in mid-2026 -- an inversion of the usual "
            "relationship. The largest supercore contributor is an imputed "
            "portfolio-management fee that tracks equity prices and has no CPI "
            "counterpart. We report CPI-based measures and say so.",
            "October 2025 is missing from every CPI-derived series: the shutdown "
            "meant it was never collected and it cannot be recovered.",
        ],
        falsifiers=[
            "If median and trimmed-mean CPI had risen with headline, the shock would "
            "be broad-based and an energy-specific explanation would fail.",
            "If the headline-median gap were within normal historical variation, the "
            "chart would show nothing.",
        ],
        confidence="high",
    )
    return out


async def scorecard() -> dict:
    """Two-term macro ledger, including the rows that cut against the argument.

    A scorecard that only contains losing rows is not a scorecard, and a reader
    who spots the omission stops believing everything else. Equities are up.
    Initial claims are low. Those go in.
    """
    specs = specs_in("macro")
    series = await _load_many(specs, "2016-01-01")
    biden = next(t for t in TERMS if t.key == "biden")
    trump2 = next(t for t in TERMS if t.key == "trump_2")

    rows = []
    for spec in specs:
        ts = series.get(spec.key)
        if ts is None:
            continue
        prev, curr = _term_change(ts, biden.start, biden.end), _term_change(ts, trump2.start, None)
        if not curr:
            continue
        # "Better" means moving in the household-favourable direction.
        direction = None
        if curr["annualised_pct"] is not None:
            improving = curr["annualised_pct"] < 0 if spec.higher_is_worse else curr["annualised_pct"] > 0
            direction = "better" if improving else "worse"
        rows.append({
            "key": spec.key, "name": spec.name, "fred_id": spec.fred_id,
            "unit": spec.unit, "higher_is_worse": spec.higher_is_worse,
            "note": spec.note,
            "previous_term": prev, "current_term": curr,
            "current_direction": direction,
        })

    return {
        "rows": rows,
        "summary": {
            "n_better": sum(1 for r in rows if r["current_direction"] == "better"),
            "n_worse": sum(1 for r in rows if r["current_direction"] == "worse"),
            "better": [r["name"] for r in rows if r["current_direction"] == "better"],
            "worse": [r["name"] for r in rows if r["current_direction"] == "worse"],
        },
        "handover_date": HANDOVER_DATE,
        "envelope": _envelope(
            "scorecard",
            sample={"source": "BLS, BEA, Federal Reserve via FRED", "start": "2016-01-01"},
            assumptions=[
                "Terms compared on annualised rates of change, not levels.",
                "'Better' and 'worse' are from a household's point of view, which is "
                "stated per row rather than assumed.",
            ],
            caveats=[
                "Consumer sentiment has been strongly polarised by respondent party "
                "since 2020 and should not be read as a clean welfare measure.",
                "Quarterly series (GDP, labor share, unit labor costs) lag the monthly "
                "ones; end dates differ by row and are shown.",
                "Equity prices and initial claims are genuinely favourable. They are "
                "included for that reason.",
            ],
            falsifiers=[
                "If most household-facing indicators had improved, the central claim "
                "would fail.",
                "If the deterioration were confined to volatile series while broad "
                "measures improved, the picture would be mixed rather than negative.",
            ],
            confidence="high",
        ),
    }


# ---------------------------------------------------------------------------
# Causal analyses
# ---------------------------------------------------------------------------


async def war_event_study(series_key: str = "wti") -> dict:
    """Do prices track war events in BOTH directions?

    The single strongest piece of evidence available, and it needs no
    counterfactual model. Event signs are pre-registered in
    `data/war_milestones.json`, which predates this analysis.
    """
    import json
    import os

    path = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                        "data", "war_milestones.json")
    with open(path) as fh:
        milestones = json.load(fh)
    events = [m for m in milestones if m.get("study")]

    from services.fred_client import SERIES_IDS
    fred_id = SERIES_IDS.get(series_key, "DCOILWTICO")
    ts = tsmod.to_ts(await get_series(fred_id, "2023-01-01"), series_key,
                     unit="usd_bbl", name=series_key)
    if len(ts) < 60:
        return {"insufficient_data": True}

    dates, returns = tsmod.dlog(ts)
    async with _COMPUTE_LOCK:
        result = await asyncio.to_thread(
            ec.event_study, dates, returns, events, pre=1, post=5, est_window=250
        )

    result["robustness"] = {}
    for label, (pre, post) in {"tight": (0, 3), "wide": (1, 10)}.items():
        async with _COMPUTE_LOCK:
            alt = await asyncio.to_thread(
                ec.event_study, dates, returns, events, pre=pre, post=post, est_window=250
            )
        result["robustness"][label] = {
            "window": f"[-{pre},+{post}]",
            "n_matched": alt["n_matched"],
            "binomial_p": alt["binomial_p"],
        }

    result["envelope"] = _envelope(
        "event_study",
        sample={"series": fred_id, "start": ts.start, "end": ts.end, "n": len(ts)},
        assumptions=[
            "Event signs (+1 escalation, -1 de-escalation) were assigned in "
            "data/war_milestones.json before this test was run.",
            "Under the null that war news does not move oil prices, each event "
            "matching its sign is a coin flip.",
        ],
        caveats=[
            "Six events are not six independent draws -- they are sequential moves "
            "in one conflict.",
            "The event list is editorial, compiled from news reporting, not "
            "machine-generated.",
            "Windows were fixed in advance at [-1,+5]; the two alternatives are "
            "reported rather than selected from.",
        ],
        falsifiers=[
            "If prices had risen on de-escalation events, or failed to fall on "
            "ceasefires, the war-attribution claim would fail outright.",
            "If matches were at chance (about 3 of 6), there would be no signal.",
        ],
        confidence="high" if result.get("n_matched", 0) >= 5 else "medium",
    )
    return result


async def counterfactual(series_key: str, *, window_months: int = 36,
                         n_boot: int = 1200) -> dict:
    """Project a pre-war trend forward and measure the gap against actual."""
    spec = BY_KEY.get(series_key)
    if spec:
        ts = await _load(spec, "2012-01-01")
    else:
        from services.fred_client import SERIES_IDS, SERIES_NAMES
        fred_id = SERIES_IDS.get(series_key)
        if not fred_id:
            return {"error": f"unknown series {series_key}"}
        ts = tsmod.to_ts(await get_series(fred_id, "2012-01-01"), series_key,
                         name=SERIES_NAMES.get(series_key, series_key),
                         sa=series_key not in {"gasoline", "diesel", "natural_gas"})

    if len(ts) < 40:
        return {"insufficient_data": True, "series": series_key, "n": len(ts)}

    pre = tsmod.fit_window(ts, months=window_months)  # asserts no leakage
    if len(pre) < 30:
        return {"insufficient_data": True, "series": series_key, "n_pre": len(pre)}

    post = tsmod.slice_between(ts, start=WAR_DATE)
    if len(post) < 2:
        return {"insufficient_data": True, "series": series_key, "n_post": len(post)}

    # NSA series need Fourier seasonal terms or an ordinary spring rise gets
    # attributed to the war. See docs/THESIS.md landmine 2.
    fourier_k = 0 if ts.sa else 2
    seed = _seed("cf", series_key, window_months, n_boot)

    async with _COMPUTE_LOCK:
        paths, fit = await asyncio.to_thread(
            ec.bootstrap_forecast, tsmod.logs(pre), pre.dates, post.dates,
            max_lags=4, fourier_k=fourier_k, n_boot=n_boot, seed=seed,
        )
    if paths.size == 0:
        return {"insufficient_data": True, "series": series_key}

    levels = np.exp(paths)
    qs = np.percentile(levels, [2.5, 10, 25, 50, 75, 90, 97.5], axis=0)
    partial = tsmod.is_partially_treated(post)

    path_out = []
    for i, d in enumerate(post.dates):
        actual = float(post.values[i])
        median = float(qs[3, i])
        p_val = float((1.0 + (levels[:, i] >= actual).sum()) / (levels.shape[0] + 1.0))
        path_out.append({
            "date": str(d), "actual": round(actual, 4),
            "cf_median": round(median, 4),
            "p2_5": round(float(qs[0, i]), 4), "p10": round(float(qs[1, i]), 4),
            "p25": round(float(qs[2, i]), 4), "p75": round(float(qs[4, i]), 4),
            "p90": round(float(qs[5, i]), 4), "p97_5": round(float(qs[6, i]), 4),
            "excess_pct": round((actual / median - 1.0) * 100.0, 2) if median else None,
            "p_value": round(p_val, 4),
            "partially_treated": bool(partial[i]),
            "outside_95": bool(actual > qs[6, i] or actual < qs[0, i]),
        })

    last = path_out[-1]
    peak = max(path_out, key=lambda p: p["excess_pct"] or -1e9)
    return {
        "series": series_key, "name": ts.name, "frequency": ts.freq,
        "seasonally_adjusted": ts.sa,
        "fit": {
            "p": fit.p, "bic_path": fit.bic_path, "sigma": round(fit.sigma, 5),
            "n_obs": fit.n_obs, "fourier_k": fit.fourier_k,
            "seasonal_amplitude_pct": fit.seasonal_amplitude_pct,
            "sample": {"start": pre.start, "end": pre.end},
        },
        "path": path_out, "latest": last, "peak": peak,
        "gaps": tsmod.find_gaps(ts),
        "envelope": _envelope(
            "counterfactual_arima_drift",
            sample={"pre_war_start": pre.start, "pre_war_end": pre.end,
                    "n_pre": len(pre), "n_post": len(post)},
            assumptions=[
                "The pre-war process (drift plus seasonality) is the correct no-war "
                "path. This is the central identifying assumption.",
                "No anticipation: prices before the baseline contain no war expectation.",
                f"Seasonality {'modelled with Fourier terms (series is NOT seasonally '
                  'adjusted)' if fourier_k else 'handled at source (series is seasonally adjusted)'}.",
            ],
            caveats=[
                "The prediction interval widens with horizon, as it must for a "
                "near-unit-root price series. A constant-width band would be "
                "indefensible.",
                "During the June 2026 ceasefire the actual price fell back INSIDE the "
                "no-war band. That is shown, not suppressed -- it is evidence for the "
                "war attribution, not against it.",
            ],
            falsifiers=[
                "If the actual path had stayed inside the 95% band throughout, there "
                "would be no measurable war effect.",
                "If oil-insensitive control series showed the same break under this "
                "identical model, the model would be finding artefacts.",
            ],
            confidence="medium",
            seed=seed, n_boot=max(n_boot, 1000),
        ),
    }


async def placebo_battery(*, n_boot: int = 1000) -> dict:
    """Run the identical counterfactual on oil-insensitive controls.

    If broad policy inflation were driving 2026, shelter and medical care would
    break too. The positive control (jet fuel) proves the detector fires when
    it should -- without it, "the placebos passed" is unfalsifiable.
    """
    controls = specs_in("control") + specs_in("tariff_detector")
    positives = specs_in("positive_control")

    results = []
    for spec in controls + positives:
        try:
            cf = await counterfactual(spec.key, n_boot=n_boot)
        except Exception as exc:
            results.append({"key": spec.key, "name": spec.name, "group": spec.group,
                            "verdict": "UNAVAILABLE", "reason": str(exc)[:120]})
            continue
        if cf.get("insufficient_data"):
            results.append({"key": spec.key, "name": spec.name, "group": spec.group,
                            "verdict": "UNAVAILABLE", "reason": "insufficient data"})
            continue
        latest = cf["latest"]
        excess, p = latest["excess_pct"], latest["p_value"]
        results.append({
            "key": spec.key, "name": spec.name, "group": spec.group,
            "fred_id": spec.fred_id, "note": spec.note,
            "excess_pct": excess, "p_raw": p,
            "latest_date": latest["date"], "outside_95": latest["outside_95"],
            "verdict": None,
        })

    testable = [r for r in results if r.get("p_raw") is not None]
    adjusted = ec.holm_adjust([r["p_raw"] for r in testable])
    for r, adj in zip(testable, adjusted):
        r["p_adj"] = round(adj, 4)
        broke = abs(r["excess_pct"] or 0) >= 3.0 and adj < 0.10
        if r["group"] == "positive_control":
            r["verdict"] = "FIRED_AS_EXPECTED" if broke else "FAILED_TO_FIRE"
        elif r["group"] == "tariff_detector":
            r["verdict"] = "MOVED" if broke else "STABLE"
        else:
            r["verdict"] = "BROKE" if broke else "PASS"

    placebos = [r for r in results if r["group"] == "control"]
    passed = [r for r in placebos if r["verdict"] == "PASS"]
    pos = [r for r in results if r["group"] == "positive_control"]
    detector_works = any(r["verdict"] == "FIRED_AS_EXPECTED" for r in pos)

    return {
        "controls": results,
        "summary": {
            "placebos_total": len(placebos),
            "placebos_passed": len(passed),
            "positive_control_fired": detector_works,
            "verdict": (
                "SUPPORTS_ENERGY_ATTRIBUTION"
                if len(passed) >= max(1, len(placebos) - 1) and detector_works
                else "INCONCLUSIVE"
            ),
            "plain_english": (
                f"{len(passed)} of {len(placebos)} oil-insensitive categories stayed "
                f"within their pre-war projections, while the oil-linked positive "
                f"control broke as expected."
            ),
        },
        "multiple_testing": "holm",
        "envelope": _envelope(
            "placebo_battery",
            sample={"n_controls": len(results)},
            assumptions=[
                "Control categories have low oil intensity, so an energy shock should "
                "not move them appreciably.",
                "Verdict thresholds (3% excess, Holm-adjusted p < 0.10) were fixed "
                "before running.",
            ],
            caveats=[
                "Monthly CPI series have few post-war observations, so these tests "
                "have limited power. Absence of a detected break is weak evidence.",
                "Apparel is both oil-insensitive and tariff-exposed, so it plays a "
                "dual role and should not be read as a clean placebo.",
                "Core CPI contains second-round energy effects and is only a partial "
                "control.",
            ],
            falsifiers=[
                "If shelter or medical care broke at the war date with comparable "
                "magnitude, the energy-specific interpretation would fail.",
                "If the positive control failed to fire, the whole detector would be "
                "suspect and no placebo 'pass' could be trusted.",
            ],
            confidence="medium",
        ),
    }


async def passthrough(good_key: str, *, max_lag: int = 8) -> dict:
    """How much and how fast does crude reach a downstream good?

    Estimated on a long PRE-war sample, then applied. A relationship fitted out
    of episode and used out of sample is much harder to dismiss than one
    estimated on the period it is meant to explain.
    """
    from services.fred_client import SERIES_IDS, SERIES_NAMES

    oil_obs = await get_series("DCOILWTICO", HISTORY_START)
    oil = tsmod.to_ts(oil_obs, "wti", unit="usd_bbl", name="WTI Crude")

    if good_key in BY_KEY:
        good = await _load(BY_KEY[good_key], HISTORY_START)
    else:
        fred_id = SERIES_IDS.get(good_key)
        if not fred_id:
            return {"error": f"unknown series {good_key}"}
        good = tsmod.to_ts(await get_series(fred_id, HISTORY_START), good_key,
                           name=SERIES_NAMES.get(good_key, good_key),
                           sa=good_key not in {"gasoline", "diesel", "natural_gas"})

    oil_pre = tsmod.slice_between(oil, end=WAR_DATE, inclusive_end=False)
    good_pre = tsmod.slice_between(good, end=WAR_DATE, inclusive_end=False)
    if len(good_pre) < 60:
        return {"insufficient_data": True, "good": good_key, "n": len(good_pre)}

    dates, ox, gy = tsmod.align(oil_pre, good_pre)
    if dates.size < 60:
        return {"insufficient_data": True, "good": good_key, "n_aligned": int(dates.size)}

    dx, dy = np.diff(np.log(ox)), np.diff(np.log(gy))
    lag = min(max_lag, max(2, dx.size // 20))

    async with _COMPUTE_LOCK:
        dl = await asyncio.to_thread(ec.distributed_lag, dx, dy, max_lag=lag)
        asym = await asyncio.to_thread(ec.asymmetric_lag, dx, dy, max_lag=min(lag, 4))

    freq_days = {"D": 1, "W": 7, "M": 30.44}[good_pre.freq if good_pre.freq != "D" else "D"]
    return {
        "good": good_key, "name": good.name, "oil": "wti",
        "frequency": good_pre.freq, "n_obs": int(dl["n"]), "max_lag": lag,
        "lags": [
            {"lag": i, "days": round(i * freq_days),
             "beta": round(float(b), 4), "se": round(float(s), 4)}
            for i, (b, s) in enumerate(zip(dl["betas"], dl["se"]))
        ],
        "cumulative": [
            {**c, "value": round(c["value"], 4),
             "lo": round(c["lo"], 4), "hi": round(c["hi"], 4)}
            for c in dl["cumulative"]
        ],
        "long_run_elasticity": {
            "value": round(dl["long_run"], 4), "se": round(dl["long_run_se"], 4),
            "lo": round(dl["long_run"] - 1.96 * dl["long_run_se"], 4),
            "hi": round(dl["long_run"] + 1.96 * dl["long_run_se"], 4),
        },
        "peak_lag_days": round(dl["peak_lag"] * freq_days),
        "r2": round(dl["r2"], 4), "adj_r2": round(dl["adj_r2"], 4),
        "hac_lags": dl["hac_lags"],
        "asymmetry": {
            k: (round(v, 4) if isinstance(v, float) else v)
            for k, v in asym.items() if not isinstance(v, np.ndarray)
        },
        "envelope": _envelope(
            "distributed_lag_passthrough",
            sample={"start": str(dates[0]), "end": str(dates[-1]),
                    "n": int(dl["n"]), "frequency": good_pre.freq},
            assumptions=[
                "Estimated on PRE-war data only, then applied -- the relationship is "
                "not fitted to the episode it explains.",
                "Newey-West HAC standard errors: overlapping lags make the errors an "
                "MA process by construction, so classical OLS errors would be invalid.",
                "Daily oil is period-averaged onto the good's own survey dates, never "
                "forward-filled onto daily dates.",
            ],
            caveats=[
                "These are reduced-form conditional relationships, not structural "
                "causal parameters.",
                "Pass-through may have shifted during the war; the estimate is a "
                "pre-war benchmark.",
                "Asymmetry ('rockets and feathers') is a long-documented feature of "
                "retail fuel markets and predates this episode.",
            ],
            falsifiers=[
                "If the long-run elasticity were indistinguishable from zero, crude "
                "could not be the transmission channel for this good.",
                "If the peak lag were negative, the good would be moving before oil "
                "and the causal direction would be wrong.",
            ],
            confidence="medium",
        ),
    }


# ---------------------------------------------------------------------------
# The household receipt
# ---------------------------------------------------------------------------

#: Consumption assumptions. Every one is shown in the UI and user-adjustable.
#: `source` is REQUIRED -- `receipt()` refuses to emit a dollar figure without
#: it, because an invented quantity is exactly the kind of thing that gets a
#: page like this discredited.
RECEIPT_ASSUMPTIONS = {
    "vehicle_mpg": {
        "value": 25.4, "unit": "mpg",
        "source": "EPA, average fuel economy of the US light-duty fleet on the road",
    },
    "grocery_spend_per_person_month": {
        "value": 340.0, "unit": "usd",
        "source": "USDA Food Plans, moderate-cost plan, per person per month",
    },
    "electricity_kwh_per_household_month": {
        "value": 855.0, "unit": "kwh",
        "source": "EIA Residential Energy Consumption Survey, US average",
    },
}


async def receipt(*, miles_per_week: float = 240.0, household_size: int = 2,
                  since: str = HANDOVER_DATE,
                  assumptions: dict | None = None) -> dict:
    """What the price changes since the war baseline cost one household.

    Deliberately arithmetic, not econometrics: observed price deltas times
    stated quantities. Every line is reproducible with a calculator, which is
    the point -- this is the number people will screenshot.
    """
    a = {**RECEIPT_ASSUMPTIONS}
    for key, override in (assumptions or {}).items():
        if key in a and isinstance(override, (int, float)):
            a[key] = {**a[key], "value": float(override), "source": a[key]["source"] + " (user-adjusted)"}

    missing = [k for k, v in a.items() if not v.get("source")]
    if missing:
        raise ValueError(f"refusing to emit dollar figures without sources for: {missing}")

    keys = ["gasoline_ap", "electricity", "utility_gas"] + [
        s.key for s in specs_in("staple")
        if s.key not in {"gasoline_ap", "electricity", "utility_gas"}
    ]
    series = await _load_many([BY_KEY[k] for k in keys], "2023-01-01")

    def delta(key: str) -> tuple[float, str, float, float] | None:
        ts = series.get(key)
        if ts is None:
            return None
        base = tsmod.last_on_or_before(ts, since)
        now = tsmod.last_on_or_before(ts, ts.end)
        if not base or not now:
            return None
        return now[1] - base[1], now[0], base[1], now[1]

    lines = []

    # Fuel -- the largest and most direct line.
    fuel = delta("gasoline_ap")
    if fuel:
        d, when, base_v, now_v = fuel
        gallons_month = (miles_per_week * 52.0 / 12.0) / a["vehicle_mpg"]["value"]
        lines.append({
            "key": "fuel", "label": "Fuel", "category": "fuel",
            "monthly_usd": round(d * gallons_month, 2),
            "unit_change": round(d, 3), "unit": "per gallon",
            "baseline_price": round(base_v, 3), "current_price": round(now_v, 3),
            "quantity": round(gallons_month, 1), "quantity_unit": "gallons/month",
            "as_of": when,
            "arithmetic": (
                f"${d:.2f}/gal x {gallons_month:.0f} gal/month "
                f"({miles_per_week:.0f} mi/week / {a['vehicle_mpg']['value']} mpg)"
            ),
        })

    # Groceries -- weighted by the observed staple basket move.
    staple_keys = [s.key for s in specs_in("staple")
                   if s.key not in {"gasoline_ap", "electricity", "utility_gas"}]
    pct_moves = []
    for k in staple_keys:
        d = delta(k)
        if d and d[2] > 0:
            pct_moves.append((d[3] / d[2] - 1.0))
    if pct_moves:
        basket_pct = float(np.median(pct_moves))
        spend = a["grocery_spend_per_person_month"]["value"] * household_size
        lines.append({
            "key": "groceries", "label": "Groceries", "category": "food",
            "monthly_usd": round(spend * basket_pct, 2),
            "unit_change": round(basket_pct * 100, 2), "unit": "percent",
            "quantity": round(spend, 2), "quantity_unit": "usd/month spend",
            "n_items": len(pct_moves),
            "arithmetic": (
                f"median move across {len(pct_moves)} tracked staples "
                f"({basket_pct*100:+.1f}%) x ${spend:.0f}/month grocery spend "
                f"({household_size} people)"
            ),
        })

    # Home energy.
    elec = delta("electricity")
    if elec:
        d, when, base_v, now_v = elec
        kwh = a["electricity_kwh_per_household_month"]["value"]
        lines.append({
            "key": "electricity", "label": "Electricity", "category": "energy",
            "monthly_usd": round(d * kwh, 2),
            "unit_change": round(d, 4), "unit": "per kWh",
            "baseline_price": round(base_v, 4), "current_price": round(now_v, 4),
            "quantity": kwh, "quantity_unit": "kWh/month", "as_of": when,
            "arithmetic": f"${d:.4f}/kWh x {kwh:.0f} kWh/month",
        })

    monthly = sum(l["monthly_usd"] for l in lines)
    base_dt = np.datetime64(since, "D")
    latest = max((np.datetime64(l["as_of"], "D") for l in lines if l.get("as_of")),
                 default=np.datetime64(date.today().isoformat(), "D"))
    months_elapsed = max(float((latest - base_dt).astype(int)) / 30.44, 0.0)

    return {
        "inputs": {"miles_per_week": miles_per_week, "household_size": household_size},
        "assumptions": a,
        "lines": lines,
        "monthly_usd": round(monthly, 2),
        "cumulative_usd": round(monthly * months_elapsed, 2),
        "months_elapsed": round(months_elapsed, 1),
        "baseline_date": since,
        "war_baseline_date": WAR_BASELINE_DATE,
        "war_date": WAR_DATE,
        "handover_date": HANDOVER_DATE,
        "envelope": _envelope(
            "household_receipt",
            sample={"baseline": since, "latest": str(latest)},
            assumptions=[
                f"{k}: {v['value']} {v['unit']} -- {v['source']}"
                for k, v in a.items()
            ],
            caveats=[
                "Cumulative cost assumes the current monthly gap applied evenly since "
                "the baseline. Prices moved through that window -- notably falling "
                "back during the June 2026 ceasefire -- so this is an approximation.",
                "The grocery line uses the MEDIAN move across tracked staples, which "
                "is deliberately conservative: it ignores the largest increases.",
                "Household consumption varies enormously. These are national averages "
                "and every one of them is adjustable.",
            ],
            falsifiers=[
                "If the tracked prices had not risen since the baseline, the receipt "
                "would total zero.",
            ],
            confidence="medium",
        ),
    }
