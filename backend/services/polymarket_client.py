"""Async Polymarket API client with caching.

Fetches war-economy prediction markets: recession risk, Fed policy,
and geopolitical escalation — the downstream consequences of the
Iran war's oil shock.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime

import logging

import httpx

from services.cache import set_cached, _db, _make_key

logger = logging.getLogger(__name__)

GAMMA_BASE = "https://gamma-api.polymarket.com"

# 10-minute TTL for Polymarket data (vs 24h for FRED)
POLYMARKET_CACHE_TTL = 600

# --- Market category definitions ---
# Each category has keywords that must appear in the question,
# and false-positive keywords to exclude.

CATEGORIES: list[dict] = [
    {
        "key": "recession",
        "name": "Recession Risk",
        "icon": "\U0001F4C9",  # chart decreasing
        "keywords": ["recession"],
        "exclude": [],
        "description": "Will the oil shock tip the economy into recession?",
    },
    {
        "key": "fed",
        "name": "Fed Policy",
        "icon": "\U0001F3E6",  # bank
        "keywords": ["fed rate cut", "fed rate"],
        "exclude": [],
        "description": "How will the Fed respond to oil-driven inflation?",
    },
    {
        "key": "geopolitical",
        "name": "Geopolitical Escalation",
        "icon": "\U0001F310",  # globe
        "keywords": [
            "china invade taiwan", "china blockade taiwan",
            "russia invade", "russia-ukraine ceasefire",
            "russia x ukraine ceasefire", "nato",
        ],
        "exclude": ["gta vi", "before gta"],
        "description": "More conflict = more oil supply disruption risk.",
    },
]


def _parse_outcome_prices(raw: str | list | None) -> list[float]:
    """Parse outcomePrices which can be a JSON string or a list."""
    if raw is None:
        return []
    if isinstance(raw, str):
        try:
            return [float(x) for x in json.loads(raw)]
        except (json.JSONDecodeError, ValueError):
            return []
    if isinstance(raw, list):
        try:
            return [float(x) for x in raw]
        except (ValueError, TypeError):
            return []
    return []


def _categorize_market(question: str) -> str | None:
    """Return category key if market matches, or None."""
    q = question.lower()
    for cat in CATEGORIES:
        # Check exclusions first
        if any(ex in q for ex in cat["exclude"]):
            continue
        if any(kw in q for kw in cat["keywords"]):
            return cat["key"]
    return None


def _get_yes_probability(market: dict) -> float:
    """Extract the 'Yes' outcome probability from a market."""
    outcomes = market.get("outcomes", [])
    prices = _parse_outcome_prices(market.get("outcomePrices"))
    if isinstance(outcomes, list):
        for i, label in enumerate(outcomes):
            if str(label).lower() == "yes" and i < len(prices):
                return prices[i]
    # Fallback: first price
    return prices[0] if prices else 0.0


async def _get_cached_polymarket(cache_key: str) -> list | None:
    """Get cached data with Polymarket's shorter TTL."""
    if _db is None:
        return None
    key = _make_key(cache_key, "polymarket", "data")
    async with _db.execute(
        "SELECT value, ts FROM cache WHERE key = ?", (key,)
    ) as cursor:
        row = await cursor.fetchone()
    if row is None:
        return None
    value_str, ts = row
    if time.time() - ts > POLYMARKET_CACHE_TTL:
        await _db.execute("DELETE FROM cache WHERE key = ?", (key,))
        await _db.commit()
        return None
    return json.loads(value_str)


async def _set_cached_polymarket(cache_key: str, value: list | dict) -> None:
    """Store data in cache for Polymarket."""
    data = value if isinstance(value, list) else [value]
    await set_cached(cache_key, "polymarket", "data", data)


