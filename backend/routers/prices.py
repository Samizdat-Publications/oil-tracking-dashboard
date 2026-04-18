"""Price data endpoints."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("oildash")

from services.fred_client import (
    SERIES_IDS,
    SERIES_NAMES,
    DOWNSTREAM_SERIES,
    get_series,
)
from models.schemas import (
    PriceSeries,
    PricePoint,
    PriceSummaryItem,
    PriceSummaryResponse,
    DownstreamResponse,
    TickerItem,
    TickerResponse,
)

router = APIRouter(prefix="/api/prices", tags=["prices"])

# Kitchen Table Ticker series — keep in sync with frontend TICKER_ITEMS.
_TICKER_KEYS = [
    "wti",
    "gasoline",
    "diesel",
    "natural_gas",
    "airline_fares",
    "eggs_meat",
    "food_at_home",
    "cpi_energy",
    "cpi_all",
]

_IRAN_WAR_DATE = "2026-02-28"


# ---- Static routes MUST be defined before the dynamic /{series} route ----


@router.get("/summary", response_model=PriceSummaryResponse)
async def get_price_summary():
    """Current price, daily change, and % change for WTI, Brent, diesel."""
    summary_series = ["wti", "brent", "diesel"]
    start = (date.today() - timedelta(days=30)).isoformat()
    end = date.today().isoformat()

    items: list[PriceSummaryItem] = []
    for key in summary_series:
        try:
            obs = await get_series(SERIES_IDS[key], start, end)
        except Exception:
            items.append(PriceSummaryItem(series=key, name=SERIES_NAMES[key]))
            continue

        if len(obs) >= 2:
            current = obs[-1]["value"]
            previous = obs[-2]["value"]
            change = round(current - previous, 4)
            pct = round((change / previous) * 100, 4) if previous != 0 else None
            items.append(
                PriceSummaryItem(
                    series=key,
                    name=SERIES_NAMES[key],
                    current_price=current,
                    previous_price=previous,
                    daily_change=change,
                    pct_change=pct,
                    date=obs[-1]["date"],
                )
            )
        elif len(obs) == 1:
            items.append(
                PriceSummaryItem(
                    series=key,
                    name=SERIES_NAMES[key],
                    current_price=obs[-1]["value"],
                    date=obs[-1]["date"],
                )
            )
        else:
            items.append(PriceSummaryItem(series=key, name=SERIES_NAMES[key]))

    return PriceSummaryResponse(data=items)


@router.get("/ticker", response_model=TickerResponse)
async def get_ticker():
    """Lightweight payload for the above-fold Kitchen Table ticker.

    Returns only latest value + war-baseline value per ticker series (~18
    numbers total) so the ticker can render without waiting on the full
    20-year /api/prices/downstream response.
    """
    # 60 days is enough to reliably capture a "latest" observation for every
    # series (even weekly/monthly CPI series update within this window).
    end = date.today().isoformat()
    latest_start = (date.today() - timedelta(days=60)).isoformat()

    # For the war baseline, pull a 90-day window ending on the war date and
    # use the last observation in that window.
    from datetime import datetime
    war_dt = datetime.strptime(_IRAN_WAR_DATE, "%Y-%m-%d").date()
    baseline_start = (war_dt - timedelta(days=90)).isoformat()
    baseline_end = _IRAN_WAR_DATE

    async def _fetch_for(key: str) -> TickerItem:
        try:
            latest_obs, baseline_obs = await asyncio.gather(
                get_series(SERIES_IDS[key], latest_start, end),
                get_series(SERIES_IDS[key], baseline_start, baseline_end),
            )
        except Exception:
            logger.exception("Ticker fetch failed for %s", key)
            return TickerItem(key=key, name=SERIES_NAMES.get(key, key))

        latest = latest_obs[-1] if latest_obs else None
        baseline = baseline_obs[-1] if baseline_obs else None
        has_post_war = bool(latest and latest["date"] >= _IRAN_WAR_DATE)

        return TickerItem(
            key=key,
            name=SERIES_NAMES.get(key, key),
            latest_value=latest["value"] if latest else None,
            latest_date=latest["date"] if latest else None,
            war_baseline=baseline["value"] if baseline else None,
            has_post_war_data=has_post_war,
        )

    items = await asyncio.gather(*[_fetch_for(k) for k in _TICKER_KEYS if k in SERIES_IDS])
    return TickerResponse(items=list(items), iran_war_date=_IRAN_WAR_DATE)


@router.get("/downstream", response_model=DownstreamResponse)
async def get_downstream():
    """Return WTI + all downstream series for correlation analysis."""
    start = (date.today() - timedelta(days=365 * 20)).isoformat()
    end = date.today().isoformat()

    # Fetch WTI as the base oil series
    try:
        wti_obs = await get_series(SERIES_IDS["wti"], start, end)
    except Exception:
        logger.exception("Failed to fetch WTI for /api/prices/downstream")
        raise HTTPException(status_code=502, detail="Upstream data fetch failed")

    oil = PriceSeries(
        series_id=SERIES_IDS["wti"],
        name=SERIES_NAMES["wti"],
        observations=[PricePoint(date=o["date"], value=o["value"]) for o in wti_obs],
    )

    # Fetch all downstream series in parallel for ~4x speedup
    async def _fetch_one(key: str) -> PriceSeries | None:
        try:
            obs = await get_series(SERIES_IDS[key], start, end)
            return PriceSeries(
                series_id=SERIES_IDS[key],
                name=SERIES_NAMES[key],
                observations=[PricePoint(date=o["date"], value=o["value"]) for o in obs],
            )
        except Exception:
            return None

    results = await asyncio.gather(*[_fetch_one(key) for key in DOWNSTREAM_SERIES])
    downstream: list[PriceSeries] = [r for r in results if r is not None]

    return DownstreamResponse(oil=oil, series=downstream)


# ---- Dynamic route last ----


@router.get("/{series}", response_model=PriceSeries)
async def get_price_series(
    series: str,
    start: str = Query(default=None, description="Start date YYYY-MM-DD"),
    end: str = Query(default=None, description="End date YYYY-MM-DD"),
):
    """Return time-series observations for a given series name."""
    key = series.lower()
    if key not in SERIES_IDS:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown series '{series}'. Valid: {', '.join(SERIES_IDS.keys())}",
        )

    date_re = re.compile(r'^\d{4}-\d{2}-\d{2}$')
    if start is not None and not date_re.match(start):
        raise HTTPException(status_code=400, detail="Invalid start date format. Use YYYY-MM-DD.")
    if end is not None and not date_re.match(end):
        raise HTTPException(status_code=400, detail="Invalid end date format. Use YYYY-MM-DD.")

    if start is None:
        start = (date.today() - timedelta(days=365 * 20)).isoformat()
    if end is None:
        end = date.today().isoformat()

    try:
        obs = await get_series(SERIES_IDS[key], start, end)
    except RuntimeError:
        logger.exception("API key / configuration error fetching series %s", key)
        raise HTTPException(status_code=503, detail="Data source not configured")
    except Exception:
        logger.exception("FRED fetch failed for series %s", key)
        raise HTTPException(status_code=502, detail="Upstream data fetch failed")

    return PriceSeries(
        series_id=SERIES_IDS[key],
        name=SERIES_NAMES[key],
        observations=[PricePoint(date=o["date"], value=o["value"]) for o in obs],
    )
