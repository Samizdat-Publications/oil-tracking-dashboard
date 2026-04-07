import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useMilestones } from '../../hooks/useOilPrices';
import { TimelineMilestone } from '../timeline/TimelineMilestone';

export function WarTimelineSection() {
  const { data, isLoading, isError } = useMilestones();
  const ref = useScrollReveal();

  if (isError) {
    return (
      <section className="py-12 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <span className="section-number">05 / Timeline</span>
          <h2 className="editorial-header">The War's Ripple</h2>
          <p className="text-sm font-[family-name:var(--font-mono)] text-text-secondary mt-2">
            Unable to load timeline data.
          </p>
          <div className="section-rule mt-4" />
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <span className="section-number">05 / Timeline</span>
          <h2 className="editorial-header">The War's Ripple</h2>
          <p className="editorial-subhead mb-4">Loading timeline...</p>
          <div className="section-rule" />
          {/* Skeleton */}
          <div className="relative mt-8">
            <div className="absolute top-0 bottom-0 w-[2px]" style={{ left: 9, background: 'rgba(212,160,18,0.15)' }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid gap-x-4 mb-0 py-4" style={{ gridTemplateColumns: '20px 1fr' }}>
                <div className="flex justify-center pt-1">
                  <div className="w-[10px] h-[10px] rounded-full bg-surface animate-pulse" />
                </div>
                <div>
                  <div className="h-3 w-32 bg-surface rounded animate-pulse mb-2" />
                  <div className="h-4 w-64 bg-surface rounded animate-pulse mb-1" />
                  <div className="h-3 w-48 bg-surface rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const milestones = data?.milestones ?? [];
  if (!milestones.length) {
    return (
      <section className="py-12 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <span className="section-number">05 / Timeline</span>
          <h2 className="editorial-header">The War's Ripple</h2>
          <p className="text-sm font-[family-name:var(--font-mono)] text-text-secondary mt-2">
            No milestone data available yet.
          </p>
          <div className="section-rule mt-4" />
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 scroll-reveal" ref={ref}>
      <div className="section-reading">
        <h2 className="editorial-header">The War's Ripple</h2>
        <p className="editorial-subhead">
          Week by week, here's how the Iran war reshaped prices from the barrel to your wallet.
        </p>
        <div className="section-rule" />

        {/* Timeline */}
        <div className="relative mt-8">
          {/* Vertical line — centered in the 20px dot column (10px from left) */}
          <div
            className="absolute top-0 bottom-0 w-[2px]"
            style={{
              left: 9,
              background: 'linear-gradient(180deg, #CC2936 0%, #00F0FF 30%, #00F0FF 80%, #5DB075 100%)',
              opacity: 0.4,
            }}
          />

          {/* Milestone cards */}
          {milestones.map((m, i) => (
            <TimelineMilestone key={`${m.type}-${m.date}-${i}`} milestone={m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
