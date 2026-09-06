"""IMF PortWatch -- daily vessel transits through the world's chokepoints.

PortWatch is a joint IMF / Oxford project that estimates daily transit calls
at maritime chokepoints from satellite AIS positions. It is free, needs no
key, and is served as an ArcGIS FeatureServer with `Access-Control-Allow-
Origin: *`, so the browser can read the latest count live as well.

Hormuz is the series that turns the vessel layer in the simulation from
*illustrative* into *measured*. The other chokepoints show where the ships
went: Bab el-Mandeb (the Houthi blockade of Saudi-linked traffic since July),
Suez, and the Cape of Good Hope (the long way round).

What it is NOT: a count of every hull. AIS-dark vessels -- which Iran-linked
traffic increasingly is -- are undercounted, and the IMF says so. The page
labels every figure 'AIS-counted' and never presents one as a queue count.

Docs: https://portwatch.imf.org/
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from services.cache import get_cached, set_cached

log = logging.getLogger(__name__)

FEATURE_URL = (
    "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/"
    "Daily_Chokepoints_Data/FeatureServer/0/query"
)

#: key -> PortWatch portname (the FeatureServer's `portname` field; ids are
#: 'chokepointN' and not stable to reason about, so we filter on the name).
CHOKEPOINTS: dict[str, str] = {
    "hormuz": "Strait of Hormuz",
    "bab_el_mandeb": "Bab el-Mandeb Strait",
    "suez": "Suez Canal",
    "good_hope": "Cape of Good Hope",
    "panama": "Panama Canal",
    "malacca": "Malacca Strait",
}

#: A day; the upstream series updates daily with a lag of roughly a week.
TTL = 86400


def _iso(v) -> str:
    """ArcGIS returns dates either as epoch milliseconds or as 'YYYY-MM-DD'."""
    if isinstance(v, (int, float)):
        return datetime.fromtimestamp(v / 1000, tz=timezone.utc).date().isoformat()
    return str(v)[:10]


async def get_chokepoint_transits(key: str, start: str = "2025-01-01") -> dict:
    """Daily transit counts for one chokepoint from `start`, with a pre-war baseline."""
    name = CHOKEPOINTS[key]
    cache_key = f"portwatch:{key}:v2"
    try:
        hit = await get_cached(cache_key, start, "-", ttl=TTL)
        if hit is not None:
            return hit
    except Exception as exc:  # cache must never take the data path down
        log.warning("portwatch cache read failed: %s", exc)

    params = {
        "where": f"portname = '{name}' AND date >= DATE '{start}'",
        "outFields": "date,portid,n_total,n_tanker,n_cargo,n_container,n_dry_bulk",
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

    feats = body.get("features", [])
    obs = [
        {
            "date": _iso(f["attributes"]["date"]),
            "total": f["attributes"].get("n_total"),
            "tanker": f["attributes"].get("n_tanker"),
            "cargo": f["attributes"].get("n_cargo"),
        }
        for f in feats
    ]
    obs.sort(key=lambda o: o["date"])
    port_id = feats[0]["attributes"].get("portid") if feats else None

    # Baseline: every day from `start` to the last full pre-war day. A year of
    # normal traffic, so a single quiet week cannot move it.
    pre = [o for o in obs if o["date"] <= "2026-02-27" and o["total"] is not None]
    baseline_total = round(sum(o["total"] for o in pre) / len(pre), 1) if pre else None
    baseline_tanker = round(sum(o["tanker"] for o in pre) / len(pre), 1) if pre else None
    last7 = [o for o in obs[-7:] if o["total"] is not None]
    mean7 = round(sum(o["total"] for o in last7) / len(last7), 1) if last7 else None
    tanker7 = round(sum(o["tanker"] for o in last7) / len(last7), 1) if last7 else None

    payload = {
        "key": key,
        "port_id": port_id,
        "name": name,
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
        "recent": {"mean7_total": mean7, "mean7_tanker": tanker7,
                   "pct_of_baseline": round(mean7 / baseline_total * 100, 1)
                   if mean7 is not None and baseline_total else None},
        "observations": obs,
        "latest": obs[-1] if obs else None,
    }
    try:
        await set_cached(cache_key, start, "-", payload)
    except Exception as exc:
        log.warning("portwatch cache write failed: %s", exc)
    return payload


async def get_hormuz_transits(start: str = "2025-01-01") -> dict:
    """Backwards-compatible: the Hormuz series the simulation reads."""
    return await get_chokepoint_transits("hormuz", start)


async def chokepoints_snapshot(start: str = "2025-01-01") -> dict:
    """All tracked chokepoints, observations thinned to the last 120 days each
    (Hormuz keeps its full series in `hormuz_transits`)."""
    results = await asyncio.gather(
        *(get_chokepoint_transits(k, start) for k in CHOKEPOINTS), return_exceptions=True)
    items = {}
    for k, r in zip(CHOKEPOINTS, results):
        if isinstance(r, Exception):
            items[k] = {"key": k, "name": CHOKEPOINTS[k], "error": str(r)}
        else:
            items[k] = {**r, "observations": r["observations"][-120:]}
    return {
        "as_of": datetime.now(tz=timezone.utc).date().isoformat(),
        "items": items,
        "source": "IMF PortWatch", "source_url": "https://portwatch.imf.org/", "tier": 1,
    }
