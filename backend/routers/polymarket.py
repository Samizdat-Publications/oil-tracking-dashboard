"""Polymarket prediction markets endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from services.polymarket_client import search_oil_markets, get_oil_prediction_summary
from models.schemas import PolymarketMarketsResponse, PolymarketSummaryResponse

router = APIRouter(prefix="/api/polymarket", tags=["polymarket"])


@router.get("/markets", response_model=PolymarketMarketsResponse)
async def get_markets():
    """Return all active oil-related prediction markets with current odds."""
    from datetime import datetime

    markets = await search_oil_markets()
    return PolymarketMarketsResponse(
        markets=markets,
        updated_at=datetime.utcnow().isoformat() + "Z",
    )


@router.get("/summary", response_model=PolymarketSummaryResponse)
async def get_summary():
    """Return aggregated sentiment and price targets from oil prediction markets."""
    summary = await get_oil_prediction_summary()
    return PolymarketSummaryResponse(**summary)
