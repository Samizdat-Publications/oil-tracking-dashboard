"""Price data endpoints."""

from __future__ import annotations

import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

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
)

router = APIRouter(prefix="/api/prices", tags=["prices"])


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


@router.get("/downstream", response_model=DownstreamResponse)
async def get_downstream():
    """Return WTI + all downstream series for correlation analysis."""
    start = (date.today() - timedelta(days=365 * 20)).isoformat()
    end = date.today().isoformat()

    # Fetch WTI as the base oil series
    try:
        wti_obs = await get_series(SERIES_IDS["wti"], start, end)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch WTI: {exc}")

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

    if start is None:
        start = (date.today() - timedelta(days=365 * 20)).isoformat()
    if end is None:
        end = date.today().isoformat()

    try:
        obs = await get_series(SERIES_IDS[key], start, end)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"FRED API error: {exc}")

    return PriceSeries(
        series_id=SERIES_IDS[key],
        name=SERIES_NAMES[key],
        observations=[PricePoint(date=o["date"], value=o["value"]) for o in obs],
    )
