"""Async Polymarket API client with caching.

Fetches war-economy prediction markets across 9 categories: recession risk,
Fed policy, geopolitical escalation, oil price targets, gas & energy prices,
inflation, Iran war & oil supply, tariffs & trade, and food & commodities —
the downstream consequences of the Iran war's oil shock.
"""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime

import logging

import httpx

from services.cache import set_cached, _db, _make_key

logger = logging.getLogger(__name__)

GAMMA_BASE = "https://gamma-api.polymarket.com"

# Persistent JSON file for instant loading (survives restarts, no TTL)
PERSISTENT_DATA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "polymarket_latest.json"
)

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
    {
        "key": "oil_targets",
        "name": "Oil Price Targets",
        "icon": "\U0001F6E2\uFE0F",
        "keywords": ["wti", "crude oil", "oil price", "brent crude", "crude oil (cl)"],
        "exclude": ["up or down", "oilers", "premier league", "epl", "football", "soccer", "relegat", "standings"],
        "description": "Where traders think oil prices are headed.",
    },
    {
        "key": "gas_energy",
        "name": "Gas & Energy Prices",
        "icon": "\u26FD",
        "keywords": ["gas price", "gasoline", "gas hit", "natural gas", "energy price"],
        "exclude": ["gas station", "gas mask", "ethereum", "gwei", "eth gas"],
        "description": "What you\u2019ll pay at the pump and on your utility bill.",
    },
    {
        "key": "inflation",
        "name": "Inflation & Cost of Living",
        "icon": "\U0001F4C8",
        "keywords": ["inflation", "cpi", "consumer price"],
        "exclude": ["grade inflation", "inflation target"],
        "description": "How fast everyday prices are rising.",
    },
    {
        "key": "iran_war",
        "name": "Iran War & Oil Supply",
        "icon": "\u2694\uFE0F",
        "keywords": ["iran war", "iran ceasefire", "strait of hormuz", "iran conflict", "iran peace", "iran attack", "hormuz", "invade iran", "iranian regime", "iran nuclear", "iran nuke", "us-iran"],
        "exclude": ["rescue", "fifa", "world cup"],
        "description": "War trajectory shapes the global oil supply picture.",
    },
    {
        "key": "tariffs",
        "name": "Tariffs & Trade",
        "icon": "\U0001F6A2",
        "keywords": ["tariff", "trade war", "sanctions", "trade deal"],
        "exclude": ["republican", "democrat", "primary", "election"],
        "description": "Trade policy adds fuel to the inflation fire.",
    },
    {
        "key": "supply_chain",
        "name": "Food & Commodities",
        "icon": "\U0001F33E",
        "keywords": ["wheat", "corn", "food price", "commodity price", "supply chain", "shipping", "grain", "soybean", "agriculture"],
        "exclude": ["republican", "democrat", "primary", "election", "endorse", "trump", "senate", "congress", "governor"],
        "description": "From farm gate to dinner plate \u2014 commodity price bets.",
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


GLOBAL_EXCLUDE = [
    "premier league", "epl", "champions league", "la liga", "serie a",
    "bundesliga", "nfl", "nba", "mlb", "nhl", "super bowl", "stanley cup",
    "eastern conference", "western conference", "pacific division",
    "academy award", "oscar", "grammy", "emmy", "golden globe",
    "bachelor", "bachelorette", "reality tv", "love island",
    "brentford", "relegat", "standings", "oilers", "senators",
    "gta vi", "before gta",
]


def _categorize_market(question: str) -> list[str]:
    """Return list of matching category keys (multi-category matching)."""
    q = question.lower()

    # Global exclusion: reject sports/entertainment/gaming markets
    if any(ex in q for ex in GLOBAL_EXCLUDE):
        return []

    matches: list[str] = []
    for cat in CATEGORIES:
        if any(ex in q for ex in cat["exclude"]):
            continue
        if any(kw in q for kw in cat["keywords"]):
            matches.append(cat["key"])
    return matches


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


# Curated event slugs for economic/commodity markets.
# The Gamma API's generic /markets endpoint mostly returns sports/entertainment.
# These specific events contain the oil, inflation, Iran, tariff, and Fed markets.
# Updated periodically as new events are created on Polymarket.
ECONOMIC_EVENT_SLUGS = [
    # Oil / Crude
    "what-price-will-wti-hit-in-april-2026",
    "will-wti-hit-week-of-april-6-2026",
    "what-will-crude-oil-settle-at-in-june-2026",
    "what-will-crude-oil-settle-at-in-may-2026",
    # Recession / Economy
    "us-recession-by-end-of-2026",
    "canada-recession-before-2027",
    # Fed Rate
    "how-many-fed-rate-cuts-in-2026",
    "what-will-fed-rate-hit-before-2027",
    "fed-emergency-rate-cut-before-2027",
    # Inflation
    "how-high-will-inflation-get-in-2026",
    # Iran
    "will-the-us-invade-iran-before-2027",
    "will-the-iranian-regime-fall-by-the-end-of-2026",
    "us-iran-nuclear-deal-before-2027",
    "iran-nuclear-test-before-2027",
    "iran-nuke-before-2027",
    "will-iran-withdraw-from-the-npt-before-2027",
    # Trade
    "us-trade-deals-before-2027",
]


async def _fetch_all_active_markets() -> list[dict]:
    """Fetch active markets from Polymarket using two strategies:

    1. Targeted: Fetch specific known economic event slugs (fast, accurate)
    2. General: Scan /markets endpoint pages for additional matches

    Both run in parallel for speed. Results are deduplicated by market ID.
    """
    import asyncio

    seen_ids: set[str] = set()
    all_markets: list[dict] = []

    async with httpx.AsyncClient(timeout=30) as client:

        async def _fetch_event_by_slug(slug: str) -> list[dict]:
            """Fetch all markets from a specific event by slug."""
            try:
                resp = await client.get(
                    f"{GAMMA_BASE}/events",
                    params={"closed": "false", "slug": slug},
                )
                resp.raise_for_status()
                events = resp.json()
                markets = []
                for event in (events if isinstance(events, list) else [events]):
                    for m in (event.get("markets") or []):
                        markets.append(m)
                return markets
            except Exception as exc:
                logger.debug("Event slug '%s' not found or failed: %s", slug, exc)
                return []

        async def _fetch_markets_page(offset: int) -> list[dict]:
            try:
                resp = await client.get(
                    f"{GAMMA_BASE}/markets",
                    params={"closed": "false", "limit": "100", "offset": str(offset)},
                )
                resp.raise_for_status()
                return resp.json() or []
            except Exception as exc:
                logger.warning("Polymarket markets fetch failed at offset %d: %s", offset, exc)
                return []

        # Fetch targeted economic events in small batches (avoid rate limits)
        # Plus 3 general market pages for recession/geopolitical matches
        all_results: list[list[dict]] = []

        # Batch 1: targeted economic event slugs (5 at a time)
        for i in range(0, len(ECONOMIC_EVENT_SLUGS), 5):
            batch_slugs = ECONOMIC_EVENT_SLUGS[i:i + 5]
            batch_results = await asyncio.gather(*[_fetch_event_by_slug(s) for s in batch_slugs])
            all_results.extend(batch_results)

        # Batch 2: general market pages for broader matches
        market_results = await asyncio.gather(*[_fetch_markets_page(o) for o in range(0, 300, 100)])
        all_results.extend(market_results)

        for batch in all_results:
            for m in batch:
                mid = m.get("id", "")
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    all_markets.append(m)

    logger.info("Fetched %d unique active markets from Polymarket", len(all_markets))
    return all_markets


async def get_war_economy_markets(force_refresh: bool = False) -> dict:
    """Fetch and categorize war-economy prediction markets.

    Returns grouped markets across recession risk, Fed policy,
    and geopolitical escalation categories.

    Args:
        force_refresh: If True, skip all caches and fetch fresh from API.
    """
    if not force_refresh:
        # 1. Check SQLite cache (10-min TTL)
        cached = await _get_cached_polymarket("polymarket:war_economy")
        if cached is not None and len(cached) > 0:
            return cached[0] if isinstance(cached, list) else cached

        # 2. Fall back to persistent JSON file (survives restarts, no TTL)
        if os.path.exists(PERSISTENT_DATA_PATH):
            try:
                with open(PERSISTENT_DATA_PATH, "r") as f:
                    stored = json.load(f)
                if stored and stored.get("categories"):
                    logger.info("Loaded Polymarket data from persistent file")
                    return stored
            except Exception as exc:
                logger.warning("Failed to read persistent Polymarket data: %s", exc)

    # 3. Fresh API fetch (slow)
    raw_markets = await _fetch_all_active_markets()

    # Categorize and normalize
    categorized: dict[str, list[dict]] = {cat["key"]: [] for cat in CATEGORIES}

    for m in raw_markets:
        question = m.get("question", "")
        cat_keys = _categorize_market(question)
        if not cat_keys:
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

        normalized = {
            "id": m.get("id", ""),
            "question": question,
            "yes_probability": round(yes_prob, 4),
            "volume": volume,
            "end_date": end_date,
            "source_url": f"https://polymarket.com/event/{slug}" if slug else None,
        }

        for cat_key in cat_keys:
            categorized[cat_key].append(normalized)

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

        oil_price_distribution = None
        if cat["key"] == "oil_targets":
            oil_price_distribution = _build_oil_price_distribution(markets)

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
            "oil_price_distribution": oil_price_distribution,
            "market_count": len(markets),
            "total_volume": round(cat_volume, 2),
        })

    result = {
        "categories": groups,
        "total_volume": round(total_volume, 2),
        "market_count": total_count,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }

    # Persist to disk for instant loading on next startup
    try:
        with open(PERSISTENT_DATA_PATH, "w") as f:
            json.dump(result, f)
        logger.info("Saved Polymarket data to %s", PERSISTENT_DATA_PATH)
    except Exception as exc:
        logger.warning("Failed to save Polymarket data: %s", exc)

    # Cache in SQLite (10-min TTL)
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


def _build_oil_price_distribution(markets: list[dict]) -> list[dict]:
    """Build probability distribution for oil price target markets.

    Extracts dollar price targets from questions like "Will WTI hit $120?"
    and builds [{price: 100, probability: 0.95}, {price: 120, probability: 0.65}, ...]
    """
    price_pattern = re.compile(r'\$(\d+)', re.IGNORECASE)

    distribution: dict[int, float] = {}

    for m in markets:
        q = m["question"]
        prob = m["yes_probability"]

        match = price_pattern.search(q)
        if match:
            price = int(match.group(1))
            # Keep highest probability for each price level
            if price not in distribution or prob > distribution[price]:
                distribution[price] = prob

    return [
        {"price": k, "probability": round(v, 4)}
        for k, v in sorted(distribution.items())
    ]
