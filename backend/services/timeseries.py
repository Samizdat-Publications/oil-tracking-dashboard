"""Shared time-series representation for the V3 attribution engine.

Every causal analysis in `services/attribution.py` reduces to "get two aligned,
log-differenced arrays at a common frequency, with no post-war leakage." That
reduction happens here, once, so the six analyses can't each invent their own
(subtly different, subtly wrong) alignment.

The rules encoded below are load-bearing. Getting any of them wrong silently
poisons every downstream estimate rather than raising:

1. NEVER UPSAMPLE. Aggregation is always high-frequency -> low-frequency.
   Forward-filling monthly CPI onto daily dates manufactures autocorrelation
   and is the classic route to a fake t-stat of 12.

2. WEEKLY ANCHOR = FRED'S OWN DATES. GASREGW/GASDESW are Monday-stamped survey
   prices covering the preceding week. The matching oil bucket is the *mean of
   daily WTI over the 7 days ending on that Monday*, not the Monday close.
   Period-mean rather than point-sample, because retail prices reflect wholesale
   costs accumulated over the period; point-sampling induces classical
   measurement error and attenuates beta toward zero.

3. MONTHLY ANCHOR = CALENDAR MONTH. CPI is a period-average concept collected
   across the month, so the oil regressor is the calendar-month mean of daily
   WTI. CPI observations are dated to the 1st of the month they *cover*.

4. COVERAGE GUARD. A bucket holding less than `min_coverage` of its expected
   underlying observations becomes NaN and is dropped pairwise, with the count
   reported. Protects against holiday weeks and FRED gaps quietly reweighting
   the sample.

5. NON-POSITIVE SERIES ARE NEVER LOGGED. T10Y2Y goes negative; log() would
   produce NaN and the regression would silently drop half the sample.

6. LEAKAGE GUARD. `fit_window()` asserts its output ends strictly before the
   war date. Every pre-war estimator draws its sample from that function, so
   leakage is a raised AssertionError rather than a slightly-too-good result.

7. PARTIAL-TREATMENT DONUT. The war starts mid-period for monthly series. The
   pre-war sample ends with the last period ending strictly before 2026-02-28
   (January 2026 for monthly, week-ending 2026-02-23 for weekly). February 2026
   monthly observations are flagged `partially_treated` and excluded from
   headline totals.

MISSING DATA WARNING -- October 2025
------------------------------------
The 43-day federal shutdown (2025-10-01 to 2025-11-12) means October 2025 CPI
was never collected and never will be. It has TWO distinct failure modes that
callers must both survive:

  * CPI series: BLS/FRED return the period with a null/"." value.
  * Import/export price indexes: the period is ABSENT from the response
    entirely -- 864 indexes permanently suppressed.

`to_ts` drops non-finite values, so mode one collapses into mode two: the gap
appears as a missing period rather than a NaN. `find_gaps()` surfaces both so
the frontend can disclose the hole rather than drawing a straight line through
it. See docs/THESIS.md "Landmines".
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Literal, Sequence

import numpy as np

Freq = Literal["D", "W", "M"]
How = Literal["mean", "last"]

#: Canonical war start. The event marker, not the math baseline.
WAR_DATE = "2026-02-28"

#: Baseline for "since the war" arithmetic. By 2026-02-27 the spot price had
#: already priced in escalation, so the last clean print before the run-up is
#: the honest anchor. Both dates are shown in the UI.
WAR_BASELINE_DATE = "2026-02-14"

#: Periods per year, used for annualisation. Keyed by inferred frequency.
PERIODS_PER_YEAR: dict[str, float] = {"D": 252.0, "W": 52.0, "M": 12.0}

#: Expected underlying observations per bucket when aggregating to a frequency.
#: Daily source data is business-daily, hence 5 per week / ~21 per month.
_EXPECTED_PER_BUCKET: dict[str, float] = {"W": 5.0, "M": 21.0}

_DAY = np.timedelta64(1, "D")


@dataclass(frozen=True)
class TS:
    """An aligned, gap-free time series.

    `dates` is strictly ascending and unique; `values` is finite throughout.
    Construct via `to_ts` rather than directly -- it enforces both invariants.
    """

    key: str
    dates: np.ndarray  # datetime64[D], strictly ascending, unique
    values: np.ndarray  # float64, all finite
    freq: Freq
    unit: str = "index"  # "usd_bbl" | "usd_gal" | "index" | "pct" | "ratio"
    positive: bool = True  # False => never log-transform
    sa: bool = True  # seasonally adjusted at source?
    name: str = ""
    n_dropped: int = 0  # observations discarded as non-finite

    def __len__(self) -> int:
        return int(self.values.size)

    @property
    def start(self) -> str:
        return str(self.dates[0]) if len(self) else ""

    @property
    def end(self) -> str:
        return str(self.dates[-1]) if len(self) else ""

    @property
    def periods_per_year(self) -> float:
        return PERIODS_PER_YEAR[self.freq]

    def to_observations(self) -> list[dict]:
        """Round-trip back to the FRED-style wire format."""
        return [
            {"date": str(d), "value": float(v)}
            for d, v in zip(self.dates, self.values)
        ]


# ---------------------------------------------------------------------------
# Construction
# ---------------------------------------------------------------------------


def to_ts(
    obs: Sequence[dict],
    key: str,
    *,
    unit: str = "index",
    positive: bool = True,
    sa: bool = True,
    name: str = "",
    freq: Freq | None = None,
) -> TS:
    """Build a `TS` from FRED-style ``[{"date": ..., "value": ...}]``.

    Non-finite values are dropped and counted -- this is what collapses the
    "null value" flavour of the October 2025 hole into the "missing period"
    flavour, so downstream code only has to handle one.

    Duplicate dates keep the last occurrence (FRED revisions arrive in order).
    """
    raw_dates: list[np.datetime64] = []
    raw_values: list[float] = []
    dropped = 0

    for point in obs:
        raw = point.get("value")
        if raw is None or raw == "." or raw == "":
            dropped += 1
            continue
        try:
            value = float(raw)
        except (TypeError, ValueError):
            dropped += 1
            continue
        if not np.isfinite(value):
            dropped += 1
            continue
        raw_dates.append(np.datetime64(str(point["date"])[:10], "D"))
        raw_values.append(value)

    if not raw_dates:
        return TS(
            key=key,
            dates=np.array([], dtype="datetime64[D]"),
            values=np.array([], dtype=np.float64),
            freq=freq or "D",
            unit=unit,
            positive=positive,
            sa=sa,
            name=name or key,
            n_dropped=dropped,
        )

    dates = np.array(raw_dates, dtype="datetime64[D]")
    values = np.array(raw_values, dtype=np.float64)

    order = np.argsort(dates, kind="stable")
    dates, values = dates[order], values[order]

    # Keep the LAST observation per date. np.unique returns first indices, so
    # find the last by reversing.
    if dates.size > 1:
        keep = np.ones(dates.size, dtype=bool)
        keep[:-1] = dates[:-1] != dates[1:]
        dates, values = dates[keep], values[keep]

    return TS(
        key=key,
        dates=dates,
        values=values,
        freq=freq or infer_freq(dates),
        unit=unit,
        positive=positive,
        sa=sa,
        name=name or key,
        n_dropped=dropped,
    )


def infer_freq(dates: np.ndarray) -> Freq:
    """Infer frequency from the median inter-observation gap.

    Median rather than mean so a single shutdown-sized hole doesn't reclassify
    a daily series as weekly.
    """
    if dates.size < 3:
        return "D"
    gaps = np.diff(dates).astype("timedelta64[D]").astype(float)
    median_gap = float(np.median(gaps))
    if median_gap <= 4.0:
        return "D"
    if median_gap <= 10.0:
        return "W"
    return "M"


# ---------------------------------------------------------------------------
# Bucketing
# ---------------------------------------------------------------------------


def _month_floor(dates: np.ndarray) -> np.ndarray:
    """Map each date to the first of its calendar month."""
    return dates.astype("datetime64[M]").astype("datetime64[D]")


def _bucket_to_anchors(dates: np.ndarray, anchors: np.ndarray) -> np.ndarray:
    """Assign each date to the earliest anchor >= that date (period-ending).

    Implements rule 2: a Monday-stamped weekly print covers the days leading up
    to it, so daily observations map forward onto the next anchor. Dates after
    the final anchor return -1 and are discarded.
    """
    idx = np.searchsorted(anchors, dates, side="left")
    idx[idx >= anchors.size] = -1
    return idx


def resample(
    ts: TS,
    freq: Freq,
    *,
    how: How = "mean",
    anchor: np.ndarray | None = None,
    min_coverage: float = 0.6,
) -> TS:
    """Aggregate `ts` to `freq`. Never upsamples (rule 1).

    Parameters
    ----------
    anchor:
        Target period-end dates. When aggregating daily data to match a weekly
        survey series, pass that series' own dates -- this is rule 2, and it is
        why we don't reconstruct week boundaries ourselves.
    min_coverage:
        Fraction of `_EXPECTED_PER_BUCKET` a bucket must contain to survive
        (rule 4). Buckets below it are dropped, not interpolated.
    """
    order = {"D": 0, "W": 1, "M": 2}
    if order[freq] < order[ts.freq]:
        raise ValueError(
            f"refusing to upsample {ts.key} from {ts.freq} to {freq} "
            "(see timeseries rule 1)"
        )
    if freq == ts.freq and anchor is None:
        return ts
    if len(ts) == 0:
        return replace(ts, freq=freq)

    if anchor is not None:
        anchors = np.asarray(anchor, dtype="datetime64[D]")
        bucket_idx = _bucket_to_anchors(ts.dates, anchors)
    elif freq == "M":
        anchors, bucket_idx = np.unique(_month_floor(ts.dates), return_inverse=True)
    else:  # weekly with no anchor: snap forward to Mondays
        offsets = (ts.dates.astype(int) - 4) % 7  # 1970-01-01 was a Thursday
        mondays = ts.dates + (7 - offsets).astype("timedelta64[D]")
        anchors, bucket_idx = np.unique(mondays, return_inverse=True)

    valid = bucket_idx >= 0
    if not valid.any():
        return replace(
            ts,
            dates=np.array([], dtype="datetime64[D]"),
            values=np.array([], dtype=np.float64),
            freq=freq,
        )

    idx = bucket_idx[valid]
    vals = ts.values[valid]
    n_buckets = anchors.size

    counts = np.bincount(idx, minlength=n_buckets).astype(np.float64)
    if how == "mean":
        sums = np.bincount(idx, weights=vals, minlength=n_buckets)
        with np.errstate(invalid="ignore", divide="ignore"):
            agg = sums / counts
    else:  # "last" -- assignment in ascending order leaves the final write
        agg = np.full(n_buckets, np.nan)
        agg[idx] = vals

    # Coverage guard (rule 4). Only meaningful when the source is finer-grained
    # than the target; same-frequency realignment expects one point per bucket.
    if ts.freq == "D" and freq in _EXPECTED_PER_BUCKET:
        required = _EXPECTED_PER_BUCKET[freq] * min_coverage
    else:
        required = 1.0
    keep = counts >= required

    dropped = int((~keep & (counts > 0)).sum())
    return TS(
        key=ts.key,
        dates=anchors[keep],
        values=agg[keep],
        freq=freq,
        unit=ts.unit,
        positive=ts.positive,
        sa=ts.sa,
        name=ts.name,
        n_dropped=ts.n_dropped + dropped,
    )


def align(
    x: TS,
    y: TS,
    *,
    how: How = "mean",
    min_coverage: float = 0.6,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Align two series onto their common (coarser) frequency.

    Returns ``(dates, x_values, y_values)``. The coarser series supplies the
    anchor dates, so a daily regressor is period-averaged onto a weekly or
    monthly outcome rather than the outcome being smeared onto daily dates.
    """
    order = {"D": 0, "W": 1, "M": 2}
    target: Freq = x.freq if order[x.freq] >= order[y.freq] else y.freq

    if order[x.freq] < order[target]:
        anchor = y.dates if target == y.freq else None
        x = resample(x, target, how=how, anchor=anchor, min_coverage=min_coverage)
    if order[y.freq] < order[target]:
        anchor = x.dates if target == x.freq else None
        y = resample(y, target, how=how, anchor=anchor, min_coverage=min_coverage)

    common, ix, iy = np.intersect1d(x.dates, y.dates, return_indices=True)
    return common, x.values[ix], y.values[iy]


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------


