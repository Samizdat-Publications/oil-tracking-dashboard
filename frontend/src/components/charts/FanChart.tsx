import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useOilPrices } from '../../hooks/useOilPrices';
import { useDashboardStore } from '../../stores/dashboardStore';
import { SERIES_LABELS } from '../../lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import type { SimulationBands } from '../../types';

interface FanChartProps {
  simulationResult: SimulationBands | null;
  isSimulating: boolean;
}

export function FanChart({ simulationResult, isSimulating }: FanChartProps) {
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);
  const { data: priceData } = useOilPrices(selectedSeries, undefined);

  const { traces, layout } = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traceList: any[] = [];

    // Historical prices (last 252 trading days for context)
    if (priceData?.observations?.length) {
      const histSlice = priceData.observations.slice(-252);
      traceList.push({
        x: histSlice.map((p) => p.date),
        y: histSlice.map((p) => p.value),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Historical',
        line: { color: '#3b82f6', width: 2 },
        hovertemplate: '%{x}<br>$%{y:.2f}<extra>Historical</extra>',
      });
    }

    // Simulation bands
    if (simulationResult) {
      const simDates = simulationResult.dates;
      const b = simulationResult.bands;

      // Band 1: p1-p99 (widest, red)
      traceList.push({
        x: simDates,
        y: b.p1,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: '1st percentile',
        line: { color: 'transparent', width: 0 },
        showlegend: false,
        hovertemplate: 'P1: $%{y:.2f}<extra></extra>',
      });
      traceList.push({
        x: simDates,
        y: b.p99,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'P1-P99 (98% range)',
        fill: 'tonexty' as const,
        fillcolor: 'rgba(239, 68, 68, 0.10)',
        line: { color: 'transparent', width: 0 },
        hovertemplate: 'P99: $%{y:.2f}<extra></extra>',
      });

      // Band 2: p5-p95
      traceList.push({
        x: simDates,
        y: b.p5,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: '5th percentile',
        line: { color: 'transparent', width: 0 },
        showlegend: false,
        hovertemplate: 'P5: $%{y:.2f}<extra></extra>',
      });
      traceList.push({
        x: simDates,
        y: b.p95,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'P5-P95 (90% range)',
        fill: 'tonexty' as const,
        fillcolor: 'rgba(249, 115, 22, 0.15)',
        line: { color: 'transparent', width: 0 },
        hovertemplate: 'P95: $%{y:.2f}<extra></extra>',
      });

      // Band 3: p25-p75
      traceList.push({
        x: simDates,
        y: b.p25,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: '25th percentile',
        line: { color: 'transparent', width: 0 },
        showlegend: false,
        hovertemplate: 'P25: $%{y:.2f}<extra></extra>',
      });
      traceList.push({
        x: simDates,
        y: b.p75,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'P25-P75 (50% range)',
        fill: 'tonexty' as const,
        fillcolor: 'rgba(148, 163, 184, 0.25)',
        line: { color: 'transparent', width: 0 },
        hovertemplate: 'P75: $%{y:.2f}<extra></extra>',
      });

      // Median line
      traceList.push({
        x: simDates,
        y: b.p50,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Median (P50)',
        line: { color: '#3b82f6', width: 2.5, dash: 'dash' },
        hovertemplate: 'Median: $%{y:.2f}<extra></extra>',
      });
    }

    // "Today" vertical line
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todayShapes: any[] = [];
    if (simulationResult && priceData?.observations?.length) {
      const lastHistDate = priceData.observations[priceData.observations.length - 1].date;
      todayShapes.push({
        type: 'line',
        x0: lastHistDate,
        x1: lastHistDate,
        y0: 0,
        y1: 1,
        yref: 'paper',
        line: { color: '#a1a1aa', width: 1, dash: 'dash' },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todayAnnotations: any[] = [];
    if (simulationResult && priceData?.observations?.length) {
      todayAnnotations.push({
        x: priceData.observations[priceData.observations.length - 1].date,
        y: 1.02,
        yref: 'paper',
        text: 'Today',
        showarrow: false,
        font: { size: 10, color: '#a1a1aa' },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartLayout: any = {
      paper_bgcolor: '#0a0a0f',
      plot_bgcolor: '#12121a',
      font: { color: '#e4e4e7', family: 'Inter, sans-serif', size: 12 },
      xaxis: {
        gridcolor: '#2a2a3e',
        linecolor: '#2a2a3e',
        zerolinecolor: '#2a2a3e',
        type: 'date' as const,
      },
      yaxis: {
        gridcolor: '#2a2a3e',
        linecolor: '#2a2a3e',
        zerolinecolor: '#2a2a3e',
        title: { text: 'Price (USD/bbl)', font: { size: 11, color: '#a1a1aa' } },
        tickprefix: '$',
      },
      margin: { l: 65, r: 20, t: 30, b: 40 },
      hovermode: 'x unified' as const,
      hoverlabel: {
        bgcolor: '#1a1a2e',
        bordercolor: '#2a2a3e',
        font: { color: '#e4e4e7', family: 'Inter, sans-serif' },
      },
      legend: {
        orientation: 'h' as const,
        yanchor: 'bottom' as const,
        y: 1.02,
        xanchor: 'right' as const,
        x: 1,
        font: { size: 10, color: '#a1a1aa' },
      },
      shapes: todayShapes,
      annotations: todayAnnotations,
    };

    return { traces: traceList, layout: chartLayout };
  }, [priceData, simulationResult]);

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Monte Carlo Simulation - {SERIES_LABELS[selectedSeries]}</CardTitle>
        <CardDescription>
          {simulationResult
            ? `Fan chart showing probability bands for price forecast`
            : isSimulating
              ? 'Running simulation...'
              : 'Run a simulation to see forecast bands'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isSimulating ? (
          <div className="flex items-center justify-center h-[450px]">
            <div className="text-text-secondary animate-pulse">Running Monte Carlo simulation...</div>
          </div>
        ) : (
          <Plot
            data={traces}
            layout={layout}
            config={{
              displayModeBar: true,
              displaylogo: false,
              responsive: true,
              modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            }}
            style={{ width: '100%', height: '450px' }}
            useResizeHandler
          />
        )}
      </CardContent>
    </Card>
  );
}

