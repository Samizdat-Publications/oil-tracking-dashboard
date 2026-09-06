"""The gate must reject what the page cannot render, and pass what it can."""

from __future__ import annotations

import json
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts"))

from validate_snapshot import validate  # noqa: E402

TODAY = date(2026, 9, 5)


def _good() -> dict:
    """Minimal v2 snapshot that satisfies every check."""
    mk = lambda d, v: {"date": d, "value": v}  # noqa: E731
    yoy = {k: {"latest": mk("2026-07-01", 3.0)} for k in [
        "cpi_energy", "cpi_gasoline", "cpi_airfares", "cpi_food_home",
        "cpi_headline_nsa", "cpi_core", "pce_core", "pce_headline"]}
    return {
        "_meta": {"generated": "2026-09-05", "schema_version": 2},
        "international": {"terms": [{"key": "trump_2", "in_progress": True}]},
        "staples": {"items": [{"key": "beef_ground"}, {"key": "coffee"}]},
        "jobs": {"current_term": {"mean_monthly": 42474.0}},
        "breadth": {}, "scorecard": {}, "administrations": {}, "war_milestones": [], "context": {},
        "macro": {"series": {"gasoline_weekly": {"latest": mk("2026-08-31", 4.07)},
                             "cpi_headline_nsa": {"latest": mk("2026-07-01", 333.9)}},
                  "yoy": yoy},
        "crude_daily": {"observations": [mk("2026-09-01", 91.48)]},
        "receipt": {"monthly_usd": 83.18, "lines": [{}, {}, {}]},
        "eia": {"series": {"spr": {"latest": mk("2026-08-28", 286604)}}},
        "fiscal": {"debt": {"latest": mk("2026-09-03", 4.01e13)}},
        "chain": {"chains": []},
        "receipt_inputs": {"national": {}},
        "hormuz_transits": None, "chokepoints": None, "nowcast": None, "polymarket": None,
    }


def test_good_snapshot_passes():
    assert validate(_good(), today=TODAY) == []


def test_missing_critical_block_fails():
    snap = _good()
    del snap["macro"]
    v = validate(snap, today=TODAY)
    assert any("missing critical block: macro" in x for x in v)


def test_errored_critical_block_fails():
    snap = _good()
    snap["eia"] = {"error": "EIA_API_KEY is not set", "as_of": "2026-09-05"}
    assert any("critical block errored: eia" in x for x in validate(snap, today=TODAY))


def test_stale_crude_fails_but_soft_blocks_may_be_null():
    snap = _good()
    snap["crude_daily"]["observations"] = [{"date": "2026-08-01", "value": 80.0}]
    v = validate(snap, today=TODAY)
    assert any(x.startswith("stale: crude_daily") for x in v)
    assert not any("hormuz" in x or "nowcast" in x for x in v)


def test_v1_snapshot_not_held_to_v2_blocks():
    snap = _good()
    snap["_meta"]["schema_version"] = 1
    for k in ("eia", "fiscal", "chain", "receipt_inputs"):
        del snap[k]
    assert validate(snap, today=TODAY) == []


def test_og_inputs_are_checked():
    snap = _good()
    snap["staples"]["items"] = [{"key": "beef_ground"}]
    assert any("coffee" in x for x in validate(snap, today=TODAY))


def test_real_snapshot_if_present():
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                        "frontend", "public", "data-snapshot.json")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        snap = json.load(fh)
    gen = snap.get("_meta", {}).get("generated")
    ref = date.fromisoformat(gen) if gen else TODAY
    # Freshness is judged against the snapshot's own generation date, so a
    # committed snapshot stays valid as the calendar moves on.
    assert validate(snap, today=ref) == []
