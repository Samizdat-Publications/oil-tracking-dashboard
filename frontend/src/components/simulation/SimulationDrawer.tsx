import { ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { SimulationBands } from '../../types';

interface SimulationDrawerProps {
  onRunSimulation: () => void;
  isSimulating: boolean;
  simulationResult: SimulationBands | null;
}

const HORIZONS = [
  { label: '1 month', value: 21 },
  { label: '3 months', value: 63 },
  { label: '6 months', value: 126 },
  { label: '1 year', value: 252 },
];

function horizonLabel(days: number): string {
  const h = HORIZONS.find((h) => h.value === days);
  return h ? h.label : `${days}d`;
}

function lookbackLabel(years: number): string {
  return `${years}yr`;
}

export function SimulationDrawer({ onRunSimulation, isSimulating, simulationResult }: SimulationDrawerProps) {
  const isOpen = useDashboardStore((s) => s.simulationControlsOpen);
  const toggle = useDashboardStore((s) => s.toggleSimulationControls);
  const params = useDashboardStore((s) => s.simulationParams);
  const setParams = useDashboardStore((s) => s.setSimulationParams);

  const summaryText = `${params.model === 'jump_diffusion' ? 'Jump-Diffusion' : 'GBM'} | ${lookbackLabel(params.lookback_years)} | ${horizonLabel(params.horizon_days)} | ${params.n_paths.toLocaleString()} paths`;

  return (
    <div>
      <div className="signal-card rounded-lg overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors duration-200"
          onClick={toggle}
        >
          <span className="font-[family-name:var(--font-display)] text-sm tracking-[0.15em] uppercase text-text-primary">Simulation Controls</span>
          <span className="text-[11px] text-text-secondary number-display hidden sm:block">{summaryText}</span>
          <div className="flex items-center gap-2">
            <button
              className="bg-accent hover:bg-accent-hover text-background text-sm font-semibold px-4 py-1.5 transition-all font-[family-name:var(--font-mono)] tracking-wider uppercase"
              onClick={(e) => {
                e.stopPropagation();
                onRunSimulation();
              }}
              disabled={isSimulating}
            >
              {isSimulating ? 'Running...' : 'Re-run'}
            </button>
            <ChevronDown
              className="h-4 w-4 text-text-secondary transition-transform duration-300"
              style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              onClick={(e) => { e.stopPropagation(); toggle(); }}
            />
          </div>
        </div>

        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: isOpen ? '400px' : '0px' }}
        >
          <div className="border-t border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 p-5">
            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-text-secondary mb-1.5 block font-[family-name:var(--font-display)]">Model</label>
                <Select value={params.model} onValueChange={(v) => setParams({ model: v as 'gbm' | 'jump_diffusion' })}>
                  <SelectTrigger className="h-9 rounded-none bg-surface border border-border text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-accent/30 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gbm">GBM</SelectItem>
                    <SelectItem value="jump_diffusion">Jump-Diffusion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-text-secondary mb-1.5 block font-[family-name:var(--font-display)]">Lookback</label>
                <Select
                  value={String(params.lookback_years)}
                  onValueChange={(v) => setParams({ lookback_years: Number(v) })}
                >
                  <SelectTrigger className="h-9 rounded-none bg-surface border border-border text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-accent/30 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 year</SelectItem>
                    <SelectItem value="2">2 years</SelectItem>
                    <SelectItem value="5">5 years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-text-secondary mb-1.5 block font-[family-name:var(--font-display)]">Horizon</label>
                <Select
                  value={String(params.horizon_days)}
                  onValueChange={(v) => setParams({ horizon_days: Number(v) })}
                >
                  <SelectTrigger className="h-9 rounded-none bg-surface border border-border text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-accent/30 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORIZONS.map((h) => (
                      <SelectItem key={h.value} value={String(h.value)}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-text-secondary mb-1.5 block font-[family-name:var(--font-display)]">
                  Paths: {params.n_paths.toLocaleString()}
                </label>
                <Slider
                  value={[params.n_paths]}
                  onValueChange={(v) => setParams({ n_paths: v[0] })}
                  min={1000}
                  max={50000}
                  step={1000}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-text-secondary mb-1.5 block font-[family-name:var(--font-display)]">Seed (optional)</label>
                <input
                  type="number"
                  className="h-9 rounded-none bg-surface border border-border text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-accent/30 w-full font-[family-name:var(--font-mono)]"
                  placeholder="Random"
                  value={params.seed ?? ''}
                  onChange={(e) => setParams({ seed: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-text-secondary mb-1.5 block font-[family-name:var(--font-display)]">Mu override</label>
                <input
                  type="number"
                  step="0.01"
                  className="h-9 rounded-none bg-surface border border-border text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-accent/30 w-full font-[family-name:var(--font-mono)]"
                  placeholder="Auto"
                  value={params.mu_override ?? ''}
                  onChange={(e) => setParams({ mu_override: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.15em] text-text-secondary mb-1.5 block font-[family-name:var(--font-display)]">Sigma override</label>
                <input
                  type="number"
                  step="0.01"
                  className="h-9 rounded-none bg-surface border border-border text-text-primary text-sm px-3 focus:outline-none focus:ring-1 focus:ring-accent/30 w-full font-[family-name:var(--font-mono)]"
                  placeholder="Auto"
                  value={params.sigma_override ?? ''}
                  onChange={(e) => setParams({ sigma_override: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <button
                className="w-full h-11 bg-accent hover:bg-accent-hover text-background text-sm font-bold transition-all disabled:opacity-50 font-[family-name:var(--font-mono)] tracking-wider uppercase"
                onClick={onRunSimulation}
                disabled={isSimulating}
              >
                {isSimulating ? 'Simulating...' : 'Run Simulation'}
              </button>

              {simulationResult?.params && (
                <div className="mt-3 text-[11px] text-text-secondary number-display space-y-1">
                  <div>Drift (\u03BC): {simulationResult.params.mu.toFixed(4)}</div>
                  <div>Volatility (\u03C3): {simulationResult.params.sigma.toFixed(4)}</div>
                  {simulationResult.params.lambda_jump != null && (
                    <div>Jump intensity (\u03BB): {simulationResult.params.lambda_jump.toFixed(4)}</div>
                  )}
                  {simulationResult.params.mu_jump != null && (
                    <div>Jump mean: {simulationResult.params.mu_jump.toFixed(4)}</div>
                  )}
                  {simulationResult.params.sigma_jump != null && (
                    <div>Jump vol: {simulationResult.params.sigma_jump.toFixed(4)}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
