/**
 * V3 data layer — fetchers and React Query hooks for the attribution engine.
 *
 * Kept separate from `lib/api.ts` so the legacy dashboard and broadsheet views
 * keep working untouched while V3 evolves.
 *
 * Timeout is 45s, not the 10s used elsewhere: several attribution endpoints run
 * bootstrap batteries that take seconds cold, and the Fly VM scales to zero so
 * the first request after idle also pays a container cold start.
 */

import { useQuery } from '@tanstack/react-query';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api/attribution`;

const TIMEOUT_MS = 45_000;

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    if (!res.ok) {
      throw new ApiError(`Request failed (${res.status})`, res.status);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('The server took too long to respond.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

export interface MethodEnvelope {
  method: string;
  method_version: string;
  sample: Record<string, unknown>;
  assumptions: string[];
  caveats: string[];
  falsifiers: string[];
  confidence: 'high' | 'medium' | 'low';
  seed?: number;
  n_boot?: number;
}

export interface TermChange {
  start_date: string;
  start_value: number;
  end_date: string;
  end_value: number;
  years: number;
  total_pct: number;
  annualised_pct: number | null;
  absolute_change: number;
}

export interface StapleItem {
  key: string;
  name: string;
  fred_id: string;
  unit: string;
  note: string;
  previous_term: TermChange;
  current_term: TermChange;
  acceleration_ratio: number | null;
  faster_now: boolean;
}

export interface StaplesPayload {
  items: StapleItem[];
  summary: {
    n_items: number;
    n_rising_faster_now: number;
    n_rising_slower_or_falling: number;
    rising_faster: string[];
    falling_or_slower: string[];
  };
  terms: {
    previous: { label: string; holder: string; start: string; end: string | null };
    current: { label: string; holder: string; start: string; end: string | null };
  };
  envelope: MethodEnvelope;
}

export interface JobsPayload {
  monthly_changes: { date: string; value: number }[];
  previous_term: JobsWindow;
  current_term: JobsWindow;
  collapse_ratio: number | null;
  counterweights: {
    key: string;
    name: string;
    direction: string;
    change: TermChange;
    note: string;
  }[];
  envelope: MethodEnvelope;
}

export interface JobsWindow {
  start: string;
  end: string;
  n_months: number;
  mean_monthly: number;
  median_monthly: number;
  total: number;
  negative_months: number;
  worst_month: { date: string; value: number };
}

export interface BreadthPayload {
  measures: {
    key: string;
    name: string;
    fred_id: string;
    points: { date: string; value: number }[];
    latest: { date: string; value: number } | null;
  }[];
  verdict: {
    headline: number;
    median: number;
    gap_pp: number;
    reads_as: 'tail_shock' | 'broad_based';
    plain_english: string;
  } | null;
  envelope: MethodEnvelope;
}

export interface ScorecardPayload {
  rows: {
    key: string;
    name: string;
    fred_id: string;
    unit: string;
    higher_is_worse: boolean;
    note: string;
    previous_term: TermChange | null;
    current_term: TermChange;
    current_direction: 'better' | 'worse' | null;
  }[];
  summary: {
    n_better: number;
    n_worse: number;
    better: string[];
    worse: string[];
  };
  handover_date: string;
  envelope: MethodEnvelope;
}

export interface EventStudyPayload {
  events: {
    id: string;
    date: string;
    label: string;
    sign: number;
    car_pct: number;
    t_stat: number;
    p_value: number;
    matched: boolean;
  }[];
  n_events: number;
  n_matched: number;
  binomial_p: number;
  signed_magnitude: {
    statistic: number | null;
    max_possible?: number;
    share_of_max?: number | null;
    p_value: number | null;
    method: string;
  };
  mean_car_escalation: number | null;
  mean_car_deescalation: number | null;
  envelope: MethodEnvelope;
}

export interface ReceiptLine {
  key: string;
  label: string;
  category: string;
  monthly_usd: number;
  unit_change: number;
  unit: string;
  baseline_price?: number;
  current_price?: number;
  quantity: number;
  quantity_unit: string;
  as_of?: string;
  n_items?: number;
  arithmetic: string;
}

export interface ReceiptPayload {
  inputs: { miles_per_week: number; household_size: number };
  assumptions: Record<string, { value: number; unit: string; source: string }>;
  lines: ReceiptLine[];
  monthly_usd: number;
  cumulative_usd: number;
  months_elapsed: number;
  baseline_date: string;
  war_date: string;
  envelope: MethodEnvelope;
}

export interface MethodologyPayload {
  version: string;
  series: {
    key: string;
    fred_id: string;
    name: string;
    group: string;
    unit: string;
    seasonally_adjusted: boolean;
    note: string;
    url: string;
  }[];
  terms: { key: string; label: string; holder: string; start: string; end: string | null }[];
  known_data_gaps: {
    period: string;
    what: string;
    why: string;
    effect: string;
    source: string;
  }[];
  claims_we_decline_to_make: string[];
}

// ---------------------------------------------------------------------------
// Hooks. Long staleTime — the underlying series are monthly at best.
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;

export const useStaples = () =>
  useQuery({ queryKey: ['v3', 'staples'], queryFn: () => get<StaplesPayload>('/staples'), staleTime: 6 * HOUR });

export const useJobs = () =>
  useQuery({ queryKey: ['v3', 'jobs'], queryFn: () => get<JobsPayload>('/jobs'), staleTime: 6 * HOUR });

export const useBreadth = () =>
  useQuery({ queryKey: ['v3', 'breadth'], queryFn: () => get<BreadthPayload>('/breadth'), staleTime: 6 * HOUR });

export const useScorecard = () =>
  useQuery({ queryKey: ['v3', 'scorecard'], queryFn: () => get<ScorecardPayload>('/scorecard'), staleTime: 6 * HOUR });

export const useEventStudy = (series = 'wti') =>
  useQuery({
    queryKey: ['v3', 'event-study', series],
    queryFn: () => get<EventStudyPayload>(`/event-study?series=${series}`),
    staleTime: 6 * HOUR,
  });

export const useMethodology = () =>
  useQuery({ queryKey: ['v3', 'methodology'], queryFn: () => get<MethodologyPayload>('/methodology'), staleTime: 24 * HOUR });

export const useReceipt = (milesPerWeek: number, householdSize: number) =>
  useQuery({
    queryKey: ['v3', 'receipt', milesPerWeek, householdSize],
    queryFn: () =>
      get<ReceiptPayload>(
        `/receipt?miles_per_week=${milesPerWeek}&household_size=${householdSize}`,
      ),
    staleTime: HOUR,
  });

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const usd = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;

export const thousands = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString('en-US')}`;

export const monthLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
