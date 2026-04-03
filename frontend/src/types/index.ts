export interface PricePoint {
  date: string;
  value: number;
}

export interface PriceSeries {
  series_id: string;
  name: string;
  observations: PricePoint[];
}

export interface SimulationBands {
  dates: string[];
  bands: {
    p1: number[];
    p5: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p95: number[];
    p99: number[];
  };
  params: {
    mu: number;
    sigma: number;
    lambda_jump: number | null;
    mu_jump: number | null;
    sigma_jump: number | null;
    model: string;
    n_paths: number;
    horizon_days: number;
    current_price: number;
  };
}

export interface SimulationRequest {
  series: 'wti' | 'brent';
  lookback_years: number;
  n_paths: number;
  horizon_days: number;
  model: 'gbm' | 'jump_diffusion';
  seed?: number;
  mu_override?: number;
  sigma_override?: number;
}

export interface GeoEvent {
  id: string;
  date: string;
  endDate?: string;
  label: string;
  description: string;
  category: 'war' | 'embargo' | 'revolution' | 'pandemic' | 'market' | 'opec' | 'custom';
  visible: boolean;
}

export interface PriceSummaryItem {
  series: string;
  name: string;
  current_price: number | null;
  previous_price: number | null;
  daily_change: number | null;
  pct_change: number | null;
  date: string | null;
}

export interface PriceSummary {
  data: PriceSummaryItem[];
}

export interface CorrelationPoint {
  date: string;
  correlation: number | null;
}

export interface CorrelationSeries {
  downstream_series: string;
  downstream_name: string;
  data: CorrelationPoint[];
}

export interface CorrelationsResponse {
  oil_series: string;
  window: number;
  correlations: CorrelationSeries[];
}

export interface DownstreamData {
  oil: PriceSeries;
  series: PriceSeries[];
}

export interface VolatilityData {
  [window: string]: number;
}

export interface ScenarioProbabilities {
  medianPrice: number;
  bullPct: number;
  basePct: number;
  bearPct: number;
  currentPrice: number;
  horizonLabel: string;
}

export interface MilestoneBadge {
  label: string;
  change: string;
}

export interface Milestone {
  type: 'editorial' | 'data' | 'today';
  date: string;
  week: number;
  headline: string;
  description: string;
  badges: MilestoneBadge[];
}

export interface MilestonesResponse {
  milestones: Milestone[];
}

// Polymarket war-economy prediction types
export interface PolymarketMarketItem {
  id: string;
  question: string;
  yes_probability: number;
  volume: number;
  end_date: string | null;
  source_url: string | null;
}

export interface FedCutPoint {
  cuts: number;
  probability: number;
}

export interface PolymarketCategory {
  key: string;
  name: string;
  icon: string;
  description: string;
  markets: PolymarketMarketItem[];
  highlight: PolymarketMarketItem | null;
  fed_distribution: FedCutPoint[] | null;
  market_count: number;
  total_volume: number;
}

export interface PolymarketWarEconomy {
  categories: PolymarketCategory[];
  total_volume: number;
  market_count: number;
  updated_at: string;
}

// Crisis comparison types
export interface CrisisTrajectoryPoint {
  day: number;
  pct_change: number;
}

export interface CrisisData {
  id: string;
  name: string;
  year: number;
  start_date: string;
  end_date: string | null;
  peak_spike_pct: number | null;
  duration_months: number | null;
  gas_impact_pct: number | null;
  context: string;
  trajectory: CrisisTrajectoryPoint[];
  is_current: boolean;
}

export interface CrisisComparisonResponse {
  crises: CrisisData[];
  updated_at: string;
}
