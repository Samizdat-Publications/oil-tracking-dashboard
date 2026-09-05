/* eslint-disable @typescript-eslint/no-explicit-any -- the snapshot is untyped JSON straight from the endpoints. */
/**
 * V4 data layer.
 *
 * Ports `design-handoff/.../v4-data.js`, with one substantive change: nothing
 * here is a hardcoded figure. Everything reads from the snapshot, which holds
 * real endpoint responses, so a number cannot drift from its source by being
 * retyped.
 *
 * Swapping to the live API is one constant:
 *
 *     const SOURCE: Source = 'api';
 *
 * Both paths return identical types. The snapshot exists because Cloudflare
 * Pages serves a static bundle and the Fly backend scales to zero — a cold
 * start would leave the page empty for several seconds on the first visit,
 * which is the visit that matters.
 *
 * ── The three conflicts Design flagged ──────────────────────────────────────
 * `v4-data.js` recorded three brief-vs-THESIS disagreements and used the
 * brief's values. Resolving them found a bug in our own year-over-year
 * calculation, not a disagreement about sources: it indexed 12 *observations*
 * back rather than 12 *months*, and October 2025 CPI does not exist, so every
 * point after the gap reached back 13 months.
 *
 *     US headline, Jun 2026    brief 3.73  →  3.53   (THESIS was right)
 *     Euro area,   Jun 2026    brief 2.73  →  2.73   (agreed)
 *     Breadth headline         brief 3.70  →  3.53
 *
 * The snapshot now carries the corrected values, so `CONFLICTS` is resolved
 * history rather than an open question. See backend/services/timeseries.py::yoy.
 */

type Source = 'snapshot' | 'api';

const SOURCE: Source = 'snapshot';

const SNAPSHOT_URL = `${import.meta.env.BASE_URL ?? '/'}data-snapshot.json`;
const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api/attribution`;

/** Snapshot key → live endpoint path. */
const ENDPOINTS = {
  international: '/international',
  breadth: '/breadth',
  jobs: '/jobs',
  staples: '/staples',
  scorecard: '/scorecard',
  event_study: '/event-study',
  receipt: '/receipt',
  macro: '/macro',
  context: '/context',
  hormuz_transits: '/hormuz-transits',
} as const;

export type SnapshotKey = keyof typeof ENDPOINTS | 'administrations' | 'crude_daily' | 'war_milestones';

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

let snapshotPromise: Promise<Record<string, any>> | null = null;

/** Fetch and memoise the snapshot. One request regardless of how many hooks ask. */
function loadSnapshot(): Promise<Record<string, any>> {
  if (!snapshotPromise) {
    snapshotPromise = fetch(SNAPSHOT_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`snapshot ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        // Clear the memo so a retry can succeed — a cached rejected promise
        // would make one transient failure permanent for the session.
        snapshotPromise = null;
        throw err;
      });
  }
  return snapshotPromise;
}

