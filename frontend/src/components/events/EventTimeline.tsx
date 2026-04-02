import { useEvents } from '../../hooks/useEvents';
import { EVENT_CATEGORY_COLORS } from '../../lib/constants';
import { formatDate } from '../../lib/utils';
import type { GeoEvent } from '../../types';

export function EventTimeline() {
  const { events, toggleEvent } = useEvents();

  return (
    <div>
      <h2 className="section-title mb-3">Geopolitical Events</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {events.map((event: GeoEvent) => (
          <button
            key={event.id}
            onClick={() => toggleEvent(event.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs transition-all duration-200 cursor-pointer whitespace-nowrap border ${
              event.visible
                ? 'signal-card border-border opacity-100'
                : 'opacity-30 hover:opacity-60 border-transparent'
            }`}
          >
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: EVENT_CATEGORY_COLORS[event.category], boxShadow: event.visible ? `0 0 6px ${EVENT_CATEGORY_COLORS[event.category]}40` : 'none' }}
            />
            <span className="font-medium text-text-primary">{event.label}</span>
            <span className="text-[10px] text-text-secondary font-[family-name:var(--font-mono)]">{formatDate(event.date)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function EventCategoryLegend() {
  const categories = Object.entries(EVENT_CATEGORY_COLORS);
  return (
    <div className="flex items-center gap-3 mt-2">
      {categories.map(([cat, color]) => (
        <div key={cat} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[10px] text-text-secondary capitalize font-[family-name:var(--font-mono)]">{cat}</span>
        </div>
      ))}
    </div>
  );
}
