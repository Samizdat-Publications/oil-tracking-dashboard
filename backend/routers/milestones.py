"""War Impact Timeline milestones endpoint."""

from __future__ import annotations

import json
import os
from datetime import date, timedelta, datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from services.fred_client import SERIES_IDS, SERIES_NAMES, get_series
from services.cache import get_cached, set_cached

router = APIRouter(prefix="/api/milestones", tags=["milestones"])

IRAN_WAR_DATE = "2026-02-28"
MILESTONES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "war_milestones.json")

# Thresholds for auto-detecting price milestones
WEEKLY_CHANGE_THRESHOLD = 5.0  # percent
PRICE_THRESHOLDS: dict[str, list[float]] = {
    "wti": [80, 90, 100, 110, 120],
    "brent": [85, 95, 105, 115, 125],
    "diesel": [4.0, 4.5, 5.0, 5.5, 6.0],
    "gasoline": [3.0, 3.5, 4.0, 4.5, 5.0],
}

SERIES_FOR_MILESTONES = ["wti", "brent", "diesel", "gasoline", "natural_gas"]


class MilestoneBadge(BaseModel):
    label: str
    change: str


class Milestone(BaseModel):
    type: str  # "editorial" | "data" | "today"
    date: str
    week: int
    headline: str
    description: str
    badges: list[MilestoneBadge]


