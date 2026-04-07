import { useState, useMemo } from 'react';
import { HeroFanChart } from '../charts/HeroFanChart';
import { SimulationDrawer } from '../simulation/SimulationDrawer';
import { usePriceSummary } from '../../hooks/useOilPrices';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useEvents } from '../../hooks/useEvents';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { SCENARIO_THRESHOLDS, EVENT_CATEGORY_COLORS } from '../../lib/constants';
import type { SimulationBands } from '../../types';

interface ForecastSectionProps {
  simulationResult: SimulationBands | null;
  isSimulating: boolean;
  onRunSimulation: () => void;
}

function estimateCdfAtPrice(bands: SimulationBands['bands'], price: number): number {
  const idx = bands.p50.length - 1;
  const points = [
    { pct: 0.01, val: bands.p1[idx] },
    { pct: 0.05, val: bands.p5[idx] },
    { pct: 0.25, val: bands.p25[idx] },
    { pct: 0.50, val: bands.p50[idx] },
    { pct: 0.75, val: bands.p75[idx] },
    { pct: 0.95, val: bands.p95[idx] },
    { pct: 0.99, val: bands.p99[idx] },
  ];
  if (price <= points[0].val) return 0;
  if (price >= points[points.length - 1].val) return 1;
  for (let i = 0; i < points.length - 1; i++) {
    if (price >= points[i].val && price <= points[i + 1].val) {
      const frac = (price - points[i].val) / (points[i + 1].val - points[i].val);
      return points[i].pct + frac * (points[i + 1].pct - points[i].pct);
    }
  }
  return 0.5;
}

type ScenarioKey = 'median' | 'bull' | 'base' | 'bear' | null;

