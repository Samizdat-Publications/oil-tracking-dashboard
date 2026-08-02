"""Synthetic-truth tests for the estimators.

Every estimator is checked two ways:

  * **Recovery** -- plant a known effect, confirm it is found.
  * **Size**    -- plant NOTHING, confirm it stays quiet.

Size tests matter more than recovery tests here. An estimator that finds a
break in white noise, or an asymmetry in a symmetric series, would manufacture
exactly the conclusion this project wants to reach -- which is the one kind of
bug that would never look wrong on the finished page.

Run: `py -m pytest tests/ -q` from `backend/`.
"""

from __future__ import annotations

import numpy as np
import pytest

from services import econometrics as ec


def _dates(n: int, step_days: int = 7, start: str = "2015-01-05") -> np.ndarray:
    return np.datetime64(start, "D") + np.arange(n) * np.timedelta64(step_days, "D")


# ---------------------------------------------------------------------------
# OLS / HAC
# ---------------------------------------------------------------------------


def test_ols_recovers_known_coefficients():
    rng = np.random.default_rng(0)
    n = 500
    x1, x2 = rng.normal(size=n), rng.normal(size=n)
    y = 1.5 + 2.0 * x1 - 0.75 * x2 + rng.normal(scale=0.3, size=n)
    res = ec.ols(np.column_stack([np.ones(n), x1, x2]), y)
    assert res.beta == pytest.approx([1.5, 2.0, -0.75], abs=0.06)
    assert res.r2 > 0.95


def test_hac_se_exceeds_ols_se_under_autocorrelation():
    """With MA(1) errors, classical SEs are too small. HAC must widen them."""
    rng = np.random.default_rng(1)
    n = 600
    x = np.cumsum(rng.normal(size=n))  # persistent regressor
    e = rng.normal(size=n + 1)
    y = 1.0 + 0.5 * x + (e[1:] + 0.8 * e[:-1])
    X = np.column_stack([np.ones(n), x])
    assert ec.ols(X, y, hac_lags=8).se[1] > ec.ols(X, y).se[1]


# ---------------------------------------------------------------------------
# Structural break
# ---------------------------------------------------------------------------


def test_sup_f_recovers_planted_break():
    rng = np.random.default_rng(2)
    T, k_true = 600, 300
    r = np.concatenate([rng.normal(0.0, 1.0, k_true),
                        rng.normal(1.2, 1.0, T - k_true)])
    stat, k_hat, _ = ec.sup_f_mean(r)
    assert abs(k_hat - k_true) <= 15
    assert ec.wild_bootstrap_pvalue(r, stat, n_boot=400, seed=3) < 0.05


def test_sup_f_size_under_null():
    """iid noise must not produce spurious breaks more than ~8% of the time."""
    rejections = 0
    reps = 120
    for i in range(reps):
        r = np.random.default_rng(100 + i).normal(size=200)
        stat, _, _ = ec.sup_f_mean(r)
        if ec.wild_bootstrap_pvalue(r, stat, n_boot=200, seed=i) < 0.05:
            rejections += 1
    assert rejections / reps < 0.10, f"size {rejections/reps:.3f} is inflated"


def test_wild_bootstrap_survives_heteroskedasticity():
    """Volatility clustering with NO mean break must not trigger a rejection.

    This is why the bootstrap exists: an asymptotic F table assumes
    homoskedasticity that oil returns plainly violate.
    """
    rejections = 0
    reps = 60
    for i in range(reps):
        rng = np.random.default_rng(500 + i)
        vol = np.concatenate([np.full(150, 0.5), np.full(150, 2.0)])
        r = rng.normal(0.0, 1.0, 300) * vol  # variance shifts, mean does not
        stat, _, _ = ec.sup_f_mean(r)
        if ec.wild_bootstrap_pvalue(r, stat, n_boot=200, seed=i) < 0.05:
            rejections += 1
    assert rejections / reps < 0.20


def test_break_ci_covers_truth():
    rng = np.random.default_rng(4)
    T, k_true = 400, 200
    r = np.concatenate([rng.normal(0, 1, k_true), rng.normal(1.5, 1, T - k_true)])
    _, k_hat, _ = ec.sup_f_mean(r)
    lo, hi = ec.break_date_ci(r, k_hat, n_boot=150, seed=5)
    assert lo <= k_true <= hi


