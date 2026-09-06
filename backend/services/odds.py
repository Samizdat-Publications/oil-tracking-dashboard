"""Curated Polymarket odds for the ledger.

The existing `polymarket_client` scans hundreds of markets for the V1
dashboard. The ledger needs four or five, chosen by question, carried with
their odds as *crowd odds* -- labelled as such, never as data, and never
summed with anything. An unmatched question yields `matched: false` and a
null probability so the page renders a dash rather than silently dropping it.

Gamma sends no CORS header, so this is server-side only; the snapshot ships it.
"""

from __future__ import annotations

import re
from datetime import date

from services.polymarket_client import _fetch_all_active_markets, _get_yes_probability

#: key, label, regex over the question text (case-insensitive). Order = display order.
CURATED: list[tuple[str, str, str]] = [
    ("fed_hike_sept", "Fed raises rates in September",
     r"fed increase interest rates by 25 bps after the september 2026"),
    ("fed_hold_sept", "Fed holds in September",
     r"no change in fed interest rates after the september 2026"),
    ("blockade_end_sept", "US announces end of the Iranian blockade by 30 September",
     r"end of iranian blockade by september 30"),
    ("ceasefire_sept", "US-Iran effective ceasefire by early September",
     r"us x iran effective ceasefire by september"),
    ("regime_2026", "Iranian regime falls before 2027",
     r"iranian regime fall before 2027"),
    ("invade_2026", "US invades Iran before 2027",
     r"invade iran before 2027"),
]


def match_curated(markets: list[dict]) -> list[dict]:
    """Pure matcher, testable offline."""
    out = []
    for key, label, pattern in CURATED:
        rx = re.compile(pattern, re.I)
        hit = next((m for m in markets if rx.search(m.get("question") or "")), None)
        if not hit:
            out.append({"key": key, "label": label, "matched": False, "yes_probability": None})
            continue
        vol = hit.get("volumeNum") or hit.get("volume")
        try:
            vol = float(vol) if vol is not None else None
        except (TypeError, ValueError):
            vol = None
        slug = hit.get("slug")
        out.append({
            "key": key, "label": label, "matched": True,
            "question": hit.get("question"),
            "yes_probability": round(_get_yes_probability(hit), 4),
            "volume_usd": vol,
            "end_date": hit.get("endDate"),
            "source_url": f"https://polymarket.com/market/{slug}" if slug else "https://polymarket.com",
        })
    return out


async def _top_by_volume(pages: int = 3) -> list[dict]:
    """The curated questions are the most-traded macro markets; fetch by 24h
    volume so they are present regardless of the V1 client's slug list."""
    import httpx

    from services.polymarket_client import GAMMA_BASE

    out: list[dict] = []
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(pages):
            try:
                r = await client.get(f"{GAMMA_BASE}/markets", params={
                    "closed": "false", "limit": 100, "offset": i * 100,
                    "order": "volume24hr", "ascending": "false"})
                r.raise_for_status()
                out.extend(r.json())
            except Exception:  # partial coverage is fine; unmatched renders a dash
                break
    return out


async def odds_snapshot() -> dict:
    scanned = await _fetch_all_active_markets()
    top = await _top_by_volume()
    seen = {m.get("id") for m in scanned}
    markets = scanned + [m for m in top if m.get("id") not in seen]
    return {
        "as_of": date.today().isoformat(),
        "markets": match_curated(markets),
        "n_scanned": len(markets),
        "source": "Polymarket (Gamma API)", "source_url": "https://polymarket.com", "tier": 2,
        "note": ("Market-implied probabilities from a prediction market: what traders are "
                 "willing to pay, not a forecast and not data. Shown as odds, never summed."),
    }
