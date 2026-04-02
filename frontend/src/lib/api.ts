import type { PriceSeries, PriceSummary, SimulationBands, SimulationRequest, DownstreamData, MilestonesResponse, PolymarketMarket, PolymarketSummary } from '../types';

const BASE = '/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch a single price series by name (wti, brent, diesel, etc.) */
export function fetchPrices(series: string, start?: string, end?: string): Promise<PriceSeries> {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const qs = params.toString();
  return fetchJson<PriceSeries>(`${BASE}/prices/${series}${qs ? '?' + qs : ''}`);
}

/** Fetch current price summary for WTI, Brent, Diesel */
export function fetchSummary(): Promise<PriceSummary> {
  return fetchJson<PriceSummary>(`${BASE}/prices/summary`);
}

/** Run Monte Carlo simulation */
export function fetchSimulation(params: SimulationRequest): Promise<SimulationBands> {
  return fetchJson<SimulationBands>(`${BASE}/simulation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

/** Fetch downstream correlation data */
export function fetchCorrelations(window?: number): Promise<DownstreamData> {
  const params = window ? `?window=${window}` : '';
  return fetchJson<DownstreamData>(`${BASE}/correlations${params}`);
}

/** Fetch WTI + all downstream series for correlation analysis */
export function fetchDownstream(): Promise<DownstreamData> {
  return fetchJson<DownstreamData>(`${BASE}/prices/downstream`);
}

/** Fetch war impact milestones (editorial + data-detected) */
export function fetchMilestones(): Promise<MilestonesResponse> {
  return fetchJson<MilestonesResponse>(`${BASE}/milestones`);
}

/** Fetch Polymarket oil prediction markets */
export function fetchPolymarketMarkets(): Promise<{ markets: PolymarketMarket[]; updated_at: string }> {
  return fetchJson(`${BASE}/polymarket/markets`);
}

/** Fetch Polymarket aggregated summary */
export function fetchPolymarketSummary(): Promise<PolymarketSummary> {
  return fetchJson<PolymarketSummary>(`${BASE}/polymarket/summary`);
}

/** Check if API keys are configured */
export async function checkSetup(): Promise<{ configured: boolean }> {
  const res = await fetchJson<{ fred_api_key_set: boolean }>(`${BASE}/setup/status`);
  return { configured: res.fred_api_key_set };
}

/** Save API keys to backend .env */
export function configureKeys(fredKey: string, eiaKey?: string): Promise<{ success: boolean; message: string }> {
  return fetchJson<{ success: boolean; message: string }>(`${BASE}/setup/configure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fred_api_key: fredKey, eia_api_key: eiaKey }),
  });
}
