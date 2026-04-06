import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useOilPrices } from '../../hooks/useOilPrices';
import { useEvents } from '../../hooks/useEvents';
import { useDashboardStore } from '../../stores/dashboardStore';
import { EVENT_CATEGORY_COLORS, PRESIDENTIAL_ERAS, PLOTLY_CONFIG } from '../../lib/constants';
import type { SimulationBands } from '../../types';

interface HeroFanChartProps {
  simulationResult: SimulationBands | null;
  isSimulating: boolean;
  activeScenario?: string | null;
  dateFrom?: string;
  dateTo?: string;
}

const SMA_CONFIGS = [
  { key: 'sma20' as const, window: 20, color: '#5DB075', label: 'SMA 20' },
  { key: 'sma50' as const, window: 50, color: '#2ECDC1', label: 'SMA 50' },
  { key: 'sma200' as const, window: 200, color: '#CC2936', label: 'SMA 200' },
];

function getBandColors(activeScenario: string | null | undefined) {
  if (!activeScenario) {
    return { p1_p99: 'rgba(0, 240, 255, 0.05)', p5_p95: 'rgba(0, 240, 255, 0.10)', p25_p75: 'rgba(0, 240, 255, 0.22)', p50: '#00F0FF', p50width: 2.5 };
  }
  switch (activeScenario) {
    case 'bull': return { p1_p99: 'rgba(0, 255, 136, 0.12)', p5_p95: 'rgba(0, 255, 136, 0.08)', p25_p75: 'rgba(0, 240, 255, 0.04)', p50: 'rgba(0, 240, 255, 0.3)', p50width: 1.5 };
    case 'bear': return { p1_p99: 'rgba(255, 51, 102, 0.12)', p5_p95: 'rgba(255, 51, 102, 0.08)', p25_p75: 'rgba(0, 240, 255, 0.04)', p50: 'rgba(0, 240, 255, 0.3)', p50width: 1.5 };
    case 'base': return { p1_p99: 'rgba(0, 240, 255, 0.02)', p5_p95: 'rgba(0, 240, 255, 0.04)', p25_p75: 'rgba(0, 240, 255, 0.35)', p50: '#00F0FF', p50width: 3 };
    case 'median': return { p1_p99: 'rgba(0, 240, 255, 0.02)', p5_p95: 'rgba(0, 240, 255, 0.04)', p25_p75: 'rgba(0, 240, 255, 0.06)', p50: '#00F0FF', p50width: 4 };
    default: return { p1_p99: 'rgba(0, 240, 255, 0.05)', p5_p95: 'rgba(0, 240, 255, 0.10)', p25_p75: 'rgba(0, 240, 255, 0.22)', p50: '#00F0FF', p50width: 2.5 };
  }
}

