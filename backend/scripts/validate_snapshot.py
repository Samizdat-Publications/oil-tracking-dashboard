"""Gate: refuse to ship a snapshot that is missing or stale.

Run after build_snapshot.py and before deploy:

    py scripts/validate_snapshot.py ../frontend/public/data-snapshot.json

Exit 1 with a list of violations, or 0 and a one-line summary. The critical set
is data-driven from `_meta.schema_version` so an older snapshot still validates
against the blocks its page actually reads.

Why this exists: every block in build_snapshot.py fails soft so a local build
always produces a file you can inspect. On CI that is the wrong trade -- a
snapshot with `macro: null` would deploy a page full of dashes. The previous
deploy stays live until a complete one replaces it.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date, datetime

# Blocks the page reads and cannot render without. Version 1 is the August 2026
# page; version 2 adds the September data modules.
CRITICAL: dict[int, list[str]] = {
    1: ["international", "staples", "jobs", "breadth", "scorecard", "macro", "crude_daily",
        "administrations", "receipt", "war_milestones", "context", "_meta"],
    2: ["eia", "fiscal", "chain", "receipt_inputs"],
}
#: May be null or carry an error without failing the gate.
SOFT = ["hormuz_transits", "chokepoints", "nowcast", "polymarket"]

#: (path, max age in days). A stale critical series means the upstream fetch
#: silently returned an old cache or nothing at all.
FRESHNESS: list[tuple[str, int]] = [
    ("crude_daily.observations[-1].date", 10),
    ("macro.series.gasoline_weekly.latest.date", 14),
    # CPI for month M is released mid-M+1 and dated the 1st of M, so the latest
    # print is legitimately up to ~75 days old just before the next release.
    ("macro.series.cpi_headline_nsa.latest.date", 80),
    ("eia.series.spr.latest.date", 14),
    ("fiscal.debt.latest.date", 7),
]

MACRO_YOY_KEYS = ["cpi_energy", "cpi_gasoline", "cpi_airfares", "cpi_food_home",
                  "cpi_headline_nsa", "cpi_core", "pce_core", "pce_headline"]


def _get(obj, path: str):
    """Tiny path resolver: dotted keys, `[i]` indexes (negative allowed)."""
    cur = obj
    for part in path.split("."):
        while "[" in part:
            key, rest = part.split("[", 1)
            idx, part = rest.split("]", 1)
            if key:
                cur = cur[key]
            cur = cur[int(idx)]
            if not part:
                part = None
                break
            part = part.lstrip(".")
        if part:
            cur = cur[part]
    return cur


def _days_since(iso: str, ref: date) -> int:
    return (ref - datetime.strptime(iso[:10], "%Y-%m-%d").date()).days


def validate(snap: dict, *, today: date | None = None) -> list[str]:
    today = today or date.today()
    v: list[str] = []
    meta = snap.get("_meta") or {}
    version = int(meta.get("schema_version", 1))
    generated = meta.get("generated")
    ref = datetime.strptime(generated, "%Y-%m-%d").date() if generated else today

    required = [k for ver, keys in CRITICAL.items() if ver <= version for k in keys]
    for key in required:
        block = snap.get(key)
        if block is None:
            v.append(f"missing critical block: {key}")
        elif isinstance(block, dict) and block.get("error") and len(block) <= 3:
            v.append(f"critical block errored: {key}: {block.get('error')}")

    for key in SOFT:
        if snap.get(key) is None:
            print(f"  warn: soft block absent: {key}")

    for path, max_days in FRESHNESS:
        root = path.split(".")[0].split("[")[0]
        if root not in required:
            continue
        try:
            iso = _get(snap, path)
            age = _days_since(iso, ref)
            if age > max_days:
                v.append(f"stale: {path} = {iso} is {age} days before {ref} (max {max_days})")
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            v.append(f"unreadable: {path} ({type(exc).__name__})")

    macro = snap.get("macro") or {}
    errors = [k for k, s in (macro.get("series") or {}).items() if isinstance(s, dict) and s.get("error")]
    if len(errors) > 3:
        v.append(f"macro: {len(errors)} series errored: {errors}")
    for k in MACRO_YOY_KEYS:
        if not (macro.get("yoy") or {}).get(k, {}).get("latest"):
            v.append(f"macro.yoy.{k}.latest missing")

    # What build-og.mjs needs. Fail here, not inside Playwright.
    intl = snap.get("international") or {}
    if not any(t.get("in_progress") for t in intl.get("terms", [])):
        v.append("international.terms has no in-progress term (OG card)")
    staples = {s.get("key") for s in (snap.get("staples") or {}).get("items", [])}
    for k in ("beef_ground", "coffee"):
        if k not in staples:
            v.append(f"staples missing {k} (OG card)")
    if not (snap.get("jobs") or {}).get("current_term", {}).get("mean_monthly"):
        v.append("jobs.current_term.mean_monthly missing (OG card)")

    receipt = snap.get("receipt") or {}
    m = receipt.get("monthly_usd")
    if not isinstance(m, (int, float)) or not math.isfinite(m):
        v.append("receipt.monthly_usd is not a finite number")
    if len(receipt.get("lines", [])) != 3:
        v.append(f"receipt.lines has {len(receipt.get('lines', []))} entries, expected 3")

    return v


def main(argv: list[str]) -> int:
    path = argv[1] if len(argv) > 1 else "../frontend/public/data-snapshot.json"
    with open(path, encoding="utf-8") as fh:
        snap = json.load(fh)
    violations = validate(snap)
    if violations:
        print("SNAPSHOT REJECTED:")
        for x in violations:
            print("  -", x)
        return 1
    meta = snap.get("_meta", {})
    print(f"snapshot ok: generated {meta.get('generated')}, schema v{meta.get('schema_version', 1)}, "
          f"{len(meta.get('endpoints', []))} blocks")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