def logs(ts: TS) -> np.ndarray:
    """Natural log of the values. Raises for non-positive series (rule 5)."""
    if not ts.positive:
        raise ValueError(
            f"{ts.key} is flagged non-positive; use levels, not logs "
            "(see timeseries rule 5)"
        )
    if len(ts) and float(np.min(ts.values)) <= 0.0:
        raise ValueError(f"{ts.key} contains non-positive values; cannot log")
    return np.log(ts.values)


def dlog(ts: TS) -> tuple[np.ndarray, np.ndarray]:
    """First difference of logs. Returns ``(dates[1:], diff)``.

    Gaps are NOT bridged: a difference spanning the October 2025 hole is a
    two-month change wearing a one-month label. Callers that care should use
    `find_gaps` to mask those observations; `passthrough` does.
    """
    if len(ts) < 2:
        return np.array([], dtype="datetime64[D]"), np.array([], dtype=np.float64)
    return ts.dates[1:], np.diff(logs(ts))


def dlevel(ts: TS) -> tuple[np.ndarray, np.ndarray]:
    """First difference in levels, for series that can't be logged."""
    if len(ts) < 2:
        return np.array([], dtype="datetime64[D]"), np.array([], dtype=np.float64)
    return ts.dates[1:], np.diff(ts.values)


