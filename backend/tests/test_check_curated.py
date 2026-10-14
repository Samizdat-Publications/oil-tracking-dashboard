"""The hand-checked figures list: due once its interval has passed since the later
of the figure's date and its last check, and --mark keeps the file's formatting."""

from __future__ import annotations

import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts"))

import check_curated as C  # noqa: E402


def _ctx(as_of, checked=None):
    cas = {"as_of": as_of, "us_killed": 1, "wapo_count": {"reported": "2026-01-01"}}
    if checked:
        cas["checked"] = checked
    return {"war_cost": {"casualties": cas}, "gold": {"moves": [], "moves_checked": "2026-10-10"}}


def _row(ctx, path, now):
    return next(r for r in C.rows(ctx, now) if r["path"] == path)


def test_due_after_interval_from_the_later_date():
    now = dt.date(2026, 10, 13)
    assert _row(_ctx("2026-10-01"), "war_cost.casualties", now)["due"]            # 12 days > 7
    assert not _row(_ctx("2026-10-01", "2026-10-12"), "war_cost.casualties", now)["due"]
    assert not _row(_ctx("2026-10-01"), "gold.moves", now)["due"]                 # list stamp on parent


def test_year_month_reads_as_month_end():
    assert C.parse("2026-08") == dt.date(2026, 8, 31)
    assert C.parse("2026-12") == dt.date(2026, 12, 31)


def test_mark_edits_text_and_keeps_nested_stamps_apart(tmp_path, monkeypatch):
    f = tmp_path / "ctx.json"
    f.write_text('{\n  "war_cost": {\n    "casualties": {\n      "as_of": "2026-10-01",\n'
                 '      "wapo_count": { "reported": "2026-09-18", "checked": "2026-01-01" }\n    }\n  },\n'
                 '  "gold": {\n    "moves": [1, 2]\n  }\n}\n', encoding="utf-8")
    monkeypatch.setattr(C, "CONTEXT", f)
    C.mark("war_cost.casualties", "2026-10-13")
    C.mark("war_cost.casualties", "2026-10-14")      # updates rather than adds a second
    C.mark("gold.moves", "2026-10-13")
    d = json.loads(f.read_text(encoding="utf-8"))
    assert d["war_cost"]["casualties"]["checked"] == "2026-10-14"
    assert d["war_cost"]["casualties"]["wapo_count"]["checked"] == "2026-01-01"
    assert d["gold"]["moves_checked"] == "2026-10-13"
    assert '      "as_of": "2026-10-01",' in f.read_text(encoding="utf-8")   # formatting kept
