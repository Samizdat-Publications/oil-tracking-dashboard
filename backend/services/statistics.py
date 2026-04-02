"""Statistical analysis helpers."""

from __future__ import annotations

import numpy as np


def rolling_correlation(
    series_a: list[dict],
    series_b: list[dict],
    window: int = 30,
) -> list[dict]:
    """Compute rolling Pearson correlation between two time series.

    Each series is a list of {"date": str, "value": float}.
    Returns list of {"date": str, "correlation": float | None}.
    """
    # Build date-aligned arrays
    a_map = {pt["date"]: pt["value"] for pt in series_a}
    b_map = {pt["date"]: pt["value"] for pt in series_b}

    common_dates = sorted(set(a_map.keys()) & set(b_map.keys()))
    if len(common_dates) < window:
        return []

    a_vals = np.array([a_map[d] for d in common_dates], dtype=np.float64)
    b_vals = np.array([b_map[d] for d in common_dates], dtype=np.float64)

    results: list[dict] = []
    for i in range(len(common_dates)):
        if i < window - 1:
            results.append({"date": common_dates[i], "correlation": None})
            continue
        a_win = a_vals[i - window + 1 : i + 1]
        b_win = b_vals[i - window + 1 : i + 1]

        std_a = np.std(a_win, ddof=1)
        std_b = np.std(b_win, ddof=1)
        if std_a == 0 or std_b == 0:
            results.append({"date": common_dates[i], "correlation": None})
            continue

        corr = float(np.corrcoef(a_win, b_win)[0, 1])
        results.append({"date": common_dates[i], "correlation": round(corr, 4)})

    return results


def realized_volatility(
    prices: list[float],
    windows: list[int] | None = None,
) -> dict[int, float]:
    """Compute annualised realised volatility for multiple windows.

    Returns {window: annualised_vol}.
    """
    if windows is None:
        windows = [5, 20, 60, 252]

    arr = np.array(prices, dtype=np.float64)
    if len(arr) < 2:
        return {w: 0.0 for w in windows}

    log_ret = np.diff(np.log(arr))
    result: dict[int, float] = {}
    for w in windows:
        if len(log_ret) < w:
            result[w] = float(np.std(log_ret, ddof=1) * np.sqrt(252))
        else:
            recent = log_ret[-w:]
            result[w] = round(float(np.std(recent, ddof=1) * np.sqrt(252)), 6)
    return result


def compute_var(
    simulated_end_prices: list[float] | np.ndarray,
    confidence: float = 0.95,
) -> float:
    """Value-at-Risk: the worst-case loss at the given confidence level.

    Returns the price threshold below which (1-confidence)% of outcomes fall.
    """
    arr = np.array(simulated_end_prices, dtype=np.float64)
    return round(float(np.percentile(arr, (1.0 - confidence) * 100)), 2)


def compute_cvar(
    simulated_end_prices: list[float] | np.ndarray,
    confidence: float = 0.95,
) -> float:
    """Conditional VaR (Expected Shortfall): average of losses beyond VaR."""
    arr = np.array(simulated_end_prices, dtype=np.float64)
    var_threshold = np.percentile(arr, (1.0 - confidence) * 100)
    tail = arr[arr <= var_threshold]
    if len(tail) == 0:
        return round(float(var_threshold), 2)
    return round(float(np.mean(tail)), 2)
