import { useEffect, useRef } from 'react';
import type { Milestone } from '../../types';

interface TimelineMilestoneProps {
  milestone: Milestone;
  index: number;
}

const DOT_COLORS: Record<string, string> = {
  editorial: '#FF3366',
  data: '#00F0FF',
  today: '#00FF88',
};

export function TimelineMilestone({ milestone, index }: TimelineMilestoneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
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

  const color = DOT_COLORS[milestone.type] || DOT_COLORS.data;
  const isToday = milestone.type === 'today';
  const isEditorial = milestone.type === 'editorial';

  const dateLabel = isToday
    ? `Today \u2022 ${new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : milestone.week > 0
      ? `Week ${milestone.week} \u2022 ${new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div
      ref={ref}
      className="timeline-milestone grid gap-x-4 mb-0 py-4"
      style={{
        gridTemplateColumns: '20px 1fr',
        minHeight: isEditorial ? 80 : 60,
      }}
    >
      {/* Column 1: Dot (centered in 20px column) */}
      <div className="flex justify-center pt-1 relative">
        {isToday ? (
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              background: '#04060C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
                animation: 'todayPulse 2s ease-in-out infinite',
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: isEditorial ? 12 : 10,
              height: isEditorial ? 12 : 10,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 8px ${color}40`,
              flexShrink: 0,
              marginTop: 2,
            }}
          />
        )}
      </div>

      {/* Column 2: Content */}
      <div>
        {/* Date label */}
        <div
          className="font-[family-name:var(--font-mono)] text-[11px] tracking-[0.12em] uppercase mb-1"
          style={{ color }}
        >
          {dateLabel}
          {isEditorial && (
            <span className="ml-2" style={{ color: '#FF3366' }}>{'\u2022'} Event</span>
          )}
        </div>

        {/* Headline */}
        <div
          className="font-semibold text-text-primary mb-1"
          style={{ fontSize: isEditorial ? 16 : 14 }}
        >
          {milestone.headline}
        </div>

        {/* Description */}
        {milestone.description && (
          <div className="text-[13px] text-text-secondary leading-relaxed">
            {milestone.description}
          </div>
        )}

        {/* Badges */}
        {milestone.badges.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {milestone.badges.map((badge, i) => (
              <span
                key={i}
                className="font-[family-name:var(--font-mono)] text-[11px] px-2 py-0.5 rounded-sm"
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  color,
                }}
              >
                {badge.label} {badge.change}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
