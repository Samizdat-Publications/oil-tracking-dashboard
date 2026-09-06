"""Follow the barrel -- the transmission chain from the strait to the shelf.

The page asserts that a shut strait becomes a grocery bill. This block shows
it, link by link, with two kinds of evidence per link:

* **Descriptive**: the latest 12-month change and the change since the war
  baseline for each node -- what actually happened.
* **Estimated** (where the pre-war sample allows): the long-run elasticity of
  the downstream series to the upstream one, with a 95% interval and the peak
  lag, from `attribution.passthrough_pair()` fitted on pre-war data only. A
  relationship estimated out of episode and then applied is much harder to
  dismiss than one fitted to the period it is meant to explain.

Links with fewer than 60 aligned pre-war observations, or whose regressor is
not strictly positive, are reported as descriptive only and say so. Qatar's
LNG outage is a `context` figure, not a FRED series, so the fertiliser chain
starts at European gas and the envelope says so.
"""

from __future__ import annotations

import asyncio
from datetime import date

from services import timeseries as tsmod
from services.attribution import HISTORY_START, _envelope, passthrough_pair
from services.fred_client import get_series
from services.macro import nearest_on_or_before, yoy_by_calendar_month
from services.series_catalog import HANDOVER_DATE
from services.timeseries import WAR_BASELINE_DATE, TS

#: key -> (FRED id, name, unit, seasonally adjusted)
NODES: dict[str, tuple[str, str, str, bool]] = {
    "wti": ("DCOILWTICO", "WTI crude, Cushing spot", "usd_bbl", False),
    "diesel": ("GASDESW", "Diesel, US retail (EIA weekly)", "usd_gal", False),
    "truck_ppi": ("PCU484484", "Producer prices: truck transportation", "index", True),
    "cpi_food_home": ("CUUR0000SAF11", "CPI: food at home", "index", False),
    "jet_fuel": ("WJFUELUSGULF", "Jet fuel, US Gulf Coast", "usd_gal", False),
    "cpi_airfares": ("CUUR0000SETG01", "CPI: airline fares", "index", False),
    "eu_gas": ("PNGASEUUSDM", "Natural gas, Europe (IMF)", "usd_mmbtu", False),
    "fertilizer_ppi": ("PCU325311325311", "Producer prices: nitrogenous fertilizer", "index", True),
}

CHAINS: list[dict] = [
    {"key": "diesel_to_food", "title": "From the strait to the shelf",
     "nodes": ["wti", "diesel", "truck_ppi", "cpi_food_home"]},
    {"key": "jet_to_fares", "title": "From the strait to the airport",
     "nodes": ["wti", "jet_fuel", "cpi_airfares"]},
    {"key": "gas_to_fertilizer", "title": "From Qatar's gas to next year's food",
     "nodes": ["eu_gas", "fertilizer_ppi"],
     "preface": ("Qatar's Ras Laffan LNG complex was damaged in the war and will take three to "
                 "five years to repair. That is a context figure, not a FRED series, so this "
                 "chain starts at the European gas price it moved.")},
]

MIN_PREWAR_OBS = 60


async def _load(key: str) -> TS:
    fred_id, name, unit, sa = NODES[key]
    return tsmod.to_ts(await get_series(fred_id, HISTORY_START), key,
                       unit=unit, sa=sa, name=name)


def _pct_since(pts: list[dict], when: str) -> float | None:
    base = nearest_on_or_before(pts, when)
    latest = pts[-1] if pts else None
    if not base or not latest or not base["value"]:
        return None
    return round((latest["value"] / base["value"] - 1.0) * 100.0, 2)


def _node_summary(key: str, ts: TS) -> dict:
    fred_id, name, unit, _ = NODES[key]
    pts = [{"date": str(d), "value": float(v)} for d, v in zip(ts.dates, ts.values)]
    if ts.freq == "M":
        yoy = [p for p in yoy_by_calendar_month(pts) if p["value"] is not None]
        yoy_latest = yoy[-1] if yoy else None
    else:
        # Weekly/daily: same calendar date a year earlier, nearest on or before.
        latest = pts[-1] if pts else None
        yoy_latest = None
        if latest:
            y, rest = latest["date"][:4], latest["date"][4:]
            base = nearest_on_or_before(pts, f"{int(y) - 1}{rest}")
            if base and base["value"]:
                yoy_latest = {"date": latest["date"],
                              "value": round((latest["value"] / base["value"] - 1) * 100, 2)}
    return {
        "key": key, "fred_id": fred_id, "name": name, "unit": unit,
        "url": f"https://fred.stlouisfed.org/series/{fred_id}",
        "frequency": ts.freq, "latest": pts[-1] if pts else None,
        "yoy_pct": yoy_latest["value"] if yoy_latest else None,
        "since_war_pct": _pct_since(pts, WAR_BASELINE_DATE),
        "since_handover_pct": _pct_since(pts, HANDOVER_DATE),
    }


