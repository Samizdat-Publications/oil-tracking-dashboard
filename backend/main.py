"""FastAPI backend for Oil Price Tracking Dashboard."""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from services.cache import init_cache, clear_cache
from routers import prices, simulation, correlations
from models.schemas import (
    HealthResponse,
    SetupStatusResponse,
    ConfigureRequest,
    ConfigureResponse,
    GeoEvent,
)

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
EVENTS_PATH = os.path.join(os.path.dirname(__file__), "data", "default_events.json")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    await init_cache()
    yield


app = FastAPI(
    title="Oil Price Tracking Dashboard API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(prices.router)
app.include_router(simulation.router)
app.include_router(correlations.router)


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


@app.post("/api/setup/configure", response_model=ConfigureResponse)
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

    # Reload env
    load_dotenv(ENV_PATH, override=True)

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
