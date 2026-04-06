import { useDashboardStore } from '../../stores/dashboardStore';
import { COMMODITY_CATEGORIES } from '../../lib/commodity-data';

export interface DownstreamItemData {
  seriesKey: string;
  displayName: string;
  icon: string;
  why: string;
  changePct: number | null;
  correlation: number;
  awaitingPostWar?: boolean;
}

interface BranchGridProps {
  items: DownstreamItemData[];
}

function CorrelationLabel({ r }: { r: number }) {
  const abs = Math.abs(r);
  if (abs > 0.7) return <span className="text-green">r={r.toFixed(2)}</span>;
  if (abs > 0.4) return <span className="text-accent">r={r.toFixed(2)}</span>;
  return <span className="text-text-secondary">r={r.toFixed(2)}</span>;
}

export function BranchGrid({ items }: BranchGridProps) {
  const openPanel = useDashboardStore((s) => s.openCommodityPanel);

  const itemMap = new Map(items.map((it) => [it.seriesKey, it]));

  return (
    <div className="relative">
      {/* Horizontal connector */}
      <div
        className="absolute top-0 h-[1px]"
        style={{
          left: 'calc(16.67%)',
          right: 'calc(16.67%)',
          background: 'linear-gradient(90deg, rgba(0,240,255,0.05), rgba(212,160,18,0.15), rgba(0,240,255,0.05))',
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COMMODITY_CATEGORIES.map((cat) => (
          <div key={cat.key} className="relative pt-6">
            {/* Vertical stub from horizontal line */}
            <div className="absolute top-0 left-1/2 w-[1px] h-6 bg-border-hover hidden md:block" />

            {/* Category header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
              <span className="text-lg">{cat.icon}</span>
              <span className="font-[family-name:var(--font-mono)] text-[10px] tracking-[0.12em] uppercase text-accent">
                {cat.name}
              </span>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-1.5">
              {cat.series.map((seriesKey) => {
                const item = itemMap.get(seriesKey);
                if (!item) return null;
                return (
                  <button
                    key={seriesKey}
                    onClick={() => openPanel(seriesKey)}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-md bg-card-solid border border-border text-left transition-all duration-200 hover:border-border-hover hover:bg-[#0E1528] hover:translate-x-1 relative overflow-hidden"
                  >
                    {/* Left accent on hover */}
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-transparent transition-all duration-200 group-hover:bg-accent group-hover:shadow-[0_0_8px_rgba(0,240,255,0.3)]" />

                    <span className="text-[22px] shrink-0">{item.icon}</span>

                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-text-primary">{item.displayName}</div>
                      <div className="text-[10px] text-text-secondary truncate">{item.why}</div>
                    </div>

                    <div className="text-right shrink-0">
                      {item.awaitingPostWar ? (
                        <div className="font-[family-name:var(--font-mono)] text-[9px] text-text-secondary italic">
                          Awaiting data
                        </div>
                      ) : item.changePct !== null ? (
                        <div className={`font-[family-name:var(--font-mono)] text-sm font-bold ${item.changePct >= 0 ? 'text-red' : 'text-green'}`}>
                          {item.changePct >= 0 ? '\u2191' : '\u2193'} {Math.abs(item.changePct).toFixed(1)}%
                        </div>
                      ) : null}
                      <div className="font-[family-name:var(--font-mono)] text-[9px] text-text-secondary mt-0.5">
                        <CorrelationLabel r={item.correlation} />
                      </div>
                    </div>

                    {/* Arrow */}
                    <span className="text-sm text-accent/40 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
                      {'\u203A'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