async def _fetch_all_active_markets() -> list[dict]:
    """Fetch active markets from Polymarket (up to 1000)."""
    all_markets: list[dict] = []
    async with httpx.AsyncClient(timeout=20) as client:
        for offset in range(0, 1000, 100):
            try:
                resp = await client.get(
                    f"{GAMMA_BASE}/markets",
                    params={"closed": "false", "limit": "100", "offset": str(offset)},
                )
                resp.raise_for_status()
                batch = resp.json()
                if not batch:
                    break
                all_markets.extend(batch)
            except Exception as exc:
                logger.warning("Polymarket fetch failed at offset %d: %s", offset, exc)
                break
    logger.info("Fetched %d active markets from Polymarket", len(all_markets))
    return all_markets


async def get_war_economy_markets() -> dict:
    """Fetch and categorize war-economy prediction markets.

    Returns grouped markets across recession risk, Fed policy,
    and geopolitical escalation categories.
    """
    # Check cache
    cached = await _get_cached_polymarket("polymarket:war_economy")
    if cached is not None and len(cached) > 0:
        return cached[0] if isinstance(cached, list) else cached

    raw_markets = await _fetch_all_active_markets()

    # Categorize and normalize
    categorized: dict[str, list[dict]] = {cat["key"]: [] for cat in CATEGORIES}

    for m in raw_markets:
        question = m.get("question", "")
        cat_key = _categorize_market(question)
        if cat_key is None:
            continue

        yes_prob = _get_yes_probability(m)
        volume = float(m.get("volume", 0) or 0)
        slug = m.get("slug", m.get("id", ""))

        end_date = None
        if m.get("endDate"):
            try:
                end_date = m["endDate"][:10]
            except (TypeError, IndexError):
                pass

        categorized[cat_key].append({
            "id": m.get("id", ""),
            "question": question,
            "yes_probability": round(yes_prob, 4),
            "volume": volume,
            "end_date": end_date,
            "source_url": f"https://polymarket.com/event/{slug}" if slug else None,
        })

    # Sort each category by volume descending
    for key in categorized:
        categorized[key].sort(key=lambda x: x["volume"], reverse=True)
        logger.info("Category '%s': %d markets found", key, len(categorized[key]))

    # Build category groups for the response
    groups: list[dict] = []
    total_volume = 0.0
    total_count = 0

    for cat in CATEGORIES:
        markets = categorized[cat["key"]]
        if not markets:
            continue

        # For Fed rate cuts, build a special probability distribution
        fed_distribution = None
        if cat["key"] == "fed":
            fed_distribution = _build_fed_distribution(markets)

        cat_volume = sum(m["volume"] for m in markets)
        total_volume += cat_volume
        total_count += len(markets)

        # Highlight: the single most important market in this category
        highlight = markets[0] if markets else None

        groups.append({
            "key": cat["key"],
            "name": cat["name"],
            "icon": cat["icon"],
            "description": cat["description"],
            "markets": markets[:6],  # top 6 per category
            "highlight": highlight,
            "fed_distribution": fed_distribution,
            "market_count": len(markets),
            "total_volume": round(cat_volume, 2),
        })

    result = {
        "categories": groups,
        "total_volume": round(total_volume, 2),
        "market_count": total_count,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }

    # Cache
    await _set_cached_polymarket("polymarket:war_economy", result)
    return result


def _build_fed_distribution(markets: list[dict]) -> list[dict]:
    """Build a probability distribution from Fed rate cut markets.

    Extracts the number of cuts from each question and builds
    [{cuts: 0, probability: 0.31}, {cuts: 1, probability: 0.275}, ...]
    """
    cut_pattern = re.compile(r'(\d+)\s+(?:fed\s+)?rate\s+cuts?', re.IGNORECASE)
    no_cuts_pattern = re.compile(r'no\s+fed\s+rate\s+cuts?', re.IGNORECASE)

    distribution: dict[int, float] = {}

    for m in markets:
        q = m["question"]
        prob = m["yes_probability"]

        if no_cuts_pattern.search(q):
            distribution[0] = prob
            continue

        match = cut_pattern.search(q)
        if match:
            n = int(match.group(1))
            distribution[n] = prob

    # Sort by number of cuts
    return [
        {"cuts": k, "probability": round(v, 4)}
        for k, v in sorted(distribution.items())
    ]