def _week_number(d: str) -> int:
    """Compute weeks since war start."""
    war = datetime.strptime(IRAN_WAR_DATE, "%Y-%m-%d")
    target = datetime.strptime(d, "%Y-%m-%d")
    return max(0, (target - war).days // 7)


def _load_editorial() -> list[Milestone]:
    """Load editorial milestones from JSON."""
    if not os.path.exists(MILESTONES_PATH):
        return []
    with open(MILESTONES_PATH, "r") as f:
        data = json.load(f)
    return [
        Milestone(
            type="editorial",
            date=evt["date"],
            week=_week_number(evt["date"]),
            headline=evt["headline"],
            description=evt["description"],
            badges=[],
        )
        for evt in data
    ]


async def _fetch_all_series() -> dict[str, list[dict]]:
    """Fetch all milestone-relevant series from FRED (or cache) in parallel."""
    import asyncio
    start = (datetime.strptime(IRAN_WAR_DATE, "%Y-%m-%d") - timedelta(days=7)).strftime("%Y-%m-%d")
    end = date.today().isoformat()

    keys = [k for k in SERIES_FOR_MILESTONES if k in SERIES_IDS]

    async def _fetch_one(key: str):
        try:
            return key, await get_series(SERIES_IDS[key], start, end)
        except Exception:
            return key, None

    results = await asyncio.gather(*[_fetch_one(k) for k in keys])
    return {k: v for k, v in results if v is not None}


def _detect_data_milestones(all_series_data: dict[str, list[dict]]) -> list[Milestone]:
    """Auto-detect significant price moves from pre-fetched FRED data."""
    milestones: list[Milestone] = []

    if not all_series_data:
        return milestones

    # Detect weekly changes per series
    seen_thresholds: dict[str, set[float]] = {k: set() for k in PRICE_THRESHOLDS}

    for key, obs in all_series_data.items():
        if len(obs) < 2:
            continue

        name = SERIES_NAMES.get(key, key)

        # Get pre-war baseline (last value before war)
        pre_war = [o for o in obs if o["date"] < IRAN_WAR_DATE]
        if not pre_war:
            continue
        baseline_val = pre_war[-1]["value"]

        # Group post-war observations by week
        post_war = [o for o in obs if o["date"] >= IRAN_WAR_DATE]
        weeks: dict[int, list[dict]] = {}
        for o in post_war:
            w = _week_number(o["date"])
            weeks.setdefault(w, []).append(o)

        prev_week_close = baseline_val
        for week_num in sorted(weeks.keys()):
            week_obs = weeks[week_num]
            week_close = week_obs[-1]["value"]

            if prev_week_close and prev_week_close != 0:
                pct_change = ((week_close - prev_week_close) / prev_week_close) * 100
            else:
                pct_change = 0

            week_date = week_obs[-1]["date"]

            # Check weekly change threshold
            if abs(pct_change) >= WEEKLY_CHANGE_THRESHOLD:
                direction = "surges" if pct_change > 0 else "drops"
                milestones.append(Milestone(
                    type="data",
                    date=week_date,
                    week=week_num,
                    headline=f"{name} {direction} {abs(pct_change):.1f}% in a single week",
                    description=f"{name} moved from ${prev_week_close:.2f} to ${week_close:.2f} in week {week_num} of the conflict.",
                    badges=[MilestoneBadge(label=name, change=f"{pct_change:+.1f}%")],
                ))

            # Check price threshold crossings
            if key in PRICE_THRESHOLDS:
                for threshold in PRICE_THRESHOLDS[key]:
                    if threshold in seen_thresholds[key]:
                        continue
                    if prev_week_close < threshold <= week_close:
                        seen_thresholds[key].add(threshold)
                        milestones.append(Milestone(
                            type="data",
                            date=week_date,
                            week=week_num,
                            headline=f"{name} crosses ${threshold:.2f}",
                            description=f"{name} broke through the ${threshold:.2f} level, reaching ${week_close:.2f} by end of week {week_num}.",
                            badges=[MilestoneBadge(label=name, change=f"${week_close:.2f}")],
                        ))

            prev_week_close = week_close

    # Consolidate: per series per week, keep only the most significant milestone
    # Priority: weekly surge > highest threshold crossing
    # This prevents 5 milestones on the same date for WTI ($80, $90, +35%)
    from collections import defaultdict
    by_series_week: dict[tuple[str, int], list[Milestone]] = defaultdict(list)
    for m in milestones:
        # Extract series name from first badge label (or headline)
        series_name = m.badges[0].label if m.badges else "unknown"
        by_series_week[(series_name, m.week)].append(m)

    consolidated: list[Milestone] = []
    for (series_name, week_num), group in by_series_week.items():
        # Separate surge milestones from threshold crossings
        surges = [m for m in group if "surges" in m.headline or "drops" in m.headline]
        crossings = [m for m in group if "crosses" in m.headline]

        # Keep the surge OR the highest crossing, not both (pick the most interesting)
        if surges:
            consolidated.append(surges[0])
        elif crossings:
            # Only keep highest threshold crossing if no surge this week
            consolidated.append(crossings[-1])

    # Deduplicate by headline
    seen_headlines: set[str] = set()
    unique: list[Milestone] = []
    for m in consolidated:
        if m.headline not in seen_headlines:
            seen_headlines.add(m.headline)
            unique.append(m)

    return unique


def _build_today_marker(all_data: dict[str, list[dict]]) -> Milestone:
    """Build the 'today' marker with current prices."""
    today = date.today().isoformat()
    week = _week_number(today)

    # Gather latest prices for description
    prices: list[str] = []
    for key in ["wti", "diesel", "gasoline"]:
        obs = all_data.get(key)
        if obs:
            latest = obs[-1]
            prices.append(f"{SERIES_NAMES.get(key, key)} at ${latest['value']:.2f}")

    desc = ". ".join(prices) + "." if prices else "Current market data loading."

    return Milestone(
        type="today",
        date=today,
        week=week,
        headline=f"{week} weeks into the conflict",
        description=desc,
        badges=[],
    )


@router.get("", response_model=dict)
async def get_milestones():
    """Return merged editorial + data-detected milestones, sorted chronologically."""
    end = date.today().isoformat()

    # Check cache
    cache_key = "milestones_merged"
    cached = await get_cached(cache_key, IRAN_WAR_DATE, end)
    if cached is not None:
        return {"milestones": cached}

    # Fetch all series data once (shared by milestone detection + today marker)
    all_data = await _fetch_all_series()

    # Load editorial milestones
    editorial = _load_editorial()

    # Detect data milestones from the pre-fetched data
    data_milestones = _detect_data_milestones(all_data)

    # Build today marker from the same data
    today_marker = _build_today_marker(all_data)

    # Merge, sort, append today
    all_milestones = editorial + data_milestones
    all_milestones.sort(key=lambda m: m.date)
    all_milestones.append(today_marker)

    # Cache the result
    result = [m.model_dump() for m in all_milestones]
    await set_cached(cache_key, IRAN_WAR_DATE, end, result)

    return {"milestones": result}
