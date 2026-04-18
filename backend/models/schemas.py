"""Pydantic models for request/response bodies."""

from __future__ import annotations

import math

from pydantic import BaseModel, Field, field_validator
from typing import Optional


# ---------------------------------------------------------------------------
# Price models
# ---------------------------------------------------------------------------

class PricePoint(BaseModel):
    date: str
    value: float


class PriceSeries(BaseModel):
    series_id: str
    name: str
    observations: list[PricePoint]


class PriceSummaryItem(BaseModel):
    series: str
    name: str
    current_price: float | None = None
    previous_price: float | None = None
    daily_change: float | None = None
    pct_change: float | None = None
    date: str | None = None


class PriceSummaryResponse(BaseModel):
    data: list[PriceSummaryItem]


class DownstreamResponse(BaseModel):
    oil: PriceSeries
    series: list[PriceSeries]


class TickerItem(BaseModel):
    """Compact payload for the above-fold Kitchen Table ticker.

    Just the numbers the ticker actually renders — no full time series. This
    keeps the critical-path request tiny so hero LCP isn't gated on the
    20-year downstream endpoint.
    """

    key: str
    name: str
    latest_value: float | None = None
    latest_date: str | None = None
    war_baseline: float | None = None
    has_post_war_data: bool = False


class TickerResponse(BaseModel):
    items: list[TickerItem]
    iran_war_date: str


# ---------------------------------------------------------------------------
# Simulation models
# ---------------------------------------------------------------------------

class SimulationRequest(BaseModel):
    series: str = Field(default="wti", description="wti or brent")
    lookback_years: int = Field(default=2, ge=1, le=10)
    n_paths: int = Field(default=5000, ge=1000, le=50000)
    horizon_days: int = Field(default=126, ge=21, le=252)
    model: str = Field(default="jump_diffusion", description="gbm or jump_diffusion")
    seed: int | None = Field(default=None, ge=0, le=2**31 - 1)
    # Annualized drift (mu) and volatility (sigma) overrides. Bounded to realistic
    # ranges so an attacker can't feed nan/inf or extreme values that hang numpy.
    mu_override: float | None = Field(default=None, ge=-5.0, le=5.0)
    sigma_override: float | None = Field(default=None, ge=0.0, le=10.0)

    @field_validator("mu_override", "sigma_override")
    @classmethod
    def _finite_float(cls, v: float | None) -> float | None:
        if v is not None and not math.isfinite(v):
            raise ValueError("must be a finite number")
        return v

    @field_validator("series", "model")
    @classmethod
    def _allowed_string(cls, v: str, info) -> str:
        allowed = {"series": {"wti", "brent"}, "model": {"gbm", "jump_diffusion"}}[info.field_name]
        key = v.lower()
        if key not in allowed:
            raise ValueError(f"must be one of {sorted(allowed)}")
        return key


class SimulationParams(BaseModel):
    mu: float
    sigma: float
    lambda_jump: float | None = None
    mu_jump: float | None = None
    sigma_jump: float | None = None
    model: str
    n_paths: int
    horizon_days: int
    current_price: float


class SimulationBands(BaseModel):
    p1: list[float]
    p5: list[float]
    p25: list[float]
    p50: list[float]
    p75: list[float]
    p95: list[float]
    p99: list[float]


class SimulationResponse(BaseModel):
    dates: list[str]
    bands: SimulationBands
    params: SimulationParams


# ---------------------------------------------------------------------------
# Correlation models
# ---------------------------------------------------------------------------

class CorrelationPoint(BaseModel):
    date: str
    correlation: float | None


class CorrelationSeries(BaseModel):
    downstream_series: str
    downstream_name: str
    data: list[CorrelationPoint]


class CorrelationsResponse(BaseModel):
    oil_series: str
    window: int
    correlations: list[CorrelationSeries]


# ---------------------------------------------------------------------------
# Setup / health models
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    version: str


class SetupStatusResponse(BaseModel):
    fred_api_key_set: bool


class ConfigureRequest(BaseModel):
    fred_api_key: str
    eia_api_key: str | None = None


class ConfigureResponse(BaseModel):
    success: bool
    message: str


# ---------------------------------------------------------------------------
# Geopolitical event model
# ---------------------------------------------------------------------------

class GeoEvent(BaseModel):
    id: str
    date: str
    label: str
    category: str
    description: str


# ---------------------------------------------------------------------------
# Polymarket prediction models — war-economy markets
# ---------------------------------------------------------------------------

class PolymarketMarketItem(BaseModel):
    id: str
    question: str
    yes_probability: float
    volume: float
    end_date: str | None = None
    source_url: str | None = None


class FedCutPoint(BaseModel):
    cuts: int
    probability: float


class OilPricePoint(BaseModel):
    price: int
    probability: float


class PolymarketCategory(BaseModel):
    key: str
    name: str
    icon: str
    description: str
    markets: list[PolymarketMarketItem]
    highlight: PolymarketMarketItem | None = None
    fed_distribution: list[FedCutPoint] | None = None
    oil_price_distribution: list[OilPricePoint] | None = None
    market_count: int
    total_volume: float


class PolymarketWarEconomyResponse(BaseModel):
    categories: list[PolymarketCategory]
    total_volume: float
    market_count: int
    updated_at: str


# ---------------------------------------------------------------------------
# Crisis comparison models
# ---------------------------------------------------------------------------

class CrisisTrajectoryPoint(BaseModel):
    day: int
    pct_change: float


class CrisisData(BaseModel):
    id: str
    name: str
    year: int
    start_date: str
    end_date: str | None = None
    peak_spike_pct: float | None = None
    duration_months: float | None = None
    gas_impact_pct: float | None = None
    context: str
    trajectory: list[CrisisTrajectoryPoint]
    is_current: bool


class CrisisComparisonResponse(BaseModel):
    crises: list[CrisisData]
    updated_at: str
