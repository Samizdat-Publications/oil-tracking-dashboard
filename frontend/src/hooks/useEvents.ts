import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import type { GeoEvent } from '../types';

const STORAGE_KEY = 'oil-tracker-events';

export function useEvents() {
  const events = useDashboardStore((s) => s.events);
  const toggleEvent = useDashboardStore((s) => s.toggleEvent);
  const addEvent = useDashboardStore((s) => s.addEvent);
  const removeEvent = useDashboardStore((s) => s.removeEvent);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as GeoEvent[];
        const customEvents = parsed.filter((e) => e.category === 'custom');
        customEvents.forEach((e) => {
          if (!events.find((ex) => ex.id === e.id)) {
            addEvent(e);
          }
        });
      } catch {
        // ignore parse errors
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save custom events to localStorage
  useEffect(() => {
    const custom = events.filter((e) => e.category === 'custom');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  }, [events]);

  const visibleEvents = events.filter((e) => e.visible);

  return { events, visibleEvents, toggleEvent, addEvent, removeEvent };
}
