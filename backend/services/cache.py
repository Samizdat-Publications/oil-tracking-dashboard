"""SQLite-based async cache for API responses."""

from __future__ import annotations

import json
import time
import hashlib
import os

import aiosqlite

# Where to persist the cache. Defaults to backend/data/cache.db for local dev;
# on Fly.io (or any container host) set CACHE_DB_PATH to a path on the mounted
# volume, e.g. CACHE_DB_PATH=/data/cache.db so the cache survives restarts.
DB_PATH = os.getenv(
    "CACHE_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "cache.db"),
)

# 24-hour TTL in seconds
CACHE_TTL = 86400

_db: aiosqlite.Connection | None = None


async def init_cache() -> None:
    """Create the cache table if it doesn't exist."""
    global _db
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    _db = await aiosqlite.connect(DB_PATH)
    await _db.execute(
        """
        CREATE TABLE IF NOT EXISTS cache (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            ts    REAL NOT NULL
        )
        """
    )
    await _db.commit()


def _make_key(series_id: str, start_date: str, end_date: str) -> str:
    """Produce a deterministic cache key."""
    raw = f"{series_id}|{start_date}|{end_date}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_cached(
    series_id: str, start_date: str, end_date: str, ttl: int | None = None
) -> list | dict | None:
    """Return the cached JSON value, or None if missing/expired.

    `ttl` overrides the 24h default. Attribution results cost seconds of CPU
    and their inputs update weekly at best, so they use a much longer TTL --
    without this, the whole battery recomputes daily on a 1-vCPU box.
    """
    if _db is None:
        return None
    key = _make_key(series_id, start_date, end_date)
    async with _db.execute(
        "SELECT value, ts FROM cache WHERE key = ?", (key,)
    ) as cursor:
        row = await cursor.fetchone()
    if row is None:
        return None
    value_str, ts = row
    if time.time() - ts > (CACHE_TTL if ttl is None else ttl):
        await _db.execute("DELETE FROM cache WHERE key = ?", (key,))
        await _db.commit()
        return None
    return json.loads(value_str)


async def set_cached(
    series_id: str, start_date: str, end_date: str, value: list | dict
) -> None:
    """Store a JSON-serialisable list or dict in the cache."""
    if _db is None:
        return
    key = _make_key(series_id, start_date, end_date)
    await _db.execute(
        "INSERT OR REPLACE INTO cache (key, value, ts) VALUES (?, ?, ?)",
        (key, json.dumps(value), time.time()),
    )
    await _db.commit()


async def clear_cache() -> None:
    """Delete all cache entries."""
    if _db is None:
        return
    await _db.execute("DELETE FROM cache")
    await _db.commit()


async def close_cache() -> None:
    """Close the database connection."""
    global _db
    if _db is not None:
        await _db.close()
        _db = None
