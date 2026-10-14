"""Rewrite the figures on the landing page (docs/index.html) from the V5 data.

The landing page on GitHub Pages carries a dated snapshot of the headline
figures: the hero stamp, the ticker, "The bill so far" and two block summaries.
They were typed in, so they said "As of 23 Sep 2026" for three weeks after the
live page had moved on. Each region now sits between markers,

    <!--fig:name--> ... <!--/fig:name-->

and this script replaces what is between them, from the same files the live
page reads. Run by refresh.ps1 after build_v5_data.py; the HTML around the
markers is left alone.

    py scripts/build_landing.py           # rewrite docs/index.html
    py scripts/build_landing.py --check   # exit 1 if it would change
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
V5 = ROOT / "frontend" / "public" / "v5"
LANDING = ROOT / "docs" / "index.html"

MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
        "September", "October", "November", "December"]
WORDS = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
         "fifteen sixteen seventeen eighteen nineteen twenty").split()
BAR_T = 400 * 31.1034768 / 1e6          # tonnes in a 400-ounce London Good Delivery bar


def d(iso: str, year=True, long=False) -> str:
    x = dt.date.fromisoformat(iso[:10])
    m = (LONG if long else MON)[x.month - 1]
    return "%d %s%s" % (x.day, m, " %d" % x.year if year else "")


def money(v: float, dec=2) -> str:
    return "$" + format(v, ",.%df" % dec)


def word(n: int) -> str:
    return WORDS[n] if 0 <= n < len(WORDS) else str(n)


def pct(a: float, b: float) -> str:
    return "%.1f%%" % (100 * a / b) if b else "0%"


def figures() -> dict:
    load = lambda n: json.loads((V5 / (n + ".json")).read_text(encoding="utf-8"))  # noqa: E731
    globe, crude, prices, bill = load("globe-data"), load("crude-data"), load("prices-data"), load("bill-data")
    obs = crude["observations"]
    h = globe["items"]["hormuz"]
    dsl = prices["diesel"]
    rec = dsl.get("record") or {}
    high = max(dsl["points"], key=lambda p: p[1])
    months = [m for m in bill["jobs"]["monthly"] if "2023-01-01" <= m[0] <= "2024-12-01"]
    base = sum(m[1] for m in months) / len(months)
    em = bill["gold"]["earmarked"]
    out_t = em[0][2] - em[-1][2]
    days = (dt.date.fromisoformat(em[-1][0]) - dt.date.fromisoformat(em[0][0])).days
    w = bill["war_cost"]
    return {
        "asof": d(globe["as_of"]),
        "rc_month": round(prices["receipt"]["monthly_usd"]), "rc_total": round(prices["receipt"]["cumulative_usd"]),
        "c_jan": obs[0][1], "c_peak": crude["peak"]["value"], "c_peak_d": crude["peak"]["date"],
        "c_now": obs[-1][1], "c_now_d": obs[-1][0],
        "h_base": round(h["baseline"]["total_per_day"]), "h_now": round(h["recent"]["mean7_total"]),
        "h_thru": globe["hormuz_daily"][-1][0],
        "d_now": dsl["latest"]["value"], "d_now_d": dsl["latest"]["date"], "d_record": bool(rec.get("is_record")),
        "d_prior": rec.get("prior_peak"), "d_high": high,
        "j_base": base, "j_now": bill["jobs"]["curr"]["mean_monthly"],
        "war_bn": w["dod_cost"]["usd_bn"], "war_d": w["dod_cost"]["as_of"],
        "war_cite": (w["dod_cost"].get("cite") or "").split(",")[0],
        "killed": w["casualties"]["us_killed"], "aircraft": w["aircraft"]["total_lost_or_damaged"],
        "g_bars": round(out_t / BAR_T), "g_t": round(out_t), "g_months": len(em) - 1,
        "g_perday": round(out_t / BAR_T / days) if days else 0,
    }


def fragments(f: dict) -> dict:
    e = html.escape
    diesel_say = ("on %s, a record for the EIA series." % d(f["d_now_d"], year=False) if f["d_record"]
                  else "on %s, below the record of %s set on %s." % (d(f["d_now_d"], year=False),
                                                                    money(f["d_high"][1]), d(f["d_high"][0], year=False)))
    if f["d_record"] and f["d_prior"]:
        ref_label, ref_v = "Previous peak, " + LONG[int(f["d_prior"]["date"][5:7]) - 1] + " " + f["d_prior"]["date"][:4], f["d_prior"]["value"]
    else:
        ref_label, ref_v = "Record, " + d(f["d_high"][0]), f["d_high"][1]
    top = max(ref_v, f["d_now"])
    ticker = "\n".join("        <li><b>%s</b> %s</li>" % (b, e(t)) for b, t in [
        ("+$%d" % f["rc_month"], "a month, a household"),
        ("$" + format(f["rc_total"], ","), "since 20 Jan 2025"),
        (money(f["c_now"]), "crude, " + d(f["c_now_d"], year=False)),
        (money(f["c_peak"]), "crude peak, " + d(f["c_peak_d"], year=False)),
        (str(f["h_now"]), "ships a day through Hormuz, was %d" % f["h_base"]),
        (money(f["d_now"]), "diesel" + (", a record" if f["d_record"] else ", record " + money(f["d_high"][1]))),
        (format(round(f["j_now"], -3), ",.0f"), "new jobs a month, was %s in 2023-24" % format(round(f["j_base"], -3), ",.0f")),
        ("$%sbn" % f["war_bn"], "the war so far"),
        (format(f["g_bars"], ","), "gold bars out of the New York Fed"),
    ])
    ledger = """      <div class="item lead reveal">
        <p class="mono">What it adds to a household's month</p>
        <p class="flap" data-flap="+${m}" aria-hidden="true">+${m}</p>
        <p class="sr-only">Plus {m} dollars a month for a household.</p>
        <p class="say">a month for a household.</p>
        <p class="since">Since 20 Jan 2025: <span class="count tnum" data-to="{t}" data-pre="$" aria-hidden="true">${tc}</span><span class="sr-only">${tc}</span></p>
        <p class="src">Pick your state on the live page and the total re-flips for it.</p>
      </div>
      <div class="item reveal">
        <p class="mono">Crude oil, a barrel</p>
        <span class="fig count" data-from="{cj:.0f}" data-to="{cp:.2f}" data-dec="2" data-pre="$" aria-hidden="true">${cp:.2f}</span>
        <p class="say">at the peak on {cpd}, from ${cj:.0f} in January. ${cn:.2f} on {cnd}.</p>
        <div class="bars" aria-hidden="true">
          <div class="bar"><span>January</span><b>${cj:.0f}</b><span class="track"><i style="--w:{wj}"></i></span></div>
          <div class="bar bad"><span>Peak, {cpd}</span><b>${cp:.2f}</b><span class="track"><i style="--w:100%"></i></span></div>
          <div class="bar now"><span>{cnd}</span><b>${cn:.2f}</b><span class="track"><i style="--w:{wn}"></i></span></div>
        </div>
      </div>
      <div class="item reveal">
        <p class="mono">Strait of Hormuz</p>
        <span class="fig count" data-from="{hb}" data-to="{hn}" data-dur="1800" aria-hidden="true">{hn}</span>
        <p class="say">ships a day, down from {hb} before the war.</p>
        <div class="bars" aria-hidden="true">
          <div class="bar"><span>Before the war</span><b>{hb}</b><span class="track"><i style="--w:100%"></i></span></div>
          <div class="bar bad"><span>Now</span><b>{hn}</b><span class="track"><i style="--w:{wh}"></i></span></div>
        </div>
        <p class="src">7-day mean to {ht}, IMF PortWatch.</p>
      </div>
      <div class="item reveal">
        <p class="mono">Diesel, a gallon</p>
        <p class="flap sm" data-flap="${dn:.2f}" aria-hidden="true">${dn:.2f}</p>
        <p class="say">{dsay}</p>
        <div class="bars" aria-hidden="true">
          <div class="bar"><span>{rl}</span><b>${rv:.2f}</b><span class="track"><i style="--w:{wr}"></i></span></div>
          <div class="bar bad"><span>{dnd}</span><b>${dn:.2f}</b><span class="track"><i style="--w:{wd}"></i></span></div>
        </div>
      </div>
      <div class="item reveal">
        <p class="mono">New jobs a month</p>
        <span class="fig count" data-to="{jn}" aria-hidden="true">{jnc}</span>
        <p class="say">since January 2025, against {jbc} a month in 2023-24.</p>
        <div class="bars" aria-hidden="true">
          <div class="bar"><span>2023-24</span><b>{jbc}</b><span class="track"><i style="--w:100%"></i></span></div>
          <div class="bar bad"><span>Since Jan 2025</span><b>{jnc}</b><span class="track"><i style="--w:{wjob}"></i></span></div>
        </div>
      </div>
      <div class="item wide2 reveal">
        <p class="mono">What the war has cost</p>
        <span class="fig count" data-to="{wb}" data-dec="1" data-pre="$" data-suf="bn" aria-hidden="true">${wb}bn</span>
        <p class="say">so far, the Pentagon's own estimate as of {wd_}.</p>
        <p class="src">{wcite}</p>
      </div>
      <div class="item wide2 reveal">
        <p class="mono">Gold leaving New York</p>
        <span class="fig"><span class="count" data-to="{gb}" aria-hidden="true">{gbc}</span><small>bars</small></span>
        <p class="say">of foreign gold, {gt} tonnes, taken out of the New York Fed over {gm} months: about {gpd} bars a day.</p>
      </div>""".format(
        m=f["rc_month"], t=f["rc_total"], tc=format(f["rc_total"], ","),
        cj=f["c_jan"], cp=f["c_peak"], cpd=d(f["c_peak_d"], year=False), cn=f["c_now"], cnd=d(f["c_now_d"], year=False),
        wj=pct(f["c_jan"], f["c_peak"]), wn=pct(f["c_now"], f["c_peak"]),
        hb=f["h_base"], hn=f["h_now"], wh=pct(f["h_now"], f["h_base"]), ht=d(f["h_thru"], year=False),
        dn=f["d_now"], dnd=d(f["d_now_d"]), dsay=e(diesel_say), rl=e(ref_label), rv=ref_v,
        wr=pct(ref_v, top), wd=pct(f["d_now"], top),
        jn=round(f["j_now"]), jnc=format(round(f["j_now"]), ","), jbc=format(round(f["j_base"]), ","),
        wjob=pct(f["j_now"], f["j_base"]),
        wb=f["war_bn"], wd_=d(f["war_d"], year=False), wcite=e(("Reported by " + f["war_cite"] + ".") if f["war_cite"] else ""),
        gb=f["g_bars"], gbc=format(f["g_bars"], ","), gt=f["g_t"], gm=word(f["g_months"]), gpd=f["g_perday"])
    sr = ("In text: plus ${m} a month for a household, ${t} since 20 January 2025. Crude oil went from ${cj:.0f} in January "
          "to ${cp:.2f} at the peak on {cpd}, and was ${cn:.2f} on {cnd}. The Strait of Hormuz carried {hb} ships a day before "
          "the war and {hn} now, the 7-day mean to {ht} from IMF PortWatch. Diesel was ${dn:.2f} a gallon on {dnd}, {drec}. "
          "{jn} new jobs a month since January 2025, against {jb} in 2023 and 2024. The war has cost ${wb} billion, the "
          "Pentagon's estimate as of {wd_}. {gt} tonnes of foreign gold, about {gb} bars, left the New York Fed over {gm} months.").format(
        m=f["rc_month"], t=format(f["rc_total"], ","), cj=f["c_jan"], cp=f["c_peak"], cpd=d(f["c_peak_d"], year=False, long=True),
        cn=f["c_now"], cnd=d(f["c_now_d"], year=False, long=True), hb=f["h_base"], hn=f["h_now"], ht=d(f["h_thru"], year=False, long=True),
        dn=f["d_now"], dnd=d(f["d_now_d"], year=False, long=True),
        drec="a record for the EIA series" if f["d_record"] else "below its record of %s on %s" % (money(f["d_high"][1]), d(f["d_high"][0], year=False, long=True)),
        jn=format(round(f["j_now"]), ","), jb=format(round(f["j_base"]), ","), wb=f["war_bn"], wd_=d(f["war_d"], year=False, long=True),
        gt=f["g_t"], gb=format(f["g_bars"], ","), gm=word(f["g_months"]))
    return {
        "stamp": "<small>Figures as of</small>" + f["asof"],
        "ticker": "\n" + ticker + "\n      ",
        "asof": "As of " + f["asof"],
        "ledger": "\n" + ledger + "\n    ",
        "ledger-sr": e(sr),
        "block06": "%d US service members killed, per the Pentagon's own count. %d aircraft lost or damaged. $%sbn spent. "
                   "The disputed interceptor estimate is printed beside the dispute." % (f["killed"], f["aircraft"], f["war_bn"]),
        "block08": "%s bars of gold taken out of the New York Fed in %s months, who moved theirs and why, and the Fed's own "
                   "rebuttal at full size." % (format(f["g_bars"], ","), word(f["g_months"])),
    }


def render(page: str, frags: dict) -> str:
    for name, body in frags.items():
        pat = re.compile(r"(<!--fig:%s-->)(.*?)(<!--/fig:%s-->)" % (re.escape(name), re.escape(name)), re.S)
        n = len(pat.findall(page))
        if n == 0:
            sys.exit("docs/index.html has no <!--fig:%s--> region" % name)
        page = pat.sub(lambda m: m.group(1) + body + m.group(3), page)
    return page


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    raw = LANDING.read_text(encoding="utf-8")
    nl = "\r\n" if "\r\n" in raw else "\n"
    page = raw.replace("\r\n", "\n")
    new = render(page, fragments(figures()))
    if args.check:
        print("landing: " + ("identical" if new == page else "WOULD CHANGE"))
        return 0 if new == page else 1
    LANDING.write_text(new.replace("\n", nl), encoding="utf-8")
    print("landing: " + ("unchanged" if new == page else "updated"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
