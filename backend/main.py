"""FastAPI backend for Oil Price Tracking Dashboard."""

from __future__ import annotations

import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from services.cache import init_cache, clear_cache, close_cache
from services.fred_client import SERIES_IDS, get_series
from routers import (
    prices, simulation, correlations, milestones, polymarket, crisis, attribution,
)
from dependencies import verify_localhost
from models.schemas import (
    HealthResponse,
    SetupStatusResponse,
    ConfigureRequest,
    ConfigureResponse,
    GeoEvent,
)

logger = logging.getLogger("oildash")

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
EVENTS_PATH = os.path.join(os.path.dirname(__file__), "data", "default_events.json")

# Series that the Kitchen Table Ticker surfaces above the fold. These are warmed
# synchronously at startup so the first user gets a hot cache for the ticker.
TICKER_SERIES_KEYS = [
    "gasoline",
    "diesel",
    "natural_gas",
    "airline_fares",
    "eggs_meat",
    "food_at_home",
    "cpi_energy",
    "cpi_all",
]


async def _prewarm_cache():
    """Pre-warm FRED cache for critical series so first page load is fast."""
    import asyncio
    from datetime import date, timedelta

    start = (date.today() - timedelta(days=365 * 20)).isoformat()
    end = date.today().isoformat()

    # Warm the most important series: WTI, Brent, gasoline, diesel + all downstream
    keys_to_warm = list(SERIES_IDS.keys())

    async def _warm_one(key: str):
        try:
            await get_series(SERIES_IDS[key], start, end)
        except Exception as e:
            logger.warning(f"Cache warm failed for {key}: {e}")

    await asyncio.gather(*[_warm_one(k) for k in keys_to_warm])


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    import asyncio
    from datetime import date, timedelta

    await init_cache()

    if not os.getenv("ADMIN_SECRET", "").strip():
        logger.warning(
            "ADMIN_SECRET is not set — remote administrative endpoints "
            "(/api/setup/configure, /api/polymarket/refresh) are restricted to localhost only."
        )

    # Await ONLY the series used above the fold so the first user sees a hot
    # cache. Everything else is warmed in the background after yield.
    critical_keys = ["wti", "brent"] + TICKER_SERIES_KEYS
    start = (date.today() - timedelta(days=365 * 20)).isoformat()
    end = date.today().isoformat()

    async def _warm(key: str):
        try:
            await get_series(SERIES_IDS[key], start, end)
        except Exception as e:
            logger.warning("Critical cache warm failed for %s: %s", key, e)

    try:
        await asyncio.wait_for(
            asyncio.gather(*[_warm(k) for k in critical_keys if k in SERIES_IDS]),
            timeout=10.0,
        )
    except asyncio.TimeoutError:
        logger.warning("Critical cache warm exceeded 10s; continuing startup")

    asyncio.create_task(_prewarm_cache())
    yield
    await close_cache()


app = FastAPI(
    title="Oil Price Tracking Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — restrict origins via env var (defaults to local dev servers).
# allow_credentials=False: the API is cookieless; disabling credentials narrows
# the blast radius if someone later misconfigures ALLOWED_ORIGINS to "*".
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000",
    ).split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# HTTP request logging middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({duration:.2f}s)")
    return response

# Include routers
app.include_router(prices.router)
app.include_router(simulation.router)
app.include_router(correlations.router)
app.include_router(milestones.router)
app.include_router(polymarket.router)
app.include_router(crisis.router)
app.include_router(attribution.router)


# ---------------------------------------------------------------------------
# Health & setup endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="1.0.0")


@app.get("/api/setup/status", response_model=SetupStatusResponse)
async def setup_status():
    """Check whether FRED_API_KEY is configured."""
    load_dotenv(ENV_PATH)
    key = os.getenv("FRED_API_KEY", "").strip()
    return SetupStatusResponse(fred_api_key_set=bool(key))


@app.post("/api/setup/configure", response_model=ConfigureResponse, dependencies=[Depends(verify_localhost)])
async def setup_configure(body: ConfigureRequest):
    """Save FRED API key to the .env file."""
    api_key = body.fred_api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="fred_api_key cannot be empty")

    eia_key = (body.eia_api_key or "").strip()

    # Read existing .env content (if any) and update/add keys
    env_lines: list[str] = []
    found_fred = False
    found_eia = False
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r") as f:
            for line in f:
                if line.strip().startswith("FRED_API_KEY"):
                    env_lines.append(f"FRED_API_KEY={api_key}\n")
                    found_fred = True
                elif line.strip().startswith("EIA_API_KEY"):
                    if eia_key:
                        env_lines.append(f"EIA_API_KEY={eia_key}\n")
                    found_eia = True
                else:
                    env_lines.append(line)
    if not found_fred:
        env_lines.append(f"FRED_API_KEY={api_key}\n")
    if not found_eia and eia_key:
        env_lines.append(f"EIA_API_KEY={eia_key}\n")

    with open(ENV_PATH, "w") as f:
        f.writelines(env_lines)

    # Clear cache so fresh data is fetched with new key
    await clear_cache()

    # Reload env and API key
    load_dotenv(ENV_PATH, override=True)
    from services.fred_client import reload_api_key
    reload_api_key()

    return ConfigureResponse(success=True, message="FRED API key saved successfully.")


# ---------------------------------------------------------------------------
# Geopolitical events endpoint
# ---------------------------------------------------------------------------

@app.get("/api/events", response_model=list[GeoEvent])
async def get_events():
    """Return the default geopolitical events list."""
    if not os.path.exists(EVENTS_PATH):
        return []
    with open(EVENTS_PATH, "r") as f:
        data = json.load(f)
    return [GeoEvent(**evt) for evt in data]
