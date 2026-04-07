"""Async FRED API client with caching."""

from __future__ import annotations

import os
from datetime import date

import httpx
from dotenv import load_dotenv

from services.cache import get_cached, set_cached

# ---------------------------------------------------------------------------
# Series ID constants
# ---------------------------------------------------------------------------

SERIES_IDS: dict[str, str] = {
    "wti": "DCOILWTICO",
    "brent": "DCOILBRENTEU",
    "diesel": "GASDESW",
    "fertilizer": "PNFERTINDEXM",
    "food_index": "PPFGSUSDM",
    "cpi_energy": "CPIENGSL",
    "cotton": "PCOTTINDEXM",
    "aluminum": "PALUMINDEXM",
    "plastics": "PPLASINDEXM",
    "airline_fares": "CUSR0000SETB01",
    "gasoline": "GASREGW",            # US Regular All Formulations Gas Price ($/gallon)
    "food_at_home": "CUSR0000SAF11",  # CPI: Food at Home
    "eggs_meat": "CUSR0000SAF112",    # CPI: Meats, Poultry, Fish, and Eggs
    "natural_gas": "DHHNGSP",         # Henry Hub Natural Gas Spot Price
    "cpi_all": "CPIAUCSL",
    "vix": "VIXCLS",
    "usd_eur": "DEXUSEU",
    "treasury_spread": "T10Y2Y",
}

SERIES_NAMES: dict[str, str] = {
    "wti": "WTI Crude Oil",
    "brent": "Brent Crude Oil",
    "diesel": "US Diesel Prices",
    "fertilizer": "Fertilizer Price Index",
    "food_index": "Global Food Price Index",
    "cpi_energy": "CPI Energy",
    "cotton": "Cotton Price Index",
    "aluminum": "Aluminum Price Index",
    "plastics": "Plastics Price Index",
    "airline_fares": "Airline Fares CPI",
    "gasoline": "Gasoline (Regular)",
    "food_at_home": "Groceries (Food at Home)",
    "eggs_meat": "Eggs, Meat & Poultry",
    "natural_gas": "Natural Gas",
    "cpi_all": "CPI All Items",
    "vix": "VIX Volatility Index",
    "usd_eur": "USD/EUR Exchange Rate",
    "treasury_spread": "10Y-2Y Treasury Spread",
}

DOWNSTREAM_SERIES = [
    "diesel",
    "fertilizer",
    "food_index",
    "cpi_energy",
    "cotton",
    "aluminum",
    "plastics",
    "airline_fares",
    "gasoline",
    "food_at_home",
    "eggs_meat",
    "natural_gas",
    "cpi_all",
]

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# Load .env once at module level
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
_cached_api_key: str | None = os.getenv("FRED_API_KEY", "").strip() or None


def _get_api_key() -> str:
    return _cached_api_key or ""


def reload_api_key() -> None:
    """Reload the API key from .env (called after configure)."""
    global _cached_api_key
    load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"), override=True)
    _cached_api_key = os.getenv("FRED_API_KEY", "").strip() or None


async def get_series(
    series_id: str,
    start_date: str,
    end_date: str | None = None,
) -> list[dict]:
    """Fetch observations from FRED, using the cache when possible.

    Returns list of {"date": "YYYY-MM-DD", "value": float}.
    """
    if end_date is None:
        end_date = date.today().isoformat()

    # Check cache first
    cached = await get_cached(series_id, start_date, end_date)
    if cached is not None:
        return cached

    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("FRED_API_KEY is not set. Configure it via /api/setup/configure.")

    params = {
        "series_id": series_id,
        "api_key": api_key,
        "file_type": "json",
        "observation_start": start_date,
        "observation_end": end_date,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(BASE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    observations = []
    for obs in data.get("observations", []):
        val = obs.get("value", ".")
        if val == ".":
            continue
        try:
            observations.append({"date": obs["date"], "value": float(val)})
        except (ValueError, KeyError):
            continue

    # Store in cache
    await set_cached(series_id, start_date, end_date, observations)
    return observations
