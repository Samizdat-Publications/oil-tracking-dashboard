"""Correlation analysis endpoints."""

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
from services.statistics import rolling_correlation
from models.schemas import (
    CorrelationsResponse,
    CorrelationSeries,
    CorrelationPoint,
)

router = APIRouter(prefix="/api/correlations", tags=["correlations"])


@router.get("", response_model=CorrelationsResponse)
async def get_correlations(
    window: int = Query(default=30, ge=5, le=252, description="Rolling window size"),
):
    """Rolling correlations between WTI and each downstream series."""
    start = (date.today() - timedelta(days=365 * 5)).isoformat()
    end = date.today().isoformat()

    # Fetch WTI
    try:
        wti_obs = await get_series(SERIES_IDS["wti"], start, end)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch WTI: {exc}")

    async def _fetch_downstream(key: str):
        try:
            ds_obs = await get_series(SERIES_IDS[key], start, end)
            corr_data = rolling_correlation(wti_obs, ds_obs, window=window)
            return CorrelationSeries(
                downstream_series=key,
                downstream_name=SERIES_NAMES[key],
                data=[
                    CorrelationPoint(date=pt["date"], correlation=pt["correlation"])
                    for pt in corr_data
                ],
            )
        except Exception:
            return None

    raw_results = await asyncio.gather(*[_fetch_downstream(key) for key in DOWNSTREAM_SERIES])
    results = [r for r in raw_results if r is not None]

    return CorrelationsResponse(
        oil_series="wti",
        window=window,
        correlations=results,
    )
