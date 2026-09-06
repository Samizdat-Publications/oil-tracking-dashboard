"""Cleveland Fed inflation nowcast -- what the next CPI print will probably say.

The Cleveland Fed publishes daily model nowcasts of CPI, core CPI, PCE and
core PCE for the current and next month, updated each business day around
10am ET. There is no API; the page carries two small HTML tables (month-over-
month and year-over-year) with the columns Month / CPI / Core CPI / PCE /
Core PCE / Updated. This parses them with the standard library and fails
soft: a layout change yields `None`, never a wrong number.

It is a NOWCAST -- a model estimate, Tier 1 by source but not a print. The
page must label it as such.

https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting
"""

from __future__ import annotations

import logging
from datetime import date
from html.parser import HTMLParser

import httpx

from services.cache import get_cached, set_cached

log = logging.getLogger(__name__)

URL = "https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting"
TTL = 12 * 3600
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; oil-tracking-dashboard snapshot builder)"}
COLS = ["period", "cpi", "core_cpi", "pce", "core_pce", "updated"]


class _Tables(HTMLParser):
    """Collect every <tr> as a list of cell strings."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None
        elif tag == "tr" and self._row is not None:
            if self._row:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def _num(s: str) -> float | None:
    try:
        return float(s)
    except ValueError:
        return None


def parse_nowcast(html: str) -> dict | None:
    """Return {"monthly": [...], "yoy": [...], "quarterly": [...]} or None.

    The page repeats the same header for each table; rows are assigned to the
    table by the header that most recently preceded them: 'Month' twice (m/m
    then y/y), then 'Quarter'.
    """
    p = _Tables()
    p.feed(html)
    tables: list[list[dict]] = []
    current: list[dict] | None = None
    for row in p.rows:
        if row and row[0] in ("Month", "Quarter"):
            current = []
            tables.append(current)
            continue
        if current is None or len(row) < 6 or row[0].startswith("Note"):
            continue
        vals = [_num(c) for c in row[1:5]]
        if all(v is None for v in vals):
            continue
        current.append({
            "period": row[0], "cpi": vals[0], "core_cpi": vals[1],
            "pce": vals[2], "core_pce": vals[3], "updated": row[5],
        })
    if len(tables) < 2 or not tables[0] or not tables[1]:
        return None
    return {"monthly": tables[0], "yoy": tables[1],
            "quarterly": tables[2] if len(tables) > 2 else []}


async def cleveland_nowcast() -> dict | None:
    try:
        hit = await get_cached("nowcast:cleveland:v1", "-", "-", ttl=TTL)
        if hit is not None:
            return hit
    except Exception as exc:
        log.warning("nowcast cache read failed: %s", exc)
    try:
        async with httpx.AsyncClient(timeout=40, follow_redirects=True, headers=HEADERS) as client:
            r = await client.get(URL)
            r.raise_for_status()
        parsed = parse_nowcast(r.text)
    except Exception as exc:
        log.warning("nowcast fetch/parse failed: %s", exc)
        return None
    if not parsed:
        log.warning("nowcast: page layout not recognised; returning None")
        return None
    payload = {
        "as_of": date.today().isoformat(),
        "name": "Federal Reserve Bank of Cleveland inflation nowcast",
        "source_url": URL, "tier": 1,
        "note": "Model nowcast updated each business day. Not a published print.",
        **parsed,
    }
    try:
        await set_cached("nowcast:cleveland:v1", "-", "-", payload)
    except Exception as exc:
        log.warning("nowcast cache write failed: %s", exc)
    return payload
