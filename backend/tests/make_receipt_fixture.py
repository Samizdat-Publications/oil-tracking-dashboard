"""Regenerate tests/fixtures/receipt_fixture.json from live inputs.

Run deliberately, from backend/:  py tests/make_receipt_fixture.py
The fixture pins Python and TypeScript to the same bill; regenerating it is a
conscious act, not a side effect of a test run.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.attribution import RECEIPT_ASSUMPTIONS, receipt_inputs, receipt_lines  # noqa: E402
from services.cache import close_cache, init_cache  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "receipt_fixture.json")
CASES = [(240, 2), (0, 1), (100, 1), (500, 4), (240, 3)]


async def main() -> None:
    await init_cache()
    try:
        inputs = await receipt_inputs()
    finally:
        await close_cache()
    moves = [i["move"] for i in inputs["staple_moves"]["items"]]
    cases = []
    for miles, hh in CASES:
        lines = receipt_lines(inputs["national"], moves, miles_per_week=miles,
                              household_size=hh, assumptions=RECEIPT_ASSUMPTIONS)
        cases.append({"miles_per_week": miles, "household_size": hh,
                      "expected": {l["key"]: l["monthly_usd"] for l in lines}})
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump({"inputs": {k: inputs[k] for k in ("baseline_date", "national", "staple_moves", "assumptions")},
                   "cases": cases}, fh, indent=2)
    print(f"wrote {OUT}: {cases}")


if __name__ == "__main__":
    asyncio.run(main())
