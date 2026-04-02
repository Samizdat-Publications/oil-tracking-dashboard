import { useEvents } from '../../hooks/useEvents';
import { EVENT_CATEGORY_COLORS } from '../../lib/constants';
import { formatDate } from '../../lib/utils';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import type { GeoEvent } from '../../types';

export function TimelineSection() {
  const { events, toggleEvent } = useEvents();
  const ref = useScrollReveal();

  return (
    <section className="band-darker py-12 scroll-reveal" ref={ref as any}>
      <div className="section-wide">
        <div className="mb-6">
          <h2 className="editorial-header">How We Got Here</h2>
          <p className="editorial-subhead">Major geopolitical events that shaped oil markets</p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {events.map((event: GeoEvent) => {
            const color = EVENT_CATEGORY_COLORS[event.category] || '#4A5568';
            return (
              <button
                key={event.id}
                onClick={() => toggleEvent(event.id)}
                className={`group flex-shrink-0 text-left transition-all duration-300 cursor-pointer ${
                  event.visible ? 'opacity-100' : 'opacity-25 hover:opacity-50'
                }`}
                style={{ minWidth: '180px', maxWidth: '220px' }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: color,
                      boxShadow: event.visible ? `0 0 8px ${color}50` : 'none',
                    }}
                  />
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-text-secondary">
                    {formatDate(event.date)}
                  </span>
                </div>
                <div className="text-xs font-semibold text-text-primary mb-1 leading-snug">
                  {event.label}
                </div>
                <div className="text-[10px] text-text-secondary leading-relaxed line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {event.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
