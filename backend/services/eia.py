"""EIA API v2 -- the weekly petroleum figures FRED does not carry.

Four things this adds to the page, none of which are on FRED:

* **The Strategic Petroleum Reserve** (WCSSTUS1). Drawn to 286.6 million barrels
  by late August 2026, the lowest since 1983 -- the reserve was spent holding
  the price down, and that is part of the bill.
* **Refinery utilisation** (WPULEUS3). At 98% there is no slack, which is why
  diesel -- the tightest product -- leads every price table.
* **US crude exports** (WCREXUS2). US producers sold ~4.5 mb/d into the
  shortage. The winners belong on the page too.
* **Retail prices by region and state** (petroleum/pri/gnd), plus residential
  electricity by state (electricity/retail-sales), which is what lets the
  household receipt be *yours* rather than the national average.

The key lives in `backend/.env` as EIA_API_KEY (or the environment on CI).
Because it travels in the query string, EIA is server-side only: the browser
reads these figures from the snapshot, never from EIA directly.

Docs: https://www.eia.gov/opendata/documentation.php
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import date
from typing import Any

import httpx
from dotenv import load_dotenv

from services.attribution import _envelope
from services.cache import get_cached, set_cached
from services.macro import nearest_on_or_before
from services.series_catalog import HANDOVER_DATE
from services.timeseries import WAR_BASELINE_DATE

log = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

BASE = "https://api.eia.gov/v2"
TTL = 6 * 3600  # EIA weeklies land Wednesday/Monday; six hours is plenty

#: Single-series weeklies: key -> (route, series id, name, unit).
WEEKLY_SERIES: dict[str, tuple[str, str, str, str]] = {
    "spr": ("petroleum/stoc/wstk", "WCSSTUS1",
            "Strategic Petroleum Reserve, crude stocks", "kbbl"),
    "refinery_util": ("petroleum/pnp/wiup", "WPULEUS3",
                      "Refinery utilisation, US", "pct"),
    "crude_exports": ("petroleum/move/wkly", "WCREXUS2",
                      "US crude oil exports", "kbd"),
}

#: Retail price areas EIA publishes weekly (verified against the API facet
#: list on 2026-09-05). Anything not here falls back to its PADD.
AREAS: dict[str, str] = {
    "NUS": "United States",
    "R10": "East Coast (PADD 1)", "R1X": "New England (PADD 1A)",
    "R1Y": "Central Atlantic (PADD 1B)", "R1Z": "Lower Atlantic (PADD 1C)",
    "R20": "Midwest (PADD 2)", "R30": "Gulf Coast (PADD 3)",
    "R40": "Rocky Mountain (PADD 4)", "R50": "West Coast (PADD 5)",
    "R5XCA": "West Coast except California",
    "SCA": "California", "SCO": "Colorado", "SFL": "Florida", "SMA": "Massachusetts",
    "SMN": "Minnesota", "SNY": "New York", "SOH": "Ohio", "STX": "Texas",
    "SWA": "Washington",
    "Y05LA": "Los Angeles", "Y05SF": "San Francisco", "Y35NY": "New York City",
    "Y44HO": "Houston", "Y48SE": "Seattle", "YBOS": "Boston", "YCLE": "Cleveland",
    "YDEN": "Denver", "YMIA": "Miami", "YORD": "Chicago",
}

#: State -> PADD fallback for the receipt picker, for states without a weekly series.
STATE_TO_PADD: dict[str, str] = {
    **{s: "R1X" for s in ["CT", "ME", "MA", "NH", "RI", "VT"]},
    **{s: "R1Y" for s in ["DE", "DC", "MD", "NJ", "NY", "PA"]},
    **{s: "R1Z" for s in ["FL", "GA", "NC", "SC", "VA", "WV"]},
    **{s: "R20" for s in ["IL", "IN", "IA", "KS", "KY", "MI", "MN", "MO", "NE", "ND", "OH", "OK", "SD", "TN", "WI"]},
    **{s: "R30" for s in ["AL", "AR", "LA", "MS", "NM", "TX"]},
    **{s: "R40" for s in ["CO", "ID", "MT", "UT", "WY"]},
    **{s: "R50" for s in ["AK", "AZ", "CA", "HI", "NV", "OR", "WA"]},
}

STATES = ["US", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
          "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
          "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
          "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"]


def _key() -> str:
    k = os.getenv("EIA_API_KEY", "").strip()
    if not k:
        raise RuntimeError("EIA_API_KEY is not set")
    return k


async def _get(route: str, params: dict[str, Any], cache_id: str) -> list[dict]:
    """GET /v2/<route>/data with paging; cached by route+params."""
    try:
        hit = await get_cached(f"eia:{cache_id}:v1", "-", "-", ttl=TTL)
        if hit is not None:
            return hit
    except Exception as exc:
        log.warning("eia cache read failed: %s", exc)

    rows: list[dict] = []
    offset = 0
    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            p = {"api_key": _key(), "offset": offset, "length": 5000, **params}
            r = await client.get(f"{BASE}/{route}/data/", params=p)
            r.raise_for_status()
            body = r.json()
            if "error" in body:
                raise RuntimeError(f"EIA {route}: {body['error']}")
            data = body.get("response", {}).get("data", [])
            rows.extend(data)
            total = int(body.get("response", {}).get("total", len(rows)))
            offset += len(data)
            if not data or offset >= total:
                break
    try:
        await set_cached(f"eia:{cache_id}:v1", "-", "-", rows)
    except Exception as exc:
        log.warning("eia cache write failed: %s", exc)
    return rows


def _pts(rows: list[dict], value_key: str = "value") -> list[dict]:
    out = []
    for r in rows:
        try:
            v = float(r[value_key])
        except (KeyError, TypeError, ValueError):
            continue
        out.append({"date": _iso(r["period"]), "value": v})
    out.sort(key=lambda p: p["date"])
    return out


def _iso(period: str) -> str:
    """EIA periods are 'YYYY-MM-DD' (weekly) or 'YYYY-MM' (monthly)."""
    return period if len(period) == 10 else f"{period}-01"


def _summary(pts: list[dict]) -> dict:
    return {
        "latest": pts[-1] if pts else None,
        "handover": nearest_on_or_before(pts, HANDOVER_DATE),
        "prewar": nearest_on_or_before(pts, WAR_BASELINE_DATE),
        "points": pts,
    }


async def weekly(key: str, start: str = "2025-01-01") -> dict:
    route, sid, name, unit = WEEKLY_SERIES[key]
    rows = await _get(route, {
        "frequency": "weekly", "data[0]": "value", "facets[series][]": sid,
        "start": start, "sort[0][column]": "period", "sort[0][direction]": "asc",
    }, f"{sid}:{start}")
    return {"series_id": sid, "name": name, "unit": unit,
            "url": f"https://www.eia.gov/opendata/browser/{route}", **_summary(_pts(rows))}


async def retail_prices(product: str, start: str = "2025-01-01") -> dict[str, dict]:
    """Weekly retail price for every published area. product: EPMR (regular
    gasoline) or EPD2D (on-highway diesel). Returns area code -> summary."""
    rows = await _get("petroleum/pri/gnd", {
        "frequency": "weekly", "data[0]": "value",
        "facets[product][]": product, "facets[process][]": "PTE",
        "start": start, "sort[0][column]": "period", "sort[0][direction]": "asc",
    }, f"gnd:{product}:{start}")
    by_area: dict[str, list[dict]] = {}
    for r in rows:
        a = r.get("duoarea")
        if a in AREAS:
            by_area.setdefault(a, []).append(r)
    out = {}
    for a, rs in by_area.items():
        pts = _pts(rs)
        s = _summary(pts)
        s["points"] = pts[-8:]  # keep the block small; the full series is not needed per area
        h, l = s["handover"], s["latest"]
        s.update({"area": a, "name": AREAS[a], "unit": "usd_gal",
                  "delta": round(l["value"] - h["value"], 3) if h and l else None})
        out[a] = s
    return out


async def electricity_by_state(start: str = "2025-01") -> dict[str, dict]:
    """Monthly residential electricity price, cents/kWh -> $/kWh, by state."""
    rows = await _get("electricity/retail-sales", {
        "frequency": "monthly", "data[0]": "price",
        "facets[sectorid][]": "RES", "start": start,
        "sort[0][column]": "period", "sort[0][direction]": "asc",
    }, f"elec:RES:{start}")
    by_state: dict[str, list[dict]] = {}
    for r in rows:
        st = r.get("stateid")
        if st in STATES:
            by_state.setdefault(st, []).append(r)
    out = {}
    for st, rs in by_state.items():
        pts = [{"date": p["date"], "value": round(p["value"] / 100.0, 4)} for p in _pts(rs, "price")]
        s = _summary(pts)
        s["points"] = pts[-6:]
        h, l = s["handover"], s["latest"]
        s.update({"state": st, "unit": "usd_kwh",
                  "delta": round(l["value"] - h["value"], 4) if h and l else None})
        out[st] = s
    return out


async def eia_snapshot() -> dict:
    """Everything the page reads from EIA, in one block."""
    try:
        _key()
    except RuntimeError as exc:
        return {"error": str(exc), "as_of": date.today().isoformat()}

    results = await asyncio.gather(
        *(weekly(k) for k in WEEKLY_SERIES),
        retail_prices("EPMR"), retail_prices("EPD2D"), electricity_by_state(),
        return_exceptions=True,
    )
    keys = list(WEEKLY_SERIES)
    series: dict[str, Any] = {}
    for k, r in zip(keys, results[: len(keys)]):
        series[k] = r if not isinstance(r, Exception) else {"error": str(r)}
    gas, diesel, elec = results[len(keys):]

    return {
        "as_of": date.today().isoformat(),
        "series": series,
        "gasoline_by_area": gas if not isinstance(gas, Exception) else {"error": str(gas)},
        "diesel_by_area": diesel if not isinstance(diesel, Exception) else {"error": str(diesel)},
        "electricity_by_state": elec if not isinstance(elec, Exception) else {"error": str(elec)},
        "state_to_padd": STATE_TO_PADD,
        "source": "US Energy Information Administration, API v2",
        "source_url": "https://www.eia.gov/opendata/",
        "tier": 1,
        "envelope": _envelope(
            "eia_snapshot",
            sample={"source": "EIA API v2", "weeklies": keys,
                    "areas": len(AREAS), "states": len(STATES)},
            assumptions=[
                "EIA weekly retail prices are Monday-stamped survey averages; not seasonally adjusted.",
                "Residential electricity prices are monthly averages and lag by about two months.",
            ],
            caveats=[
                "Only nine states and ten metros have a weekly gasoline series; the receipt "
                "falls back to the state's PADD for the rest and says so.",
                "The SPR figure is crude in storage; it excludes the exchange barrels owed back "
                "to the reserve.",
            ],
            falsifiers=[
                "If a quoted figure differs from the EIA series on its stated date, the "
                "snapshot is stale or wrong and must be rebuilt.",
            ],
            confidence="high",
        ),
    }
