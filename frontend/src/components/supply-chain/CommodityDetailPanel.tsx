import { useEffect, useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useDownstream } from '../../hooks/useOilPrices';
import {
  COMMODITY_DATA,
  IRAN_WAR_DATE,
  alignSeries,
  computeCorrelation,
  getValueBeforeDate,
  hasDataAfter,
} from '../../lib/commodity-data';

export function CommodityDetailPanel() {
  const isOpen = useDashboardStore((s) => s.supplyChainPanelOpen);
  const commodityKey = useDashboardStore((s) => s.selectedCommodityKey);
  const closePanel = useDashboardStore((s) => s.closeCommodityPanel);
  const { data: downstream } = useDownstream();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closePanel]);

  const info = commodityKey ? COMMODITY_DATA[commodityKey] : null;

  const panelData = useMemo(() => {
    if (!info || !downstream?.oil || !commodityKey) return null;

    const ds = downstream.series.find((s) => s.name === info.displayName);
    if (!ds) return null;

    const aligned = alignSeries(downstream.oil, ds);
    const corr = computeCorrelation(aligned.oilValues, aligned.dsValues);
    const warBaseline = getValueBeforeDate(ds, IRAN_WAR_DATE);
    const latestVal = ds.observations.at(-1)?.value ?? null;
    const postWarData = hasDataAfter(ds, IRAN_WAR_DATE);
    const sinceWarPct = warBaseline && latestVal && postWarData ? ((latestVal - warBaseline) / warBaseline) * 100 : null;
    const awaitingPostWar = !postWarData && warBaseline !== null;

    // Format price
    let priceStr = latestVal !== null ? latestVal.toFixed(2) : 'N/A';
    if (['gasoline', 'diesel', 'natural_gas'].includes(commodityKey) && latestVal !== null) {
      priceStr = '$' + latestVal.toFixed(2);
    } else if (latestVal !== null) {
      priceStr = 'Index ' + latestVal.toFixed(1);
    }

    return { ds, aligned, corr, sinceWarPct, awaitingPostWar, latestVal, priceStr };
  }, [info, downstream, commodityKey]);

  const corrLabel = panelData ? (Math.abs(panelData.corr) > 0.7 ? 'Strong' : Math.abs(panelData.corr) > 0.4 ? 'Moderate' : 'Weak') : '';
  const corrColor = panelData ? (Math.abs(panelData.corr) > 0.7 ? '#00FF88' : Math.abs(panelData.corr) > 0.4 ? '#00F0FF' : '#4A5568') : '#4A5568';

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(4,6,12,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={closePanel}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 bottom-0 w-[520px] z-[101] bg-surface border-l border-border overflow-y-auto transition-[right] duration-[350ms] ${isOpen ? 'right-0' : '-right-[520px]'}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' }}
      >
        {/* Close button */}
        <button
          onClick={closePanel}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded bg-accent-glow border border-border-hover text-text-secondary hover:text-text-primary hover:bg-[rgba(0,240,255,0.12)] transition-all z-10"
        >
          {'\u2715'}
        </button>

        {info && panelData && (
          <>
            {/* Header */}
            <div className="p-6 pb-4 border-b border-border">
              <span className="text-4xl block mb-2">{info.icon}</span>
              <div className="font-[family-name:var(--font-display)] text-[28px] tracking-[0.05em] text-text-primary">
                {info.displayName}
              </div>
              <div className="text-sm text-text-secondary mt-1.5 leading-relaxed">{info.why}</div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
              <div className="text-center p-3 rounded-md bg-accent-glow">
                <div className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.1em] uppercase text-text-secondary mb-1">Current Price</div>
                <div className="font-[family-name:var(--font-mono)] text-xl font-bold text-text-primary">{panelData.priceStr}</div>
              </div>
              <div className="text-center p-3 rounded-md bg-accent-glow">
                <div className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.1em] uppercase text-text-secondary mb-1">Since Iran War</div>
                {panelData.awaitingPostWar ? (
                  <div className="font-[family-name:var(--font-mono)] text-xs text-text-secondary italic mt-1">Awaiting post-war data</div>
                ) : (
                  <div className="font-[family-name:var(--font-mono)] text-xl font-bold" style={{ color: panelData.sinceWarPct !== null && panelData.sinceWarPct >= 0 ? '#FF3366' : '#00FF88' }}>
                    {panelData.sinceWarPct !== null ? `${panelData.sinceWarPct >= 0 ? '\u2191' : '\u2193'}${Math.abs(panelData.sinceWarPct).toFixed(1)}%` : 'N/A'}
                  </div>
                )}
              </div>
              <div className="text-center p-3 rounded-md bg-accent-glow">
                <div className="font-[family-name:var(--font-mono)] text-[9px] tracking-[0.1em] uppercase text-text-secondary mb-1">Correlation</div>
                <div className="font-[family-name:var(--font-mono)] text-base font-bold" style={{ color: corrColor }}>
                  {corrLabel} {panelData.corr.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="p-4 border-b border-border">
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-accent mb-2">
                Price History vs Oil
              </div>
              {panelData.aligned.dates.length >= 3 ? (
                <Plot
                  data={[
                    {
                      x: panelData.aligned.dates, y: panelData.aligned.oilValues,
                      type: 'scatter', mode: 'lines', name: 'Oil',
                      line: { color: '#33F5FF', width: 2 }, yaxis: 'y',
                      hovertemplate: 'Oil: $%{y:.2f}<extra></extra>',
                    },
                    {
                      x: panelData.aligned.dates, y: panelData.aligned.dsValues,
                      type: 'scatter', mode: 'lines', name: info.displayName,
                      line: { color: '#00FF88', width: 2 }, yaxis: 'y2',
                      hovertemplate: `${info.displayName}: %{y:.2f}<extra></extra>`,
                    },
                  ]}
                  layout={{
                    paper_bgcolor: '#060A14', plot_bgcolor: '#0A0E18',
                    font: { color: '#E8ECF4', family: 'Outfit, sans-serif', size: 10 },
                    xaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', type: 'date' as const },
                    yaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', title: { text: 'Oil ($)', font: { size: 9, color: '#33F5FF' } }, tickprefix: '$', side: 'left' as const },
                    yaxis2: { gridcolor: 'transparent', linecolor: 'rgba(0,240,255,0.04)', title: { text: info.displayName, font: { size: 9, color: '#00FF88' } }, side: 'right' as const, overlaying: 'y' as const },
                    margin: { l: 50, r: 50, t: 10, b: 30 },
                    hovermode: 'x unified' as const,
                    hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(0,240,255,0.15)', font: { color: '#E8ECF4', size: 10 } },
                    showlegend: false,
                    shapes: [{ type: 'line' as const, x0: IRAN_WAR_DATE, x1: IRAN_WAR_DATE, y0: 0, y1: 1, yref: 'paper' as const, line: { color: '#FF3366', width: 1.5, dash: 'dash' as const } }],
                    annotations: [{ x: IRAN_WAR_DATE, y: 1.03, yref: 'paper' as const, text: 'Iran War', showarrow: false, font: { size: 9, color: '#FF3366' } }],
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%', height: '220px' }}
                  useResizeHandler
                />
              ) : (
                <div className="h-[220px] flex items-center justify-center text-text-secondary text-sm font-[family-name:var(--font-mono)]">
                  Insufficient data for chart
                </div>
              )}
            </div>

            {/* Context */}
            <div className="p-5">
              <div className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-accent mb-2">
                Why Oil Matters Here
              </div>
              <div className="text-sm text-[#8B95A5] leading-relaxed">{info.detail}</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
