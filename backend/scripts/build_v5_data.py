"""Cut the four V5 data files out of frontend/public/data-snapshot.json.

The V5 page ("The Bill") reads five JSON files from frontend/public/v5/. Design
produced the first set by hand from a 6 September snapshot; this script
reproduces them from whatever snapshot is current, so a refresh actually moves
the numbers on the page.

Only four of the five are derived. strait-coast.json, hormuz-coast.json and the
two world-atlas land files are fixed geography and are never rewritten.

The acceptance test is exact: run against the snapshot Design worked from and
every derived file must come back identical to the one Design shipped. --check
does that comparison without writing.

    py scripts/build_v5_data.py           # rewrite frontend/public/v5/*.json
    py scripts/build_v5_data.py --check   # compare only, exit 1 on drift
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PUBLIC = HERE.parent.parent / "frontend" / "public"
SNAPSHOT = PUBLIC / "data-snapshot.json"
OUT = PUBLIC / "v5"

# EIA area codes carry no display name in the snapshot. These are stable labels
# for fixed PADD regions, not anything measured.
AREA_NAMES = {
    "NUS": "United States", "SCA": "California",
    "R5XCA": "West Coast except California", "R50": "West Coast (PADD 5)",
    "R40": "Rocky Mountain (PADD 4)", "R30": "Gulf Coast (PADD 3)",
    "R20": "Midwest (PADD 2)", "R1Z": "Lower Atlantic (PADD 1C)",
    "R1Y": "Central Atlantic (PADD 1B)", "R1X": "New England (PADD 1A)",
    "R10": "East Coast (PADD 1)",
}

# The globe's ship trails start here; earlier history is not drawn.
HORMUZ_DAILY_FROM = "2025-12-01"

# Series behind block 05's readouts, keyed by the name bill-data uses.
BILL_SERIES = {
    "ltu": "long_term_unemployed_share",
    "u6": "u6",
    "unemployment": "unemployment",
    "hires": "hires_rate",
    "quits": "quits_rate",
    "pay": "ahe_yoy",
}


def globe_data(sn):
    ch = sn["chokepoints"]
    items = {}
    for key, it in ch["items"].items():
        items[key] = {
            "name": it["name"],
            "baseline": it["baseline"],
            "recent": it["recent"],
            "latest": it["latest"],
            # The globe draws totals only; tanker/cargo splits are dropped.
            "observations": [[o["date"], o["total"]] for o in it["observations"]],
        }
    daily = [[o["date"], o["total"], o["tanker"]]
             for o in sn["hormuz_transits"]["observations"]
             if o["date"] >= HORMUZ_DAILY_FROM]
    return {
        "as_of": ch["as_of"],
        "source": ch["source"],
        "source_url": ch["source_url"],
        "tier": ch["tier"],
        "note": sn["hormuz_transits"]["note"],
        "items": items,
        "hormuz_daily": daily,
    }


def crude_data(sn):
    cd = sn["crude_daily"]
    obs = [[o["date"], o["value"]] for o in cd["observations"] if o["date"] >= "2026-01-01"]
    peak = max(obs, key=lambda o: o[1])
    pre = [o for o in obs if o[0] <= "2026-02-27"][-1]
    return {
        "series_id": cd["series_id"],
        "name": cd["name"],
        "note": cd["note"],
        "source": "FRED " + cd["series_id"],
        "observations": obs,
        "prestrike": {"date": pre[0], "value": pre[1]},
        "peak": {"date": peak[0], "value": peak[1]},
        # The seismograph marks only what he did: strikes and tariffs.
        "milestones": [{"date": m["date"], "kind": m["kind"], "h": m["headline"]}
                       for m in sn["war_milestones"] if m["kind"] in ("war", "tariff")],
    }


def trim_area(code, v, names):
    """One EIA gasoline region as the state picker needs it.

    The display name comes from whatever the previous file called this code.
    These are stable labels Design chose for EIA area codes (YORD is Chicago,
    SMA is Massachusetts, and so on); the snapshot carries no names, and
    inventing them here would be a fabrication.
    """
    out = {"name": names.get(code, {}).get("name", code),
           "latest": v["latest"], "handover": v["handover"]}
    out["delta"] = round(v["latest"]["value"] - v["handover"]["value"], 3)
    return out


def prices_data(sn, old=None):
    st, eia, ri, rc = sn["staples"], sn["eia"], sn["receipt_inputs"], sn["receipt"]
    old_regions = ((old or {}).get("receipt_inputs") or {}).get("regions") or {}
    items = []
    for it in st["items"]:
        ct = it["current_term"]
        items.append({
            "key": it["key"], "name": it["name"], "note": it["note"],
            "start": ct["start_value"], "end": ct["end_value"], "pct": ct["total_pct"],
            "start_date": ct["start_date"], "end_date": ct["end_date"],
            "fred_id": it["fred_id"],
        })
    dw = sn["macro"]["series"]["diesel_weekly"]
    pts = [[p["date"], p["value"]] for p in dw["points"]]
    return {
        "as_of": {"source": "BLS average price data via FRED", "start": "2015-01-01"},
        "items": items,
        "diesel": {
            "latest": dw["latest"], "handover": dw["handover"], "prewar": dw["prewar"],
            "max": max(p[1] for p in pts), "points": pts, "fred_id": dw["fred_id"],
        },
        "receipt": {
            "monthly_usd": rc["monthly_usd"], "cumulative_usd": rc["cumulative_usd"],
            "months_elapsed": rc["months_elapsed"], "lines": rc["lines"],
            "inputs": rc["inputs"], "assumptions": rc["assumptions"],
            "caveats": rc["envelope"]["caveats"], "baseline_date": rc["baseline_date"],
        },
        "receipt_inputs": {
            "national": ri["national"], "staple_moves": ri["staple_moves"],
            # Trimmed to what the state picker reads. The full region objects
            # carry a weekly points array each, which would roughly double the
            # file for series no block ever draws.
            "regions": {k: trim_area(k, v, old_regions) for k, v in ri["regions"].items()},
            "electricity_by_state": ri["electricity_by_state"],
            "state_to_padd": ri["state_to_padd"], "note": ri["note"],
        },
        "diesel_by_area": {
            k: {"name": AREA_NAMES.get(k, k), "latest": v["latest"], "handover": v["handover"]}
            for k, v in eia["diesel_by_area"].items()
        },
    }


def bill_data(sn, old):
    jb, ms, ctx = sn["jobs"], sn["macro"]["series"], sn["context"]
    out = {
        "jobs": {
            "monthly": [[m["date"], m["value"]] for m in jb["monthly_changes"]],
            "prev": jb["previous_term"],
            "curr": jb["current_term"],
            "ratio": jb["collapse_ratio"],
        },
    }
    for key, src in BILL_SERIES.items():
        s = ms.get(src)
        if s is None:
            # Keep whatever Design shipped rather than blank a readout. A missing
            # series is a snapshot problem; it should not silently empty a block.
            out[key] = old.get(key)
            continue
        out[key] = {
            "name": s.get("name"), "unit": s.get("unit"),
            "latest": s.get("latest"), "handover": s.get("handover"),
            "prewar": s.get("prewar"), "fred_id": s.get("fred_id"),
            "points": [[p["date"], p["value"]] for p in s.get("points", [])],
        }
    out["war_cost"] = ctx["war_cost"]
    out["gold"] = gold(ctx["gold"])
    out["against"] = old.get("against")
    rc = sn["receipt"]
    out["receipt"] = {"monthly_usd": rc["monthly_usd"],
                      "cumulative_usd": rc["cumulative_usd"],
                      "months": rc["months_elapsed"]}
    intl = sn.get("international") or {}
    # Block 08's right-hand panel plots the last three months, not the history.
    out["international"] = {"peers": intl.get("peers"),
                            "latest": (intl.get("series") or [])[-3:]}
    return out


def gold(g):
    """Block 08's vault, from the Fed's Table 3.13 rows.

    The statutory valuation has been $42.22 an ounce since 1973, so a change in
    the dollar row is a change in OUNCES, not in price -- which is the whole
    point of the block, and why tonnes are derived here rather than shown in
    dollars.
    """
    em = g["fed_earmarked_gold"]
    tonnes = lambda usd_m: round(usd_m / 42.22 * 31.1034768, 1)
    earmarked = [[p["date"], p["usd_m"], tonnes(p["usd_m"])] for p in em["points"]]
    tr = g["fed_custody_treasuries"]
    return {
        "earmarked": earmarked,
        "earmarked_src": em["source"],
        "earmarked_url": em["url"],
        "note": em["note"],
        "treasuries": [[p["date"], p["usd_m"]] for p in tr["points"]],
        "moves": g["moves"],
        "fed_counterpoint": g["fed_counterpoint"],
        "gold_price": g["gold_price"],
        "historical": g["historical_custody"],
        "tonnes_out": round(earmarked[0][2] - earmarked[-1][2], 1),
    }


def whole_floats_to_int(o):
    """320938.0 -> 320938.

    Numpy arithmetic upstream turns whole counts into floats. JavaScript cannot
    tell the difference, but JSON can, and leaving them as floats makes every
    rebuild produce a diff against Design's files for no reason.
    """
    if isinstance(o, dict):
        return {k: whole_floats_to_int(v) for k, v in o.items()}
    if isinstance(o, list):
        return [whole_floats_to_int(v) for v in o]
    if isinstance(o, float) and o.is_integer():
        return int(o)
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="compare against what is on disk; do not write")
    args = ap.parse_args()

    sn = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    names = ("globe-data", "crude-data", "prices-data", "bill-data")
    old = {n: json.loads((OUT / (n + ".json")).read_text(encoding="utf-8"))
           for n in names if (OUT / (n + ".json")).exists()}

    built = {
        "globe-data": globe_data(sn),
        "crude-data": crude_data(sn),
        "prices-data": prices_data(sn, old.get("prices-data", {})),
        "bill-data": bill_data(sn, old.get("bill-data", {})),
    }
    built = {k: whole_floats_to_int(v) for k, v in built.items()}

    drift = 0
    for name, doc in built.items():
        path = OUT / (name + ".json")
        same = name in old and old[name] == doc
        if args.check:
            print("  %-14s%s" % (name, "identical" if same else "DIFFERS"))
            drift += 0 if same else 1
        else:
            text = json.dumps(doc, separators=(",", ":"), allow_nan=False)
            path.write_text(text, encoding="utf-8")
            print("  %-14s%9s bytes  %s" % (name, format(len(text), ","),
                                            "unchanged" if same else "updated"))

    if args.check and drift:
        print("\n%d file(s) differ from the snapshot." % drift, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
