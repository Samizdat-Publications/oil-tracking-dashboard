"""Crisis analysis service — computes historical oil crisis comparisons.

Compares 7 major oil crises since 1973 by peak price spike,
duration, and gas price impact. Builds day-by-day trajectories
for superimposed comparison charts.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from services.fred_client import get_series, SERIES_IDS
from services.cache import get_cached, set_cached

logger = logging.getLogger(__name__)

IRAN_WAR_DATE = "2026-02-28"
CACHE_KEY = "crisis_comparison"

# ---------------------------------------------------------------------------
# Hardcoded pre-FRED data (1973, 1979)
# ---------------------------------------------------------------------------

# 1973 Arab Oil Embargo: pre-embargo WTI ~$3.56/bbl
EMBARGO_1973_TRAJECTORY = [
    {"day": 0, "pct_change": 0.0},
    {"day": 30, "pct_change": 33.7},
    {"day": 60, "pct_change": 98.6},
    {"day": 90, "pct_change": 227.2},
    {"day": 120, "pct_change": 196.1},
    {"day": 152, "pct_change": 176.7},
]

# 1979 Iranian Revolution: pre-revolution WTI ~$14.00/bbl
REVOLUTION_1979_TRAJECTORY = [
    {"day": 0, "pct_change": 0.0},
    {"day": 30, "pct_change": 7.1},
    {"day": 60, "pct_change": 14.3},
    {"day": 90, "pct_change": 35.7},
    {"day": 150, "pct_change": 71.4},
    {"day": 210, "pct_change": 107.1},
    {"day": 270, "pct_change": 142.9},
    {"day": 330, "pct_change": 164.3},
    {"day": 365, "pct_change": 171.4},
    {"day": 455, "pct_change": 182.1},
    {"day": 530, "pct_change": 150.0},
]

# ---------------------------------------------------------------------------
# Crisis definitions
# ---------------------------------------------------------------------------

CRISES = [
    {
        "id": "1973_embargo",
        "name": "Arab Oil Embargo",
        "year": 1973,
        "start_date": "1973-10-17",
        "end_date": "1974-03-18",
        "peak_spike_pct": 227.2,
        "duration_months": 5,
        "gas_impact_pct": 43.0,
        "context": "OAPEC proclaimed an oil embargo against nations supporting Israel "
                   "in the Yom Kippur War. Oil prices quadrupled in six months, "
                   "triggering the first global energy crisis and long gas station "
                   "lines across America.",
        "trajectory": EMBARGO_1973_TRAJECTORY,
        "is_current": False,
        "use_fred": False,
    },
    {
        "id": "1979_revolution",
        "name": "Iranian Revolution",
        "year": 1979,
        "start_date": "1979-01-16",
        "end_date": "1980-06-30",
        "peak_spike_pct": 182.1,
        "duration_months": 17,
        "gas_impact_pct": 80.0,
        "context": "The Shah fled Iran as revolution swept the country. Iranian oil "
                   "production collapsed from 6 million to 1.5 million barrels per day. "
                   "The direct historical parallel to the current Iran conflict.",
        "trajectory": REVOLUTION_1979_TRAJECTORY,
        "is_current": False,
        "use_fred": False,
    },
    {
        "id": "1990_gulf_war",
        "name": "Gulf War",
        "year": 1990,
        "start_date": "1990-08-02",
        "end_date": "1991-02-28",
        "duration_months": 7,
        "context": "Iraq invaded Kuwait and Saddam Hussein torched oil fields. "
                   "Prices spiked from $17 to $41 in weeks \u2014 a fast, violent "
                   "shock. The war itself was quick but the price impact was immediate.",
        "is_current": False,
        "use_fred": True,
    },
    {
        "id": "2008_superspike",
        "name": "Price Super-Spike",
        "year": 2008,
        "start_date": "2007-01-02",
        "end_date": "2008-07-11",
        "duration_months": 18,
        "context": "Speculation and surging demand drove oil from $50 to $147/bbl "
                   "\u2014 the all-time record. Goldman Sachs coined the term "
                   "'super-spike.' The subsequent crash to $32 was equally dramatic.",
        "is_current": False,
        "use_fred": True,
    },
    {
        "id": "2014_opec_war",
        "name": "OPEC Price War",
        "year": 2014,
        "start_date": "2014-06-20",
        "end_date": "2016-02-11",
        "duration_months": 20,
        "context": "Saudi Arabia refused to cut production, flooding the market to "
                   "crush US shale competitors. Oil crashed from $107 to $26. A "
                   "reminder that oil can collapse just as violently as it spikes.",
        "is_current": False,
        "use_fred": True,
    },
    {
        "id": "2022_russia_ukraine",
        "name": "Russia-Ukraine War",
        "year": 2022,
        "start_date": "2022-02-24",
        "end_date": "2022-06-14",
        "duration_months": 4,
        "context": "Russia invaded Ukraine and the West imposed sweeping sanctions. "
                   "Oil spiked above $120 on fears of Russian supply disappearing. "
                   "The most recent crisis in collective memory.",
        "is_current": False,
        "use_fred": True,
    },
    {
        "id": "2026_iran",
        "name": "Iran War",
        "year": 2026,
        "start_date": IRAN_WAR_DATE,
        "end_date": None,
        "duration_months": None,
        "context": "US-Iran military conflict disrupted Strait of Hormuz tanker "
                   "traffic, threatening ~20%% of global oil transit. The crisis "
                   "you are living through right now.",
        "is_current": True,
        "use_fred": True,
    },
]


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

async def get_crisis_comparison() -> dict:
    """Build the full crisis comparison response.

    Returns cached result if available, otherwise computes from FRED + hardcoded data.
    """
    # Check cache
    today = date.today().isoformat()
    cached = await get_cached(CACHE_KEY, "1973-01-01", today)
    if cached is not None:
        return cached

    crises_out: list[dict] = []

    for crisis in CRISES:
        if crisis["use_fred"]:
            entry = await _build_fred_crisis(crisis)
        else:
            # Pre-FRED era — use hardcoded data
            entry = {
                "id": crisis["id"],
                "name": crisis["name"],
                "year": crisis["year"],
                "start_date": crisis["start_date"],
                "end_date": crisis["end_date"],
                "peak_spike_pct": crisis["peak_spike_pct"],
                "duration_months": crisis["duration_months"],
                "gas_impact_pct": crisis.get("gas_impact_pct"),
                "context": crisis["context"],
                "trajectory": crisis["trajectory"],
                "is_current": crisis["is_current"],
            }

        crises_out.append(entry)

    result = {
        "crises": crises_out,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }

    # Cache result
    await set_cached(CACHE_KEY, "1973-01-01", today, result)
    return result


async def _build_fred_crisis(crisis: dict) -> dict:
    """Build a crisis entry from FRED WTI data."""
    start = crisis["start_date"]
    end = crisis["end_date"] or date.today().isoformat()

    # Fetch WTI data with buffer for weekends
    start_dt = datetime.strptime(start, "%Y-%m-%d")
    fetch_start = (start_dt - timedelta(days=10)).strftime("%Y-%m-%d")

    try:
        wti_data = await get_series(
            SERIES_IDS["wti"],
            fetch_start,
            end,
        )
    except Exception as exc:
        logger.warning("Failed to fetch WTI for crisis %s: %s", crisis["id"], exc)
        return _empty_crisis_entry(crisis)

    if not wti_data:
        return _empty_crisis_entry(crisis)

    # Find baseline price (first available on or after crisis start)
    baseline_price = None
    baseline_date = None
    for obs in wti_data:
        if obs["date"] >= start:
            baseline_price = obs["value"]
            baseline_date = obs["date"]
            break

    if baseline_price is None or baseline_price <= 0:
        return _empty_crisis_entry(crisis)

    # Build trajectory and find peak
    trajectory: list[dict] = []
    peak_pct = 0.0

    for obs in wti_data:
        if obs["date"] < start:
            continue
        obs_dt = datetime.strptime(obs["date"], "%Y-%m-%d")
        day = (obs_dt - start_dt).days
        pct = ((obs["value"] - baseline_price) / baseline_price) * 100
        trajectory.append({"day": day, "pct_change": round(pct, 2)})

        # Track peak (can be negative for OPEC collapse)
        if abs(pct) > abs(peak_pct):
            peak_pct = pct

    # Sample trajectory to keep reasonable size (max ~90 points)
    if len(trajectory) > 90:
        step = max(1, len(trajectory) // 90)
        sampled = trajectory[::step]
        # Always include the last point
        if sampled[-1] != trajectory[-1]:
            sampled.append(trajectory[-1])
        trajectory = sampled

    # Compute gas impact
    gas_impact = await _compute_gas_impact(start, end)

    # Compute duration for current crisis
    duration = crisis["duration_months"]
    if crisis["is_current"]:
        days_elapsed = (date.today() - start_dt.date()).days
        duration = round(days_elapsed / 30.44, 1)

    return {
        "id": crisis["id"],
        "name": crisis["name"],
        "year": crisis["year"],
        "start_date": crisis["start_date"],
        "end_date": crisis["end_date"],
        "peak_spike_pct": round(peak_pct, 1),
        "duration_months": duration,
        "gas_impact_pct": round(gas_impact, 1) if gas_impact is not None else None,
        "context": crisis["context"],
        "trajectory": trajectory,
        "is_current": crisis["is_current"],
    }


async def _compute_gas_impact(
    crisis_start: str, crisis_end: str
) -> float | None:
    """Compute % increase in retail gasoline during a crisis period.

    Uses FRED series GASREGW (weekly, available from ~1990).
    """
    start_dt = datetime.strptime(crisis_start, "%Y-%m-%d")
    fetch_start = (start_dt - timedelta(days=14)).strftime("%Y-%m-%d")

    try:
        gas_data = await get_series(
            SERIES_IDS["gasoline"],
            fetch_start,
            crisis_end,
        )
    except Exception:
        return None

    if not gas_data or len(gas_data) < 2:
        return None

    # Baseline: first observation on or after crisis start
    baseline = None
    for obs in gas_data:
        if obs["date"] >= crisis_start:
            baseline = obs["value"]
            break

    if baseline is None or baseline <= 0:
        return None

    # Peak gas price during crisis
    peak = max(
        (obs["value"] for obs in gas_data if obs["date"] >= crisis_start),
        default=baseline,
    )

    return ((peak - baseline) / baseline) * 100


def _empty_crisis_entry(crisis: dict) -> dict:
    """Return a crisis entry with no computed data (fallback)."""
    return {
        "id": crisis["id"],
        "name": crisis["name"],
        "year": crisis["year"],
        "start_date": crisis["start_date"],
        "end_date": crisis["end_date"],
        "peak_spike_pct": None,
        "duration_months": crisis["duration_months"],
        "gas_impact_pct": None,
        "context": crisis["context"],
        "trajectory": [],
        "is_current": crisis["is_current"],
    }
