"""Crisis comparison endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from services.crisis_analysis import get_crisis_comparison
from models.schemas import CrisisComparisonResponse

router = APIRouter(prefix="/api/crisis", tags=["crisis"])


@router.get("/comparison", response_model=CrisisComparisonResponse)
async def crisis_comparison():
    """Compare 7 major oil crises: peak spike, duration, gas impact,
    and day-by-day price trajectories normalized to % change from Day 0.
    """
    result = await get_crisis_comparison()
    return CrisisComparisonResponse(**result)
