import { useEffect, useRef } from 'react';
import type { Milestone } from '../../types';

interface TimelineMilestoneProps {
  milestone: Milestone;
  index: number;
}

const DOT_STYLES: Record<string, { bg: string; shadow: string }> = {
  editorial: { bg: '#FF3366', shadow: '0 0 8px rgba(255,51,102,0.4)' },
  data: { bg: '#00F0FF', shadow: '0 0 8px rgba(0,240,255,0.3)' },
  today: { bg: '#00FF88', shadow: '0 0 8px rgba(0,255,136,0.4)' },
};

export function TimelineMilestone({ milestone, index }: TimelineMilestoneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Track reveal timing to stagger cards entering viewport together
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Use a shared timestamp to batch cards entering within 200ms of each other
          const now = Date.now();
          const lastReveal = Number(document.documentElement.dataset.lastMilestoneReveal || '0');
          const batchIndex = (now - lastReveal < 200)
            ? Number(document.documentElement.dataset.milestoneBatchIdx || '0') + 1
            : 0;
          document.documentElement.dataset.lastMilestoneReveal = String(now);
          document.documentElement.dataset.milestoneBatchIdx = String(batchIndex);

          el.style.animationDelay = `${batchIndex * 0.1}s`;
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  const dot = DOT_STYLES[milestone.type] || DOT_STYLES.data;
  const isToday = milestone.type === 'today';

  // Format date label
  const dateLabel = milestone.type === 'today'
    ? `Today \u2022 ${new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : milestone.week > 0
      ? `Week ${milestone.week} \u2022 ${new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div ref={ref} className="timeline-milestone relative pl-12 mb-8" style={{ minHeight: 60 }}>
      {/* Dot */}
      {isToday ? (
        <div
          className="absolute left-0 top-1"
          style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${dot.bg}`, background: '#04060C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            style={{ width: 8, height: 8, borderRadius: '50%', background: dot.bg, animation: 'todayPulse 2s ease-in-out infinite' }}
          />
        </div>
      ) : (
        <div
          className="absolute left-[3px] top-1"
          style={{ width: 12, height: 12, borderRadius: '50%', background: dot.bg, border: '2px solid #04060C', boxShadow: dot.shadow }}
        />
      )}

      {/* Content */}
      <div
        className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.1em] uppercase mb-1"
        style={{ color: '#00F0FF' }}
      >
        {dateLabel}
        {milestone.type === 'editorial' && (
          <span className="ml-2 text-red">{'\u2022'} Event</span>
        )}
      </div>

      <div className="text-[15px] font-semibold text-text-primary mb-1">
        {milestone.headline}
      </div>

      <div className="text-[13px] text-text-secondary">
        {milestone.description}
      </div>

      {/* Badges */}
      {milestone.badges.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {milestone.badges.map((badge, i) => (
            <span
              key={i}
              className="font-[family-name:var(--font-mono)] text-[10px] px-2 py-0.5 border rounded-sm"
              style={{ borderColor: 'rgba(255,51,102,0.3)', color: '#FF3366' }}
            >
              {badge.label} {badge.change}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
