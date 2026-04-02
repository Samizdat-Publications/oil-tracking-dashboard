import { Fuel, Settings } from 'lucide-react';
import { useDashboardStore, type DateRangePreset } from '../../stores/dashboardStore';

const DATE_RANGES: DateRangePreset[] = ['1M', '3M', '6M', '1Y', '2Y', '5Y', 'ALL'];

interface HeaderProps {
  onOpenEventManager: () => void;
}

export function Header({ onOpenEventManager }: HeaderProps) {
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);
  const setSelectedSeries = useDashboardStore((s) => s.setSelectedSeries);
  const dateRangePreset = useDashboardStore((s) => s.dateRangePreset);
  const setDateRange = useDashboardStore((s) => s.setDateRange);

  return (
    <header className="animate-fade-in flex items-center justify-between py-3 sticky top-0 z-30 bg-background/80 backdrop-blur-md -mx-6 sm:-mx-8 lg:-mx-12 px-6 sm:px-8 lg:px-12 border-b border-border">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Fuel className="h-7 w-7 text-accent" />
          <div className="absolute inset-0 blur-lg bg-accent-glow rounded-full" />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-text-primary tracking-[0.08em] uppercase">
            Crude Oil Analytics
          </h1>
          <p className="text-[10px] text-text-secondary tracking-widest uppercase font-[family-name:var(--font-mono)]">
            Real-time pricing & Monte Carlo simulation
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Series toggle */}
        <div className="flex items-center gap-0 border border-border rounded-none overflow-hidden">
          <button
            onClick={() => setSelectedSeries('wti')}
            className={`px-4 py-1.5 text-xs font-medium transition-all duration-200 font-[family-name:var(--font-mono)] ${
              selectedSeries === 'wti'
                ? 'bg-accent text-background'
                : 'text-text-secondary hover:text-text-primary bg-transparent'
            }`}
          >
            WTI
          </button>
          <button
            onClick={() => setSelectedSeries('brent')}
            className={`px-4 py-1.5 text-xs font-medium transition-all duration-200 font-[family-name:var(--font-mono)] ${
              selectedSeries === 'brent'
                ? 'bg-accent text-background'
                : 'text-text-secondary hover:text-text-primary bg-transparent'
            }`}
          >
            BRENT
          </button>
        </div>

        {/* Date range pills */}
        <div className="flex items-center gap-0 border border-border rounded-none overflow-hidden">
          {DATE_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200 font-[family-name:var(--font-mono)] ${
                dateRangePreset === range
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <button
          onClick={onOpenEventManager}
          className="p-2 text-text-secondary hover:text-accent hover:bg-surface transition-all duration-200"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
