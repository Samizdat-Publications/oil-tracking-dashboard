"""Append this refresh's headline figures to docs/refresh-history.csv.

One row per refresh, so there is a record of what the site said and when. The
site itself only ever shows the latest numbers; this is the only place the
history is kept, and it is committed alongside the data it describes.

Every value is read from frontend/public/data-snapshot.json. Nothing is typed
in, and a missing field records as empty rather than guessing.

    py scripts/record_refresh.py            append a row, print what moved
    py scripts/record_refresh.py --dry      print what moved, write nothing
"""
import argparse
import csv
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SNAPSHOT = ROOT / "frontend" / "public" / "data-snapshot.json"
HISTORY = ROOT / "docs" / "refresh-history.csv"


def dig(obj, *path, default=None):
    """Walk a path of dict keys / list indices, returning default on any miss."""
    for key in path:
        try:
            obj = obj[key]
        except (KeyError, IndexError, TypeError):
            return default
    return obj if obj is not None else default


def staple(sn, key, field="end_value"):
    for item in dig(sn, "staples", "items", default=[]):
        if item.get("key") == key:
            return dig(item, "current_term", field)
    return None


# (column, how to read it, how many decimals when printing a change)
FIELDS = [
    ("snapshot_generated", lambda s: dig(s, "_meta", "generated"), None),
    ("crude_last_date", lambda s: dig(s, "crude_daily", "observations", -1, "date"), None),
    ("crude_last", lambda s: dig(s, "crude_daily", "observations", -1, "value"), 2),
    ("crude_peak", lambda s: max((o["value"] for o in dig(s, "crude_daily", "observations", default=[])
                                  if o["date"] >= "2026-01-01"), default=None), 2),
    ("hormuz_mean7", lambda s: dig(s, "hormuz_transits", "recent", "mean7_total"), 1),
    ("hormuz_pct_baseline", lambda s: dig(s, "hormuz_transits", "recent", "pct_of_baseline"), 1),
    ("diesel", lambda s: dig(s, "macro", "series", "diesel_weekly", "latest", "value"), 3),
    ("gasoline", lambda s: staple(s, "gasoline_ap"), 3),
    ("beef_ground", lambda s: staple(s, "beef_ground"), 3),
    ("coffee", lambda s: staple(s, "coffee"), 3),
    ("eggs", lambda s: staple(s, "eggs"), 3),
    ("electricity", lambda s: staple(s, "electricity"), 3),
    ("jobs_per_month_now", lambda s: dig(s, "jobs", "current_term", "mean_monthly"), 0),
    ("jobs_per_month_prev", lambda s: dig(s, "jobs", "previous_term", "mean_monthly"), 0),
    # macro.series.ltu_share, not long_term_unemployed_share. The longer name
    # reads like the right one and silently records nothing.
    ("long_term_unemployed_pct",
     lambda s: dig(s, "macro", "series", "ltu_share", "latest", "value"), 1),
    ("receipt_monthly_usd", lambda s: dig(s, "receipt", "monthly_usd"), 2),
    ("receipt_cumulative_usd", lambda s: dig(s, "receipt", "cumulative_usd"), 2),
    ("us_inflation_excess", lambda s: next(
        (t.get("excess") for t in dig(s, "international", "terms", default=[]) if t.get("in_progress")), None), 2),
    ("war_cost_usd_bn", lambda s: dig(s, "context", "war_cost", "dod_cost", "usd_bn"), 1),
]


def read_rows():
    if not HISTORY.exists():
        return []
    with io.open(HISTORY, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="print what moved, write nothing")
    args = ap.parse_args()

    if not SNAPSHOT.exists():
        print("record: %s not found. Run build_snapshot.py first." % SNAPSHOT, file=sys.stderr)
        return 1

    sn = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    row = {"refreshed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    for name, read, _ in FIELDS:
        value = read(sn)
        row[name] = "" if value is None else value

    previous = read_rows()
    header = ["refreshed_at"] + [f[0] for f in FIELDS]

    # Show what moved since the last recorded refresh. This is the part worth
    # reading; the CSV is for later.
    if previous:
        last = previous[-1]
        moved = []
        for name, _, places in FIELDS:
            old, new = str(last.get(name, "")), str(row[name])
            if old == new or old == "" or new == "":
                continue
            if places is None:
                moved.append("  %-26s %s -> %s" % (name, old, new))
                continue
            try:
                a, b = float(old), float(new)
            except ValueError:
                moved.append("  %-26s %s -> %s" % (name, old, new))
                continue
            delta = b - a
            pct = (delta / a * 100) if a else 0.0
            moved.append("  %-26s %s -> %s  (%+.*f, %+.1f%%)"
                         % (name, format(a, ",.%df" % places), format(b, ",.%df" % places),
                            places, delta, pct))
        print("Since the last refresh (%s):" % last.get("refreshed_at", "?"))
        print("\n".join(moved) if moved else "  nothing moved")
    else:
        print("First recorded refresh. Baseline:")
        for name, _, _ in FIELDS:
            print("  %-26s %s" % (name, row[name]))

    if args.dry:
        print("\n--dry: nothing written.")
        return 0

    HISTORY.parent.mkdir(parents=True, exist_ok=True)
    fresh = not HISTORY.exists()
    with io.open(HISTORY, "a", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=header)
        if fresh:
            writer.writeheader()
        writer.writerow(row)
    print("\nrecorded to %s (%d refreshes now)" % (HISTORY.relative_to(ROOT), len(previous) + 1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