export function ForecastSection({ simulationResult, isSimulating, onRunSimulation }: ForecastSectionProps) {
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);
  const showSMA = useDashboardStore((s) => s.showSMA);
  const toggleSMA = useDashboardStore((s) => s.toggleSMA);
  const showEras = useDashboardStore((s) => s.showEras);
  const toggleEras = useDashboardStore((s) => s.toggleEras);
  const { data: summary } = usePriceSummary();
  const { events, toggleEvent } = useEvents();
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const wtiItem = summary?.data?.find((d) => d.series === selectedSeries);
  const currentPrice = wtiItem?.current_price ?? null;

  const probabilities = useMemo(() => {
    if (!simulationResult) return null;
    const { bands } = simulationResult;
    const idx = bands.p50.length - 1;
    const medianPrice = bands.p50[idx];
    const bullCdf = estimateCdfAtPrice(bands, SCENARIO_THRESHOLDS.bull);
    const bearCdf = estimateCdfAtPrice(bands, SCENARIO_THRESHOLDS.bear);
    return {
      medianPrice,
      bullPct: (1 - bullCdf) * 100,
      basePct: (bullCdf - bearCdf) * 100,
      bearPct: bearCdf * 100,
    };
  }, [simulationResult]);

  const delta = probabilities && currentPrice != null
    ? probabilities.medianPrice - currentPrice
    : null;

  const sectionRef = useScrollReveal();

  const scenarios: { key: ScenarioKey; label: string; value: string; color: string; sub: string; desc: string }[] = [
    {
      key: 'median',
      label: 'Median Forecast',
      value: probabilities ? formatCurrency(probabilities.medianPrice) : '--',
      color: '#00F0FF',
      sub: delta != null ? `${delta >= 0 ? '\u2191' : '\u2193'}${formatPercent(currentPrice ? (delta / currentPrice) * 100 : 0)}` : '',
      desc: '6-month median projected price',
    },
    {
      key: 'bull',
      label: 'Bull Scenario',
      value: probabilities ? `${probabilities.bullPct.toFixed(1)}%` : '--',
      color: '#00FF88',
      sub: `> $${SCENARIO_THRESHOLDS.bull}`,
      desc: 'War expands / Hormuz stays closed',
    },
    {
      key: 'base',
      label: 'Base Scenario',
      value: probabilities ? `${probabilities.basePct.toFixed(1)}%` : '--',
      color: '#00F0FF',
      sub: `$${SCENARIO_THRESHOLDS.bear}\u2013$${SCENARIO_THRESHOLDS.bull}`,
      desc: 'Status quo / gradual normalization',
    },
    {
      key: 'bear',
      label: 'Bear Scenario',
      value: probabilities ? `${probabilities.bearPct.toFixed(1)}%` : '--',
      color: '#FF3366',
      sub: `< $${SCENARIO_THRESHOLDS.bear}`,
      desc: 'Ceasefire / OPEC+ oversupply',
    },
  ];

  const SMA_CONFIGS = [
    { key: 'sma20' as const, color: '#00FF88', label: 'SMA 20' },
    { key: 'sma50' as const, color: '#2ECDC1', label: 'SMA 50' },
    { key: 'sma200' as const, color: '#FF3366', label: 'SMA 200' },
  ];

  return (
    <section className="py-12 scroll-reveal" ref={sectionRef as any}>
      <div className="section-wide">
        {/* Row 1: Title */}
        <div className="mb-6">
          <h2 className="editorial-header">Where Is It Going?</h2>
          <p className="editorial-subhead">Monte Carlo simulation with confidence bands</p>
        </div>

        {/* Row 2: Scenario tabs — full width 4-column grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {scenarios.map((s) => {
            const isActive = activeScenario === s.key;
            const isDimmed = activeScenario !== null && !isActive;
            return (
              <button
                key={s.key}
                onClick={() => setActiveScenario(isActive ? null : s.key)}
                className={`relative text-left px-5 py-4 transition-all duration-300 cursor-pointer border ${
                  isActive
                    ? 'border-border bg-white/[0.03]'
                    : isDimmed
                    ? 'border-border/50 opacity-50'
                    : 'border-border hover:bg-white/[0.02]'
                }`}
                style={{
                  borderTopWidth: '3px',
                  borderTopColor: isActive || !isDimmed ? s.color : '#4A5568',
                  boxShadow: isActive ? `0 -4px 20px ${s.color}15, inset 0 1px 0 ${s.color}20` : 'none',
                }}
              >
                <div className="font-[family-name:var(--font-display)] text-[11px] tracking-[0.12em] uppercase text-text-secondary mb-1">
                  {s.label}
                </div>
                <div
                  className="number-display text-2xl lg:text-3xl font-semibold transition-colors duration-300 mb-1"
                  style={{ color: isDimmed ? '#4A5568' : s.color }}
                >
                  {s.value}
                </div>
                <div className="text-[11px] text-text-secondary">{s.desc}</div>
                {s.sub && (
                  <div
                    className="number-display text-[11px] mt-1"
                    style={{ color: s.key === 'median' && delta != null ? (delta >= 0 ? '#00FF88' : '#FF3366') : '#4A5568' }}
                  >
                    {s.sub}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 3: Chart controls */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            {SMA_CONFIGS.map((cfg) => (
              <button
                key={cfg.key}
                className={`px-3 py-1 text-[11px] font-semibold transition-all duration-200 font-[family-name:var(--font-mono)] ${
                  showSMA[cfg.key]
                    ? 'text-background border border-transparent'
                    : 'border border-border text-text-secondary hover:text-text-primary hover:border-border-hover'
                }`}
                style={showSMA[cfg.key] ? { backgroundColor: cfg.color } : undefined}
                onClick={() => toggleSMA(cfg.key)}
              >
                {cfg.label.toUpperCase()}
              </button>
            ))}
            <button
              className={`px-3 py-1 text-[11px] font-semibold transition-all duration-200 font-[family-name:var(--font-mono)] ${
                showEras
                  ? 'bg-purple text-background border border-transparent'
                  : 'border border-border text-text-secondary hover:text-text-primary hover:border-border-hover'
              }`}
              onClick={toggleEras}
            >
              ERAS
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-secondary font-[family-name:var(--font-mono)]">RANGE:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-7 bg-surface border border-border text-text-primary text-[11px] px-2 focus:outline-none focus:ring-1 focus:ring-accent/30 font-[family-name:var(--font-mono)]"
            />
            <span className="text-text-secondary text-[11px]">{'\u2014'}</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-7 bg-surface border border-border text-text-primary text-[11px] px-2 focus:outline-none focus:ring-1 focus:ring-accent/30 font-[family-name:var(--font-mono)]"
            />
            {(dateFrom || dateTo) && (
              <button
                className="text-[11px] text-accent hover:text-accent-hover font-[family-name:var(--font-mono)]"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* Row 4: Chart */}
        <div className="border-t border-border pt-2">
          <HeroFanChart
            simulationResult={simulationResult}
            isSimulating={isSimulating}
            activeScenario={activeScenario}
            dateFrom={dateFrom || undefined}
            dateTo={dateTo || undefined}
          />
        </div>

        {/* Row 5: Event toggle strip */}
        <div className="mt-3 mb-4">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-text-secondary font-[family-name:var(--font-display)] tracking-[0.12em] uppercase mr-2">Events:</span>
            {events.map((event) => {
              const color = EVENT_CATEGORY_COLORS[event.category] || '#4A5568';
              return (
                <button
                  key={event.id}
                  onClick={() => toggleEvent(event.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-[10px] transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    event.visible
                      ? 'text-text-primary'
                      : 'text-text-secondary/40 hover:text-text-secondary/70'
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: event.visible ? color : '#4A5568' }}
                  />
                  {event.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 6: Simulation controls */}
        <SimulationDrawer
          onRunSimulation={onRunSimulation}
          isSimulating={isSimulating}
          simulationResult={simulationResult}
        />
      </div>
    </section>
  );
}
