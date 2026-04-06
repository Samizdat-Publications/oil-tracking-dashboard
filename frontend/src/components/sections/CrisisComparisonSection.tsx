import { useState } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useCrisisComparison } from '../../hooks/useCrisisComparison';
import { CrisisBar } from '../crisis/CrisisBar';
import {
  type CrisisMetric,
  METRIC_LABELS,
  getMaxAbsValue,
} from '../../lib/crisis-data';

const METRICS: CrisisMetric[] = ['peak_spike', 'duration', 'gas_impact'];

export function CrisisComparisonSection() {
  const { data, isLoading, isError } = useCrisisComparison();
  const ref = useScrollReveal();
  const [metric, setMetric] = useState<CrisisMetric>('peak_spike');

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <span className="section-number">06 / History</span>
          <h2 className="editorial-header">How Bad Is It?</h2>
          <p className="editorial-subhead mb-4">Loading historical crisis data...</p>
          <div className="section-rule" />
          <div className="mt-6 space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 h-4 bg-surface rounded animate-pulse" />
                <div className="w-40 h-4 bg-surface rounded animate-pulse" />
                <div className="flex-1 h-5 bg-surface rounded animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
                <div className="w-16 h-4 bg-surface rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !data || !data.crises.length) {
    return (
      <section className="py-12 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <span className="section-number">06 / History</span>
          <h2 className="editorial-header">How Bad Is It?</h2>
          <p className="text-xs font-[family-name:var(--font-mono)] text-text-secondary mt-2">
            {isError ? 'Unable to load crisis comparison data.' : 'No historical crisis data available yet.'}
          </p>
          <div className="section-rule mt-4" />
        </div>
      </section>
    );
  }

  const { crises } = data;
  const maxAbs = getMaxAbsValue(crises, metric);

  // Find current (2026) crisis trajectory for comparison charts
  const currentCrisis = crises.find((c) => c.is_current);
  const currentTrajectory = currentCrisis?.trajectory ?? [];

  return (
    <section className="py-24 scroll-reveal" ref={ref}>
      <div className="section-reading">
        <h2 className="editorial-header">How Bad Is It?</h2>
        <p className="editorial-subhead">
          Every major oil shock since 1973, measured side by side. The current war
          {' '}{'\u2014'}{' '}in real-time. Click any crisis to compare trajectories day by day.
        </p>
        <div className="section-rule" />

        {/* Crisis bars */}
        <div className="mt-6 space-y-1">
          {crises.map((crisis, i) => (
            <CrisisBar
              key={crisis.id}
              crisis={crisis}
              metric={metric}
              maxAbsValue={maxAbs}
              currentTrajectory={currentTrajectory}
              delay={i * 150}
            />
          ))}
        </div>

        {/* Metric toggle */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className="px-3 py-1.5 rounded text-xs font-[family-name:var(--font-mono)] transition-all duration-200"
              style={{
                background: metric === m ? 'rgba(212, 160, 18, 0.12)' : 'transparent',
                border: `1px solid ${metric === m ? 'rgba(212, 160, 18, 0.3)' : 'rgba(212, 160, 18, 0.08)'}`,
                color: metric === m ? '#00F0FF' : '#8A8F98',
              }}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Hint */}
        <div className="mt-3 text-center text-[10px] font-[family-name:var(--font-mono)] text-text-secondary">
          Click a crisis row to compare its price trajectory against the current war
        </div>
      </div>
    </section>
  );
}