def yoy(ts: TS) -> tuple[np.ndarray, np.ndarray]:
    """12-month percent change, matched **by calendar date, not by position**.

    This is not a style preference. October 2025 CPI was never collected, and
    `to_ts` drops missing observations -- so a positional `values[12:] /
    values[:-12]` silently compares against the observation 13 calendar months
    earlier for every month spanning the hole. That produced a June 2026
    headline of 3.73% against the true 3.53%, which is the kind of error that
    survives review because it looks plausible.

    Months with no observation exactly 12 months prior are omitted rather than
    approximated: a gap in the official series is a gap on the chart. See
    docs/THESIS.md landmine 1.
    """
    if len(ts) < 13:
        return np.array([], dtype="datetime64[D]"), np.array([], dtype=np.float64)

    lookup = {str(d): v for d, v in zip(ts.dates, ts.values)}
    out_dates: list[np.datetime64] = []
    out_vals: list[float] = []
    for d, v in zip(ts.dates, ts.values):
        prior = str(d.astype("datetime64[M]") - 12)
        # Monthly observations are dated to the first of the month.
        key = f"{prior}-01" if len(prior) == 7 else prior
        base = lookup.get(key)
        if base is None or base == 0:
            continue
        out_dates.append(d)
        out_vals.append((v / base - 1.0) * 100.0)

    return (np.array(out_dates, dtype="datetime64[D]"),
            np.array(out_vals, dtype=np.float64))


