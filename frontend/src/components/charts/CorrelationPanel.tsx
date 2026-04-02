import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useDownstream } from '../../hooks/useOilPrices';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
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
  // Build a date map from the downstream series
  const dsMap = new Map<string, number>();
  for (const p of ds.observations) {
    dsMap.set(p.date, p.value);
  }

  // For monthly downstream data, match oil dates to the closest month
  const oilDates: string[] = [];
  const oilVals: number[] = [];
  const dsVals: number[] = [];

  if (ds.observations.length > 0 && oil.observations.length > 0) {
    // If downstream is monthly (fewer points), interpolate oil to monthly
    if (ds.observations.length < oil.observations.length / 5) {
      // Monthly downstream - use downstream dates, find closest oil price
      const oilMap = new Map<string, number>();
      for (const p of oil.observations) {
        oilMap.set(p.date, p.value);
      }

      for (const dp of ds.observations) {
        // Find oil price on or nearest to this date
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
      // Daily downstream - direct date matching
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

export function CorrelationPanel() {
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
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-text-secondary">Loading correlation data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!panels.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[400px]">
          <div className="text-text-secondary">No downstream data available yet.</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {panels.map(({ series: ds, aligned, correlation }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const traces: any[] = [
          {
            x: aligned.dates,
            y: aligned.oilValues,
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'WTI Oil',
            line: { color: '#3b82f6', width: 1.5 },
            yaxis: 'y' as const,
            hovertemplate: 'Oil: $%{y:.2f}<extra></extra>',
          },
          {
            x: aligned.dates,
            y: aligned.dsValues,
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: ds.name,
            line: { color: '#f97316', width: 1.5 },
            yaxis: 'y2' as const,
            hovertemplate: `${ds.name}: %{y:.2f}<extra></extra>`,
          },
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layout: any = {
          paper_bgcolor: '#0a0a0f',
          plot_bgcolor: '#12121a',
          font: { color: '#e4e4e7', family: 'Inter, sans-serif', size: 10 },
          xaxis: { gridcolor: '#2a2a3e', linecolor: '#2a2a3e', type: 'date' as const },
          yaxis: {
            gridcolor: '#2a2a3e', linecolor: '#2a2a3e',
            title: { text: 'Oil ($)', font: { size: 9, color: '#3b82f6' } },
            tickprefix: '$', side: 'left' as const,
          },
          yaxis2: {
            gridcolor: 'transparent', linecolor: '#2a2a3e',
            title: { text: ds.name, font: { size: 9, color: '#f97316' } },
            side: 'right' as const, overlaying: 'y' as const,
          },
          margin: { l: 50, r: 50, t: 10, b: 30 },
          hovermode: 'x unified' as const,
          hoverlabel: { bgcolor: '#1a1a2e', bordercolor: '#2a2a3e', font: { color: '#e4e4e7', size: 10 } },
          showlegend: false,
        };

        return (
          <Card key={ds.series_id}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs">{ds.name}</CardTitle>
              <CardDescription>
                Correlation: {correlation >= 0 ? '+' : ''}{correlation.toFixed(3)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Plot
                data={traces}
                layout={layout}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '220px' }}
                useResizeHandler
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
