import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import type { PriceSeries } from '../../types';

interface VolatilityChartProps {
  wtiData: PriceSeries | undefined;
  isLoading: boolean;
}

function computeRealizedVol(values: number[], window: number): number | null {
  if (values.length < window + 1) return null;
  const slice = values.slice(-window - 1);
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0) returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function VolatilityChart({ wtiData, isLoading }: VolatilityChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { traces, layout } = useMemo(() => {
    if (!wtiData?.observations?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { traces: [] as any[], layout: {} };
    }

    const values = wtiData.observations.map((p) => p.value);
    const windows = [5, 20, 60, 252];
    const volValues = windows.map((w) => {
      const v = computeRealizedVol(values, w);
      return v !== null ? v * 100 : 0;
    });
    const maxVol = Math.max(...volValues);
    const colors = volValues.map((v) => {
      const ratio = maxVol > 0 ? v / maxVol : 0;
      if (ratio > 0.66) return '#CC2936';
      if (ratio > 0.33) return '#00F0FF';
      return '#5DB075';
    });
    const labels = ['5d (1W)', '20d (1M)', '60d (3M)', '252d (1Y)'];

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      traces: [{
        x: labels, y: volValues, type: 'bar' as const,
        marker: { color: colors, line: { color: 'rgba(0,240,255,0.1)', width: 1 } },
        text: volValues.map((v) => `${v.toFixed(1)}%`),
        textposition: 'outside' as const,
        textfont: { color: '#E8ECF4', size: 11, family: 'IBM Plex Mono, monospace' },
        hovertemplate: '%{x}<br>Volatility: %{y:.2f}%<extra></extra>',
      }] as any[],
      layout: {
        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        font: { color: '#E8ECF4', family: 'Plus Jakarta Sans, sans-serif', size: 12 },
        xaxis: { gridcolor: 'rgba(212,160,18,0.04)', linecolor: 'rgba(212,160,18,0.04)' },
        yaxis: { gridcolor: 'rgba(212,160,18,0.04)', linecolor: 'rgba(212,160,18,0.04)', title: { text: 'Annualized Vol (%)', font: { size: 11, color: '#4A5568' } }, ticksuffix: '%' },
        margin: { l: 60, r: 20, t: 10, b: 50 },
        hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(212,160,18,0.15)', font: { color: '#E8ECF4' } },
        showlegend: false, bargap: 0.3,
      },
    };
  }, [wtiData]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-[280px]"><div className="text-text-secondary animate-pulse font-[family-name:var(--font-mono)] text-sm">Loading...</div></div>;
  }

  return (
    <div>
      <h3 className="font-[family-name:var(--font-display)] text-base tracking-[0.08em] uppercase text-text-primary mb-2">Realized Volatility</h3>
      <Plot data={traces} layout={layout} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', height: '280px' }} useResizeHandler />
    </div>
  );
}
