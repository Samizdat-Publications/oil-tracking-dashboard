"""The landing page's figures come from the V5 data, between <!--fig:--> markers."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts"))

import build_landing as L  # noqa: E402


def test_render_replaces_every_region_and_keeps_the_rest():
    page = "<p><!--fig:asof-->old<!--/fig:asof--></p><ul><!--fig:t-->a<!--/fig:t--></ul><ul><!--fig:t-->a<!--/fig:t--></ul>"
    out = L.render(page, {"asof": "As of 1 Oct 2026", "t": "b"})
    assert out == "<p><!--fig:asof-->As of 1 Oct 2026<!--/fig:asof--></p><ul><!--fig:t-->b<!--/fig:t--></ul><ul><!--fig:t-->b<!--/fig:t--></ul>"


def test_a_missing_region_fails_loudly():
    with pytest.raises(SystemExit):
        L.render("<p>no markers</p>", {"asof": "x"})


def test_the_live_page_has_every_region():
    page = L.LANDING.read_text(encoding="utf-8")
    for name in L.fragments(L.figures()):
        assert "<!--fig:%s-->" % name in page
