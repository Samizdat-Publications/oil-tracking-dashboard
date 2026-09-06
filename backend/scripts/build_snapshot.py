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
import math
import os
import sys
import time
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np  # noqa: E402

from services import attribution as A  # noqa: E402
from services.cache import close_cache, init_cache  # noqa: E402
from services.chain import chain_snapshot  # noqa: E402
from services.eia import eia_snapshot  # noqa: E402
from services.fiscal import fiscal_snapshot  # noqa: E402
from services.fred_client import get_series  # noqa: E402
from services.macro import macro_snapshot  # noqa: E402
from services.nowcast import cleveland_nowcast  # noqa: E402
from services.odds import odds_snapshot  # noqa: E402
from services.portwatch import chokepoints_snapshot, get_hormuz_transits  # noqa: E402

#: Blocks the page cannot render without. validate_snapshot.py enforces these;
#: everything else may fail soft and render as "no data".
SCHEMA_VERSION = 2
CRITICAL = ["international", "staples", "jobs", "breadth", "scorecard", "macro", "crude_daily",
            "administrations", "receipt", "war_milestones", "context",
            "eia", "fiscal", "chain", "receipt_inputs"]
SOFT = ["hormuz_transits", "chokepoints", "nowcast", "polymarket"]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "..", "frontend", "public", "data-snapshot.json")
DATA = os.path.join(ROOT, "data")


def to_json_safe(obj):
    """Coerce numpy scalars to Python and non-finite floats to null.

    FastAPI's encoder handles numpy transparently, so the live endpoints work
    while `json.dump` on the same payload raises -- `np.bool_` is not a `bool`
    as far as the stdlib encoder is concerned. Anything reaching the snapshot
    has to survive plain serialisation.

    NaN and Inf matter more: `json.dump` writes them as bare `NaN` / `Infinity`,
    which is not valid JSON and makes `JSON.parse` throw in the browser. A null
    renders as a gap, which is what a missing value should look like anyway.
    """
    if isinstance(obj, dict):
        return {k: to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_json_safe(v) for v in obj]
    if isinstance(obj, np.generic):
        obj = obj.item()
    if isinstance(obj, float) and not math.isfinite(obj):
        return None
    return obj


ADMIN_METRICS = ["jobs", "cpi_headline", "gasoline_ap", "beef_ground",
                 "real_earnings", "unemployment", "sp500"]


def _load_json(name: str):
    with open(os.path.join(DATA, name), encoding="utf-8") as fh:
        return json.load(fh)


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
        ("macro", macro_snapshot()),
        ("eia", eia_snapshot()),
        ("fiscal", fiscal_snapshot()),
        ("chain", chain_snapshot()),
        ("receipt_inputs", A.receipt_inputs()),
    ]:
        print(f"  {name} ...", flush=True)
        snap[name] = await coro

    # The receipt picker needs regional prices; merge them in from EIA so the
    # frontend has one block to read.
    eia = snap.get("eia") or {}
    if isinstance(snap.get("receipt_inputs"), dict) and not eia.get("error"):
        snap["receipt_inputs"]["regions"] = eia.get("gasoline_by_area", {})
        snap["receipt_inputs"]["electricity_by_state"] = eia.get("electricity_by_state", {})
        snap["receipt_inputs"]["state_to_padd"] = eia.get("state_to_padd", {})

    # Soft blocks: useful, not load-bearing. A failure here is logged, the block
    # is null, and the page renders "no data" for it.
    for name, coro in [
        ("chokepoints", chokepoints_snapshot()),
        ("nowcast", cleveland_nowcast()),
        ("polymarket", odds_snapshot()),
    ]:
        print(f"  {name} (soft) ...", flush=True)
        try:
            snap[name] = await coro
        except Exception as exc:
            print(f"    unavailable: {exc}", flush=True)
            snap[name] = None

    snap["administrations"] = {}
    for m in ADMIN_METRICS:
        print(f"  administrations/{m} ...", flush=True)
        snap["administrations"][m] = await A.administrations(m)

    # Daily crude for the masthead chart and the strait simulation. The first
    # build of the page drew straight lines between four verified closes because
    # this was not wired; the dailies remove that caveat.
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
                 "chart. The spot peak is $114.58 on 7 Apr 2026, the day the first "
                 "ceasefire was announced; an earlier version of the page quoted "
                 "$114.01 on 6 Apr, which is the previous day's close."),
        "observations": obs,
    }

    # IMF PortWatch: measured daily transits. This is what turns the vessel layer
    # from illustrative into a real series. Failure here is loud, not silent --
    # the page would otherwise fall back to the stepped IEA figures and say so.
    print("  hormuz_transits ...", flush=True)
    try:
        snap["hormuz_transits"] = await get_hormuz_transits("2025-01-01")
    except Exception as exc:
        print(f"    PortWatch unavailable: {exc}", flush=True)
        snap["hormuz_transits"] = None

    snap["war_milestones"] = _load_json("war_milestones.json")
    snap["context"] = _load_json("context_figures.json")

    snap["_meta"] = {
        "generated": date.today().isoformat(),
        "schema_version": SCHEMA_VERSION,
        "critical": CRITICAL,
        "soft": SOFT,
        "note": ("Real endpoint responses. Shape matches /api/attribution/<key> "
                 "exactly, so the frontend can swap snapshot -> api with no other "
                 "change. `context` mirrors data/context_figures.json: curated, "
                 "tiered figures that do not live on FRED."),
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

    # Serialise and validate fully in memory, then write the target in a single
    # call. Temp-file-plus-os.replace is the right approach on a normal
    # filesystem, but this repo sits in a OneDrive-synced folder where the sync
    # client takes a hard lock: replace, unlink and rename all fail with
    # WinError 5. An earlier version's cleanup handler then deleted the
    # freshly-built temp file on the way out, losing the good data.
    payload = json.dumps(to_json_safe(snap), separators=(",", ":"),
                         allow_nan=False)
    json.loads(payload)  # fail here, not in the browser

    last: Exception | None = None
    for i in range(12):
        try:
            with open(target, "w", encoding="utf-8") as fh:
                fh.write(payload)
                fh.flush()
                os.fsync(fh.fileno())
            break
        except PermissionError as exc:  # OneDrive mid-upload
            last = exc
            time.sleep(0.25 * (i + 1))
    else:
        raise RuntimeError(
            f"could not write {target} -- OneDrive or an editor is holding it "
            f"open. Pause syncing and re-run."
        ) from last

    with open(target, encoding="utf-8") as fh:
        json.load(fh)  # confirm what actually landed on disk

    print(f"\nwrote {target} ({os.path.getsize(target):,} bytes)")
    print(f"keys: {', '.join(snap['_meta']['endpoints'])}")
    print(f"crude daily closes: {len(snap['crude_daily']['observations'])}")
    ht = snap.get("hormuz_transits")
    if ht:
        print(f"hormuz transits: {len(ht['observations'])} days, latest {ht['latest']}")


if __name__ == "__main__":
    asyncio.run(main())
