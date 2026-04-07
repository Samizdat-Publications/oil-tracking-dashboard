import { useState } from 'react';
import { Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { SimulationBands } from '../../types';

interface SimulationControlsProps {
  onRunSimulation: () => void;
  isSimulating: boolean;
  simulationResult: SimulationBands | null;
}

export function SimulationControls({ onRunSimulation, isSimulating, simulationResult }: SimulationControlsProps) {
  const simulationParams = useDashboardStore((s) => s.simulationParams);
  const setSimulationParams = useDashboardStore((s) => s.setSimulationParams);

  const [seed, setSeed] = useState('');
  const [muOverride, setMuOverride] = useState('');
  const [sigmaOverride, setSigmaOverride] = useState('');

  const handleRun = () => {
    const updates: Record<string, unknown> = {};
    if (seed) updates.seed = parseInt(seed);
    if (muOverride) updates.mu_override = parseFloat(muOverride);
    if (sigmaOverride) updates.sigma_override = parseFloat(sigmaOverride);
    if (Object.keys(updates).length > 0) {
      setSimulationParams(updates);
    }
    onRunSimulation();
  };

  return (
    <Card className="w-[320px] shrink-0">
      <CardHeader>
        <CardTitle>Simulation Controls</CardTitle>
        <CardDescription>Configure Monte Carlo parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Model */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Model</label>
          <Select
            value={simulationParams.model}
            onValueChange={(v) => setSimulationParams({ model: v as 'gbm' | 'jump_diffusion' })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gbm">Geometric Brownian Motion</SelectItem>
              <SelectItem value="jump_diffusion">Jump-Diffusion (Merton)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lookback */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Lookback Window</label>
          <Select
            value={String(simulationParams.lookback_years)}
            onValueChange={(v) => setSimulationParams({ lookback_years: parseInt(v) })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Year</SelectItem>
              <SelectItem value="2">2 Years</SelectItem>
              <SelectItem value="5">5 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Horizon */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Forecast Horizon</label>
          <Select
            value={String(simulationParams.horizon_days)}
            onValueChange={(v) => setSimulationParams({ horizon_days: parseInt(v) })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="21">1 Month (21d)</SelectItem>
              <SelectItem value="63">3 Months (63d)</SelectItem>
              <SelectItem value="126">6 Months (126d)</SelectItem>
              <SelectItem value="252">1 Year (252d)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Simulation Paths */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">Simulation Paths</label>
            <span className="text-sm font-mono text-accent">{simulationParams.n_paths.toLocaleString()}</span>
          </div>
          <Slider
            value={[simulationParams.n_paths]}
            onValueChange={([v]) => setSimulationParams({ n_paths: v })}
            min={1000}
            max={50000}
            step={1000}
          />
          <div className="flex justify-between text-[11px] text-text-secondary">
            <span>1,000</span>
            <span>50,000</span>
          </div>
        </div>

        {/* Optional: Seed */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Random Seed (optional)</label>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="e.g. 42"
            className="flex h-8 w-full rounded-lg border border-border bg-surface px-3 py-1 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Optional: Mu override */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Mu Override (optional)</label>
          <input
            type="number"
            step="0.01"
            value={muOverride}
            onChange={(e) => setMuOverride(e.target.value)}
            placeholder="Annual drift"
            className="flex h-8 w-full rounded-lg border border-border bg-surface px-3 py-1 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Optional: Sigma override */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-text-secondary">Sigma Override (optional)</label>
          <input
            type="number"
            step="0.01"
            value={sigmaOverride}
            onChange={(e) => setSigmaOverride(e.target.value)}
            placeholder="Annual volatility"
            className="flex h-8 w-full rounded-lg border border-border bg-surface px-3 py-1 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Run Button */}
        <Button className="w-full" onClick={handleRun} disabled={isSimulating}>
          <Play className="h-4 w-4 mr-2" />
          {isSimulating ? 'Running...' : 'Run Simulation'}
        </Button>

        {/* Estimated Params */}
        {simulationResult?.params && (
          <div className="mt-3 rounded-lg bg-surface p-3 space-y-1">
            <p className="text-sm font-semibold text-text-primary mb-2">Estimated Parameters</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-text-secondary">Mu (drift):</span>
              <span className="font-mono text-text-primary">{simulationResult.params.mu.toFixed(4)}</span>
              <span className="text-text-secondary">Sigma (vol):</span>
              <span className="font-mono text-text-primary">{simulationResult.params.sigma.toFixed(4)}</span>
              {(simulationResult.params.lambda_jump ?? 0) > 0 && (
                <>
                  <span className="text-text-secondary">Jump freq:</span>
                  <span className="font-mono text-text-primary">{(simulationResult.params.lambda_jump ?? 0).toFixed(4)}</span>
                  <span className="text-text-secondary">Jump mean:</span>
                  <span className="font-mono text-text-primary">{(simulationResult.params.mu_jump ?? 0).toFixed(4)}</span>
                  <span className="text-text-secondary">Jump vol:</span>
                  <span className="font-mono text-text-primary">{(simulationResult.params.sigma_jump ?? 0).toFixed(4)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
