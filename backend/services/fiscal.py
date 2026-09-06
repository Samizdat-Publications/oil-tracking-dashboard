"""US Treasury Fiscal Data -- the government's own ledger, no key required.

Three rows the page needs and FRED does not publish at this frequency:

* **Debt to the penny** -- total public debt outstanding, daily. Crossed
  $40 trillion in the summer of 2026.
* **Customs duties, monthly, net of refunds** (Monthly Treasury Statement,
  table 9). After the Supreme Court struck the IEEPA tariffs down, refunds
  exceeded collections: June 2026 -$25.6bn, July -$8.5bn. The tariffs' own
  revenue line went negative, which nothing on the page said until now. This
  row is NET -- never present it as "tariff revenue"; the gross series is BEA's
  quarterly B235RC1Q027SBEA in the macro block.
* **Interest expense on the debt** -- monthly and fiscal-year-to-date, by
  instrument. The 10-year at 4.8% is a household number and a Treasury one.

The API sends `Access-Control-Allow-Origin: *`, so the browser may also read
debt-to-the-penny live (see frontend/src/v4/live.ts). Server-side we cache a
day; the snapshot is what ships.

Docs: https://fiscaldata.treasury.gov/api-documentation/
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import date
from typing import Any

import httpx

from services.attribution import _envelope
from services.cache import get_cached, set_cached
from services.macro import nearest_on_or_before
from services.series_catalog import HANDOVER_DATE
from services.timeseries import WAR_BASELINE_DATE

log = logging.getLogger(__name__)

BASE = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"
TTL = 86400

DEBT = "v2/accounting/od/debt_to_penny"
MTS9 = "v1/accounting/mts/mts_table_9"
INTEREST = "v2/accounting/od/interest_expense"


async def _get(endpoint: str, params: dict[str, Any], cache_id: str) -> list[dict]:
    try:
        hit = await get_cached(f"fiscal:{cache_id}:v1", "-", "-", ttl=TTL)
        if hit is not None:
            return hit
    except Exception as exc:
        log.warning("fiscal cache read failed: %s", exc)
    rows: list[dict] = []
    page = 1
    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            r = await client.get(f"{BASE}/{endpoint}",
                                 params={**params, "page[number]": page, "page[size]": 1000})
            r.raise_for_status()
            body = r.json()
            data = body.get("data", [])
            rows.extend(data)
            total_pages = int(body.get("meta", {}).get("total-pages", 1))
            if page >= total_pages or not data:
                break
            page += 1
    try:
        await set_cached(f"fiscal:{cache_id}:v1", "-", "-", rows)
    except Exception as exc:
        log.warning("fiscal cache write failed: %s", exc)
    return rows


def _f(v: Any) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


async def debt_to_penny(start: str = "2025-01-01") -> dict:
    rows = await _get(DEBT, {"filter": f"record_date:gte:{start}", "sort": "record_date",
                             "fields": "record_date,tot_pub_debt_out_amt,debt_held_public_amt"},
                      f"debt:{start}")
    pts = [{"date": r["record_date"], "value": _f(r["tot_pub_debt_out_amt"])}
           for r in rows if _f(r.get("tot_pub_debt_out_amt")) is not None]
    pts.sort(key=lambda p: p["date"])
    latest = pts[-1] if pts else None
    handover = nearest_on_or_before(pts, HANDOVER_DATE)
    prewar = nearest_on_or_before(pts, WAR_BASELINE_DATE)
    return {
        "name": "Total public debt outstanding", "unit": "usd",
        "url": "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
        "latest": latest, "handover": handover, "prewar": prewar,
        "change_since_handover": round(latest["value"] - handover["value"], 2) if latest and handover else None,
        # Monthly thinning keeps the block small; the live layer fetches the daily latest itself.
        "points": [p for i, p in enumerate(pts) if i % 21 == 0 or i == len(pts) - 1],
    }


async def customs_duties_monthly(start: str = "2024-10-01") -> dict:
    rows = await _get(MTS9, {
        "filter": f"classification_desc:eq:Customs Duties,record_date:gte:{start}",
        "sort": "record_date",
        "fields": "record_date,current_month_rcpt_outly_amt,current_fytd_rcpt_outly_amt,prior_fytd_rcpt_outly_amt",
    }, f"mts9customs:{start}")
    pts = []
    for r in rows:
        m = _f(r.get("current_month_rcpt_outly_amt"))
        if m is None:
            continue
        pts.append({"date": r["record_date"][:7] + "-01", "value": m,
                    "fytd": _f(r.get("current_fytd_rcpt_outly_amt")),
                    "prior_fytd": _f(r.get("prior_fytd_rcpt_outly_amt"))})
    pts.sort(key=lambda p: p["date"])
    negative = [p["date"] for p in pts if p["value"] < 0]
    peak = max(pts, key=lambda p: p["value"]) if pts else None
    return {
        "name": "Customs duties, monthly receipts NET of refunds (MTS table 9)", "unit": "usd",
        "url": "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/",
        "note": ("Net receipts. Refunds of the struck-down IEEPA tariffs exceeded collections in "
                 "the months flagged negative. Never present this as tariff revenue; gross "
                 "duties are BEA's quarterly series in the macro block."),
        "latest": pts[-1] if pts else None, "peak": peak,
        "months_negative": negative, "points": pts,
    }


async def interest_expense(start: str = "2024-10-01") -> dict:
    rows = await _get(INTEREST, {"filter": f"record_date:gte:{start}", "sort": "record_date"},
                      f"interest:{start}")
    by_date: dict[str, dict[str, float]] = defaultdict(lambda: {"month": 0.0, "fytd": 0.0,
                                                               "public_fytd": 0.0})
    for r in rows:
        d = r["record_date"]
        m, f = _f(r.get("month_expense_amt")), _f(r.get("fytd_expense_amt"))
        if m is not None:
            by_date[d]["month"] += m
        if f is not None:
            by_date[d]["fytd"] += f
            if "PUBLIC" in (r.get("expense_catg_desc") or "").upper():
                by_date[d]["public_fytd"] += f
    pts = [{"date": d, "month": round(v["month"], 2), "fytd": round(v["fytd"], 2),
            "public_issues_fytd": round(v["public_fytd"], 2)}
           for d, v in sorted(by_date.items())]
    return {
        "name": "Interest expense on the public debt (all categories)", "unit": "usd",
        "url": "https://fiscaldata.treasury.gov/datasets/interest-expense-debt-outstanding/",
        "note": ("Sum of all expense rows Treasury publishes for the month, including "
                 "intragovernmental Government Account Series. `public_issues_fytd` is the "
                 "marketable-debt subtotal."),
        "latest": pts[-1] if pts else None, "points": pts,
    }


async def fiscal_snapshot() -> dict:
    debt, customs, interest = await asyncio.gather(
        debt_to_penny(), customs_duties_monthly(), interest_expense(), return_exceptions=True)
    wrap = lambda r: r if not isinstance(r, Exception) else {"error": str(r)}  # noqa: E731
    return {
        "as_of": date.today().isoformat(),
        "debt": wrap(debt), "customs": wrap(customs), "interest": wrap(interest),
        "source": "US Treasury, Fiscal Data", "source_url": "https://fiscaldata.treasury.gov/",
        "tier": 1,
        "envelope": _envelope(
            "fiscal_snapshot",
            sample={"source": "Treasury Fiscal Data API", "endpoints": [DEBT, MTS9, INTEREST]},
            assumptions=["Treasury's own published figures; no adjustment."],
            caveats=[
                "MTS customs duties are net of refunds and lag about eight days after month end.",
                "Interest expense totals include intragovernmental payments; the marketable "
                "subtotal is reported separately.",
                "Debt to the penny is a stock, not a flow; it moves with auction settlement "
                "dates as well as deficits.",
            ],
            falsifiers=[
                "If a quoted figure differs from Fiscal Data on its stated date, the snapshot is "
                "stale or wrong and must be rebuilt.",
            ],
            confidence="high",
        ),
    }