export function HeroFanChart({ simulationResult, isSimulating, activeScenario, dateFrom, dateTo }: HeroFanChartProps) {
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);
  const showSMA = useDashboardStore((s) => s.showSMA);
  const showEras = useDashboardStore((s) => s.showEras);
  const { data: priceData, isLoading } = useOilPrices(selectedSeries, dateFrom, dateTo);
  const { visibleEvents } = useEvents();

  const { traces, layout } = useMemo(() => {
    const traceList: any[] = [];
    const shapes: any[] = [];
    const annotations: any[] = [];

    if (!priceData?.observations?.length) return { traces: traceList, layout: {} };

    const obs = priceData.observations;

    // Apply date range filter
    let filteredObs = obs;
    if (dateFrom) {
      filteredObs = filteredObs.filter((p: any) => p.date >= dateFrom);
    }
    if (dateTo) {
      filteredObs = filteredObs.filter((p: any) => p.date <= dateTo);
    }
    // If no custom range, default to last 504
    if (!dateFrom && !dateTo) {
      filteredObs = obs.slice(-504);
    }

    const histDates = filteredObs.map((p: any) => p.date);
    const histValues = filteredObs.map((p: any) => p.value);

    if (histDates.length === 0) return { traces: traceList, layout: {} };

    // Historical price line
    traceList.push({ x: histDates, y: histValues, type: 'scatter', mode: 'lines', name: 'Historical', line: { color: '#33F5FF', width: 2 }, hovertemplate: '%{x|%b %d, %Y}<br>$%{y:.2f}<extra></extra>' });

    // SMA overlays (computed from ALL data, then sliced to visible range)
    if (showSMA.sma20 || showSMA.sma50 || showSMA.sma200) {
      const allValues = obs.map((p: any) => p.value);
      const allDates = obs.map((p: any) => p.date);
      for (const cfg of SMA_CONFIGS) {
        if (!showSMA[cfg.key]) continue;
        const smaVals: (number | null)[] = [];
        for (let i = 0; i < allValues.length; i++) {
          if (i < cfg.window - 1) smaVals.push(null);
          else { let sum = 0; for (let j = i - cfg.window + 1; j <= i; j++) sum += allValues[j]; smaVals.push(sum / cfg.window); }
        }
        // Filter SMA to same date range as historical
        const startDate = histDates[0];
        const endDate = histDates[histDates.length - 1];
        const filteredSmaDates: string[] = [];
        const filteredSmaVals: (number | null)[] = [];
        for (let i = 0; i < allDates.length; i++) {
          if (allDates[i] >= startDate && allDates[i] <= endDate) {
            filteredSmaDates.push(allDates[i]);
            filteredSmaVals.push(smaVals[i]);
          }
        }
        traceList.push({ x: filteredSmaDates, y: filteredSmaVals, type: 'scatter', mode: 'lines', name: cfg.label, line: { color: cfg.color, width: 1.5, dash: 'dot' }, hovertemplate: `${cfg.label}: $%{y:.2f}<extra></extra>`, connectgaps: false });
      }
    }

    const lastHistDate = histDates[histDates.length - 1];
    const lastHistValue = histValues[histValues.length - 1];

    // Presidential era shading
    if (showEras) {
      for (const era of PRESIDENTIAL_ERAS) {
        // Only show eras that overlap with chart range
        if (era.end < histDates[0]) continue;
        const eraEnd = simulationResult ? simulationResult.dates[simulationResult.dates.length - 1] : lastHistDate;
        if (era.start > eraEnd) continue;
        shapes.push({
          type: 'rect',
          x0: era.start < histDates[0] ? histDates[0] : era.start,
          x1: era.end > eraEnd ? eraEnd : era.end,
          y0: 0, y1: 1, yref: 'paper',
          fillcolor: era.color,
          line: { width: 0 },
          layer: 'below',
        });
        // Label at the top
        const labelX = era.start < histDates[0] ? histDates[0] : era.start;
        annotations.push({
          x: labelX, y: 0.98, yref: 'paper',
          text: era.label,
          showarrow: false,
          font: { size: 9, color: era.party === 'dem' ? 'rgba(59,130,246,0.5)' : 'rgba(239,68,68,0.5)' },
          xanchor: 'left',
        });
      }
    }

    // Simulation bands
    const bandColors = getBandColors(activeScenario);
    if (simulationResult) {
      const simDates = simulationResult.dates;
      const b = simulationResult.bands;
      const xDates = [lastHistDate, ...simDates];
      const makeBand = (lower: number[], upper: number[], fillcolor: string, name: string) => {
        traceList.push({ x: xDates, y: [lastHistValue, ...lower], type: 'scatter', mode: 'lines', line: { color: 'transparent', width: 0 }, showlegend: false, hoverinfo: 'skip' });
        traceList.push({ x: xDates, y: [lastHistValue, ...upper], type: 'scatter', mode: 'lines', fill: 'tonexty', fillcolor, line: { color: 'transparent', width: 0 }, name, hoverinfo: 'skip' });
      };
      makeBand(b.p1, b.p99, bandColors.p1_p99, 'P1-P99 (98%)');
      makeBand(b.p5, b.p95, bandColors.p5_p95, 'P5-P95 (90%)');
      makeBand(b.p25, b.p75, bandColors.p25_p75, 'P25-P75 (50%)');
      traceList.push({ x: xDates, y: [lastHistValue, ...b.p50], type: 'scatter', mode: 'lines', name: 'Median (P50)', line: { color: bandColors.p50, width: bandColors.p50width, dash: 'dash' }, hovertemplate: 'Median: $%{y:.2f}<extra></extra>' });
    }

    // "Today" line
    shapes.push({ type: 'line', x0: lastHistDate, x1: lastHistDate, y0: 0, y1: 1, yref: 'paper', line: { color: '#4A5568', width: 1, dash: 'dot' } });
    annotations.push({ x: lastHistDate, y: 1.02, yref: 'paper', text: 'Today', showarrow: false, font: { size: 10, color: '#4A5568' } });

    // Event annotations
    const chartStart = new Date(histDates[0]);
    const chartEnd = simulationResult ? new Date(simulationResult.dates[simulationResult.dates.length - 1]) : new Date(lastHistDate);
    for (const evt of visibleEvents) {
      const evtDate = new Date(evt.date);
      if (evtDate < chartStart || evtDate > chartEnd) continue;
      const categoryColor = EVENT_CATEGORY_COLORS[evt.category] || '#4A5568';
      shapes.push({ type: 'line', x0: evt.date, x1: evt.date, y0: 0, y1: 1, yref: 'paper', line: { color: categoryColor, width: 1, dash: 'dash' } });
      annotations.push({ x: evt.date, y: 1.05, yref: 'paper', text: evt.label, showarrow: false, textangle: -30, font: { size: 9, color: categoryColor } });
    }

    const chartLayout: any = {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
      font: { color: '#E8ECF4', family: 'Plus Jakarta Sans, sans-serif', size: 12 },
      xaxis: { type: 'date', rangeslider: { visible: true, bgcolor: '#0A0E18', bordercolor: 'rgba(212,160,18,0.06)' }, gridcolor: 'rgba(212,160,18,0.04)', linecolor: 'rgba(212,160,18,0.04)', zerolinecolor: 'rgba(212,160,18,0.04)' },
      yaxis: { title: { text: 'Price (USD/bbl)', font: { size: 11, color: '#4A5568' } }, tickprefix: '$', gridcolor: 'rgba(212,160,18,0.04)', linecolor: 'rgba(212,160,18,0.04)', zerolinecolor: 'rgba(212,160,18,0.04)' },
      hovermode: 'x unified',
      hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(212,160,18,0.15)', font: { color: '#E8ECF4', family: 'Plus Jakarta Sans, sans-serif' } },
      legend: { orientation: 'h', y: 1.12, x: 0.5, xanchor: 'center', font: { size: 10, color: '#4A5568' }, bgcolor: 'transparent' },
      margin: { l: 65, r: 25, t: 60, b: 40 },
      shapes, annotations,
    };

    return { traces: traceList, layout: chartLayout };
  }, [priceData, simulationResult, visibleEvents, showSMA, activeScenario, showEras, dateFrom, dateTo]);

  if (isLoading) {
    return (
      <div className="h-[500px] relative overflow-hidden">
        {/* Chart skeleton — mimics a chart shape */}
        <div className="absolute inset-0 flex flex-col justify-end px-8 pb-12">
          {/* Fake chart line */}
          <svg className="w-full h-[300px] animate-pulse opacity-20" viewBox="0 0 800 300" preserveAspectRatio="none">
            <path d="M0,250 C100,240 150,220 200,200 C250,180 300,160 350,170 C400,180 450,140 500,120 C550,100 600,80 650,90 C700,100 750,60 800,50" fill="none" stroke="#00F0FF" strokeWidth="2" />
            <path d="M0,250 C100,240 150,220 200,200 C250,180 300,160 350,170 C400,180 450,140 500,120 C550,100 600,80 650,90 C700,100 750,60 800,50 L800,300 L0,300 Z" fill="url(#skelGrad)" />
            <defs><linearGradient id="skelGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00F0FF" stopOpacity="0.08" /><stop offset="100%" stopColor="#00F0FF" stopOpacity="0" /></linearGradient></defs>
          </svg>
          {/* Axis lines */}
          <div className="absolute bottom-12 left-8 right-8 h-px bg-border opacity-30" />
          <div className="absolute top-8 bottom-12 left-8 w-px bg-border opacity-30" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-text-secondary animate-pulse font-[family-name:var(--font-mono)] text-sm">Loading price data...</div>
        </div>
      </div>
    );
  }

  if (isSimulating && !simulationResult) {
    return <div className="flex items-center justify-center h-[500px]"><div className="text-accent animate-pulse font-[family-name:var(--font-mono)] text-sm tracking-widest uppercase">Running Monte Carlo simulation...</div></div>;
  }

  return (
    <Plot data={traces} layout={layout} config={PLOTLY_CONFIG} style={{ width: '100%', height: '500px' }} useResizeHandler />
  );
}
