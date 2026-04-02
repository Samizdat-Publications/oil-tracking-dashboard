import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useOilPrices } from '../../hooks/useOilPrices';
import { useEvents } from '../../hooks/useEvents';
import { useDashboardStore } from '../../stores/dashboardStore';
import { SERIES_LABELS, EVENT_CATEGORY_COLORS } from '../../lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

function computeSMA(values: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - window + 1; j <= i; j++) {
        sum += values[j];
      }
      result.push(sum / window);
    }
  }
  return result;
}

export function PriceChart() {
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);
  const dateRangeStart = useDashboardStore((s) => s.dateRangeStart);
  const showSMA = useDashboardStore((s) => s.showSMA);
  const toggleSMA = useDashboardStore((s) => s.toggleSMA);
  const { data: priceData, isLoading } = useOilPrices(selectedSeries, dateRangeStart);
  const { visibleEvents } = useEvents();

  const traces = useMemo(() => {
    if (!priceData?.observations?.length) return [];

    const dates = priceData.observations.map((p) => p.date);
    const values = priceData.observations.map((p) => p.value);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [
      {
        x: dates,
        y: values,
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: SERIES_LABELS[selectedSeries] || selectedSeries.toUpperCase(),
        line: { color: '#3b82f6', width: 1.5 },
        hovertemplate: '%{x}<br>$%{y:.2f}<extra></extra>',
      },
    ];

    if (showSMA.sma20) {
      result.push({
        x: dates,
        y: computeSMA(values, 20),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'SMA 20',
        line: { color: '#f97316', width: 1, dash: 'dot' },
        hovertemplate: 'SMA20: $%{y:.2f}<extra></extra>',
      });
    }

    if (showSMA.sma50) {
      result.push({
        x: dates,
        y: computeSMA(values, 50),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'SMA 50',
        line: { color: '#22c55e', width: 1, dash: 'dot' },
        hovertemplate: 'SMA50: $%{y:.2f}<extra></extra>',
      });
    }

    if (showSMA.sma200) {
      result.push({
        x: dates,
        y: computeSMA(values, 200),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'SMA 200',
        line: { color: '#a855f7', width: 1, dash: 'dot' },
        hovertemplate: 'SMA200: $%{y:.2f}<extra></extra>',
      });
    }

    return result;
  }, [priceData, selectedSeries, showSMA]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layout = useMemo((): any => {
    const filteredEvents = visibleEvents.filter((e) => {
      if (!priceData?.observations?.length) return false;
      const firstDate = priceData.observations[0].date;
      const lastDate = priceData.observations[priceData.observations.length - 1].date;
      return e.date >= firstDate && e.date <= lastDate;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shapes: any[] = filteredEvents.map((e) => ({
      type: 'line',
      x0: e.date,
      x1: e.date,
      y0: 0,
      y1: 1,
      yref: 'paper',
      line: {
        color: EVENT_CATEGORY_COLORS[e.category] || '#a1a1aa',
        width: 1,
        dash: 'dot',
      },
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const annotations: any[] = filteredEvents.map((e) => ({
      x: e.date,
      y: 1,
      yref: 'paper',
      text: e.label,
      showarrow: false,
      textangle: '-45',
      font: {
        size: 9,
        color: EVENT_CATEGORY_COLORS[e.category] || '#a1a1aa',
      },
      yshift: 10,
    }));

    return {
      paper_bgcolor: '#0a0a0f',
      plot_bgcolor: '#12121a',
      font: { color: '#e4e4e7', family: 'Inter, sans-serif', size: 12 },
      xaxis: {
        gridcolor: '#2a2a3e',
        linecolor: '#2a2a3e',
        zerolinecolor: '#2a2a3e',
        rangeslider: { visible: true, bgcolor: '#12121a', bordercolor: '#2a2a3e' },
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
      shapes,
      annotations,
    };
  }, [priceData, visibleEvents]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-[500px]">
          <div className="text-text-secondary">Loading price data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>{SERIES_LABELS[selectedSeries]} - Historical Prices</CardTitle>
        <div className="flex items-center gap-1">
          <span className="text-xs text-text-secondary mr-2">Overlays:</span>
          <Button
            variant={showSMA.sma20 ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => toggleSMA('sma20')}
          >
            SMA 20
          </Button>
          <Button
            variant={showSMA.sma50 ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => toggleSMA('sma50')}
          >
            SMA 50
          </Button>
          <Button
            variant={showSMA.sma200 ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => toggleSMA('sma200')}
          >
            SMA 200
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Plot
          data={traces}
          layout={layout}
          config={{
            displayModeBar: true,
            displaylogo: false,
            responsive: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          }}
          style={{ width: '100%', height: '500px' }}
          useResizeHandler
        />
      </CardContent>
    </Card>
  );
}

