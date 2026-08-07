"""Build frontend/public/data-snapshot.json.

The snapshot lets the frontend render real data without a running backend --
Claude Design cannot reach localhost, and Cloudflare Pages serves a static
bundle. Shapes are identical to the live endpoints, so `SOURCE` in
`frontend/src/v4/data.ts` flips between them with no other change.

Writes atomically. A previous version wrote straight to the target and a killed
background job left a half-written file that parsed as valid until the very last
byte -- the kind of corruption that shows up as a blank chart in production
rather than an error.

Run from `backend/`:  py scripts/build_snapshot.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import attribution as A  # noqa: E402
from services.cache import close_cache, init_cache  # noqa: E402
from services.fred_client import get_series  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "..", "frontend", "public", "data-snapshot.json")

ADMIN_METRICS = ["jobs", "cpi_headline", "gasoline_ap", "beef_ground",
                 "real_earnings", "unemployment", "sp500"]


async def build() -> dict:
    snap: dict = {}

    for name, coro in [
        ("international", A.international_comparison()),
        ("staples", A.staples_ledger()),
        ("jobs", A.jobs_ledger()),
        ("breadth", A.breadth_test()),
        ("scorecard", A.scorecard()),
        ("event_study", A.war_event_study("wti")),
        ("receipt", A.receipt(miles_per_week=240, household_size=2)),
    ]:
        print(f"  {name} ...", flush=True)
        snap[name] = await coro

    snap["administrations"] = {}
    for m in ADMIN_METRICS:
        print(f"  administrations/{m} ...", flush=True)
        snap["administrations"][m] = await A.administrations(m)

    # Daily crude for the strait simulation. Design fell back to a handful of
    # anchors with straight lines between them because this was not wired; real
    # dailies remove that caveat and the "DRAWN STRAIGHT BETWEEN CLOSES" legend.
    print("  crude_daily ...", flush=True)
    obs = await get_series("DCOILWTICO", "2025-01-01")
    snap["crude_daily"] = {
        "series_id": "DCOILWTICO",
        "name": "WTI Crude, Cushing spot",
        "unit": "usd_bbl",
        "source": "FRED",
        "note": ("Cushing SPOT, not front-month futures. Press figures for 8 Jul 2026 "
                 "quote $73.52 from the futures contract; spot closed $74.56. Both are "
                 "correct and they are different instruments -- do not mix them on one "
                 "chart."),
        "observations": obs,
    }

    milestones_path = os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), "data", "war_milestones.json")
    with open(milestones_path, encoding="utf-8") as fh:
        snap["war_milestones"] = json.load(fh)

    snap["_meta"] = {
        "generated": "2026-08-07",
        "note": ("Real endpoint responses. Shape matches /api/attribution/<key> "
                 "exactly, so the frontend can swap snapshot -> api with no other "
                 "change."),
        "endpoints": sorted(k for k in snap if not k.startswith("_")),
    }
    return snap


async def main() -> None:
    await init_cache()
    try:
        snap = await build()
    finally:
        await close_cache()

    target = os.path.abspath(OUT)
    os.makedirs(os.path.dirname(target), exist_ok=True)

    # Write to a temp file in the same directory, then replace. os.replace is
    # atomic on both POSIX and Windows, so a killed job leaves the previous
    # good file rather than a truncated one.
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(target), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(snap, fh, separators=(",", ":"))
            fh.flush()
            os.fsync(fh.fileno())
        # Fail loudly here rather than shipping something the browser chokes on.
        with open(tmp, encoding="utf-8") as fh:
            json.load(fh)
        os.replace(tmp, target)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise

    print(f"\nwrote {target} ({os.path.getsize(target):,} bytes)")
    print(f"keys: {', '.join(snap['_meta']['endpoints'])}")
    print(f"crude daily closes: {len(snap['crude_daily']['observations'])}")


if __name__ == "__main__":
    asyncio.run(main())
