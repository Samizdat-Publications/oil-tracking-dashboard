"""Pin the receipt arithmetic.

`receipt_lines()` is pure and is ported line-for-line to
frontend/src/v4/receipt.ts. Both read `fixtures/receipt_fixture.json`; if either
drifts from the committed expected values the page would show two different
bills for the same household, which is the one thing a receipt must not do.
Regenerate the fixture deliberately with `py tests/make_receipt_fixture.py`.
"""

from __future__ import annotations

import json
import os

from services.attribution import RECEIPT_ASSUMPTIONS, receipt_lines

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "receipt_fixture.json")


def _load():
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


def test_fixture_cases_reproduce_exactly():
    fx = _load()
    moves = [i["move"] for i in fx["inputs"]["staple_moves"]["items"]]
    for case in fx["cases"]:
        lines = receipt_lines(fx["inputs"]["national"], moves,
                              miles_per_week=case["miles_per_week"],
                              household_size=case["household_size"],
                              assumptions=RECEIPT_ASSUMPTIONS)
        got = {l["key"]: l["monthly_usd"] for l in lines}
        assert got == case["expected"], case


def test_zero_miles_zero_fuel_and_groceries_scale_with_household():
    fx = _load()
    moves = [i["move"] for i in fx["inputs"]["staple_moves"]["items"]]
    one = receipt_lines(fx["inputs"]["national"], moves, miles_per_week=0, household_size=1,
                        assumptions=RECEIPT_ASSUMPTIONS)
    four = receipt_lines(fx["inputs"]["national"], moves, miles_per_week=0, household_size=4,
                         assumptions=RECEIPT_ASSUMPTIONS)
    by = lambda ls: {l["key"]: l["monthly_usd"] for l in ls}  # noqa: E731
    assert by(one)["fuel"] == 0.0
    assert abs(by(four)["groceries"] - 4 * by(one)["groceries"]) < 0.05
    assert by(one)["electricity"] == by(four)["electricity"]


def test_refuses_unsourced_assumption():
    import asyncio

    import pytest

    from services.attribution import receipt

    bad = {**RECEIPT_ASSUMPTIONS, "vehicle_mpg": {"value": 30, "unit": "mpg", "source": ""}}
    # receipt() checks sources before any I/O, so this raises without a network call.
    with pytest.raises(ValueError):
        asyncio.run(receipt(assumptions=None) if False else _raise(bad))


def _raise(a):
    async def run():
        from services import attribution
        saved = attribution.RECEIPT_ASSUMPTIONS
        attribution.RECEIPT_ASSUMPTIONS = a
        try:
            await attribution.receipt()
        finally:
            attribution.RECEIPT_ASSUMPTIONS = saved
    return run()
