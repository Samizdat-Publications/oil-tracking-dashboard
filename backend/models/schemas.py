"""Pydantic models for request/response bodies."""

from __future__ import annotations

from pydantic import BaseModel, Field
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


# ---------------------------------------------------------------------------
# Simulation models
# ---------------------------------------------------------------------------

class SimulationRequest(BaseModel):
    series: str = Field(default="wti", description="wti or brent")
    lookback_years: int = Field(default=2, ge=1, le=10)
    n_paths: int = Field(default=5000, ge=1000, le=50000)
    horizon_days: int = Field(default=126, ge=21, le=252)
    model: str = Field(default="jump_diffusion", description="gbm or jump_diffusion")
    seed: int | None = None
    mu_override: float | None = None
    sigma_override: float | None = None


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


class PolymarketCategory(BaseModel):
    key: str
    name: str
    icon: str
    description: str
    markets: list[PolymarketMarketItem]
    highlight: PolymarketMarketItem | None = None
    fed_distribution: list[FedCutPoint] | None = None
    market_count: int
    total_volume: float


class PolymarketWarEconomyResponse(BaseModel):
    categories: list[PolymarketCategory]
    total_volume: float
    market_count: int
    updated_at: str
