"""Which hand-checked figures on The Bill are due for a look.

Most of the page refreshes itself from FRED, EIA, PortWatch and the Treasury.
The rest lives in backend/data/context_figures.json, typed in from a named
source: the Pentagon's war cost, the casualty count, the CRS aircraft tally, the
Fed's gold custody table and so on. Nothing tells you when those have moved, so
on 13 Oct 2026 the page was still showing 42 aircraft (CRS had said 81 for a
week) and gold "down a fifth" (it was down a quarter).

This lists every such figure the page shows, with how often it should be
looked at, when its data is dated, and when someone last confirmed it. A
figure is due once its interval has passed since the later of the two.

    py scripts/check_curated.py              # the table, due ones first
    py scripts/check_curated.py --due        # only what is due
    py scripts/check_curated.py --mark war_cost.casualties
                                             # looked, nothing newer: stamp "checked"

--mark edits the JSON as text, adding or updating a "checked" date on that
object, so the file's hand formatting survives. It always exits 0: being due
is a reminder, not a failure. refresh.ps1 prints the table on every run.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTEXT = HERE.parent / "data" / "context_figures.json"

# path, date field(s), days between looks, what it is on the page, where to look.
WATCH = [
    ("war_cost.casualties", ("as_of",), 7,
     "US service members killed and wounded (block 06, the card)",
     "Pentagon Defense Casualty Analysis System (dcas.dmdc.osd.mil); AP, Reuters on revisions. "
     "Also re-check wapo_count if the official count reaches it."),
    ("war_cost.dod_cost", ("as_of", "reported"), 14,
     "Pentagon's war cost to date (blocks 06 and 07, the card)",
     "Pentagon estimates to Congress: Roll Call, Reuters, Politico, appropriations hearings. "
     "Move the old figure into prior / prior_2."),
    ("war_cost.supplemental_request", (), 30,
     "War funding requested from Congress (block 06's dashed bar)",
     "DoD / OMB supplemental requests; CSIS; whether Congress has passed it."),
    ("war_cost.aircraft", ("as_of",), 30,
     "Aircraft lost or damaged, by type (blocks 06 and 07)",
     "CRS IN12692 (congress.gov/crs-product/IN12692), Military Times, Defense News. "
     "If the total grows, keep dod_loss_estimate_covers on what the Pentagon actually priced."),
    ("war_cost.cbo_estimate", ("release",), 45,
     "CBO's independent war cost (block 06)",
     "cbo.gov publications on the Iran operations."),
    ("war_cost.munitions", ("as_of",), 30,
     "Patriot interceptors left, and the denial (block 06)",
     "CSIS, CNN, Stars and Stripes on interceptor stocks; any Pentagon statement."),
    ("gold.fed_earmarked_gold", ("as_of",), 30,
     "Gold leaving the New York Fed, monthly (block 08, the card)",
     "Federal Reserve Table 3.13, federalreserve.gov/data/intlsumm/forassetsYYYYMMDD.htm "
     "(the date is the last day of the release month). Update fed_custody_treasuries from the same table."),
    ("gold.fed_custody_treasuries", ("as_of",), 30,
     "Treasuries in Fed custody (block 08's Show the work)",
     "Same Fed Table 3.13 page as the earmarked gold."),
    ("gold.gold_price", ("latest.date",), 14,
     "Gold price against its January record (block 08's counter-argument)",
     "tradingeconomics.com/commodity/gold (Tier 2). The page words the fall itself."),
    ("gold.moves", (), 30,
     "Central banks that moved gold out of New York (block 08)",
     "Central bank press releases (DNB, Bundesbank, Banque de France), Bloomberg."),
]


def today() -> dt.date:
    return dt.date.today()


def parse(d: str | None) -> dt.date | None:
    """ISO date, or YYYY-MM (read as the end of that month)."""
    if not d or not isinstance(d, str):
        return None
    try:
        if re.fullmatch(r"\d{4}-\d{2}", d):
            y, m = int(d[:4]), int(d[5:])
            return dt.date(y + m // 12, m % 12 + 1, 1) - dt.timedelta(days=1)
        return dt.date.fromisoformat(d[:10])
    except ValueError:
        return None


def get(obj, dotted: str):
    for k in dotted.split("."):
        if not isinstance(obj, dict) or k not in obj:
            return None
        obj = obj[k]
    return obj


def fomc_row(ctx: dict, now: dt.date):
    """The latest recorded rate decision is due once its next meeting has passed."""
    rates = ctx.get("rates") or {}
    dec = [(k, v) for k, v in rates.items() if k.startswith("fomc_") and isinstance(v, dict) and v.get("announced")]
    if not dec:
        return None
    key, v = max(dec, key=lambda kv: kv[1]["announced"])
    nxt = v.get("next_meeting") or ""
    m = re.match(r"(\d{4}-\d{2}-)(\d{2})(?:/(\d{2}))?", nxt)
    end = parse(m.group(1) + (m.group(3) or m.group(2))) if m else None
    due = bool(end and now > end)
    return {"path": "rates." + key, "label": "Latest Fed rate decision (block 10, 'Core CPI is lower')",
            "dated": parse(v["announced"]), "checked": parse(v.get("checked")), "every": None,
            "due": due, "why": ("the " + nxt + " meeting has happened: add it as a new fomc_<month>_decision")
            if due else "next meeting " + nxt,
            "look": "federalreserve.gov FOMC statement and, at SEP meetings, the projections."}


def rows(ctx: dict, now: dt.date):
    out = []
    for path, fields, every, label, look in WATCH:
        node = get(ctx, path)
        if node is None:
            out.append({"path": path, "label": label, "dated": None, "checked": None, "every": every,
                        "due": True, "why": "missing from context_figures.json", "look": look})
            continue
        dated = max([d for d in (parse(get(node, f)) if isinstance(node, dict) else None for f in fields) if d],
                    default=None)
        if isinstance(node, dict):
            checked = parse(node.get("checked"))
        else:  # a list carries its stamp on the parent, as "<name>_checked"
            parent, _, leaf = path.rpartition(".")
            checked = parse((get(ctx, parent) or {}).get(leaf + "_checked"))
        last = max([d for d in (dated, checked) if d], default=None)
        age = (now - last).days if last else None
        due = age is None or age > every
        out.append({"path": path, "label": label, "dated": dated, "checked": checked, "every": every,
                    "due": due, "why": ("never dated or checked" if age is None else
                                        "%d days since %s" % (age, "checked" if last == checked else "its date")),
                    "look": look})
    f = fomc_row(ctx, now)
    if f:
        out.append(f)
    return out


def mark(path: str, when: str) -> None:
    """Add or update "checked" on the object at `path`, editing the file as text.
    A list cannot carry a field, so its stamp goes on the parent as "<name>_checked"."""
    field = "checked"
    if isinstance(get(json.loads(CONTEXT.read_text(encoding="utf-8")), path), list):
        path, _, leaf = path.rpartition(".")
        field = leaf + "_checked"
    raw = CONTEXT.read_text(encoding="utf-8")
    nl = "\r\n" if "\r\n" in raw else "\n"
    s = raw.replace("\r\n", "\n")
    pos = 0
    for key in path.split("."):
        m = re.compile(r'"%s"\s*:\s*([\[{])' % re.escape(key)).search(s, pos)
        if not m:
            sys.exit("no object at %s" % path)
        pos = m.end() - 1
    # the matching close brace, skipping strings
    depth, i, in_str = 0, pos, False
    while i < len(s):
        c = s[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    body = s[pos:i]
    # only this object's own "checked", not one in a nested object
    own = [mm for mm in re.finditer(r'"%s"\s*:\s*"[^"]*"' % field, body)
           if body[:mm.start()].count("{") - body[:mm.start()].count("}") == 1]
    stamp = '"%s": "%s"' % (field, when)
    if own:
        mm = own[0]
        body = body[:mm.start()] + stamp + body[mm.end():]
    else:
        line_start = s.rfind("\n", 0, pos) + 1
        indent = re.match(r"\s*", s[line_start:]).group(0) + "  "
        if body.startswith("{\n"):
            body = "{\n" + indent + stamp + ",\n" + body[2:]
        else:
            body = "{ " + stamp + ", " + body[1:].lstrip()
    s = s[:pos] + body + s[i:]
    json.loads(s)  # never write a file that no longer parses
    CONTEXT.write_text(s.replace("\n", nl), encoding="utf-8")
    print("marked %s %s %s" % (path, field, when))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--due", action="store_true", help="list only what is due")
    ap.add_argument("--mark", metavar="PATH", nargs="+", help='stamp "checked" with today on these objects')
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()
    now = today()
    if args.mark:
        for p in args.mark:
            mark(p, now.isoformat())
        return 0
    ctx = json.loads(CONTEXT.read_text(encoding="utf-8"))
    rs = sorted(rows(ctx, now), key=lambda r: (not r["due"], r["path"]))
    if args.due:
        rs = [r for r in rs if r["due"]]
    if args.json:
        print(json.dumps([{**r, "dated": r["dated"] and r["dated"].isoformat(),
                           "checked": r["checked"] and r["checked"].isoformat()} for r in rs], indent=1))
        return 0
    n = sum(r["due"] for r in rs)
    print("Hand-checked figures on The Bill (%s): %d due" % (now.isoformat(), n))
    for r in rs:
        print("  %-4s %-30s %s" % ("DUE" if r["due"] else "ok", r["path"], r["why"]))
        if r["due"]:
            print("       %s\n       look: %s" % (r["label"], r["look"]))
    if n:
        print("\n  Update context_figures.json from a Tier 1 or Tier 2 source (new value, as_of,\n"
              "  source, url, tier), or, if nothing newer exists, run:\n"
              "  py scripts/check_curated.py --mark <path>\n"
              "  The /weekly-refresh command in Claude Code does all of this.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
