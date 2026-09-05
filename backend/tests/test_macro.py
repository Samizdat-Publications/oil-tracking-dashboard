"""Tests for services/macro.py -- the ledger's point-in-time readouts.

The one bug these exist to prevent: a 12-month change computed twelve
*observations* back instead of twelve *months* back. October 2025 CPI does not
exist, so positional indexing silently spans thirteen months for every point
after the gap. That error reached a design brief once (3.73% instead of 3.53%).
"""

from __future__ import annotations

from services.macro import nearest_on_or_before, usd_m_to_tonnes_check, yoy_by_calendar_month


def _idx(dates_values):
    return [{"date": d, "value": v} for d, v in dates_values]


def test_yoy_uses_calendar_month_not_position():
    # September 2025 -> October is MISSING -> November. If the code indexed
    # positionally, November 2026 would be compared with October 2025's slot.
    pts = _idx([
        ("2025-08-01", 100.0), ("2025-09-01", 101.0), ("2025-11-01", 103.0),
        ("2025-12-01", 104.0),
        ("2026-08-01", 110.0), ("2026-09-01", 111.1), ("2026-10-01", 112.0),
        ("2026-11-01", 113.3), ("2026-12-01", 114.4),
    ])
    out = {p["date"]: p["value"] for p in yoy_by_calendar_month(pts)}
    assert out["2026-08-01"] == 10.0
    assert out["2026-09-01"] == 10.0
    # No October 2025 -> October 2026 is UNDEFINED, not a 13-month change.
    assert out["2026-10-01"] is None
    assert out["2026-11-01"] == 10.0
    assert out["2026-12-01"] == 10.0


def test_yoy_first_year_is_null_not_dropped():
    pts = _idx([("2025-01-01", 100.0), ("2025-02-01", 100.0), ("2026-01-01", 102.0)])
    out = yoy_by_calendar_month(pts)
    assert [p["date"] for p in out] == ["2025-01-01", "2025-02-01", "2026-01-01"]
    assert out[0]["value"] is None and out[1]["value"] is None
    assert out[2]["value"] == 2.0


def test_nearest_on_or_before_holds_last_observation():
    pts = _idx([("2025-01-17", 1.0), ("2025-01-21", 2.0), ("2025-01-22", 3.0)])
    # The handover is a Monday holiday: no print that day, so Friday's stands.
    assert nearest_on_or_before(pts, "2025-01-20") == {"date": "2025-01-17", "value": 1.0}
    assert nearest_on_or_before(pts, "2025-01-22") == {"date": "2025-01-22", "value": 3.0}
    assert nearest_on_or_before(pts, "2024-12-31") is None


def test_statutory_gold_conversion_matches_frontend():
    # $7,818M at $42.22/oz is about 5,760 tonnes. The page derives tonnes from
    # the Fed's dollar figure with the same arithmetic; keep them in step.
    assert abs(usd_m_to_tonnes_check(7818) - 5759.5) < 1.0
    assert abs(usd_m_to_tonnes_check(8034) - 5918.6) < 1.0