async def _edge(x_key: str, y_key: str, x: TS, y: TS) -> dict:
    edge: dict = {"from": x_key, "to": y_key, "estimable": False, "note": None}
    if not (x.positive and y.positive):
        edge["note"] = "regressor or outcome can be non-positive; no log-elasticity"
        return edge
    try:
        est = await passthrough_pair(x, y, max_lag=8)
    except Exception as exc:  # estimator failure is reported, never hidden
        edge["note"] = f"estimation failed: {type(exc).__name__}"
        return edge
    if est.get("insufficient_data"):
        edge["n_prewar"] = est.get("n_aligned", est.get("n"))
        edge["note"] = f"insufficient pre-war sample ({edge['n_prewar']} aligned obs; need {MIN_PREWAR_OBS})"
        return edge
    lr = est["long_run_elasticity"]
    edge.update({
        "estimable": True, "n_prewar": est["n_obs"], "frequency": est["frequency"],
        "long_run_elasticity": {"value": lr["value"], "lo": lr["lo"], "hi": lr["hi"]},
        "peak_lag_days": est["peak_lag_days"], "r2": est["r2"],
        "significant": bool(lr["lo"] > 0 or lr["hi"] < 0),
        "sample": est["envelope"]["sample"],
        "note": ("pre-war sample; a 1% move in the upstream series is associated with a "
                 f"{lr['value']:.2f}% long-run move in the downstream one"),
    })
    return edge


async def chain_snapshot() -> dict:
    keys = sorted({k for c in CHAINS for k in c["nodes"]})
    loaded = await asyncio.gather(*(_load(k) for k in keys), return_exceptions=True)
    series: dict[str, TS] = {k: v for k, v in zip(keys, loaded) if isinstance(v, TS) and len(v)}
    errors = {k: str(v) for k, v in zip(keys, loaded) if not isinstance(v, TS)}

    chains = []
    for c in CHAINS:
        nodes = [_node_summary(k, series[k]) for k in c["nodes"] if k in series]
        edges = []
        for a, b in zip(c["nodes"], c["nodes"][1:]):
            if a in series and b in series:
                edges.append(await _edge(a, b, series[a], series[b]))
            else:
                edges.append({"from": a, "to": b, "estimable": False,
                              "note": f"series unavailable: {errors.get(a) or errors.get(b)}"})
        chains.append({"key": c["key"], "title": c["title"], "preface": c.get("preface"),
                       "nodes": nodes, "edges": edges})

    return {
        "as_of": date.today().isoformat(),
        "chains": chains,
        "errors": errors,
        "envelope": _envelope(
            "barrel_chain",
            sample={"source": "FRED", "nodes": keys, "history_start": HISTORY_START,
                    "estimation": "pre-war only"},
            assumptions=[
                "Each link is a reduced-form pass-through from the upstream series to the "
                "downstream one, estimated on pre-war data and applied to the episode.",
                "12-month changes for monthly indices are by calendar month (October 2025 is "
                "a gap); weekly and daily series use the nearest print a year earlier.",
            ],
            caveats=[
                "Elasticities are conditional associations, not structural parameters; other "
                "inputs (wages, weather, tariffs) move these prices too.",
                "The fertiliser chain starts at the European gas price; the Qatari outage that "
                "moved it is a context figure, not a series.",
                "Producer price indexes lag retail by a month or more; the chain is drawn in "
                "causal order, not in the order the data arrives.",
            ],
            falsifiers=[
                "If an estimated long-run elasticity were indistinguishable from zero, that "
                "link would not carry the shock and the chain would break there.",
                "If a downstream node moved before its upstream node during the war, the "
                "stated direction would be wrong.",
            ],
            confidence="medium",
        ),
    }
