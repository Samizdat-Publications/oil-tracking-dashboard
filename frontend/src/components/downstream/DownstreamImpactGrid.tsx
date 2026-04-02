import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useDownstream } from '../../hooks/useOilPrices';
import type { PriceSeries } from '../../types';

function computeCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den > 0 ? num / den : 0;
}

function alignSeries(oil: PriceSeries, ds: PriceSeries) {
  const oilDates: string[] = [];
  const oilVals: number[] = [];
  const dsVals: number[] = [];

  if (ds.observations.length > 0 && oil.observations.length > 0) {
    if (ds.observations.length < oil.observations.length / 5) {
      for (const dp of ds.observations) {
        const dsDate = dp.date;
        let bestOil: number | null = null;
        let bestDist = Infinity;
        for (const op of oil.observations) {
          const dist = Math.abs(new Date(op.date).getTime() - new Date(dsDate).getTime());
          if (dist < bestDist) {
            bestDist = dist;
            bestOil = op.value;
          }
        }
        if (bestOil !== null) {
          oilDates.push(dsDate);
          oilVals.push(bestOil);
          dsVals.push(dp.value);
        }
      }
    } else {
      const dsMap = new Map<string, number>();
      for (const p of ds.observations) {
        dsMap.set(p.date, p.value);
      }
      for (const op of oil.observations) {
        const dsVal = dsMap.get(op.date);
        if (dsVal !== undefined) {
          oilDates.push(op.date);
          oilVals.push(op.value);
          dsVals.push(dsVal);
        }
      }
    }
  }

  return { dates: oilDates, oilValues: oilVals, dsValues: dsVals };
}

function CorrelationBadge({ r }: { r: number }) {
  const absR = Math.abs(r);
  const sign = r >= 0 ? '+' : '';
  const formatted = `${sign}${r.toFixed(2)}`;

  if (absR > 0.7) {
    return (
      <span className="text-[10px] px-2 py-0.5 font-semibold border border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88] font-[family-name:var(--font-mono)]">
        Strong ({formatted})
      </span>
    );
  }
  if (absR > 0.4) {
    return (
      <span className="text-[10px] px-2 py-0.5 font-semibold border border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF] font-[family-name:var(--font-mono)]">
        Moderate ({formatted})
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 font-semibold border border-[#4A5568]/30 bg-[#4A5568]/10 text-[#4A5568] font-[family-name:var(--font-mono)]">
      Weak ({formatted})
    </span>
  );
}

export function DownstreamImpactGrid() {
  const { data: downstream, isLoading } = useDownstream();

  const panels = useMemo(() => {
    if (!downstream?.oil?.observations?.length || !downstream?.series?.length) return [];

    return downstream.series.map((ds) => {
      const aligned = alignSeries(downstream.oil, ds);
      const corr = computeCorrelation(aligned.oilValues, aligned.dsValues);
      return { series: ds, aligned, correlation: corr };
    });
  }, [downstream]);

  if (isLoading) {
    return (
      <div>
        <h2 className="section-title mb-1">Downstream Impact</h2>
        <p className="text-xs text-text-secondary mb-4">How oil prices correlate with key economic indicators</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`signal-card rounded-lg animate-signal-in stagger-${i}`}>
              <div className="flex items-center justify-center h-[250px]">
                <div className="text-text-secondary animate-pulse font-[family-name:var(--font-mono)] text-sm">Loading...</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!panels.length) {
    return (
      <div>
        <h2 className="section-title mb-1">Downstream Impact</h2>
        <p className="text-xs text-text-secondary mb-4">How oil prices correlate with key economic indicators</p>
        <div className="signal-card rounded-lg">
          <div className="flex items-center justify-center h-[200px]">
            <div className="text-text-secondary font-[family-name:var(--font-mono)] text-sm">No downstream data available yet.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title mb-1">Downstream Impact</h2>
      <p className="text-xs text-text-secondary mb-4">How oil prices correlate with key economic indicators</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {panels.map(({ series: ds, aligned, correlation }, idx) => {
          const traces: any[] = [
            {
              x: aligned.dates,
              y: aligned.oilValues,
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: 'Oil',
              line: { color: '#33F5FF', width: 1.5 },
              yaxis: 'y' as const,
              hovertemplate: 'Oil: $%{y:.2f}<extra></extra>',
            },
            {
              x: aligned.dates,
              y: aligned.dsValues,
              type: 'scatter' as const,
              mode: 'lines' as const,
              name: ds.name,
              line: { color: '#00FF88', width: 1.5 },
              yaxis: 'y2' as const,
              hovertemplate: `${ds.name}: %{y:.2f}<extra></extra>`,
            },
          ];

          const layout: any = {
            paper_bgcolor: '#060A14',
            plot_bgcolor: '#0A0E18',
            font: { color: '#E8ECF4', family: 'Outfit, sans-serif', size: 10 },
            xaxis: {
              gridcolor: 'rgba(0,240,255,0.04)',
              linecolor: 'rgba(0,240,255,0.04)',
              type: 'date' as const,
            },
            yaxis: {
              gridcolor: 'rgba(0,240,255,0.04)',
              linecolor: 'rgba(0,240,255,0.04)',
              title: { text: 'Oil ($)', font: { size: 9, color: '#33F5FF' } },
              tickprefix: '$',
              side: 'left' as const,
            },
            yaxis2: {
              gridcolor: 'transparent',
              linecolor: 'rgba(0,240,255,0.04)',
              title: { text: ds.name, font: { size: 9, color: '#00FF88' } },
              side: 'right' as const,
              overlaying: 'y' as const,
            },
            margin: { l: 50, r: 50, t: 10, b: 30 },
            hovermode: 'x unified' as const,
            hoverlabel: {
              bgcolor: '#0C1220',
              bordercolor: 'rgba(0,240,255,0.15)',
              font: { color: '#E8ECF4', size: 10 },
            },
            showlegend: false,
          };

          return (
            <div
              key={ds.series_id}
              className={`signal-card rounded-lg animate-signal-in stagger-${(idx % 8) + 1}`}
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <span className="text-xs font-semibold text-text-primary">{ds.name}</span>
                <CorrelationBadge r={correlation} />
              </div>
              <div className="px-2 pb-2">
                <Plot
                  data={traces}
                  layout={layout}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%', height: '200px' }}
                  useResizeHandler
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