def find_gaps(ts: TS, *, tolerance: float = 1.8) -> list[dict]:
    """Locate breaks longer than `tolerance` x the median spacing.

    Surfaces the October 2025 shutdown hole (and any other) so the UI can
    disclose it instead of drawing a straight line across it.
    """
    if len(ts) < 3:
        return []
    gaps = np.diff(ts.dates).astype("timedelta64[D]").astype(float)
    median_gap = float(np.median(gaps))
    if median_gap <= 0:
        return []
    threshold = median_gap * tolerance
    return [
        {
            "after": str(ts.dates[i]),
            "before": str(ts.dates[i + 1]),
            "days": int(gaps[i]),
            "expected_days": round(median_gap, 1),
            "missing_periods": int(round(gaps[i] / median_gap)) - 1,
        }
        for i in np.flatnonzero(gaps > threshold)
    ]


# ---------------------------------------------------------------------------
# Slicing / lookup
# ---------------------------------------------------------------------------


def slice_between(ts: TS, start: str | None = None, end: str | None = None,
                  *, inclusive_end: bool = True) -> TS:
    """Restrict to a date window."""
    mask = np.ones(len(ts), dtype=bool)
    if start:
        mask &= ts.dates >= np.datetime64(start, "D")
    if end:
        cutoff = np.datetime64(end, "D")
        mask &= (ts.dates <= cutoff) if inclusive_end else (ts.dates < cutoff)
    return replace(ts, dates=ts.dates[mask], values=ts.values[mask])


