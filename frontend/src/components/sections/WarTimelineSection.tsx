import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useMilestones } from '../../hooks/useOilPrices';
import { TimelineMilestone } from '../timeline/TimelineMilestone';

export function WarTimelineSection() {
  const { data, isLoading, isError } = useMilestones();
  const ref = useScrollReveal();

  if (isError) return null;

  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-reading">
          <h2 className="editorial-header">The War's Ripple</h2>
          <p className="editorial-subhead mb-4">Loading timeline...</p>
          <div className="section-rule" />
          {/* Skeleton */}
          <div className="relative mt-8 pl-12">
            <div
              className="absolute left-[8px] top-0 bottom-0 w-[2px]"
              style={{ background: 'linear-gradient(180deg, rgba(0,240,255,0.2), rgba(0,240,255,0.05))' }}
            />
            {[1, 2, 3].map((i) => (
              <div key={i} className="mb-8">
                <div className="h-3 w-32 bg-surface rounded animate-pulse mb-2" />
                <div className="h-4 w-64 bg-surface rounded animate-pulse mb-1" />
                <div className="h-3 w-48 bg-surface rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const milestones = data?.milestones ?? [];
  if (!milestones.length) return null;

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
          {/* Vertical line */}
          <div
            className="absolute left-[8px] top-0 bottom-0 w-[2px]"
            style={{ background: 'linear-gradient(180deg, #00F0FF, rgba(0,240,255,0.1))' }}
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
