import type { GeoEvent } from '../types';

export const DEFAULT_EVENTS: GeoEvent[] = [
  { id: 'arab-oil-embargo', date: '1973-10-17', endDate: '1974-03-18', label: 'Arab Oil Embargo', description: 'OAPEC proclaims oil embargo against nations supporting Israel in Yom Kippur War', category: 'embargo', visible: true },
  { id: 'iranian-revolution', date: '1979-01-16', label: 'Iranian Revolution', description: 'Shah flees Iran; oil production collapses from 6M to 1.5M bpd', category: 'revolution', visible: true },
  { id: 'iran-iraq-war', date: '1980-09-22', endDate: '1988-08-20', label: 'Iran-Iraq War', description: 'War removes ~4M bpd from global supply at peak disruption', category: 'war', visible: true },
  { id: 'gulf-war', date: '1990-08-02', endDate: '1991-02-28', label: 'Gulf War', description: 'Iraq invades Kuwait; prices spike from $17 to $41', category: 'war', visible: true },
  { id: 'asian-financial-crisis', date: '1997-07-02', label: 'Asian Financial Crisis', description: 'Demand collapse drives oil below $10/bbl', category: 'market', visible: true },
  { id: 'sep-11-attacks', date: '2001-09-11', label: '9/11 Attacks', description: 'Terror attacks create immediate demand shock and geopolitical uncertainty', category: 'war', visible: true },
  { id: 'iraq-war-2003', date: '2003-03-20', label: 'Iraq War', description: 'US invasion of Iraq removes significant production capacity', category: 'war', visible: true },
  { id: 'global-financial-crisis', date: '2008-09-15', label: 'Financial Crisis', description: 'Oil crashes from $147 to $32 in 6 months', category: 'market', visible: true },
  { id: 'arab-spring', date: '2011-01-14', label: 'Arab Spring', description: 'Libyan civil war removes 1.6M bpd; regional instability', category: 'revolution', visible: true },
  { id: 'opec-price-war-2014', date: '2014-11-27', label: 'OPEC Price War', description: 'Saudi Arabia refuses to cut production to fight US shale', category: 'opec', visible: true },
  { id: 'iran-sanctions-lifted', date: '2016-01-16', label: 'Iran Sanctions Lifted', description: 'JCPOA implementation adds ~1M bpd to oversupplied market', category: 'embargo', visible: true },
  { id: 'opec-plus-cuts-2017', date: '2017-01-01', label: 'OPEC+ Cuts Begin', description: 'Historic OPEC/non-OPEC agreement to cut 1.8M bpd', category: 'opec', visible: true },
  { id: 'oil-price-war-2020', date: '2020-03-08', label: 'Saudi-Russia Price War', description: 'Saudi Arabia floods market after OPEC+ talks collapse; WTI goes negative', category: 'opec', visible: true },
  { id: 'covid-pandemic', date: '2020-03-11', label: 'COVID-19 Pandemic', description: 'WHO declares pandemic; oil demand drops 20M bpd', category: 'pandemic', visible: true },
  { id: 'negative-oil-2020', date: '2020-04-20', label: 'WTI Goes Negative', description: 'WTI futures hit -$37/bbl; storage capacity exhausted globally', category: 'market', visible: true },
  { id: 'covid-recovery-2021', date: '2021-03-01', label: 'COVID Recovery Begins', description: 'Demand rebounds as vaccines roll out; supply still constrained from 2020 cuts', category: 'market', visible: true },
  { id: 'russia-ukraine-war', date: '2022-02-24', label: 'Russia-Ukraine War', description: 'Russian invasion leads to sanctions and supply disruption fears', category: 'war', visible: true },
  { id: 'tariff-shock-2025', date: '2025-04-02', label: 'Tariff Shock', description: 'Sweeping tariffs announced; demand uncertainty spikes, trade disruption fears', category: 'market', visible: true },
  { id: 'iran-conflict-2026', date: '2026-01-15', label: '2026 Iran Conflict', description: 'Escalation of Iran tensions threatens Strait of Hormuz shipping lanes', category: 'war', visible: true },
  { id: 'iran-war-begins-2026', date: '2026-02-28', label: 'Iran War Begins', description: 'US military strikes on Iran; Strait of Hormuz closed to tanker traffic', category: 'war', visible: true },
];

export const BAND_COLORS = {
  p1_p99: 'rgba(0, 240, 255, 0.05)',
  p5_p95: 'rgba(0, 240, 255, 0.10)',
  p25_p75: 'rgba(0, 240, 255, 0.22)',
  p50: '#00F0FF',
  historical: '#33F5FF',
};

export const EVENT_CATEGORY_COLORS: Record<string, string> = {
  war: '#FF3366',
  embargo: '#FF8800',
  revolution: '#FBBF24',
  pandemic: '#A78BFA',
  market: '#00F0FF',
  opec: '#00FF88',
  custom: '#2ECDC1',
};

export const SERIES_LABELS: Record<string, string> = {
  wti: 'WTI Crude Oil',
  brent: 'Brent Crude Oil',
  diesel: 'Diesel (No. 2)',
};

export const SCENARIO_THRESHOLDS = { bull: 100, bear: 80 };

export const SCENARIO_LABELS = {
  bull: { label: 'Bull Scenario', description: 'War expands / Hormuz stays closed', color: '#00FF88' },
  base: { label: 'Base Scenario', description: 'Status quo / gradual normalization', color: '#00F0FF' },
  bear: { label: 'Bear Scenario', description: 'Ceasefire / OPEC+ oversupply', color: '#FF3366' },
};

export const PLOTLY_DARK_LAYOUT = {
  paper_bgcolor: '#060A14',
  plot_bgcolor: '#0A0E18',
  font: { color: '#E8ECF4', family: 'Outfit, sans-serif', size: 12 },
  xaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', zerolinecolor: 'rgba(0,240,255,0.04)' },
  yaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', zerolinecolor: 'rgba(0,240,255,0.04)' },
  margin: { l: 60, r: 20, t: 40, b: 40 },
  hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(0,240,255,0.15)', font: { color: '#E8ECF4', family: 'Outfit, sans-serif' } },
};

export const PLOTLY_CONFIG = {
  displayModeBar: true,
  displaylogo: false,
  responsive: true,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
};

export const PRESIDENTIAL_ERAS = [
  { start: '2009-01-20', end: '2017-01-20', label: 'Obama', party: 'dem', color: 'rgba(59,130,246,0.06)' },
  { start: '2017-01-20', end: '2021-01-20', label: 'Trump (1st)', party: 'rep', color: 'rgba(239,68,68,0.06)' },
  { start: '2021-01-20', end: '2025-01-20', label: 'Biden', party: 'dem', color: 'rgba(59,130,246,0.06)' },
  { start: '2025-01-20', end: '2029-01-20', label: 'Trump (2nd)', party: 'rep', color: 'rgba(239,68,68,0.06)' },
];
