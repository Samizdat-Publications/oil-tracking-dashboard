"""Tests for the shared time-series layer.

The yoy tests exist because of a real shipped bug: positional 12-observation
indexing silently spanned 13 calendar months for every point after the missing
October 2025 CPI, reporting June 2026 headline inflation as 3.73% against the
true 3.53%. Plausible-looking, wrong, and it survived review.
"""

from __future__ import annotations

import numpy as np
import pytest

from services import timeseries as tsmod


def _monthly(start: str, values: list[float], skip: set[str] | None = None):
    """Monthly observations dated to the 1st, optionally omitting months."""
    skip = skip or set()
    obs = []
    d = np.datetime64(start, "M")
    for v in values:
        iso = f"{d}-01"
        if iso not in skip:
            obs.append({"date": iso, "value": v})
        d += 1
    return obs


def test_yoy_matches_by_calendar_date_across_a_gap():
    """**The October 2025 regression.**

    A series rising exactly 1% a month, with one month missing. Every 12-month
    change must still be ~12.68% (1.01^12). Positional indexing returns ~13.8%
    for points after the hole because it reaches back 13 months.
    """
    values = [100.0 * (1.01 ** i) for i in range(40)]
    ts = tsmod.to_ts(_monthly("2024-01", values, skip={"2025-10-01"}),
                     "gapped", unit="index")

    dates, vals = tsmod.yoy(ts)
    assert dates.size > 0
    expected = (1.01 ** 12 - 1) * 100.0
    assert np.allclose(vals, expected, atol=1e-6), (
        f"expected every point ~{expected:.3f}%, got "
        f"min {vals.min():.3f} max {vals.max():.3f}"
    )


def test_yoy_omits_months_whose_base_is_missing():
    """A gap is a gap. The month 12 after the hole has no base and is dropped."""
    values = [100.0 + i for i in range(30)]
    ts = tsmod.to_ts(_monthly("2024-01", values, skip={"2024-06-01"}),
                     "gapped", unit="index")
    dates, _ = tsmod.yoy(ts)
    assert "2025-06-01" not in {str(d) for d in dates}


def test_yoy_on_a_clean_series_is_exact():
    values = [100.0 * (1.005 ** i) for i in range(30)]
    ts = tsmod.to_ts(_monthly("2023-01", values), "clean", unit="index")
    _, vals = tsmod.yoy(ts)
    assert vals == pytest.approx((1.005 ** 12 - 1) * 100.0, abs=1e-6)


def test_fit_window_refuses_to_leak_post_war_data():
    """The leakage guard must raise, not warn."""
    values = [50.0 + i for i in range(60)]
    ts = tsmod.to_ts(_monthly("2022-01", values), "wti", unit="usd_bbl")
    pre = tsmod.fit_window(ts, months=24)
    assert pre.end < tsmod.WAR_DATE
    # January 2026 is the last month ending before 2026-02-28.
    assert pre.end == "2026-01-01"


def test_resample_refuses_to_upsample():
    ts = tsmod.to_ts(_monthly("2024-01", [1.0] * 12), "m", unit="index")
    with pytest.raises(ValueError, match="upsample"):
        tsmod.resample(ts, "D")


def test_non_positive_series_are_never_logged():
    obs = [{"date": f"2024-{m:02d}-01", "value": v}
           for m, v in enumerate([-0.5, 0.2, -0.1, 0.4], start=1)]
    ts = tsmod.to_ts(obs, "spread", unit="pct", positive=False)
    with pytest.raises(ValueError, match="non-positive"):
        tsmod.logs(ts)


def test_find_gaps_surfaces_the_hole():
    values = [100.0 + i for i in range(24)]
    ts = tsmod.to_ts(_monthly("2024-01", values, skip={"2025-01-01"}),
                     "gapped", unit="index")
    gaps = tsmod.find_gaps(ts)
    assert len(gaps) == 1
    assert gaps[0]["missing_periods"] == 1
