"""Monte Carlo simulation endpoints."""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from services.fred_client import SERIES_IDS, get_series
from services.monte_carlo import estimate_params, run_simulation
from models.schemas import (
    SimulationRequest,
    SimulationResponse,
    SimulationBands,
    SimulationParams,
)

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


@router.post("", response_model=SimulationResponse)
async def simulate(req: SimulationRequest):
    """Run a Monte Carlo simulation for the requested oil series."""
    key = req.series.lower()
    if key not in ("wti", "brent"):
        raise HTTPException(
            status_code=400, detail="series must be 'wti' or 'brent'"
        )

    series_id = SERIES_IDS[key]
    end = date.today().isoformat()
    start = (date.today() - timedelta(days=int(req.lookback_years * 365.25))).isoformat()

    try:
        obs = await get_series(series_id, start, end)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"FRED API error: {exc}")

    if len(obs) < 30:
        raise HTTPException(
            status_code=422,
            detail=f"Insufficient data: got {len(obs)} observations, need at least 30.",
        )

    prices = [o["value"] for o in obs]
    current_price = prices[-1]

    # Estimate parameters
    try:
        params = estimate_params(prices)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    mu = req.mu_override if req.mu_override is not None else params["mu"]
    sigma = req.sigma_override if req.sigma_override is not None else params["sigma"]

    # Run simulation
    result = run_simulation(
        current_price=current_price,
        mu=mu,
        sigma=sigma,
        lambda_jump=params["lambda_jump"],
        mu_jump=params["mu_jump"],
        sigma_jump=params["sigma_jump"],
        n_paths=req.n_paths,
        n_days=req.horizon_days,
        seed=req.seed,
        model=req.model,
    )

    return SimulationResponse(
        dates=result["dates"],
        bands=SimulationBands(**result["bands"]),
        params=SimulationParams(**result["params"]),
    )
