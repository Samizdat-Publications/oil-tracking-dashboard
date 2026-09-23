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

# Series behind block 05's readouts, keyed by the name bill-data uses. The names
# on the right are macro.series keys, and they are not guesses: check them
# against the snapshot rather than against what the block is called. "ltu" reads
# ltu_share, not long_term_unemployed_share, and getting that wrong silently
# froze the long-term-unemployment readout at the value Design shipped.
#
# "pay" is not in here because it is not a series. It is derived, in pay_block().
BILL_SERIES = {
    "ltu": "ltu_share",
    "u6": "u6",
    "unemployment": "unemployment",
    "hires": "hires_rate",
    "quits": "quits_rate",
    # Block 05's note on why claims are low while hiring is frozen.
    "claims": "initial_claims",
    "layoffs": "layoffs_rate",
    "ltu_count": "ltu_count",
    "participation": "participation",
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
            "record": dw.get("record"),
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
            # Keep whatever Design shipped rather than blank a readout, but say
            # so loudly. Falling back quietly is how the ltu mapping stayed
            # wrong: the file still looked right because it held the old values.
            stale("macro.series.%s is missing; bill-data.%s keeps its "
                  "previous values and will not refresh." % (src, key))
            out[key] = old.get(key)
            continue
        out[key] = {
            "name": s.get("name"), "unit": s.get("unit"),
            "latest": s.get("latest"), "handover": s.get("handover"),
            "prewar": s.get("prewar"), "fred_id": s.get("fred_id"),
            "points": [[p["date"], p["value"]] for p in s.get("points", [])],
        }
    out["pay"] = pay_block(ms, old.get("pay"))
    out["war_cost"] = ctx["war_cost"]
    out["gold"] = gold(ctx["gold"])
    out["against"] = against(sn)
    rc = sn["receipt"]
    out["receipt"] = {"monthly_usd": rc["monthly_usd"],
                      "cumulative_usd": rc["cumulative_usd"],
                      "months": rc["months_elapsed"]}
    intl = sn.get("international") or {}
    # Block 08's right-hand panel plots the last three months, not the history.
    out["international"] = {"peers": intl.get("peers"),
                            "latest": (intl.get("series") or [])[-3:]}
    return out


#: Every fallback to a previous value is collected here. A fallback means a
#: block did not refresh; the build fails on it unless --allow-stale is given,
#: because a warning on stderr is how the ltu_share mapping stayed wrong.
STALE: list[str] = []


def stale(msg):
    print("  WARNING: " + msg, file=sys.stderr)
    STALE.append(msg)


def against(sn):
    """Block 10's "what cuts against this page", from the snapshot.

    This used to be carried over from the previous file and never refreshed, so
    the S&P, the mortgage rate and core inflation it held stayed at Design's
    early-September values. The page decides which rows to print from these
    figures; nothing here is phrased.
    """
    ms, yoy = sn["macro"]["series"], sn["macro"].get("yoy") or {}
    pick = lambda s: s and {k: s.get(k) for k in ("name", "fred_id", "latest", "handover", "prewar")}  # noqa: E731
    eggs = next((i for i in sn["staples"]["items"] if i["key"] == "eggs"), None)
    months = sn["jobs"].get("monthly_changes") or []
    customs = (sn.get("fiscal") or {}).get("customs") or {}
    crude = [o for o in sn["crude_daily"]["observations"] if o.get("value") is not None]
    last = crude[-1] if crude else None
    month_ago = None
    if last:
        y, m, d = (int(x) for x in last["date"].split("-"))
        target = "%04d-%02d-%02d" % ((y, m - 1, d) if m > 1 else (y - 1, 12, d))
        month_ago = next((o for o in reversed(crude) if o["date"] <= target), None)
    return {
        "sp500": pick(ms.get("sp500")),
        "mortgage": pick(ms.get("mortgage_30y")),
        "dollar": pick(ms.get("dollar_index")),
        "core_cpi_yoy": (yoy.get("cpi_core") or {}).get("latest"),
        "headline_yoy": (yoy.get("cpi_headline_nsa") or {}).get("latest"),
        "core_pce_yoy": (yoy.get("pce_core") or {}).get("latest"),
        "eggs": eggs and {"name": eggs["name"], "fred_id": eggs["fred_id"],
                          "current_term": eggs["current_term"]},
        "latest_jobs": months[-1] if months else None,
        "jobs_mean": sn["jobs"]["current_term"]["mean_monthly"],
        "customs": customs.get("latest") and {
            "latest": {k: customs["latest"][k] for k in ("date", "value")},
            "months_negative": customs.get("months_negative") or []},
        "crude": last and {"latest": last, "month_ago": month_ago},
    }


def yoy_pct(points, latest_date):
    """Twelve-month percent change, matched by calendar date, not by position.

    Position arithmetic breaks the moment a month is missing from the series,
    and one has been: the October 2025 CPI was never collected during the
    shutdown, so `points[-1] / points[-13]` silently spans thirteen months.
    """
    by_date = {p["date"]: p["value"] for p in points if p.get("value") is not None}
    now = by_date.get(latest_date)
    if now is None:
        return None
    year, month, _ = latest_date.split("-")
    prior = "%04d-%s-01" % (int(year) - 1, month)
    then = by_date.get(prior)
    if not then:
        return None
    return (now / then - 1.0) * 100.0


def pay_block(ms, previous):
    """Block 05's pay readout: earnings against prices, both ways.

    Derived rather than read: the snapshot carries average hourly earnings and
    CPI as levels, and this block wants the real change since the handover and
    the real change over the last year. Both CPI figures use CPIAUCNS, the
    not-seasonally-adjusted series, because that is what the page cites.
    """
    ahe, cpi = ms.get("ahe"), ms.get("cpi_headline_nsa")
    if not ahe or not cpi:
        stale("ahe or cpi_headline_nsa missing; bill-data.pay keeps its "
              "previous values and will not refresh.")
        return previous

    ahe0 = dig(ahe, "handover", "value")
    ahe1 = dig(ahe, "latest", "value")
    cpi0 = dig(cpi, "handover", "value")
    cpi1 = dig(cpi, "latest", "value")
    if None in (ahe0, ahe1, cpi0, cpi1):
        stale("pay inputs incomplete; bill-data.pay keeps its previous "
              "values.")
        return previous

    ahe_yoy = yoy_pct(ahe.get("points", []), ahe["latest"]["date"])
    cpi_yoy = yoy_pct(cpi.get("points", []), cpi["latest"]["date"])
    if ahe_yoy is None or cpi_yoy is None:
        stale("not enough history for a 12-month pay comparison; "
              "bill-data.pay keeps its previous values.")
        return previous

    # Real change is the ratio of the two ratios, not the difference of the two
    # percentages. At these sizes the two nearly agree, which is exactly why the
    # wrong one survives review.
    return {
        "ahe0": ahe0, "ahe1": ahe1, "cpi0": cpi0, "cpi1": cpi1,
        "real_since_handover_pct": ((ahe1 / ahe0) / (cpi1 / cpi0) - 1.0) * 100.0,
        "ahe_yoy_pct": ahe_yoy,
        "cpi_yoy_pct": cpi_yoy,
        "real_yoy_pct": ((1 + ahe_yoy / 100.0) / (1 + cpi_yoy / 100.0) - 1.0) * 100.0,
        "ahe_id": ahe.get("fred_id"), "cpi_id": cpi.get("fred_id"),
        "ahe_date": ahe["latest"]["date"],
    }


def dig(obj, *path):
    for key in path:
        try:
            obj = obj[key]
        except (KeyError, IndexError, TypeError):
            return None
    return obj


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
    ap.add_argument("--allow-stale", action="store_true",
                    help="write even if a block had to keep its previous values")
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

    if STALE and not args.allow_stale:
        print("\n%d block(s) kept their previous values and did not refresh. Fix the "
              "series mapping, or pass --allow-stale to publish them anyway." % len(STALE),
              file=sys.stderr)
        return 2
    if args.check and drift:
        print("\n%d file(s) differ from the snapshot." % drift, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
