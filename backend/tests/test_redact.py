"""No API key may reach the published snapshot (2026-11-05: an error message did)."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services import redact  # noqa: E402

URL = "Client error for url 'https://api.stlouisfed.org/fred/series/observations?series_id=X&api_key=abcd1234ef567890&file_type=json'"


def test_scrub_removes_query_keys():
    out = redact.scrub(URL)
    assert "abcd1234" not in out and "api_key=REDACTED&file_type=json" in out
    assert redact.leaks(out) == []


def test_leaks_finds_a_key_in_a_url():
    assert redact.leaks(URL)


def test_a_bare_configured_key_is_caught(monkeypatch):
    monkeypatch.setenv("EIA_API_KEY", "zzzz9999yyyy8888")
    text = "error: token zzzz9999yyyy8888 rejected"
    assert redact.leaks(text)
    assert "zzzz9999" not in redact.scrub(text)