async function fromApi(path: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read one section of data from whichever source is configured.
 *
 * `administrations` is keyed by metric in both paths — a nested object in the
 * snapshot, a query parameter on the API — so it takes the `metric` argument.
 */
export async function getData(key: SnapshotKey, metric?: string): Promise<any> {
  if (SOURCE === 'api' && key in ENDPOINTS) {
    return fromApi(ENDPOINTS[key as keyof typeof ENDPOINTS]);
  }
  if (SOURCE === 'api' && key === 'administrations') {
    return fromApi(`/administrations?metric=${encodeURIComponent(metric ?? 'cpi_headline')}`);
  }

  const snap = await loadSnapshot();
  if (key === 'administrations') {
    const all = snap.administrations ?? {};
    return all[metric ?? 'cpi_headline'] ?? null;
  }
  return snap[key] ?? null;
}

/**
 * Everything the ledger page needs, in one object keyed like the snapshot.
 *
 * In snapshot mode this is the snapshot itself. In API mode it fans out to the
 * live endpoints and reassembles the same shape, so the page code is identical
 * either way. `crude_daily` and `war_milestones` have no attribution endpoint;
 * in API mode they come from the committed snapshot as a fallback.
 */
export async function getAll(): Promise<Record<string, any>> {
  if (SOURCE !== 'api') return loadSnapshot();
  const keys = Object.keys(ENDPOINTS) as (keyof typeof ENDPOINTS)[];
  const live = await Promise.all(keys.map((k) => fromApi(ENDPOINTS[k]).catch(() => null)));
  const snap = await loadSnapshot().catch(() => ({}));
  const out: Record<string, any> = { ...snap };
  keys.forEach((k, i) => { if (live[i]) out[k] = live[i]; });
  return out;
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export const PROVENANCE = {
  brief: 'docs/design-briefs/2026-08-03-v4-economic-decline.md',
  thesis: 'docs/THESIS.md',
  snapshot: 'frontend/public/data-snapshot.json',
  asOf: 'July 2026 (CPI) · August 2026 (jobs) · daily to the latest close',
} as const;

/**
 * The three conflicts, kept as resolved history.
 *
 * Worth preserving rather than deleting: it is the record of a bug that reached
 * a design handoff before anyone caught it, and the "check our work" section
 * cites it as evidence the process catches its own errors.
 */
export const CONFLICTS = [
  {
    field: 'US headline CPI y/y, June 2026',
    brief: 3.73,
    thesis: 3.53,
    resolved: 3.53,
    resolution:
      'THESIS was right. Our year-over-year used positional indexing, and the ' +
      'missing October 2025 CPI made it span 13 months. Fixed in timeseries.yoy().',
  },
  {
    field: 'Euro-area headline y/y, June 2026',
    brief: 2.73,
    thesis: 2.8,
    resolved: 2.73,
    resolution: 'Computed from Eurostat HICP via FRED: 2.73%. Brief rounded correctly.',
  },
  {
    field: 'Headline CPI (breadth section)',
    brief: 3.7,
    thesis: 3.5,
    resolved: 3.53,
    resolution: 'Same root cause as the first. Headline now reads CPIAUCNS, which is ' +
      'the unadjusted index BLS headlines and the press quotes.',
  },
] as const;

// ---------------------------------------------------------------------------
// Value tiering — drives caption text, stroke style and decimal precision
// ---------------------------------------------------------------------------

export type Confidence = 'verified' | 'approx' | 'derived' | 'interpolated' | 'illustrative';

export interface Figure {
  value: number | null;
  confidence: Confidence;
  /** Rendered beneath the value. Required for anything not `verified`. */
  caption?: string;
  asOf?: string;
  source?: string;
}

/**
 * Format a figure for display, honouring its confidence.
 *
 * A null renders as an em-dash, never a zero. The absence of a published figure
 * is part of the argument — see the queue count, which we decline to publish
 * because no verified number exists at any tier.
 */
export function formatFigure(f: Figure, unit = '', digits?: number): string {
  if (f.value === null || !Number.isFinite(f.value)) return '—';
  // Approximate and derived values carry fewer decimals: printing $96.91 for a
  // number obtained by multiplying by 0.85 implies precision that isn't there.
  const d = digits ?? (f.confidence === 'verified' ? 2 : 1);
  return `${f.value.toFixed(d)}${unit}`;
}

export const CONFIDENCE_CAPTION: Record<Confidence, string | null> = {
  verified: null,
  approx: 'approx.',
  derived: 'derived',
  interpolated: 'interpolated between published values',
  illustrative: 'illustrative — not data',
};

// ---------------------------------------------------------------------------
// Formatting helpers shared across sections
// ---------------------------------------------------------------------------

export const usd = (v: number, digits = 0) =>
  v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;

export const signed = (v: number, digits = 0) =>
  `${v >= 0 ? '+' : ''}${v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;

export const monthLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/** Party colours. Red = Republican, blue = Democratic, per US convention. */
export const PARTY = {
  D: { key: 'D', label: 'Democratic', color: '#2E5EAA' },
  R: { key: 'R', label: 'Republican', color: '#B02F2F' },
} as const;
