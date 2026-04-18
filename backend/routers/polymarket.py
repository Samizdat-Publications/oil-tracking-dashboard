"""Polymarket war-economy prediction markets endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from services.polymarket_client import get_war_economy_markets
from models.schemas import PolymarketWarEconomyResponse
from dependencies import verify_localhost

router = APIRouter(prefix="/api/polymarket", tags=["polymarket"])


@router.get("/summary", response_model=PolymarketWarEconomyResponse)
async def get_summary():
    """Return war-economy prediction markets grouped by category.

    Categories: recession risk, Fed policy, geopolitical escalation.
    """
    result = await get_war_economy_markets()
    return PolymarketWarEconomyResponse(**result)


@router.post(
    "/refresh",
    response_model=PolymarketWarEconomyResponse,
    dependencies=[Depends(verify_localhost)],
)
async def refresh_polymarket():
    """Force a fresh fetch from Polymarket API and save to disk.

    Restricted to localhost (or admin-bearer) since it drives a ~1000-market
    upstream scan — easy to abuse for rate-limit exhaustion.
    """
    result = await get_war_economy_markets(force_refresh=True)
    return PolymarketWarEconomyResponse(**result)
