"""V3 attribution endpoints.

All GET, all cached with a long TTL -- these results cost seconds of CPU and
their inputs (mostly monthly BLS releases) update weekly at best.

Heavy numpy runs inside `asyncio.to_thread` in the service layer. That is not
optional here: a 0.8s bootstrap on the event loop blocks every other request
including `/api/health`, which Fly's health check hits every 30s with a 5s
timeout -- enough to flap the machine into a restart loop.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from services import attribution as attr
from services.cache import get_cached, set_cached

router = APIRouter(prefix="/api/attribution", tags=["attribution"])
log = logging.getLogger(__name__)

#: 7 days. Bump ATTR_VERSION to invalidate everything after a methodology change.
ATTR_TTL = 7 * 86400
ATTR_VERSION = "v3.0.0"


async def _cached(name: str, params: str, compute):
    """Run `compute()` behind the shared SQLite cache."""
    key = f"attr:{ATTR_VERSION}:{name}"
    try:
        hit = await get_cached(key, params, "-", ttl=ATTR_TTL)
        if hit is not None:
            return hit
    except Exception as exc:  # a cache failure must not take the endpoint down
        log.warning("attribution cache read failed for %s: %s", name, exc)

    result = await compute()
    try:
        await set_cached(key, params, "-", result)
    except Exception as exc:
        log.warning("attribution cache write failed for %s: %s", name, exc)
    return result


@router.get("/international")
async def international():
    """US inflation vs peer economies -- the control group for global shocks.

    The 2021-22 surge hit every advanced economy. Peer inflation is therefore
    the counterfactual, and the US-minus-peer gap is the domestic component.
    """
    return await _cached("international", "-", attr.international_comparison)


@router.get("/administrations")
async def administrations(metric: str = Query("cpi_headline", pattern=r"^[a-z0-9_]{2,32}$")):
    """One metric across every administration since Clinton, banded by party.

    Powers the hero timeline and the comparison engine.
    """
    result = await _cached("administrations", metric,
                           lambda: attr.administrations(metric))
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/staples")
async def staples():
    """Grocery-shelf prices in dollars, compared across administrations."""
    return await _cached("staples", "-", attr.staples_ledger)


@router.get("/jobs")
async def jobs():
    """Payroll growth by term, with the honest labour-market counterweights."""
    return await _cached("jobs", "-", attr.jobs_ledger)


@router.get("/breadth")
async def breadth():
    """Headline vs core vs median vs trimmed-mean inflation.

    The decisive test: broad inflation moves the median, a relative-price
    shock moves only the tail.
    """
    return await _cached("breadth", "-", attr.breadth_test)


@router.get("/scorecard")
async def scorecard():
    """Two-term macro ledger, including the rows that cut the other way."""
    return await _cached("scorecard", "-", attr.scorecard)


@router.get("/event-study")
async def event_study(series: str = Query("wti", pattern=r"^[a-z_]{2,32}$")):
    """Do prices track war events in both directions?"""
    return await _cached("event_study", series, lambda: attr.war_event_study(series))


@router.get("/counterfactual/{series}")
async def counterfactual(
    series: str,
    window_months: int = Query(36, ge=12, le=120),
):
    """Pre-war trend projected forward, with an honest prediction interval."""
    if not series.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="invalid series key")
    result = await _cached(
        "counterfactual", f"{series}:{window_months}",
        lambda: attr.counterfactual(series, window_months=window_months),
    )
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/placebo")
async def placebo():
    """The falsification battery. Expensive -- roughly 6-10s cold."""
    return await _cached("placebo", "-", attr.placebo_battery)


@router.get("/passthrough/{good}")
async def passthrough(good: str, max_lag: int = Query(8, ge=2, le=24)):
    """Distributed-lag pass-through from crude to a downstream good."""
    if not good.replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="invalid series key")
    result = await _cached(
        "passthrough", f"{good}:{max_lag}",
        lambda: attr.passthrough(good, max_lag=max_lag),
    )
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/receipt")
async def receipt(
    miles_per_week: float = Query(240.0, ge=0, le=2000),
    household_size: int = Query(2, ge=1, le=12),
    since: str = Query("2025-01-20", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    mpg: float | None = Query(None, ge=5, le=150),
    grocery_spend: float | None = Query(None, ge=0, le=5000),
):
    """What the price changes since the baseline cost one household.

    Not cached -- it is parameterised per user and is pure arithmetic over
    already-cached series, so it is cheap.
    """
    overrides = {}
    if mpg is not None:
        overrides["vehicle_mpg"] = mpg
    if grocery_spend is not None:
        overrides["grocery_spend_per_person_month"] = grocery_spend
    try:
        return await attr.receipt(
            miles_per_week=miles_per_week,
            household_size=household_size,
            since=since,
            assumptions=overrides or None,
        )
    except ValueError as exc:  # missing provenance on an assumption
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/methodology")
async def methodology():
    """Static catalogue of series, sources, and the claims we decline to make.

    Cheap and dependency-free, so the UI can render the "show the math" panel
    without waiting on any computation.
    """
    from services.series_catalog import ALL_SPECS, TERMS

    return {
        "version": ATTR_VERSION,
        "series": [
            {
                "key": s.key, "fred_id": s.fred_id, "name": s.name,
                "group": s.group, "unit": s.unit,
                "seasonally_adjusted": s.sa, "note": s.note,
                "url": f"https://fred.stlouisfed.org/series/{s.fred_id}",
            }
            for s in ALL_SPECS
        ],
        "terms": [
            {"key": t.key, "label": t.label, "holder": t.holder,
             "start": t.start, "end": t.end}
            for t in TERMS
        ],
        "known_data_gaps": [
            {
                "period": "2025-10",
                "what": "October 2025 CPI was never collected",
                "why": "43-day federal shutdown, 2025-10-01 to 2025-11-12. BLS states "
                       "it 'was unable to retroactively collect these data.'",
                "effect": "A permanent hole. Every 12-month change spanning it is "
                          "undefined, and 864 import/export indexes are permanently "
                          "suppressed for that month.",
                "source": "https://www.bls.gov/cpi/additional-resources/2025-federal-government-shutdown-impact-cpi-faq.htm",
            },
            {
                "period": "2025-04 onward",
                "what": "~15% of the CPI sample suspended",
                "why": "Budget. Collection ended entirely in Lincoln NE, Provo UT and "
                       "Buffalo NY.",
                "effect": "BLS's own simulation finds a <0.01pp average effect on the "
                          "12-month change, and it is symmetric -- 14 months higher, "
                          "11 lower. We report both figures.",
                "source": "https://www.bls.gov/cpi/notices/2025/more-information-collection-reduction.htm",
            },
        ],
        "claims_we_decline_to_make": [
            "That published inflation statistics are deliberately manipulated. No "
            "regulator, watchdog, or whistleblower has established it, and the leading "
            "independent price measure (Truflation) reads BELOW official CPI -- the "
            "opposite of what suppression would produce.",
            "That the Inflation Reduction Act reduced inflation. CBO called the effect "
            "negligible; Penn Wharton found it statistically indistinguishable from zero.",
            "That the paper-physical oil spread reached $40-50/bbl. The TIER 1 ceiling "
            "is $35/bbl (IEA, mid-April 2026).",
            "That the paper-physical spread is open today. It closed to $3/bbl by early "
            "May 2026 and flipped to contango in July.",
            "That the oil futures market was manipulated. A separate, real "
            "insider-trading investigation into trades placed ahead of White House "
            "announcements is a different matter and is not evidence for this one.",
            "A point estimate for the tariff share of any price increase. No credible "
            "import-content weight per CPI category is available to us.",
        ],
    }


@router.get("/macro")
async def macro():
    """Point-in-time readouts for the ledger page: latest, handover, pre-war.

    Cached for a day rather than a week -- several inputs are daily.
    """
    key = f"attr:{ATTR_VERSION}:macro"
    try:
        hit = await get_cached(key, "-", "-", ttl=86400)
        if hit is not None:
            return hit
    except Exception as exc:
        log.warning("attribution cache read failed for macro: %s", exc)
    from services.macro import macro_snapshot

    result = await macro_snapshot()
    try:
        await set_cached(key, "-", "-", result)
    except Exception as exc:
        log.warning("attribution cache write failed for macro: %s", exc)
    return result


@router.get("/hormuz-transits")
async def hormuz_transits():
    """IMF PortWatch daily vessel transits through the Strait of Hormuz."""
    from services.portwatch import get_hormuz_transits

    return await get_hormuz_transits()


@router.get("/context")
async def context():
    """Curated, tiered figures that do not live on FRED.

    Static JSON, every entry sourced and dated. See data/context_figures.json.
    """
    import json
    import os

    path = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                        "data", "context_figures.json")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


async def _cached_daily(name: str, compute):
    key = f"attr:{ATTR_VERSION}:{name}"
    try:
        hit = await get_cached(key, "-", "-", ttl=86400)
        if hit is not None:
            return hit
    except Exception as exc:
        log.warning("attribution cache read failed for %s: %s", name, exc)
    result = await compute()
    try:
        await set_cached(key, "-", "-", result)
    except Exception as exc:
        log.warning("attribution cache write failed for %s: %s", name, exc)
    return result


@router.get("/eia")
async def eia():
    """SPR, refinery utilisation, crude exports, retail prices by area and state."""
    from services.eia import eia_snapshot
    return await _cached_daily("eia", eia_snapshot)


@router.get("/fiscal")
async def fiscal():
    """Debt to the penny, customs duties net of refunds, interest expense."""
    from services.fiscal import fiscal_snapshot
    return await _cached_daily("fiscal", fiscal_snapshot)


@router.get("/chain")
async def chain():
    """Follow the barrel: descriptive changes and pre-war pass-through per link."""
    from services.chain import chain_snapshot
    return await _cached_daily("chain", chain_snapshot)


@router.get("/receipt-inputs")
async def receipt_inputs():
    """Baselines and staple moves for the client-side household receipt."""
    return await _cached_daily("receipt_inputs", attr.receipt_inputs)


@router.get("/chokepoints")
async def chokepoints():
    """IMF PortWatch transits for six chokepoints."""
    from services.portwatch import chokepoints_snapshot
    return await chokepoints_snapshot()


@router.get("/nowcast")
async def nowcast():
    """Cleveland Fed daily inflation nowcast (model estimate, not a print)."""
    from services.nowcast import cleveland_nowcast
    return await cleveland_nowcast()


@router.get("/odds")
async def odds():
    """Curated Polymarket odds, labelled as crowd odds."""
    from services.odds import odds_snapshot
    return await odds_snapshot()
