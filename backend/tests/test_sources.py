"""Offline tests for the September 2026 data modules.

Parsers and matchers are pure; the network paths are exercised by the
snapshot build, not here.
"""

from __future__ import annotations

from services.nowcast import parse_nowcast
from services.odds import CURATED, match_curated

HTML = """
<table><tr><th>Month</th><th>CPI</th><th>Core CPI</th><th>PCE</th><th>Core PCE</th><th>Updated</th></tr>
<tr><td>September 2026</td><td>0.38</td><td>0.19</td><td>0.38</td><td>0.28</td><td>09/04</td></tr>
<tr><td>August 2026</td><td>0.36</td><td>0.20</td><td>0.35</td><td>0.27</td><td>09/04</td></tr>
<tr><td colspan="6">Note: If the cell is blank, the actual data have been released.</td></tr></table>
<table><tr><th>Month</th><th>CPI</th><th>Core CPI</th><th>PCE</th><th>Core PCE</th><th>Updated</th></tr>
<tr><td>September 2026</td><td>3.43</td><td>2.32</td><td>3.91</td><td>3.49</td><td>09/04</td></tr>
<tr><td>August 2026</td><td>3.38</td><td>2.38</td><td>3.80</td><td>3.40</td><td>09/04</td></tr></table>
<table><tr><th>Quarter</th><th>CPI</th><th>Core CPI</th><th>PCE</th><th>Core PCE</th><th>Updated</th></tr>
<tr><td>2026:Q3</td><td>1.27</td><td>1.91</td><td>2.49</td><td>3.00</td><td>09/04</td></tr></table>
"""


def test_nowcast_parses_monthly_yoy_and_quarterly():
    out = parse_nowcast(HTML)
    assert out is not None
    assert out["yoy"][1] == {"period": "August 2026", "cpi": 3.38, "core_cpi": 2.38,
                             "pce": 3.80, "core_pce": 3.40, "updated": "09/04"}
    assert out["monthly"][0]["cpi"] == 0.38
    assert out["quarterly"][0]["period"] == "2026:Q3"


def test_nowcast_blank_cells_and_layout_change_fail_soft():
    # A released month renders blank cells: the row is skipped, not zeroed.
    html = HTML.replace("<td>3.38</td><td>2.38</td><td>3.80</td><td>3.40</td>",
                        "<td></td><td></td><td></td><td></td>")
    out = parse_nowcast(html)
    assert [r["period"] for r in out["yoy"]] == ["September 2026"]
    # No recognisable tables at all -> None, never a number.
    assert parse_nowcast("<html><body><p>moved</p></body></html>") is None


def test_curated_odds_match_and_dash_when_absent():
    markets = [
        {"id": "1", "question": "Will the Fed increase interest rates by 25 bps after the September 2026 meeting?",
         "outcomePrices": '["0.495", "0.505"]', "volumeNum": 1234.5, "slug": "fed-hike-sept", "endDate": "2026-09-17"},
        {"id": "2", "question": "Will the Iranian regime fall before 2027?",
         "outcomePrices": '["0.065", "0.935"]', "volume": "99", "slug": "regime"},
    ]
    out = {m["key"]: m for m in match_curated(markets)}
    assert set(out) == {k for k, _, _ in CURATED}
    assert out["fed_hike_sept"]["matched"] and abs(out["fed_hike_sept"]["yes_probability"] - 0.495) < 1e-9
    assert out["fed_hike_sept"]["source_url"].endswith("/fed-hike-sept")
    assert out["regime_2026"]["volume_usd"] == 99.0
    assert out["blockade_end_sept"] == {"key": "blockade_end_sept",
                                        "label": "US announces end of the Iranian blockade by 30 September",
                                        "matched": False, "yes_probability": None}
