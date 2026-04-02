"""Async Polymarket API client with caching."""

from __future__ import annotations

import json
import re
import time
from datetime import date, datetime

import httpx

from services.cache import get_cached, set_cached, _db, _make_key

GAMMA_BASE = "https://gamma-api.polymarket.com"
CLOB_BASE = "https://clob.polymarket.com"

# 10-minute TTL for Polymarket data (vs 24h for FRED)
POLYMARKET_CACHE_TTL = 600

# Keywords to filter oil-related markets
OIL_KEYWORDS = re.compile(
    r'\b(wti|brent|crude\s*oil|oil\s*price|petroleum|barrel|opec)\b',
    re.IGNORECASE,
)

# Price target patterns like "$120", "$110", "above $100"
PRICE_TARGET_PATTERN = re.compile(
    r'(?:above|below|hit|reach|exceed|over|under)?\s*\$(\d+)',
    re.IGNORECASE,
)


def _is_oil_market(question: str) -> bool:
    """Check if a market question is oil-price-related."""
    return bool(OIL_KEYWORDS.search(question))


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
        return [float(x) for x in raw]
    return []


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
    await set_cached(cache_key, "polymarket", "data", value if isinstance(value, list) else [value])


async def search_oil_markets() -> list[dict]:
    """Discover active oil-related prediction markets from Polymarket.

    Uses tag filtering first, then keyword search as fallback.
    Returns normalized market objects.
    """
    # Check cache
    cached = await _get_cached_polymarket("polymarket:oil_markets")
    if cached is not None:
        return cached

    markets: dict[str, dict] = {}  # dedupe by id

    async with httpx.AsyncClient(timeout=15) as client:
        # Primary: tag-based filtering
        try:
            resp = await client.get(
                f"{GAMMA_BASE}/markets",
                params={"tag": "oil", "closed": "false", "limit": "100"},
            )
            resp.raise_for_status()
            for m in resp.json():
                if _is_oil_market(m.get("question", "")):
                    markets[m["id"]] = m
        except Exception:
            pass

        # Fallback: keyword search
        if len(markets) < 3:
            for query in ["WTI crude oil", "oil price", "crude oil barrel"]:
                try:
                    resp = await client.get(
                        f"{GAMMA_BASE}/markets",
                        params={"closed": "false", "limit": "50"},
                    )
                    resp.raise_for_status()
                    for m in resp.json():
                        if m["id"] not in markets and _is_oil_market(m.get("question", "")):
                            markets[m["id"]] = m
                except Exception:
                    pass

    # Normalize market objects
    normalized = []
    for m in markets.values():
        outcomes_raw = m.get("outcomes", [])
        prices_raw = _parse_outcome_prices(m.get("outcomePrices"))

        outcomes = []
        for i, label in enumerate(outcomes_raw if isinstance(outcomes_raw, list) else []):
            prob = prices_raw[i] if i < len(prices_raw) else 0.0
            outcomes.append({
                "label": str(label),
                "probability": round(prob, 4),
                "token_id": None,
            })

        # Categorize
        question = m.get("question", "")
        if PRICE_TARGET_PATTERN.search(question):
            category = "price_target"
        elif any(w in question.lower() for w in ["up or down", "higher", "lower", "direction"]):
            category = "directional"
        else:
            category = "geopolitical"

        # Build source URL
        slug = m.get("slug", m.get("id", ""))
        source_url = f"https://polymarket.com/event/{slug}" if slug else None

        end_date = None
        if m.get("endDate"):
            try:
                end_date = m["endDate"][:10]  # YYYY-MM-DD
            except (TypeError, IndexError):
                pass

        normalized.append({
            "id": m["id"],
            "question": question,
            "outcomes": outcomes,
            "volume": float(m.get("volume", 0) or 0),
            "liquidity": float(m.get("liquidity", 0) or 0),
            "end_date": end_date,
            "category": category,
            "source_url": source_url,
        })

    # Sort by volume descending
    normalized.sort(key=lambda x: x["volume"], reverse=True)

    # Cache result
    await _set_cached_polymarket("polymarket:oil_markets", normalized)

    return normalized


