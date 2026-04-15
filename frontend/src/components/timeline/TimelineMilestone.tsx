import { useEffect, useRef } from 'react';
import type { Milestone } from '../../types';

interface TimelineMilestoneProps {
  milestone: Milestone;
  index: number;
  side: 'left' | 'right' | 'full';
}

const DOT_COLORS: Record<string, string> = {
  editorial: '#CC2936',
  data: '#00F0FF',
  today: '#5DB075',
};

const STAMP_LABELS: Record<string, string> = {
  editorial: 'DISPATCH',
  data: 'SIGNAL',
  today: 'SITREP',
};

export function TimelineMilestone({ milestone, index, side }: TimelineMilestoneProps) {
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
  const stamp = STAMP_LABELS[milestone.type] || 'SIGNAL';
  const isToday = milestone.type === 'today';
  const isEditorial = milestone.type === 'editorial';

  const dateLabel = isToday
    ? `Today \u2022 ${new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : milestone.week > 0
      ? `Week ${milestone.week} \u2022 ${new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(milestone.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const nodeSize = isToday ? 20 : isEditorial ? 18 : 14;

  const cardContent = (
    <div className={`war-room-card war-room-card--${milestone.type} p-4 relative`}>
      <div className="war-room-accent-strip" style={{ background: color }} />

      <div className="flex items-center gap-2 mb-2 mt-1 flex-wrap">
        <span className="war-room-stamp" style={{ color, borderColor: `${color}50` }}>
          {stamp}
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-text-secondary">
          {dateLabel}
        </span>
        {isToday && (
          <span className="live-indicator ml-auto">
            <span className="live-dot" />
            LIVE
          </span>
        )}
      </div>

      <h3
        className="font-[family-name:var(--font-display)] text-text-primary mb-1 leading-snug"
        style={{ fontSize: isEditorial ? 18 : 15 }}
      >
        {milestone.headline}
      </h3>

      {milestone.description && (
        <p className="text-[13px] text-text-secondary leading-relaxed mt-1">
          {milestone.description}
        </p>
      )}

      {milestone.badges.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {milestone.badges.map((badge, i) => (
            <span
              key={i}
              className="font-[family-name:var(--font-mono)] text-[11px] px-2.5 py-1 rounded-sm"
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
  );

  return (
    <div
      ref={ref}
      className={`timeline-milestone war-room-row war-room-row--${side} py-3`}
    >
      {/* Left cell — visible on desktop only (CSS handles hiding) */}
      <div className="war-room-left-cell">
        {side === 'left' ? cardContent : null}
      </div>

      {/* Node cell — spine dot + connector */}
      <div className="war-room-node-cell flex justify-center relative" style={{ paddingTop: 16 }}>
        {isToday ? (
          <div
            style={{
              width: nodeSize,
              height: nodeSize,
              borderRadius: '50%',
              border: `2px solid ${color}`,
              background: '#04060C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              '--node-color': color,
              animation: 'nodeGlow 3s ease-in-out infinite',
            } as React.CSSProperties}
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
              width: nodeSize,
              height: nodeSize,
              borderRadius: '50%',
              background: color,
              flexShrink: 0,
              '--node-color': color,
              animation: 'nodeGlow 3s ease-in-out infinite',
            } as React.CSSProperties}
          />
        )}

        {/* Horizontal connector — desktop only */}
        {side !== 'full' && (
          <div
            className="war-room-connector-line"
            style={{
              [side === 'left' ? 'right' : 'left']: '100%',
              width: 20,
              background: `linear-gradient(${side === 'left' ? '270deg' : '90deg'}, ${color}40, transparent)`,
            }}
          />
        )}
      </div>

      {/* Right cell — always visible on mobile; on desktop shown for right/full, hidden for left */}
      <div className="war-room-right-cell">
        {cardContent}
      </div>
    </div>
  );
}
