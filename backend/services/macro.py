"""Macro snapshot -- the point-in-time readouts the ledger page needs.

Deliberately simple: no estimation, no smoothing. Every number here is a
published observation with its date, plus 12-month changes computed by
calendar month. The page reads these directly, so nothing has to be retyped
-- which is the whole reason this module exists. The August 2026 version of
the page hardcoded forty-odd figures in JSX; a month later every one of them
was stale and none of them said so.
"""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

from services.attribution import _envelope
from services.fred_client import get_series
from services.series_catalog import HANDOVER_DATE
from services.timeseries import WAR_BASELINE_DATE

#: Series the ledger reads as single figures or short histories. Each entry is
#: (key, FRED id, name, unit, history start). Daily series start at the eve of
#: the war year so the masthead can draw them; monthly and weekly series start
#: at the handover so "since January 2025" comparisons have their base.
MACRO_SERIES: list[tuple[str, str, str, str, str]] = [
    ("brent", "DCOILBRENTEU", "Brent crude, Europe spot", "usd_bbl", "2025-12-01"),
    ("gasoline_weekly", "GASREGW", "Regular gasoline, US average (EIA weekly)", "usd_gal", "2025-01-01"),
    ("diesel_weekly", "GASDESW", "Diesel, US average (EIA weekly)", "usd_gal", "2025-01-01"),
    ("jet_fuel_weekly", "WJFUELUSGULF", "Jet fuel, US Gulf Coast (weekly)", "usd_gal", "2025-01-01"),
    ("dollar_index", "DTWEXBGS", "Nominal broad dollar index", "index", "2025-01-01"),
    ("ten_year", "DGS10", "10-year Treasury yield", "pct", "2025-01-01"),
    ("breakeven_10y", "T10YIE", "10-year breakeven inflation", "pct", "2025-01-01"),
    ("fwd_5y5y", "T5YIFR", "5-year, 5-year forward inflation expectation", "pct", "2025-01-01"),
    ("fed_funds_upper", "DFEDTARU", "Federal funds target, upper bound", "pct", "2025-01-01"),
    ("mortgage_30y", "MORTGAGE30US", "30-year fixed mortgage rate", "pct", "2025-01-01"),
    ("sentiment", "UMCSENT", "Consumer sentiment (Michigan)", "index", "2025-01-01"),
    ("infl_exp_1y", "MICH", "Expected inflation, next 12 months (Michigan)", "pct", "2025-01-01"),
    ("trade_balance", "BOPGSTB", "Trade balance, goods and services", "usd_m", "2025-01-01"),
    ("imports", "BOPTIMP", "Imports of goods and services", "usd_m", "2025-01-01"),
    ("exports", "BOPTEXP", "Exports of goods and services", "usd_m", "2025-01-01"),
    ("customs_duties", "B235RC1Q027SBEA", "Customs duties, annualised (quarterly)", "usd_bn", "2024-01-01"),
    ("import_prices_ex_pet", "IREXPET", "Import prices ex-petroleum", "index", "2025-01-01"),
    ("u6", "U6RATE", "U-6 underemployment rate", "pct", "2025-01-01"),
    ("ltu_share", "LNS13025703", "Long-term unemployed, share of unemployed", "pct", "2025-01-01"),
    ("hires_rate", "JTSHIR", "Hires rate (JOLTS)", "pct", "2025-01-01"),
    ("quits_rate", "JTSQUR", "Quits rate (JOLTS)", "pct", "2025-01-01"),
    ("unemployment", "UNRATE", "Unemployment rate", "pct", "2025-01-01"),
    ("ahe", "CES0500000003", "Average hourly earnings, all private", "usd", "2025-01-01"),
    ("sp500", "SP500", "S&P 500", "index", "2025-01-01"),
    ("cpi_energy", "CPIENGSL", "CPI: energy", "index", "2024-01-01"),
    ("cpi_gasoline", "CUUR0000SETB01", "CPI: gasoline, all types (NSA)", "index", "2024-01-01"),
    ("cpi_airfares", "CUUR0000SETG01", "CPI: airline fares (NSA)", "index", "2024-01-01"),
    ("cpi_food_home", "CUUR0000SAF11", "CPI: food at home (NSA)", "index", "2024-01-01"),
    ("cpi_headline_nsa", "CPIAUCNS", "CPI: all items (NSA)", "index", "2024-01-01"),
    ("cpi_core", "CPILFESL", "CPI: all items less food and energy", "index", "2024-01-01"),
    ("pce_core", "PCEPILFE", "PCE price index ex food and energy", "index", "2024-01-01"),
    ("pce_headline", "PCEPI", "PCE price index", "index", "2024-01-01"),
]

