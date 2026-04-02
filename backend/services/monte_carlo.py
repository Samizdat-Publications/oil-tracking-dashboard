"""Monte Carlo simulation engine for oil price forecasting."""

from __future__ import annotations

from datetime import date, timedelta
import numpy as np


def estimate_params(prices: list[float], window: int = 504) -> dict:
    """Estimate GBM + jump-diffusion parameters from historical log-returns.

    Uses up to the last *window* prices.
    """
    arr = np.array(prices[-window:], dtype=np.float64)
    if len(arr) < 10:
        raise ValueError("Need at least 10 price observations to estimate parameters.")

    log_returns = np.diff(np.log(arr))
    dt = 1.0 / 252.0

    mu_daily = float(np.mean(log_returns))
    sigma_daily = float(np.std(log_returns, ddof=1))

    # Annualise
    mu = mu_daily / dt
    sigma = sigma_daily / np.sqrt(dt)

    # Jump detection: returns > 3 sigma are considered jumps
    threshold = 3.0 * sigma_daily
    jumps = log_returns[np.abs(log_returns) > threshold]

    if len(jumps) >= 2:
        lambda_jump = float(len(jumps)) / (len(log_returns) * dt)
        mu_jump = float(np.mean(jumps))
        sigma_jump = float(np.std(jumps, ddof=1))
    else:
        lambda_jump = 0.5
        mu_jump = 0.0
        sigma_jump = sigma_daily * 2.0

    return {
        "mu": mu,
        "sigma": sigma,
        "lambda_jump": lambda_jump,
        "mu_jump": mu_jump,
        "sigma_jump": sigma_jump,
    }


def run_simulation(
    current_price: float,
    mu: float,
    sigma: float,
    lambda_jump: float,
    mu_jump: float,
    sigma_jump: float,
    n_paths: int = 5000,
    n_days: int = 126,
    seed: int | None = None,
    model: str = "jump_diffusion",
) -> dict:
    """Run Monte Carlo simulation and return percentile bands.

    Parameters
    ----------
    current_price : starting price
    mu, sigma : annualised drift and volatility
    lambda_jump, mu_jump, sigma_jump : jump process params
    n_paths : number of Monte Carlo paths
    n_days : forecast horizon in trading days
    seed : optional RNG seed for reproducibility
    model : "gbm" or "jump_diffusion"

    Returns
    -------
    dict with keys: dates, bands, params
    """
    rng = np.random.default_rng(seed)
    dt = 1.0 / 252.0

    # Standard GBM increments
    z = rng.standard_normal((n_paths, n_days))
    drift = (mu - 0.5 * sigma**2) * dt
    diffusion = sigma * np.sqrt(dt) * z

    log_increments = drift + diffusion

    # Add jump component for jump-diffusion model
    if model == "jump_diffusion":
        # Poisson arrivals
        jump_counts = rng.poisson(lambda_jump * dt, size=(n_paths, n_days))
        # For each jump event, sample a jump size
        jump_sizes = rng.normal(mu_jump, sigma_jump, size=(n_paths, n_days))
        log_increments += jump_counts * jump_sizes

    # Cumulative sum of log-returns to get log(S_t / S_0)
    cum_log = np.cumsum(log_increments, axis=1)
    # Prices matrix: shape (n_paths, n_days)
    prices = current_price * np.exp(cum_log)

    # Percentile bands
    percentiles = [1, 5, 25, 50, 75, 95, 99]
    bands: dict[str, list[float]] = {}
    for p in percentiles:
        band = np.percentile(prices, p, axis=0)
        bands[f"p{p}"] = [round(float(v), 2) for v in band]

    # Generate date strings starting from tomorrow
    start = date.today() + timedelta(days=1)
    dates: list[str] = []
    d = start
    count = 0
    while count < n_days:
        if d.weekday() < 5:  # Skip weekends
            dates.append(d.isoformat())
            count += 1
        d += timedelta(days=1)

    params = {
        "mu": round(mu, 6),
        "sigma": round(sigma, 6),
        "lambda_jump": round(lambda_jump, 6) if model == "jump_diffusion" else None,
        "mu_jump": round(mu_jump, 6) if model == "jump_diffusion" else None,
        "sigma_jump": round(sigma_jump, 6) if model == "jump_diffusion" else None,
        "model": model,
        "n_paths": n_paths,
        "horizon_days": n_days,
        "current_price": round(current_price, 2),
    }

    return {"dates": dates, "bands": bands, "params": params}
