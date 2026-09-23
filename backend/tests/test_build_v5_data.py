"""The V5 cut: a block that cannot refresh must say so loudly, and the
counter-evidence must come from the snapshot, not from the previous file."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts"))

import build_v5_data as V  # noqa: E402


def test_missing_pay_inputs_are_recorded_as_stale():
    V.STALE.clear()
    previous = {"real_yoy_pct": -0.2}
    assert V.pay_block({}, previous) is previous
    assert len(V.STALE) == 1 and "pay" in V.STALE[0]


def _snapshot():
    mk = lambda d, v: {"date": d, "value": v}  # noqa: E731
    series = lambda a, b, c: {"name": "x", "fred_id": "X", "latest": mk(*a), "handover": mk(*b), "prewar": mk(*c)}  # noqa: E731
    return {
        "macro": {
            "series": {
                "sp500": series(("2026-09-22", 7764.6), ("2025-01-17", 5996.7), ("2026-02-13", 6836.2)),
                "mortgage_30y": series(("2026-09-17", 6.95), ("2025-01-16", 7.04), ("2026-02-12", 6.09)),
            },
            "yoy": {"cpi_core": {"latest": mk("2026-08-01", 2.45)}},
        },
        "staples": {"items": [{"key": "eggs", "name": "Eggs", "fred_id": "E", "current_term": {"total_pct": -55.8}}]},
        "jobs": {"monthly_changes": [mk("2026-07-01", 21000), mk("2026-08-01", 162000)],
                 "current_term": {"mean_monthly": 42474}},
        "fiscal": {"customs": {"latest": {"date": "2026-08-01", "value": 1.28e10, "fytd": 1},
                               "months_negative": ["2026-05-01", "2026-06-01", "2026-07-01"]}},
        "crude_daily": {"observations": [mk("2026-08-21", 88.0), mk("2026-09-22", 96.41)]},
    }


def test_against_reads_the_snapshot():
    a = V.against(_snapshot())
    assert a["mortgage"]["latest"]["value"] == 6.95
    assert a["latest_jobs"] == {"date": "2026-08-01", "value": 162000}
    assert a["customs"]["months_negative"][-1] == "2026-07-01"
    assert a["customs"]["latest"] == {"date": "2026-08-01", "value": 1.28e10}


def test_against_crude_compares_with_a_month_earlier_by_date():
    a = V.against(_snapshot())
    assert a["crude"]["month_ago"]["date"] == "2026-08-21"