# ---------------------------------------------------------------------------
# Counterfactual
# ---------------------------------------------------------------------------


def test_counterfactual_recovers_a_level_shock():
    rng = np.random.default_rng(6)
    n_pre, H = 200, 20
    y = np.cumsum(rng.normal(0.001, 0.02, n_pre)) + np.log(70.0)
    d = _dates(n_pre + H)
    truth = y[-1] + np.cumsum(rng.normal(0.001, 0.02, H)) + np.log(1.30)  # +30%
    paths, fit = ec.bootstrap_forecast(y, d[:n_pre], d[n_pre:], n_boot=200, seed=7,
                                       fourier_k=0)
    excess = np.exp(truth[-1]) / np.median(np.exp(paths[:, -1])) - 1.0
    assert 0.15 < excess < 0.50
    assert fit.n_obs > 100


def test_prediction_interval_is_calibrated():
    """**The gate on the whole fan chart.**

    Generate series with NO shock, forecast, and check the true continuation
    lands inside the 95% band about 95% of the time. An interval that
    under-covers would let us claim a "war effect" that is really just an
    over-confident model -- worse than having no counterfactual at all.

    Coverage is sensitive to the number of bootstrap draws, because a 2.5th
    percentile estimated from a few hundred values is biased inward. Measured:
    0.88 at B=150, 0.93 at B=400, 0.95 at B=1500. `bootstrap_forecast` now
    floors B at 1000 for exactly this reason.
    """
    inside = 0
    reps = 40
    for i in range(reps):
        rng = np.random.default_rng(900 + i)
        n_pre, H = 160, 12
        steps = rng.normal(0.0008, 0.02, n_pre + H)
        y_full = np.cumsum(steps) + np.log(65.0)
        d = _dates(n_pre + H)
        paths, _ = ec.bootstrap_forecast(y_full[:n_pre], d[:n_pre], d[n_pre:],
                                         n_boot=1200, seed=i, fourier_k=0)
        lo, hi = np.percentile(paths[:, -1], [2.5, 97.5])
        if lo <= y_full[-1] <= hi:
            inside += 1
    coverage = inside / reps
    assert 0.88 <= coverage <= 1.0, f"95% PI covered {coverage:.2f} -- miscalibrated"


def test_seasonality_is_removed_not_attributed_to_the_shock():
    """**Protects against the gasoline-seasonality attack.**

    GASREGW is not seasonally adjusted and rises every Jan->May. Build a series
    with a pure annual seasonal and zero trend, then "forecast" into spring.
    The model must attribute the spring rise to seasonality, leaving ~0% excess.
    Without the Fourier terms this test fails by construction.
    """
    n = 320  # ~6 years of weekly data
    d = _dates(n)
    doy = (d - d.astype("datetime64[Y]").astype("datetime64[D]")).astype(float)
    seasonal = 0.08 * np.sin(2 * np.pi * doy / 365.25)
    rng = np.random.default_rng(11)
    y = np.log(3.0) + seasonal + rng.normal(0, 0.004, n)

    n_pre = n - 16
    paths, fit = ec.bootstrap_forecast(y[:n_pre], d[:n_pre], d[n_pre:],
                                       n_boot=200, seed=12, fourier_k=2)
    excess = np.exp(y[-1]) / np.median(np.exp(paths[:, -1])) - 1.0
    assert abs(excess) < 0.05, f"seasonal leaked into excess: {excess:.3f}"
    assert fit.seasonal_amplitude_pct > 1.0, "seasonal amplitude not detected"


# ---------------------------------------------------------------------------
# Distributed lag
# ---------------------------------------------------------------------------


