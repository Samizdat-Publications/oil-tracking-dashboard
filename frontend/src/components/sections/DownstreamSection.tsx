import { useMemo } from 'react';
import Plot from '../../lib/plotly';
import { useDownstream } from '../../hooks/useOilPrices';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  IRAN_WAR_DATE,
  computeCorrelation,
  alignSeries,
  getValueBeforeDate,
  hasDataAfter,
  getContextByDisplayName,
} from '../../lib/commodity-data';

function CorrelationBadge({ r }: { r: number }) {
  const absR = Math.abs(r);
  const sign = r >= 0 ? '+' : '';
  const formatted = `${sign}${r.toFixed(2)}`;
  const style = absR > 0.7 ? 'border-[#00FF88]/30 bg-[#00FF88]/10 text-[#00FF88]' : absR > 0.4 ? 'border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#00F0FF]' : 'border-[#4A5568]/30 bg-[#4A5568]/10 text-[#4A5568]';
  const label = absR > 0.7 ? 'Strong' : absR > 0.4 ? 'Moderate' : 'Weak';
  return <span className={`text-[11px] px-2 py-0.5 font-semibold border font-[family-name:var(--font-mono)] ${style}`}>{label} ({formatted})</span>;
}

function SinceWarBadge({ pctChange, awaiting }: { pctChange: number | null; awaiting?: boolean }) {
  if (awaiting) return <span className="text-[11px] text-text-secondary italic">Awaiting post-war data</span>;
  if (pctChange === null) return <span className="text-[11px] text-text-secondary">No data since war</span>;
  const isUp = pctChange >= 0;
  const color = isUp ? '#FF3366' : '#00FF88'; // Red for price increases (bad for consumers), green for decreases
  const arrow = isUp ? '\u2191' : '\u2193';
  return (
    <div className="mt-1">
      <span className="number-display text-sm font-semibold" style={{ color }}>
        {arrow} {Math.abs(pctChange).toFixed(1)}%
      </span>
      <span className="text-[10px] text-text-secondary ml-1">since Iran War</span>
    </div>
  );
}

