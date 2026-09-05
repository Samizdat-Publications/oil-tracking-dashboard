"""IMF PortWatch -- daily vessel transits through the Strait of Hormuz.

PortWatch is a joint IMF / Oxford project that estimates daily transit calls
at the world's maritime chokepoints from satellite AIS positions. It is free,
needs no key, and is served as an ArcGIS FeatureServer. This is the series
that turns the vessel layer in the Hormuz simulation from *illustrative* into
*measured*: the flow readout can show a counted number of ships with an
as-of date instead of a stepped IEA figure with gaps.

What it is NOT: a count of every hull. AIS-dark vessels (which Iran-linked
traffic increasingly is) are undercounted, and the IMF says so. The page
labels the series 'AIS-based estimate' for that reason, and never presents
it as a queue count -- no verified queue count exists at any tier.

Docs: https://portwatch.imf.org/  (chokepoint6 = Strait of Hormuz)
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx

from services.cache import get_cached, set_cached

log = logging.getLogger(__name__)

FEATURE_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/"
    "Daily_Chokepoints_Data/FeatureServer/0/query"
)
PORT_ID = "chokepoint6"
PORT_NAME = "Strait of Hormuz"

#: A day; the upstream series updates daily with a lag of roughly a week.
TTL = 86400


def _iso(v) -> str:
    """ArcGIS returns dates either as epoch milliseconds or as 'YYYY-MM-DD'."""
    if isinstance(v, (int, float)):
        return datetime.fromtimestamp(v / 1000, tz=timezone.utc).date().isoformat()
    return str(v)[:10]


async def get_hormuz_transits(start: str = "2025-01-01") -> dict:
    """Daily transit counts through Hormuz from `start`, with a pre-war baseline.

    Returns a payload shaped for the frontend: observations, the baseline used
    to normalise them, and the provenance block. Cached for a day.
    """
    cache_key = "portwatch:hormuz:v1"
    try:
        hit = await get_cached(cache_key, start, "-", ttl=TTL)
        if hit is not None:
            return hit
    except Exception as exc:  # cache must never take the data path down
        log.warning("portwatch cache read failed: %s", exc)

    params = {
        "where": f"portid = '{PORT_ID}' AND date >= DATE '{start}'",
        "outFields": "date,n_total,n_tanker,n_cargo,n_container,n_dry_bulk",
        "orderByFields": "date ASC",
        "resultRecordCount": 4000,
        "f": "json",
    }
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.get(FEATURE_URL, params=params)
        r.raise_for_status()
        body = r.json()
    if "error" in body:
        raise RuntimeError(f"PortWatch: {body['error']}")

    obs = [
        {
            "date": _iso(f["attributes"]["date"]),
            "total": f["attributes"].get("n_total"),
            "tanker": f["attributes"].get("n_tanker"),
            "cargo": f["attributes"].get("n_cargo"),
        }
        for f in body.get("features", [])
    ]
    obs.sort(key=lambda o: o["date"])

    # Baseline: every day from `start` to the last full pre-war day. A year of
    # normal traffic, so a single quiet week cannot move it.
    pre = [o for o in obs if o["date"] <= "2026-02-27" and o["total"] is not None]
    baseline_total = round(sum(o["total"] for o in pre) / len(pre), 1) if pre else None
    baseline_tanker = round(sum(o["tanker"] for o in pre) / len(pre), 1) if pre else None

    payload = {
        "port_id": PORT_ID,
        "name": PORT_NAME,
        "unit": "vessels per day (estimated transit calls)",
        "source": "IMF PortWatch (IMF / University of Oxford), AIS-based estimates",
        "source_url": "https://portwatch.imf.org/",
        "tier": 1,
        "note": (
            "Estimated from satellite AIS positions. Vessels transmitting no position "
            "are not counted, so this is a floor on traffic, not a census -- and it is "
            "not a queue count. Recent days are revised as late AIS data arrives."
        ),
        "baseline": {
            "start": start,
            "end": "2026-02-27",
            "n_days": len(pre),
            "total_per_day": baseline_total,
            "tanker_per_day": baseline_tanker,
        },
        "observations": obs,
        "latest": obs[-1] if obs else None,
    }
    try:
        await set_cached(cache_key, start, "-", payload)
    except Exception as exc:
        log.warning("portwatch cache write failed: %s", exc)
    return payload
