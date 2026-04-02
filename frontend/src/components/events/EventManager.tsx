import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useEvents } from '../../hooks/useEvents';
import { EVENT_CATEGORY_COLORS } from '../../lib/constants';
import { formatDate } from '../../lib/utils';
import type { GeoEvent } from '../../types';

interface EventManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventManager({ open, onOpenChange }: EventManagerProps) {
  const { events, toggleEvent, addEvent, removeEvent } = useEvents();
  const [newLabel, setNewLabel] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCategory, setNewCategory] = useState<GeoEvent['category']>('custom');
  const [newDescription, setNewDescription] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim() || !newDate) return;
    const event: GeoEvent = {
      id: `custom-${Date.now()}`,
      date: newDate,
      label: newLabel.trim(),
      description: newDescription.trim() || newLabel.trim(),
      category: newCategory,
      visible: true,
    };
    addEvent(event);
    setNewLabel('');
    setNewDate('');
    setNewDescription('');
    setNewCategory('custom');
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border border-border bg-[#0A0E18] p-6 shadow-xl shadow-accent/5">
          <Dialog.Title className="font-[family-name:var(--font-display)] text-lg tracking-[0.1em] uppercase text-text-primary">
            Manage Events
          </Dialog.Title>
          <Dialog.Description className="text-sm text-text-secondary mt-1 mb-4">
            Toggle event visibility on charts or add custom events.
          </Dialog.Description>

          <div className="mb-4 bg-surface p-3 space-y-2 border border-border">
            <p className="text-xs font-semibold text-text-primary flex items-center gap-1 font-[family-name:var(--font-display)] tracking-wider uppercase">
              <Plus className="h-3 w-3" /> Add Custom Event
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Event label"
                className="col-span-2 h-8 border border-border bg-card-solid px-3 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/30 font-[family-name:var(--font-mono)]"
              />
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-8 border border-border bg-card-solid px-3 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/30"
              />
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as GeoEvent['category'])}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="war">War</SelectItem>
                  <SelectItem value="embargo">Embargo</SelectItem>
                  <SelectItem value="revolution">Revolution</SelectItem>
                  <SelectItem value="pandemic">Pandemic</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="opec">OPEC</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                className="col-span-2 h-8 border border-border bg-card-solid px-3 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent/30 font-[family-name:var(--font-mono)]"
              />
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newLabel.trim() || !newDate}>
              <Plus className="h-3 w-3 mr-1" /> Add Event
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface transition-colors"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: EVENT_CATEGORY_COLORS[event.category] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{event.label}</p>
                  <p className="text-[10px] text-text-secondary font-[family-name:var(--font-mono)]">{formatDate(event.date)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => toggleEvent(event.id)}
                >
                  {event.visible ? (
                    <Eye className="h-3 w-3 text-green" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-text-secondary" />
                  )}
                </Button>
                {event.category === 'custom' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeEvent(event.id)}
                  >
                    <Trash2 className="h-3 w-3 text-red" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 opacity-70 transition-opacity hover:opacity-100 cursor-pointer"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-text-secondary" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