export function DownstreamSection() {
  const { data: downstream, isLoading } = useDownstream();
  const ref = useScrollReveal();

  const panels = useMemo(() => {
    if (!downstream?.oil?.observations?.length || !downstream?.series?.length) return [];
    return downstream.series.map((ds) => {
      const aligned = alignSeries(downstream.oil, ds);
      const corr = computeCorrelation(aligned.oilValues, aligned.dsValues);

      // Compute "since Iran War" change — baseline is last value BEFORE the war
      const warValue = getValueBeforeDate(ds, IRAN_WAR_DATE);
      const latestValue = ds.observations.length > 0 ? ds.observations[ds.observations.length - 1].value : null;
      const postWarData = hasDataAfter(ds, IRAN_WAR_DATE);
      const sinceWarPct = warValue && latestValue && postWarData ? ((latestValue - warValue) / warValue) * 100 : null;
      const awaitingPostWar = !postWarData && warValue !== null;

      const context = getContextByDisplayName(ds.name) || { icon: '\u{1F4C8}', why: 'Tracks the relationship between crude oil and this indicator.' };

      return { series: ds, aligned, correlation: corr, sinceWarPct, awaitingPostWar, context };
    }).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }, [downstream]);

  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref as any}>
        <div className="section-wide">
          <h2 className="editorial-header">The Ripple Effect</h2>
          <p className="editorial-subhead">Loading downstream data...</p>
        </div>
      </section>
    );
  }

  if (!panels.length) {
    return (
      <section className="py-12 scroll-reveal" ref={ref as any}>
        <div className="section-wide">
          <h2 className="editorial-header">The Ripple Effect</h2>
          <p className="text-base font-[family-name:var(--font-mono)] text-text-secondary mt-2">
            Unable to load downstream correlation data.
          </p>
          <div className="section-rule mt-4" />
        </div>
      </section>
    );
  }

  const featured = panels[0];
  const rest = panels.slice(1);

  return (
    <section className="py-24 scroll-reveal" ref={ref as any}>
      <div className="section-wide">
        <div className="mb-8">
          <h2 className="editorial-header">The Ripple Effect</h2>
          <p className="editorial-subhead mb-4">When oil moves, everything moves. Here's how the Iran war is hitting your wallet.</p>
          <div className="section-rule" />
        </div>

        {/* Featured commodity — full width */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{featured.context.icon}</span>
            <h3 className="font-[family-name:var(--font-display)] text-xl tracking-[0.06em] uppercase text-text-primary">
              {featured.series.name}
            </h3>
            <CorrelationBadge r={featured.correlation} />
          </div>
          <p className="text-base text-text-secondary mb-2 max-w-[700px]">{featured.context.why}</p>
          <SinceWarBadge pctChange={featured.sinceWarPct} awaiting={featured.awaitingPostWar} />
          <div className="mt-3">
            <Plot
              data={[
                { x: featured.aligned.dates, y: featured.aligned.oilValues, type: 'scatter', mode: 'lines', name: 'Oil', line: { color: '#33F5FF', width: 2 }, yaxis: 'y', hovertemplate: 'Oil: $%{y:.2f}<extra></extra>' },
                { x: featured.aligned.dates, y: featured.aligned.dsValues, type: 'scatter', mode: 'lines', name: featured.series.name, line: { color: '#00FF88', width: 2 }, yaxis: 'y2', hovertemplate: `${featured.series.name}: %{y:.2f}<extra></extra>` },
              ]}
              layout={{
                paper_bgcolor: '#060A14', plot_bgcolor: '#0A0E18',
                font: { color: '#E8ECF4', family: 'Outfit, sans-serif', size: 10 },
                xaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', type: 'date' as const },
                yaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', title: { text: 'Oil ($)', font: { size: 9, color: '#33F5FF' } }, tickprefix: '$', side: 'left' as const },
                yaxis2: { gridcolor: 'transparent', linecolor: 'rgba(0,240,255,0.04)', title: { text: featured.series.name, font: { size: 9, color: '#00FF88' } }, side: 'right' as const, overlaying: 'y' as const },
                margin: { l: 50, r: 50, t: 10, b: 30 },
                hovermode: 'x unified' as const,
                hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(0,240,255,0.15)', font: { color: '#E8ECF4', size: 10 } },
                showlegend: false,
                // Add Iran War vertical line
                shapes: [{ type: 'line' as const, x0: IRAN_WAR_DATE, x1: IRAN_WAR_DATE, y0: 0, y1: 1, yref: 'paper' as const, line: { color: '#FF3366', width: 1.5, dash: 'dash' as const } }],
                annotations: [{ x: IRAN_WAR_DATE, y: 1.03, yref: 'paper' as const, text: 'Iran War', showarrow: false, font: { size: 9, color: '#FF3366' } }],
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '300px' }}
              useResizeHandler
            />
          </div>
        </div>

        {/* Grid of remaining commodities */}
        {rest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {rest.map(({ series: ds, aligned, correlation, sinceWarPct, awaitingPostWar, context }) => (
              <div key={ds.series_id} className="border-t border-border pt-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{context.icon}</span>
                  <span className="text-sm font-semibold text-text-primary flex-1">{ds.name}</span>
                  <CorrelationBadge r={correlation} />
                </div>
                <p className="text-xs text-text-secondary mb-1 line-clamp-2">{context.why}</p>
                <SinceWarBadge pctChange={sinceWarPct} awaiting={awaitingPostWar} />
                <div className="mt-2">
                  <Plot
                    data={[
                      { x: aligned.dates, y: aligned.oilValues, type: 'scatter', mode: 'lines', name: 'Oil', line: { color: '#33F5FF', width: 1.5 }, yaxis: 'y', hovertemplate: 'Oil: $%{y:.2f}<extra></extra>' },
                      { x: aligned.dates, y: aligned.dsValues, type: 'scatter', mode: 'lines', name: ds.name, line: { color: '#00FF88', width: 1.5 }, yaxis: 'y2', hovertemplate: `${ds.name}: %{y:.2f}<extra></extra>` },
                    ]}
                    layout={{
                      paper_bgcolor: '#060A14', plot_bgcolor: '#0A0E18',
                      font: { color: '#E8ECF4', family: 'Outfit, sans-serif', size: 10 },
                      xaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', type: 'date' as const },
                      yaxis: { gridcolor: 'rgba(0,240,255,0.04)', linecolor: 'rgba(0,240,255,0.04)', title: { text: 'Oil ($)', font: { size: 9, color: '#33F5FF' } }, tickprefix: '$', side: 'left' as const },
                      yaxis2: { gridcolor: 'transparent', linecolor: 'rgba(0,240,255,0.04)', title: { text: ds.name, font: { size: 9, color: '#00FF88' } }, side: 'right' as const, overlaying: 'y' as const },
                      margin: { l: 50, r: 50, t: 10, b: 30 },
                      hovermode: 'x unified' as const,
                      hoverlabel: { bgcolor: '#0C1220', bordercolor: 'rgba(0,240,255,0.15)', font: { color: '#E8ECF4', size: 10 } },
                      showlegend: false,
                      shapes: [{ type: 'line' as const, x0: IRAN_WAR_DATE, x1: IRAN_WAR_DATE, y0: 0, y1: 1, yref: 'paper' as const, line: { color: '#FF3366', width: 1, dash: 'dash' as const } }],
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%', height: '180px' }}
                    useResizeHandler
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
