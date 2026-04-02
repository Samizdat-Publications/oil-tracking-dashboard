import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import type { SimulationBands } from '../../types';

interface DistributionChartProps {
  simulationResult: SimulationBands | null;
}

export function DistributionChart({ simulationResult }: DistributionChartProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { traces, layout } = useMemo(() => {
    if (!simulationResult) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { traces: [] as any[], layout: {} };
    }

    const b = simulationResult.bands;
    const endIdx = b.p50.length - 1;
    const p5Val = b.p5[endIdx];
    const p50Val = b.p50[endIdx];
    const p1Val = b.p1[endIdx];
    const p99Val = b.p99[endIdx];

    const nSamples = 500;
    const synthetic: number[] = [];
    for (let i = 0; i < nSamples; i++) {
      const u = i / nSamples;
      let val: number;
      if (u < 0.01) val = p1Val;
      else if (u < 0.05) val = p1Val + (p5Val - p1Val) * ((u - 0.01) / 0.04);
      else if (u < 0.25) val = p5Val + (b.p25[endIdx] - p5Val) * ((u - 0.05) / 0.20);
      else if (u < 0.50) val = b.p25[endIdx] + (p50Val - b.p25[endIdx]) * ((u - 0.25) / 0.25);
      else if (u < 0.75) val = p50Val + (b.p75[endIdx] - p50Val) * ((u - 0.50) / 0.25);
      else if (u < 0.95) val = b.p75[endIdx] + (b.p95[endIdx] - b.p75[endIdx]) * ((u - 0.75) / 0.20);
      else if (u < 0.99) val = b.p95[endIdx] + (p99Val - b.p95[endIdx]) * ((u - 0.95) / 0.04);
      else val = p99Val;
      synthetic.push(val);
    }

    const cvarValues = synthetic.filter((v) => v <= p5Val);
    const cvar = cvarValues.length > 0 ? cvarValues.reduce((a, c) => a + c, 0) / cvarValues.length : p5Val;

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      traces: [{
        x: synthetic, type: 'histogram', nbinsx: 40,
        marker: { color: 'rgba(0, 240, 255, 0.35)', line: { color: '#00F0FF', width: 1 } },
        hovertemplate: '$%{x:.2f}<br>Count: %{y}<extra></extra>', name: 'Price Distribution',
      }] as any[],
      layout: {
        paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
        font: { color: '#E8ECF4', family: 'Outfit, sans-serif', size: 12 },
        xaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', title: { text: 'End Price (USD/bbl)', font: { size: 11, color: '#4A5568' } }, tickprefix: '$' },
        yaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', title: { text: 'Frequency', font: { size: 11, color: '#4A5568' } } },
        margin: { l: 60, r: 20, t: 10, b: 50 },
        hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(0,240,255,0.15)', font: { color: '#E8ECF4' } },
        showlegend: false,
        shapes: [{ type: 'line', x0: p5Val, x1: p5Val, y0: 0, y1: 1, yref: 'paper', line: { color: '#FF3366', width: 2, dash: 'dash' } }],
        annotations: [
          { x: p5Val, y: 0.95, yref: 'paper', text: `VaR(5%): $${p5Val.toFixed(2)}`, showarrow: true, arrowhead: 2, arrowcolor: '#FF3366', font: { size: 10, color: '#E8ECF4' }, ax: -60, ay: -20 },
          { x: cvar, y: 0.85, yref: 'paper', text: `CVaR: $${cvar.toFixed(2)}`, showarrow: false, font: { size: 10, color: '#E8ECF4' } },
        ],
      },
    };
  }, [simulationResult]);

  if (!simulationResult) {
    return <div className="flex items-center justify-center h-[280px]"><div className="text-text-secondary font-[family-name:var(--font-mono)] text-sm">Run a simulation to see the distribution</div></div>;
  }

  return (
    <div>
      <h3 className="font-[family-name:var(--font-display)] text-base tracking-[0.08em] uppercase text-text-primary mb-2">Price Distribution</h3>
      <Plot data={traces} layout={layout} config={{ displayModeBar: false, responsive: true }} style={{ width: '100%', height: '280px' }} useResizeHandler />
    </div>
  );
}