def test_distributed_lag_recovers_known_response():
    rng = np.random.default_rng(13)
    n = 900
    dx = rng.normal(size=n)
    dy = np.empty(n)
    for t in range(n):
        dy[t] = (0.5 * dx[t] + 0.3 * (dx[t - 1] if t >= 1 else 0.0)
                 + 0.1 * (dx[t - 2] if t >= 2 else 0.0) + rng.normal(scale=0.1))
    out = ec.distributed_lag(dx, dy, max_lag=4)
    assert out["betas"][:3] == pytest.approx([0.5, 0.3, 0.1], abs=0.05)
    assert out["long_run"] == pytest.approx(0.9, abs=0.08)
    assert out["peak_lag"] == 0


def test_asymmetry_detects_rockets_and_feathers():
    rng = np.random.default_rng(14)
    n = 1200
    dx = rng.normal(size=n)
    dy = np.where(dx > 0, 0.8 * dx, 0.2 * dx) + rng.normal(scale=0.1, size=n)
    out = ec.asymmetric_lag(dx, dy, max_lag=2)
    assert out["estimable"]
    assert out["theta_up"] > out["theta_down"]
    assert out["p_value"] < 0.05


def test_asymmetry_size_on_symmetric_data():
    """Symmetric pass-through must not read as rockets-and-feathers."""
    rejections = 0
    reps = 40
    for i in range(reps):
        rng = np.random.default_rng(700 + i)
        n = 600
        dx = rng.normal(size=n)
        dy = 0.5 * dx + rng.normal(scale=0.2, size=n)  # symmetric by construction
        out = ec.asymmetric_lag(dx, dy, max_lag=2)
        if out.get("estimable") and out["p_value"] < 0.05:
            rejections += 1
    assert rejections / reps < 0.20, "asymmetry test is an artifact factory"


# ---------------------------------------------------------------------------
# Cross-section
# ---------------------------------------------------------------------------


def test_permutation_slope_recovers_and_sizes():
    rng = np.random.default_rng(15)
    x = np.linspace(0.05, 0.7, 12)
    y = 40.0 * x + rng.normal(scale=1.5, size=12)
    hit = ec.permutation_slope_test(x, y, n_perm=3000, seed=16)
    assert hit["slope"] == pytest.approx(40.0, rel=0.25)
    assert hit["p_value"] < 0.05

    null = ec.permutation_slope_test(x, rng.normal(size=12), n_perm=3000, seed=17)
    assert null["p_value"] > 0.05


def test_holm_adjustment_is_monotone_and_bounded():
    raw = [0.001, 0.02, 0.03, 0.5]
    adj = ec.holm_adjust(raw)
    assert all(a >= r for a, r in zip(adj, raw))
    assert all(0.0 <= a <= 1.0 for a in adj)
    assert adj[0] == pytest.approx(0.004)


def test_jackknife_flags_a_single_influential_point():
    x = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.9])
    y = np.array([1.0, 1.1, 0.9, 1.0, 1.1, 20.0])  # last point drives everything
    jk = ec.jackknife_slope(x, y)
    assert jk["most_influential_index"] == 5


# ---------------------------------------------------------------------------
# Event study
# ---------------------------------------------------------------------------


def test_event_study_sign_test():
    """Six events, each moving the right way, gives exact binomial p = 2^-6."""
    n = 400
    d = _dates(n, step_days=1, start="2025-06-01")
    rng = np.random.default_rng(18)
    r = rng.normal(0, 0.005, n)

    events = []
    for i, (offset, sign) in enumerate([(300, 1), (320, -1), (340, -1),
                                        (355, 1), (370, 1), (385, 1)]):
        r[offset : offset + 3] += sign * 0.05
        events.append({"id": f"e{i}", "date": str(d[offset]), "sign": sign})

    out = ec.event_study(d, r, events, pre=1, post=5, est_window=250)
    assert out["n_events"] == 6
    assert out["n_matched"] == 6
    assert out["binomial_p"] == pytest.approx(1 / 64, abs=1e-6)


def test_event_study_null_does_not_match_everything():
    n = 400
    d = _dates(n, step_days=1, start="2025-06-01")
    r = np.random.default_rng(19).normal(0, 0.005, n)  # no planted events
    events = [{"id": f"e{i}", "date": str(d[300 + 10 * i]), "sign": 1} for i in range(6)]
    assert ec.event_study(d, r, events)["n_matched"] < 6
