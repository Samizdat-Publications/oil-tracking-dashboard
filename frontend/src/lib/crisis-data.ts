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

/** Color for each crisis bar — each crisis gets a unique color */
export const CRISIS_COLORS: Record<string, string> = {
  '1973_embargo': '#CC2936',     // hot pink
  '1979_revolution': '#FF6B35',  // burnt orange
  '1990_gulf_war': '#FFAA00',    // amber/gold
  '2008_superspike': '#FF44FF',  // magenta
  '2014_opec_war': '#5DB075',    // green (prices fell)
  '2022_russia_ukraine': '#FF8800', // orange
  '2026_iran': '#00F0FF',        // cyan (current war)
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