async def get_oil_prediction_summary() -> dict:
    """Build aggregated summary of oil prediction markets.

    Returns price targets, sentiment, and metadata.
    """
    # Check cache
    cached = await _get_cached_polymarket("polymarket:summary")
    if cached is not None and len(cached) > 0:
        return cached[0] if isinstance(cached, list) else cached

    markets = await search_oil_markets()

    price_targets: list[dict] = []
    bullish_volume = 0.0
    bearish_volume = 0.0
    total_volume = 0.0

    for m in markets:
        total_volume += m["volume"]
        question = m["question"].lower()

        # Extract price targets
        for outcome in m["outcomes"]:
            label = outcome["label"]
            prob = outcome["probability"]

            # Look for price target patterns
            price_match = PRICE_TARGET_PATTERN.search(label) or PRICE_TARGET_PATTERN.search(m["question"])
            if price_match:
                target_val = int(price_match.group(1))
                direction = "below" if any(w in label.lower() for w in ["down", "below", "under", "no"]) else "above"

                # Extract timeframe from question or end_date
                timeframe = ""
                if m["end_date"]:
                    try:
                        dt = datetime.strptime(m["end_date"], "%Y-%m-%d")
                        timeframe = dt.strftime("%B %Y")
                    except ValueError:
                        timeframe = m["end_date"]

                price_targets.append({
                    "target": f"${target_val}",
                    "direction": direction,
                    "probability": prob,
                    "timeframe": timeframe,
                    "volume": m["volume"],
                })

        # Compute sentiment from directional markets
        if "up" in question or "higher" in question or "above" in question:
            for o in m["outcomes"]:
                if o["label"].lower() in ("yes", "up"):
                    bullish_volume += m["volume"] * o["probability"]
                    bearish_volume += m["volume"] * (1 - o["probability"])
        elif "down" in question or "lower" in question or "below" in question:
            for o in m["outcomes"]:
                if o["label"].lower() in ("yes", "down"):
                    bearish_volume += m["volume"] * o["probability"]
                    bullish_volume += m["volume"] * (1 - o["probability"])

    # Deduplicate price targets by target+direction, keep highest volume
    seen_targets: dict[str, dict] = {}
    for pt in price_targets:
        key = f"{pt['target']}_{pt['direction']}_{pt['timeframe']}"
        if key not in seen_targets or pt["volume"] > seen_targets[key]["volume"]:
            seen_targets[key] = pt
    price_targets = sorted(seen_targets.values(), key=lambda x: (-x["probability"],))

    # Compute sentiment
    total_directional = bullish_volume + bearish_volume
    if total_directional > 0:
        bull_pct = bullish_volume / total_directional
        if bull_pct > 0.6:
            direction = "bullish"
            confidence = bull_pct
        elif bull_pct < 0.4:
            direction = "bearish"
            confidence = 1 - bull_pct
        else:
            direction = "neutral"
            confidence = max(bull_pct, 1 - bull_pct)
    else:
        direction = "neutral"
        confidence = 0.5

    # Generate description
    if price_targets:
        top = price_targets[0]
        description = f"Markets see {top['probability']:.0%} chance oil {'hits' if top['direction'] == 'above' else 'falls below'} {top['target']} by {top['timeframe']}"
    else:
        description = "Limited prediction market data available for oil prices"

    summary = {
        "price_targets": price_targets[:8],  # top 8
        "sentiment": {
            "direction": direction,
            "confidence": round(confidence, 2),
            "description": description,
        },
        "top_markets_count": len(markets),
        "total_volume": round(total_volume, 2),
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }

    # Cache
    await _set_cached_polymarket("polymarket:summary", summary)

    return summary
