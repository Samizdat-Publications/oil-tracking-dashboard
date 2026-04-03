/**
 * Crisis color mapping and display constants.
 * Data comes from the API — this file only has presentation metadata.
 */

export type CrisisMetric = 'peak_spike' | 'duration' | 'gas_impact';

export const METRIC_LABELS: Record<CrisisMetric, string> = {
  peak_spike: 'Peak Oil Spike',
  duration: 'Crisis Duration',
  gas_impact: 'Gas Price Impact',
};

export const METRIC_UNITS: Record<CrisisMetric, string> = {
  peak_spike: '%',
  duration: ' mo',
  gas_impact: '%',
};

/** Color for each crisis bar */
export const CRISIS_COLORS: Record<string, string> = {
  '1973_embargo': '#FF3366',
  '1979_revolution': '#FF3366',
  '1990_gulf_war': '#FF8800',
  '2008_superspike': '#FF8800',
  '2014_opec_war': '#00FF88', // collapse = green (prices went down)
  '2022_russia_ukraine': '#FF8800',
  '2026_iran': '#00F0FF', // current = accent cyan
};

/** Get the value for the selected metric */
export function getMetricValue(
  crisis: { peak_spike_pct: number | null; duration_months: number | null; gas_impact_pct: number | null },
  metric: CrisisMetric
): number | null {
  switch (metric) {
    case 'peak_spike':
      return crisis.peak_spike_pct;
    case 'duration':
      return crisis.duration_months;
    case 'gas_impact':
      return crisis.gas_impact_pct;
  }
}

/** Get the max absolute value across all crises for a metric (for scaling bars) */
export function getMaxAbsValue(
  crises: Array<{ peak_spike_pct: number | null; duration_months: number | null; gas_impact_pct: number | null }>,
  metric: CrisisMetric
): number {
  let maxAbs = 0;
  for (const c of crises) {
    const v = getMetricValue(c, metric);
    if (v !== null && Math.abs(v) > maxAbs) {
      maxAbs = Math.abs(v);
    }
  }
  return maxAbs || 1; // avoid division by zero
}
