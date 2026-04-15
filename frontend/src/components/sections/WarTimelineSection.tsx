import { useMemo } from 'react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import { useMilestones } from '../../hooks/useOilPrices';
import { IRAN_WAR_DATE } from '../../lib/commodity-data';
import { TimelineMilestone } from '../timeline/TimelineMilestone';
import type { Milestone } from '../../types';

interface PhaseMarker {
  kind: 'phase';
  label: string;
}

type TimelineItem =
  | { kind: 'milestone'; milestone: Milestone; side: 'left' | 'right' | 'full' }
  | PhaseMarker;

function buildTimeline(milestones: Milestone[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let insertedPreConflict = false;
  let insertedOpenConflict = false;
  let insertedEscalation = false;

  for (const m of milestones) {
    // Phase: PRE-CONFLICT — before war date
    if (!insertedPreConflict && m.date < IRAN_WAR_DATE) {
      items.push({ kind: 'phase', label: 'PRE-CONFLICT' });
      insertedPreConflict = true;
    }

    // Phase: OPEN CONFLICT — at or after war date
    if (!insertedOpenConflict && m.date >= IRAN_WAR_DATE) {
      items.push({ kind: 'phase', label: 'OPEN CONFLICT' });
      insertedOpenConflict = true;
    }

    // Phase: ESCALATION — week 4+
    if (!insertedEscalation && m.week >= 4 && m.date >= IRAN_WAR_DATE) {
      items.push({ kind: 'phase', label: 'ESCALATION' });
      insertedEscalation = true;
    }

    const side: 'left' | 'right' | 'full' =
      m.type === 'today' ? 'full'
      : m.type === 'editorial' ? 'left'
      : 'right';

    items.push({ kind: 'milestone', milestone: m, side });
  }

  return items;
}

function SectionHeader({ ref: sectionRef }: { ref: React.RefObject<HTMLElement | null> }) {
  return (
    <section className="py-24 scroll-reveal" ref={sectionRef}>
      <div className="section-wide">
        <span className="section-number">07 / Timeline</span>
        <h2 className="editorial-header">The War's Ripple</h2>
        <p className="text-base font-[family-name:var(--font-mono)] text-text-secondary mt-2">
          Unable to load timeline data.
        </p>
        <div className="section-rule mt-4" />
      </div>
    </section>
  );
}

export function WarTimelineSection() {
  const { data, isLoading, isError } = useMilestones();
  const ref = useScrollReveal();

  const milestones = data?.milestones ?? [];
  const timeline = useMemo(() => buildTimeline(milestones), [milestones]);

  if (isError) {
    return <SectionHeader ref={ref} />;
  }

  if (isLoading) {
    return (
      <section className="py-24 scroll-reveal" ref={ref}>
        <div className="section-wide">
          <span className="section-number">07 / Timeline</span>
          <h2 className="editorial-header">The War's Ripple</h2>
          <p className="editorial-subhead mb-4">Loading timeline...</p>
          <div className="section-rule" />

          {/* Skeleton — alternating cards */}
          <div className="relative mt-12">
            {/* Spine placeholder */}
            <div
              className="absolute top-0 bottom-0 w-[3px] left-[15px] lg:left-1/2 lg:-translate-x-1/2"
              style={{ background: 'rgba(212,160,18,0.1)' }}
            />
            {[1, 2, 3].map((i) => (
              <div key={i} className="war-room-row py-3">
                <div className="hidden lg:block" />
                <div className="war-room-node-cell flex justify-center" style={{ paddingTop: 16 }}>
                  <div className="w-[14px] h-[14px] rounded-full bg-surface animate-pulse" />
                </div>
                <div className="war-room-card-cell">
                  <div className="war-room-card p-4">
                    <div className="h-3 w-20 bg-surface rounded animate-pulse mb-3" />
                    <div className="h-4 w-48 bg-surface rounded animate-pulse mb-2" />
                    <div className="h-3 w-64 bg-surface rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!milestones.length) {
    return (
      <section className="py-12 scroll-reveal" ref={ref}>
        <div className="section-wide">
          <span className="section-number">07 / Timeline</span>
          <h2 className="editorial-header">The War's Ripple</h2>
          <p className="text-base font-[family-name:var(--font-mono)] text-text-secondary mt-2">
            No milestone data available yet.
          </p>
          <div className="section-rule mt-4" />
        </div>
      </section>
    );
  }

  return (
    <section className="py-24 scroll-reveal crosshatch-bg" ref={ref} style={{ background: '#060A12' }}>
      <div className="section-wide">
        <span className="section-number">07 / Timeline</span>
        <h2 className="editorial-header">The War's Ripple</h2>
        <p className="editorial-subhead">
          Week by week, here's how the Iran war reshaped prices from the barrel to your wallet.
        </p>
        <div className="section-rule" />

        {/* Timeline */}
        <div className="relative mt-12">
          {/* Central spine — left on mobile, centered on desktop */}
          <div
            className="absolute top-0 bottom-0 w-[3px] left-[15px] lg:left-1/2 lg:-translate-x-1/2"
            style={{
              background: 'linear-gradient(180deg, #CC2936 0%, #00F0FF 30%, #00F0FF 80%, #5DB075 100%)',
              opacity: 0.35,
            }}
          />

          {/* Timeline items — milestones + phase markers */}
          {timeline.map((item, i) => {
            if (item.kind === 'phase') {
              return (
                <div key={`phase-${item.label}`} className="flex items-center gap-3 py-4 pl-[32px] lg:pl-0 lg:justify-center">
                  <span className="war-room-phase">{item.label}</span>
                </div>
              );
            }

            return (
              <TimelineMilestone
                key={`${item.milestone.type}-${item.milestone.date}-${i}`}
                milestone={item.milestone}
                index={i}
                side={item.side}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