#: Index series whose 12-month change the page quotes.
MACRO_YOY_KEYS = ["cpi_energy", "cpi_gasoline", "cpi_airfares", "cpi_food_home",
                  "cpi_headline_nsa", "cpi_core", "pce_core", "pce_headline"]


def nearest_on_or_before(points: list[dict], when: str) -> dict | None:
    """Last observation dated on or before `when`. None if none exists."""
    best = None
    for p in points:
        if p["date"] <= when:
            best = p
        else:
            break
    return best


def yoy_by_calendar_month(points: list[dict]) -> list[dict]:
    """12-month change from a monthly index, by CALENDAR month, not position.

    October 2025 is missing from every CPI series, so indexing twelve
    observations back would silently span thirteen months after the gap --
    the exact bug that put 3.73% instead of 3.53% into a design brief. This
    looks up the same month a year earlier by date and returns null where that
    month does not exist, so the gap renders as a gap.
    """
    by_date = {p["date"]: p["value"] for p in points if p["value"] is not None}
    out = []
    for p in points:
        if p["value"] is None:
            continue
        y, m = int(p["date"][:4]), int(p["date"][5:7])
        prior = f"{y - 1:04d}-{m:02d}-01"
        base = by_date.get(prior)
        out.append({
            "date": p["date"],
            "value": round((p["value"] / base - 1.0) * 100.0, 2) if base else None,
        })
    return out


async def macro_snapshot() -> dict:
    """Latest, handover and pre-war values for every series in MACRO_SERIES."""

    async def fetch(key, fred_id, name, unit, start):
        try:
            obs = await get_series(fred_id, start)
        except Exception as exc:  # one bad series must not sink the block
            return key, {"fred_id": fred_id, "name": name, "unit": unit,
                         "error": str(exc), "points": []}
        pts = [{"date": o["date"], "value": o["value"]} for o in obs
               if o.get("value") is not None]
        return key, {
            "fred_id": fred_id, "name": name, "unit": unit,
            "url": f"https://fred.stlouisfed.org/series/{fred_id}",
            "latest": pts[-1] if pts else None,
            "handover": nearest_on_or_before(pts, HANDOVER_DATE),
            "prewar": nearest_on_or_before(pts, WAR_BASELINE_DATE),
            "points": pts,
        }

    results = await asyncio.gather(*(fetch(*spec) for spec in MACRO_SERIES))
    series = {k: v for k, v in results}

    yoy: dict[str, Any] = {}
    for key in MACRO_YOY_KEYS:
        s = series.get(key)
        if not s or not s.get("points"):
            continue
        ys = yoy_by_calendar_month(s["points"])
        valid = [p for p in ys if p["value"] is not None]
        yoy[key] = {
            "fred_id": s["fred_id"], "name": s["name"],
            "latest": valid[-1] if valid else None,
            "points": ys,
        }

    # The tariff signature: core PCE from the month the tariffs began landing
    # (April 2025) to the latest reading. Reported as a pair, never summed
    # with anything -- see THESIS.md on why war and tariff effects stay apart.
    creep = None
    pc = yoy.get("pce_core", {}).get("points", [])
    start = next((p for p in pc if p["date"] == "2025-04-01"), None)
    end = next((p for p in reversed(pc) if p["value"] is not None), None)
    if start and end and start["value"] is not None:
        creep = {"start": start, "end": end,
                 "change_pp": round(end["value"] - start["value"], 2)}

    return {
        "as_of": date.today().isoformat(),
        "handover_date": HANDOVER_DATE,
        "war_baseline_date": WAR_BASELINE_DATE,
        "series": series,
        "yoy": yoy,
        "core_pce_creep": creep,
        "envelope": _envelope(
            "macro_snapshot",
            sample={"source": "FRED", "n_series": len(series)},
            assumptions=[
                "Every value is the latest published observation; recent months are "
                "provisional and revised.",
            ],
            caveats=[
                "12-month changes are computed by calendar month so the missing "
                "October 2025 CPI renders as a gap rather than a 13-month change.",
                "Weekly EIA fuel prices are not seasonally adjusted.",
                "The dollar index and Treasury yields are daily; the page quotes the "
                "last close, not an average.",
            ],
            falsifiers=[
                "If a quoted figure differs from the FRED series on its stated date, "
                "the snapshot is stale or wrong and must be rebuilt.",
            ],
            confidence="high",
        ),
    }


def usd_m_to_tonnes_check(usd_m: float) -> float:
    """Statutory gold ($42.22/oz, fixed since 1973) in millions of dollars -> tonnes.

    Mirrors `usdMToTonnes` in frontend/src/v4/ledger-data.ts so a test can pin
    the two implementations to each other.
    """
    return (usd_m * 1e6 / 42.22) * 31.1034768 / 1e6
