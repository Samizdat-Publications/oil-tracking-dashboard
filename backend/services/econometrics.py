"""Pure-numpy estimators for the V3 attribution engine.

This module has NO I/O and imports nothing from `services.*`. That boundary is
what makes the estimators testable offline against synthetic data with known
truth -- see `backend/tests/test_econometrics.py`, where every function below
is checked for both *recovery* (does it find a planted effect?) and *size*
(does it stay quiet when there's nothing there?).

Design constraints that shaped the implementations:

* No pandas, no statsmodels. They pull ~100MB and the deploy target is a
  256MB Fly VM already holding a SQLite cache and 20 years x 18 series.
  Everything here is small-matrix OLS plus bootstrap loops.
* Bootstrap loops are vectorised across replications, not across time, and
  chunked so peak memory stays a few MB rather than N x T x 8 bytes.
* Every inference routine is bootstrap- or permutation-based rather than
  asymptotic. Oil returns are fat-tailed and volatility-clustered; a
  homoskedastic F table would be wrong in exactly the direction that
  flatters our conclusion, which is the worst kind of wrong.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

_EPS = 1e-12


# ---------------------------------------------------------------------------
# OLS with HAC standard errors
# ---------------------------------------------------------------------------


@dataclass
class OLSResult:
    beta: np.ndarray
    resid: np.ndarray
    cov: np.ndarray  # HAC if hac_lags > 0, else classical
    se: np.ndarray
    tstat: np.ndarray
    pvalue: np.ndarray
    r2: float
    adj_r2: float
    n: int
    k: int
    sigma: float
    hac_lags: int
    xtx_inv: np.ndarray = field(repr=False, default=None)  # type: ignore[assignment]


def newey_west_cov(
    X: np.ndarray, resid: np.ndarray, xtx_inv: np.ndarray, lags: int
) -> np.ndarray:
    """Newey-West HAC covariance with Bartlett kernel.

        V = (T/(T-k)) (X'X)^-1 Omega (X'X)^-1
        Omega = S_0 + sum_l w_l (S_l + S_l')
        w_l   = 1 - l/(L+1)

    Mandatory wherever regressors overlap across observations: a distributed-lag
    design makes the errors an MA process *by construction*, so classical OLS
    standard errors there aren't conservative, they're meaningless.
    """
    n, k = X.shape
    u = resid[:, None] * X  # score contributions, (n, k)
    omega = u.T @ u
    for lag in range(1, min(lags, n - 1) + 1):
        weight = 1.0 - lag / (lags + 1.0)
        gamma = u[lag:].T @ u[:-lag]
        omega += weight * (gamma + gamma.T)
    scale = n / max(n - k, 1)
    return scale * (xtx_inv @ omega @ xtx_inv)


def nw_bandwidth(n: int, floor: int = 0) -> int:
    """Newey-West (1994) automatic bandwidth, floored at a known MA order."""
    rule = int(np.floor(4.0 * (n / 100.0) ** (2.0 / 9.0)))
    return max(rule, floor, 1)


def ols(
    X: np.ndarray, y: np.ndarray, *, hac_lags: int | None = None
) -> OLSResult:
    """Least squares via `lstsq`.

    `lstsq` rather than normal equations because Fourier seasonal columns are
    near-collinear at short windows and (X'X)^-1 loses precision there.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n, k = X.shape

    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    resid = y - X @ beta
    dof = max(n - k, 1)
    sigma2 = float(resid @ resid) / dof

    xtx_inv = np.linalg.pinv(X.T @ X)
    if hac_lags and hac_lags > 0:
        cov = newey_west_cov(X, resid, xtx_inv, hac_lags)
    else:
        cov = sigma2 * xtx_inv

    se = np.sqrt(np.maximum(np.diag(cov), 0.0))
    with np.errstate(divide="ignore", invalid="ignore"):
        tstat = np.where(se > _EPS, beta / se, 0.0)
    pvalue = 2.0 * _norm_sf(np.abs(tstat))

    tss = float(((y - y.mean()) ** 2).sum())
    rss = float(resid @ resid)
    r2 = 1.0 - rss / tss if tss > _EPS else 0.0
    adj_r2 = 1.0 - (1.0 - r2) * (n - 1) / dof if dof > 0 else 0.0

    return OLSResult(
        beta=beta, resid=resid, cov=cov, se=se, tstat=tstat, pvalue=pvalue,
        r2=r2, adj_r2=adj_r2, n=n, k=k, sigma=float(np.sqrt(sigma2)),
        hac_lags=int(hac_lags or 0), xtx_inv=xtx_inv,
    )


def _norm_sf(z: np.ndarray | float) -> np.ndarray:
    """Upper-tail standard normal, via the erfc identity. Avoids a scipy import."""
    from math import erfc

    z_arr = np.atleast_1d(np.asarray(z, dtype=np.float64))
    out = np.array([0.5 * erfc(float(v) / np.sqrt(2.0)) for v in z_arr])
    return out if np.ndim(z) else out


def wald_test(
    result: OLSResult, R: np.ndarray, r: np.ndarray | float = 0.0
) -> tuple[float, float, int]:
    """Wald test of ``R beta = r``. Returns ``(statistic, p_value, df)``."""
    R = np.atleast_2d(np.asarray(R, dtype=np.float64))
    r_vec = np.atleast_1d(np.asarray(r, dtype=np.float64))
    diff = R @ result.beta - r_vec
    middle = R @ result.cov @ R.T
    stat = float(diff @ np.linalg.pinv(middle) @ diff)
    df = R.shape[0]
    return stat, float(_chi2_sf(stat, df)), df


def _chi2_sf(stat: float, df: int) -> float:
    """Upper-tail chi-square. Closed forms for df 1 and 2; series otherwise."""
    if stat <= 0:
        return 1.0
    if df == 1:
        return float(2.0 * _norm_sf(np.sqrt(stat))[0])
    if df == 2:
        return float(np.exp(-stat / 2.0))
    # Wilson-Hilferty cube-root normal approximation; accurate to ~1e-3 in the
    # tail, which is far finer than any decision this drives.
    z = ((stat / df) ** (1.0 / 3.0) - (1.0 - 2.0 / (9.0 * df))) / np.sqrt(
        2.0 / (9.0 * df)
    )
    return float(_norm_sf(z)[0])


# ---------------------------------------------------------------------------
# Structural break detection
# ---------------------------------------------------------------------------


def sup_f_mean(r: np.ndarray, trim: float = 0.15) -> tuple[float, int, np.ndarray]:
    """Sup-Wald sweep for a single mean shift. O(T) via prefix sums.

    For every candidate split k the two-regime RSS is

        RSS1(k) = (A2(k) - A1(k)^2/k) + (B2(k) - B1(k)^2/(T-k))

    with A the prefix sums and B the complementary suffix sums, so each F(k)
    costs O(1) and the whole sweep is O(T). That is what makes a 2000-rep
    bootstrap of the null distribution essentially free.

    Returns ``(supF, argmax index, full F path)``. The F path is kept so the
    caller can report the runner-up local maximum -- "you'd find a break
    anywhere" is a fair objection and the honest answer is to show the
    second-best candidate alongside the best.
    """
    r = np.asarray(r, dtype=np.float64)
    T = r.size
    lo, hi = int(np.floor(trim * T)), int(np.ceil((1 - trim) * T))
    f_path = np.zeros(T)
    if T < 8 or hi <= lo:
        return 0.0, -1, f_path

    csum = np.cumsum(r)
    csum2 = np.cumsum(r * r)
    total, total2 = csum[-1], csum2[-1]

    k = np.arange(lo, hi, dtype=np.float64)
    ki = k.astype(int)
    a1, a2 = csum[ki - 1], csum2[ki - 1]
    b1, b2 = total - a1, total2 - a2
    n2 = T - k

    rss1 = (a2 - a1 * a1 / k) + (b2 - b1 * b1 / n2)
    rss0 = total2 - total * total / T
    with np.errstate(divide="ignore", invalid="ignore"):
        f = (rss0 - rss1) / np.maximum(rss1 / (T - 2), _EPS)
    f = np.nan_to_num(f, nan=0.0, posinf=0.0, neginf=0.0)

    f_path[ki] = f
    best = int(np.argmax(f))
    return float(f[best]), int(ki[best]), f_path


def _sup_f_batch(R: np.ndarray, trim: float) -> np.ndarray:
    """Vectorised `sup_f_mean` over rows of an (N, T) matrix. Returns (N,)."""
    N, T = R.shape
    lo, hi = int(np.floor(trim * T)), int(np.ceil((1 - trim) * T))
    if T < 8 or hi <= lo:
        return np.zeros(N)

    csum = np.cumsum(R, axis=1)
    csum2 = np.cumsum(R * R, axis=1)
    total = csum[:, -1:], csum2[:, -1:]

    k = np.arange(lo, hi, dtype=np.float64)[None, :]
    ki = np.arange(lo, hi)
    a1, a2 = csum[:, ki - 1], csum2[:, ki - 1]
    b1, b2 = total[0] - a1, total[1] - a2
    n2 = T - k

    rss1 = (a2 - a1 * a1 / k) + (b2 - b1 * b1 / n2)
    rss0 = total[1] - total[0] ** 2 / T
    with np.errstate(divide="ignore", invalid="ignore"):
        f = (rss0 - rss1) / np.maximum(rss1 / (T - 2), _EPS)
    return np.nan_to_num(f, nan=0.0, posinf=0.0, neginf=0.0).max(axis=1)


def wild_bootstrap_pvalue(
    r: np.ndarray,
    observed: float,
    *,
    trim: float = 0.15,
    n_boot: int = 2000,
    seed: int = 0,
    chunk: int = 500,
) -> float:
    """Wild-bootstrap p-value for supF under the no-break null.

    Rademacher multipliers preserve conditional heteroskedasticity, so the null
    distribution reflects the actual volatility clustering in oil returns
    instead of assuming it away. This is the answer to "your F distribution is
    wrong under GARCH": we never used one.

    Chunked to cap peak memory -- an unchunked (2000 x 850) float64 draw plus
    two cumsums of the same shape is ~40MB, which matters at 256MB.
    """
    r = np.asarray(r, dtype=np.float64)
    T = r.size
    if T < 8:
        return 1.0
    rng = np.random.default_rng(seed)
    mu = float(r.mean())
    u = r - mu

    exceed = 0
    done = 0
    while done < n_boot:
        size = min(chunk, n_boot - done)
        eta = rng.choice(np.array([-1.0, 1.0]), size=(size, T))
        exceed += int((_sup_f_batch(mu + eta * u, trim) >= observed).sum())
        done += size
    return (1.0 + exceed) / (n_boot + 1.0)


def break_date_ci(
    r: np.ndarray,
    k_hat: int,
    *,
    trim: float = 0.15,
    n_boot: int = 500,
    seed: int = 0,
    block: int | None = None,
) -> tuple[int, int]:
    """Bootstrap confidence interval for the break *index*.

    Holds the two-regime means fixed, resamples residuals within regime using
    moving blocks (preserving serial dependence), regenerates, and re-estimates
    the break point. Returns 2.5th/97.5th percentiles of the redetected index.
    """
    r = np.asarray(r, dtype=np.float64)
    T = r.size
    if k_hat <= 0 or k_hat >= T:
        return k_hat, k_hat
    rng = np.random.default_rng(seed)

    mu1, mu2 = float(r[:k_hat].mean()), float(r[k_hat:].mean())
    fitted = np.concatenate([np.full(k_hat, mu1), np.full(T - k_hat, mu2)])
    u1, u2 = r[:k_hat] - mu1, r[k_hat:] - mu2
    L = block or max(2, int(round(T ** (1.0 / 3.0))))

    ks = np.empty(n_boot, dtype=int)
    for b in range(n_boot):
        star = fitted + np.concatenate(
            [_moving_block(u1, u1.size, L, rng), _moving_block(u2, u2.size, L, rng)]
        )
        _, k_star, _ = sup_f_mean(star, trim)
        ks[b] = k_star if k_star >= 0 else k_hat
    return int(np.percentile(ks, 2.5)), int(np.percentile(ks, 97.5))


def _moving_block(u: np.ndarray, n_out: int, block: int, rng) -> np.ndarray:
    """Moving-block bootstrap resample of `u`, length `n_out`."""
    n = u.size
    if n == 0:
        return np.zeros(n_out)
    if block >= n:
        return rng.choice(u, size=n_out, replace=True)
    n_blocks = int(np.ceil(n_out / block))
    starts = rng.integers(0, n - block + 1, size=n_blocks)
    return np.concatenate([u[s : s + block] for s in starts])[:n_out]


# ---------------------------------------------------------------------------
# Counterfactual: ARIMA(p,1,0) with drift + Fourier seasonality
# ---------------------------------------------------------------------------


def fourier_terms(dates: np.ndarray, K: int) -> np.ndarray:
    """Annual Fourier basis on day-of-year. Returns (n, 2K).

    Required for GASREGW/GASDESW, which are NOT seasonally adjusted: gasoline
    rises every January-to-May on summer-blend changeover and driving season.
    Attributing that recurring swing to the war is the single easiest way for a
    competent critic to discredit the whole page.
    """
    if K <= 0:
        return np.zeros((len(dates), 0))
    years = dates.astype("datetime64[Y]").astype("datetime64[D]")
    doy = (dates - years).astype("timedelta64[D]").astype(float)
    ang = 2.0 * np.pi * doy[:, None] * np.arange(1, K + 1)[None, :] / 365.25
    return np.hstack([np.cos(ang), np.sin(ang)])


def _design(dy: np.ndarray, p: int, dseas: np.ndarray) -> np.ndarray:
    """Build [1, lags(dy, 1..p), dseasonal] for the differenced regression."""
    n = dy.size - p
    cols = [np.ones(n)]
    for j in range(1, p + 1):
        cols.append(dy[p - j : dy.size - j])
    if dseas.shape[1]:
        cols.extend(dseas[p:, c] for c in range(dseas.shape[1]))
    return np.column_stack(cols)


@dataclass
class ArimaFit:
    p: int
    beta: np.ndarray
    sigma: float
    resid: np.ndarray
    bic: float
    bic_path: dict[int, float]
    n_obs: int
    fourier_k: int
    seasonal_amplitude_pct: float


def fit_arima_drift(
    y: np.ndarray,
    dates: np.ndarray,
    *,
    max_lags: int = 4,
    fourier_k: int = 2,
) -> ArimaFit:
    """Fit ``dy_t = mu + sum_j phi_j dy_{t-j} + ds_t + e_t``; select p by BIC.

    Differencing rather than a deterministic trend is the central modelling
    choice. A trend-stationary model on a near-unit-root price series produces
    a prediction interval of roughly constant width at every horizon -- it
    would assert that oil "could not plausibly" have reached $75 by June absent
    the war, when in fact it travelled $68 -> $57 -> $67 in the six pre-war
    months with no war at all. Differencing sidesteps the unit-root argument
    entirely and lets interval width grow with the horizon, as it must.
    """
    y = np.asarray(y, dtype=np.float64)
    dy = np.diff(y)
    seas = fourier_terms(dates, fourier_k)
    dseas = np.diff(seas, axis=0) if seas.shape[1] else np.zeros((dy.size, 0))

    bic_path: dict[int, float] = {}
    best: tuple[float, int, "OLSResult"] | None = None
    for p in range(0, max_lags + 1):
        if dy.size - p < 3 * (p + 1 + 2 * fourier_k) or dy.size - p < 10:
            continue
        X = _design(dy, p, dseas)
        res = ols(X, dy[p:])
        n = res.n
        sigma2 = float(res.resid @ res.resid) / n
        bic = n * np.log(max(sigma2, _EPS)) + res.k * np.log(n)
        bic_path[p] = round(float(bic), 3)
        if best is None or bic < best[0]:
            best = (bic, p, res)

    if best is None:  # degenerate sample: fall back to a pure drift
        mu = float(dy.mean()) if dy.size else 0.0
        return ArimaFit(
            p=0, beta=np.array([mu]), sigma=float(dy.std(ddof=1)) if dy.size > 1 else 0.0,
            resid=dy - mu if dy.size else np.zeros(0), bic=float("inf"), bic_path={},
            n_obs=int(dy.size), fourier_k=0, seasonal_amplitude_pct=0.0,
        )

    bic, p, res = best
    amp = 0.0
    if fourier_k and seas.shape[1]:
        coefs = res.beta[1 + p :]
        if coefs.size >= 2:
            pairs = coefs.reshape(2, -1) if coefs.size == 2 * fourier_k else None
            if pairs is not None:
                amp = float(np.sqrt((pairs[0] ** 2 + pairs[1] ** 2)).sum()) * 100.0
    return ArimaFit(
        p=p, beta=res.beta, sigma=res.sigma, resid=res.resid, bic=float(bic),
        bic_path=bic_path, n_obs=res.n, fourier_k=fourier_k,
        seasonal_amplitude_pct=round(amp, 2),
    )


def bootstrap_forecast(
    y: np.ndarray,
    dates: np.ndarray,
    future_dates: np.ndarray,
    *,
    max_lags: int = 4,
    fourier_k: int = 2,
    n_boot: int = 1000,
    seed: int = 0,
) -> tuple[np.ndarray, ArimaFit]:
    """Simulate `n_boot` no-shock continuations. Returns ``(paths (B, H), fit)``.

    Two sources of uncertainty, both required:

      1. **Parameter uncertainty** -- each replication resamples the pre-war
         residuals in moving blocks, rebuilds a pseudo-sample, and REFITS.
         This is the step that usually gets skipped, and skipping it is why
         so many published counterfactual fans are indefensibly narrow: drift
         uncertainty compounds linearly in the horizon and dominates the
         interval well before h=20.
      2. **Shock uncertainty** -- fresh residual blocks are drawn along each
         simulated path.
    """
    y = np.asarray(y, dtype=np.float64)
    fit = fit_arima_drift(y, dates, max_lags=max_lags, fourier_k=fourier_k)
    H = len(future_dates)
    if H == 0 or y.size < 3:
        return np.zeros((0, 0)), fit

    # Hard floor, not a default. Estimating a 2.5th percentile from a few
    # hundred draws biases the band INWARD -- measured coverage runs ~0.88 at
    # B=150 and ~0.93 at B=400, reaching the nominal 0.95 only past B~1000
    # (see tests/test_econometrics.py::test_prediction_interval_is_calibrated).
    # A too-narrow no-war band manufactures a war effect, so this is the one
    # knob callers do not get to turn down.
    n_boot = max(int(n_boot), 1000)

    rng = np.random.default_rng(seed)
    p, k = fit.p, fit.fourier_k
    dy = np.diff(y)

    all_dates = np.concatenate([dates, future_dates])
    seas_all = fourier_terms(all_dates, k)
    dseas_all = (
        np.diff(seas_all, axis=0) if seas_all.shape[1] else np.zeros((all_dates.size - 1, 0))
    )
    dseas_future = dseas_all[dy.size :]  # aligns with the H forecast steps

    L = max(2, int(round(fit.resid.size ** (1.0 / 3.0)))) if fit.resid.size else 2
    resid_c = fit.resid - fit.resid.mean() if fit.resid.size else np.zeros(1)

    paths = np.empty((n_boot, H))
    for b in range(n_boot):
        # (1) refit on a block-bootstrapped pseudo-sample
        star_resid = _moving_block(resid_c, fit.n_obs, L, rng)
        X = _design(dy, p, dseas_all[: dy.size])
        dy_star = X @ fit.beta + star_resid
        beta_b, *_ = np.linalg.lstsq(X, dy_star, rcond=None)

        # (2) roll forward with fresh shocks
        hist = list(dy[-p:]) if p else []
        level = y[-1]
        shocks = _moving_block(resid_c, H, L, rng)
        for h in range(H):
            row = [1.0]
            for j in range(1, p + 1):
                row.append(hist[-j])
            if dseas_future.shape[1]:
                row.extend(dseas_future[h, c] for c in range(dseas_future.shape[1]))
            step = float(np.array(row) @ beta_b) + shocks[h]
            if p:
                hist.append(step)
            level += step
            paths[b, h] = level
    return paths, fit


# ---------------------------------------------------------------------------
# Distributed lag
# ---------------------------------------------------------------------------


def build_lag_matrix(x: np.ndarray, max_lag: int) -> tuple[np.ndarray, slice]:
    """Lag matrix ``[x_t, x_{t-1}, ..., x_{t-K}]`` and the valid row slice."""
    n = x.size
    cols = [x[max_lag - j : n - j] for j in range(0, max_lag + 1)]
    return np.column_stack(cols), slice(max_lag, n)


def distributed_lag(
    dx: np.ndarray,
    dy: np.ndarray,
    *,
    max_lag: int = 8,
    hac_lags: int | None = None,
) -> dict:
    """Regress dy on dx at lags 0..K. Returns coefficients and the cumulative
    response with HAC bands.

    The long-run elasticity is ``theta = sum_j beta_j`` with
    ``SE(theta) = sqrt(i' V i)`` -- the full covariance matters here because
    adjacent lag coefficients are strongly negatively correlated, so summing
    their individual standard errors would badly overstate the uncertainty.
    """
    X, rows = build_lag_matrix(dx, max_lag)
    y = dy[rows]
    X = np.column_stack([np.ones(X.shape[0]), X])
    L = hac_lags if hac_lags is not None else nw_bandwidth(y.size, floor=max_lag)
    res = ols(X, y, hac_lags=L)

    betas = res.beta[1:]
    V = res.cov[1:, 1:]
    ones = np.ones(betas.size)
    theta = float(betas.sum())
    theta_se = float(np.sqrt(max(ones @ V @ ones, 0.0)))

    cumulative = []
    for m in range(betas.size):
        sel = np.zeros(betas.size)
        sel[: m + 1] = 1.0
        val = float(sel @ betas)
        se = float(np.sqrt(max(sel @ V @ sel, 0.0)))
        cumulative.append({"lag": m, "value": val, "lo": val - 1.96 * se, "hi": val + 1.96 * se})

    return {
        "betas": betas, "se": res.se[1:], "cov": V,
        "long_run": theta, "long_run_se": theta_se,
        "cumulative": cumulative,
        "peak_lag": int(np.argmax(betas)) if betas.size else 0,
        "r2": res.r2, "adj_r2": res.adj_r2, "n": res.n,
        "hac_lags": L, "result": res,
    }


def asymmetric_lag(
    dx: np.ndarray,
    dy: np.ndarray,
    *,
    max_lag: int = 8,
    hac_lags: int | None = None,
) -> dict:
    """Rockets-and-feathers test (Bacon 1991; Borenstein-Cameron-Gilbert 1997).

    Splits the regressor into positive and negative parts and lets each carry
    its own lag polynomial, then tests ``theta+ == theta-``.

    This is not a nuisance correction, it's a finding: crude round-tripped
    fully during the June 2026 ceasefire while retail gasoline stalled about
    $0.98 above its pre-war low. The gap between theta+ and theta- says how
    much of that stickiness is ordinary asymmetric pass-through versus
    something specific to this episode.
    """
    dx_pos, dx_neg = np.maximum(dx, 0.0), np.minimum(dx, 0.0)
    Xp, rows = build_lag_matrix(dx_pos, max_lag)
    Xn, _ = build_lag_matrix(dx_neg, max_lag)
    y = dy[rows]
    n_up = int((dx_pos > 0).sum())
    n_down = int((dx_neg < 0).sum())
    if n_up < 15 or n_down < 15:
        return {"estimable": False, "n_up": n_up, "n_down": n_down}

    X = np.column_stack([np.ones(y.size), Xp, Xn])
    L = hac_lags if hac_lags is not None else nw_bandwidth(y.size, floor=max_lag)
    res = ols(X, y, hac_lags=L)

    K = max_lag + 1
    R = np.zeros(X.shape[1])
    R[1 : 1 + K] = 1.0
    R[1 + K :] = -1.0
    stat, pval, df = wald_test(res, R)

    up = res.beta[1 : 1 + K]
    down = res.beta[1 + K :]
    se_up = float(np.sqrt(max(np.ones(K) @ res.cov[1 : 1 + K, 1 : 1 + K] @ np.ones(K), 0.0)))
    se_dn = float(np.sqrt(max(np.ones(K) @ res.cov[1 + K :, 1 + K :] @ np.ones(K), 0.0)))
    diff_se = float(np.sqrt(max(R @ res.cov @ R, 0.0)))

    return {
        "estimable": True, "n_up": n_up, "n_down": n_down,
        "theta_up": float(up.sum()), "theta_up_se": se_up,
        "theta_down": float(down.sum()), "theta_down_se": se_dn,
        "difference": float(up.sum() - down.sum()), "difference_se": diff_se,
        "wald": stat, "p_value": pval, "df": df,
        "half_life_up_lags": _half_life(up), "half_life_down_lags": _half_life(down),
        "betas_up": up, "betas_down": down,
    }


def _half_life(betas: np.ndarray) -> int | None:
    """Lags until the cumulative response first reaches half its total."""
    total = betas.sum()
    if abs(total) < _EPS:
        return None
    cum = np.cumsum(betas)
    hit = np.flatnonzero(np.abs(cum) >= abs(total) / 2.0)
    return int(hit[0]) if hit.size else None


# ---------------------------------------------------------------------------
# Cross-sectional inference
# ---------------------------------------------------------------------------


def wls_slope(
    x: np.ndarray, y: np.ndarray, w: np.ndarray | None = None
) -> tuple[float, float, float]:
    """Weighted least squares slope. Returns ``(slope, intercept, r2)``."""
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    w = np.ones_like(x) if w is None else np.asarray(w, float)
    sw = w.sum()
    if sw < _EPS or x.size < 2:
        return 0.0, 0.0, 0.0
    xb, yb = (w * x).sum() / sw, (w * y).sum() / sw
    sxx = (w * (x - xb) ** 2).sum()
    if sxx < _EPS:
        return 0.0, float(yb), 0.0
    slope = float((w * (x - xb) * (y - yb)).sum() / sxx)
    intercept = float(yb - slope * xb)
    pred = intercept + slope * x
    ss_res = (w * (y - pred) ** 2).sum()
    ss_tot = (w * (y - yb) ** 2).sum()
    return slope, intercept, float(1.0 - ss_res / ss_tot) if ss_tot > _EPS else 0.0


def permutation_slope_test(
    x: np.ndarray, y: np.ndarray, w: np.ndarray | None = None,
    *, n_perm: int = 10_000, seed: int = 0,
) -> dict:
    """Two-sided permutation test on a WLS slope.

    With n ~ 9 goods, asymptotic t-tables are a fiction. Permuting x across
    goods gives an exact-in-spirit null that needs no distributional
    assumption. Enumerates all n! permutations when n <= 8.
    """
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    n = x.size
    observed, intercept, r2 = wls_slope(x, y, w)
    if n < 3:
        return {"slope": observed, "intercept": intercept, "r2": r2,
                "p_value": 1.0, "n_perm": 0, "method": "insufficient_n"}

    if n <= 8:
        from itertools import permutations

        perms = list(permutations(range(n)))
        stats = np.array([abs(wls_slope(x[list(p)], y, w)[0]) for p in perms])
        method = f"exact_{len(perms)}_permutations"
    else:
        rng = np.random.default_rng(seed)
        stats = np.array(
            [abs(wls_slope(rng.permutation(x), y, w)[0]) for _ in range(n_perm)]
        )
        method = f"{n_perm}_random_permutations"

    p = float((1.0 + (stats >= abs(observed)).sum()) / (stats.size + 1.0))
    return {"slope": observed, "intercept": intercept, "r2": r2,
            "p_value": p, "n_perm": int(stats.size), "method": method}


def jackknife_slope(
    x: np.ndarray, y: np.ndarray, w: np.ndarray | None = None
) -> dict:
    """Leave-one-out slopes -- answers "does one good drive the whole result?"."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    w_arr = np.ones_like(x) if w is None else np.asarray(w, float)
    n = x.size
    if n < 3:
        return {"slopes": [], "min": 0.0, "max": 0.0, "sign_stable": False,
                "most_influential_index": None}
    base, *_ = wls_slope(x, y, w_arr)
    slopes = []
    for i in range(n):
        m = np.ones(n, dtype=bool)
        m[i] = False
        slopes.append(wls_slope(x[m], y[m], w_arr[m])[0])
    arr = np.array(slopes)
    return {
        "slopes": [float(s) for s in arr],
        "min": float(arr.min()), "max": float(arr.max()),
        "sign_stable": bool(np.all(np.sign(arr) == np.sign(base)) and abs(base) > _EPS),
        "most_influential_index": int(np.argmax(np.abs(arr - base))),
    }


def holm_adjust(pvalues: list[float]) -> list[float]:
    """Holm-Bonferroni step-down adjustment.

    The placebo battery runs ~10 controls x 2 tests. Reporting only raw
    p-values there hands a critic a free win ("you ran twenty tests and found
    two hits"). Raw and adjusted are both surfaced in the payload.
    """
    m = len(pvalues)
    if m == 0:
        return []
    order = np.argsort(pvalues)
    adjusted = np.empty(m)
    running = 0.0
    for rank, idx in enumerate(order):
        running = max(running, (m - rank) * pvalues[idx])
        adjusted[idx] = min(1.0, running)
    return [float(v) for v in adjusted]


# ---------------------------------------------------------------------------
# Event study
# ---------------------------------------------------------------------------


def event_study(
    dates: np.ndarray,
    returns: np.ndarray,
    events: list[dict],
    *,
    pre: int = 1,
    post: int = 5,
    est_window: int = 250,
) -> dict:
    """Abnormal returns around pre-classified events, with an exact sign test.

    **This is the strongest evidence in the project**, and it needs no
    counterfactual model at all. Each event carries a pre-registered sign
    (+1 escalation, -1 de-escalation) taken from `data/war_milestones.json`.
    Under the null that war news is unrelated to oil prices, each CAR matching
    its event's sign is a coin flip, so k matches out of n has exact binomial
    probability -- six for six gives p = 2^-6 = 0.0156.

    Inflation does not switch off on the day of a ceasefire and back on three
    weeks later. Neither do tariffs. That asymmetry between "a level story" and
    "a reversal story" is the whole identification.
    """
    dates = np.asarray(dates)
    returns = np.asarray(returns, dtype=np.float64)
    out: list[dict] = []

    for ev in events:
        when = np.datetime64(ev["date"], "D")
        idx = int(np.searchsorted(dates, when, side="left"))
        if idx >= dates.size or idx - pre < 0:
            continue
        est_lo = max(0, idx - pre - est_window)
        est = returns[est_lo : max(est_lo + 1, idx - pre)]
        if est.size < 20:
            continue
        mu, sd = float(est.mean()), float(est.std(ddof=1))
        window = returns[idx - pre : min(idx + post + 1, returns.size)]
        if window.size == 0:
            continue
        car = float((window - mu).sum())
        t = car / (sd * np.sqrt(window.size)) if sd > _EPS else 0.0
        sign = int(ev.get("sign", 1))
        out.append({
            "id": ev.get("id", ev["date"]),
            "date": ev["date"],
            "label": ev.get("headline", ""),
            "sign": sign,
            "car_pct": round(car * 100.0, 2),
            "t_stat": round(float(t), 2),
            "p_value": round(float(2.0 * _norm_sf(abs(t))[0]), 4),
            "matched": bool(np.sign(car) == np.sign(sign) and abs(car) > _EPS),
            "window_obs": int(window.size),
        })

    n = len(out)
    matched = sum(1 for e in out if e["matched"])
    esc = [e["car_pct"] for e in out if e["sign"] > 0]
    dee = [e["car_pct"] for e in out if e["sign"] < 0]

    # The sign test discards magnitude, and with a handful of events that is
    # most of the information: even a perfect 5-for-5 only reaches p = 0.031.
    # The signed-magnitude statistic S = sum(sign_e * CAR_e) uses the size of
    # each move as well as its direction, and with n <= 20 its exact null
    # distribution can be enumerated over all 2^n sign assignments -- no
    # asymptotics, no distributional assumption.
    signed = {"statistic": None, "p_value": None, "method": "insufficient_events"}
    if 0 < n <= 20:
        cars = np.array([e["car_pct"] for e in out], dtype=np.float64)
        signs = np.array([e["sign"] for e in out], dtype=np.float64)
        observed = float(signs @ cars)
        combos = 1 << n
        bits = ((np.arange(combos)[:, None] >> np.arange(n)[None, :]) & 1)
        alt = (bits * 2.0 - 1.0) @ cars
        p = float((1 + int((alt >= observed).sum())) / (combos + 1))
        signed = {
            "statistic": round(observed, 2),
            "max_possible": round(float(np.abs(cars).sum()), 2),
            "share_of_max": round(observed / float(np.abs(cars).sum()), 3)
            if np.abs(cars).sum() > _EPS else None,
            "p_value": round(p, 5),
            "method": f"exact_enumeration_{combos}_sign_assignments",
        }

    return {
        "events": out,
        "n_events": n,
        "n_matched": matched,
        "binomial_p": round(_binom_sf(matched, n, 0.5), 8) if n else 1.0,
        "signed_magnitude": signed,
        "mean_car_escalation": round(float(np.mean(esc)), 2) if esc else None,
        "mean_car_deescalation": round(float(np.mean(dee)), 2) if dee else None,
        "window": {"pre": pre, "post": post, "est_window": est_window},
    }


def _binom_sf(k: int, n: int, p: float) -> float:
    """P(X >= k) for X ~ Binomial(n, p). Exact; n is single digits here."""
    from math import comb

    if n == 0:
        return 1.0
    return float(sum(comb(n, i) * p**i * (1 - p) ** (n - i) for i in range(k, n + 1)))