def fit_window(
    ts: TS,
    *,
    war_date: str = WAR_DATE,
    months: int | None = 36,
) -> TS:
    """Return the pre-war estimation sample. **The leakage guard (rule 6).**

    Every pre-war estimator must source its sample here. The assertion at the
    end is deliberate: leakage should be a raised exception, not a slightly
    flattering coefficient nobody notices.

    Rule 7 (partial-treatment donut) is applied via `period_end_before`: the
    sample ends with the last period that *ends* strictly before the war, so a
    monthly observation straddling 2026-02-28 never enters the fit.
    """
    cutoff = np.datetime64(war_date, "D")

    if ts.freq == "M":
        # A monthly obs dated the 1st covers the whole month; it is clean only
        # if its month ENDS before the war. Feb 2026 (dated 02-01) is not.
        month_start = cutoff.astype("datetime64[M]").astype("datetime64[D]")
        last_clean = month_start  # exclusive bound => keeps through January
        pre = slice_between(ts, end=str(last_clean), inclusive_end=False)
    else:
        pre = slice_between(ts, end=str(cutoff), inclusive_end=False)

    if months is not None and len(pre):
        start = pre.dates[-1] - np.timedelta64(int(months * 30.44), "D")
        pre = slice_between(pre, start=str(start))

    assert len(pre) == 0 or pre.dates[-1] < cutoff, (
        f"leakage: {ts.key} pre-war window ends {pre.end} >= war date {war_date}"
    )
    return pre


def is_partially_treated(ts: TS, *, war_date: str = WAR_DATE) -> np.ndarray:
    """Boolean mask of observations whose period straddles the war date.

    Only monthly series can straddle; daily and weekly observations dated on or
    after the war date are fully treated.
    """
    cutoff = np.datetime64(war_date, "D")
    if ts.freq != "M":
        return np.zeros(len(ts), dtype=bool)
    month_start = cutoff.astype("datetime64[M]").astype("datetime64[D]")
    return ts.dates == month_start


def last_on_or_before(ts: TS, when: str) -> tuple[str, float] | None:
    """Most recent observation at or before `when`.

    Used for baseline lookups. 2026-02-14 is a Saturday, so the baseline date
    resolves to the preceding print -- we report the date actually used rather
    than interpolating a value that was never observed.
    """
    if len(ts) == 0:
        return None
    idx = np.searchsorted(ts.dates, np.datetime64(when, "D"), side="right") - 1
    if idx < 0:
        return None
    return str(ts.dates[idx]), float(ts.values[idx])


def horizon_end(*series: TS) -> str:
    """Latest date common to all inputs -- the honest evaluation horizon.

    Deliberately NOT `date.today()`. CPI publishes with a ~2 month lag; a
    horizon taken from the wall clock would pad the counterfactual with extra
    periods of drift and widen the measured "gap" for free. Also keeps a
    placebo control from appearing to pass merely because its data ends sooner.
    """
    ends = [s.dates[-1] for s in series if len(s)]
    return str(min(ends)) if ends else ""
