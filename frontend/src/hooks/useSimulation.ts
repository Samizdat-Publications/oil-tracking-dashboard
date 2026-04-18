import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSimulation } from '../lib/api';
import { useDashboardStore } from '../stores/dashboardStore';
import type { SimulationRequest, SimulationBands } from '../types';

/**
 * Auto-runs simulation (cached, StrictMode-safe) once `enabled` is true.
 *
 * Pass `enabled=false` to defer the Monte Carlo until the user scrolls the
 * Forecast section into view — this keeps the CPU-heavy POST off the
 * critical-path window where hero/ticker are fetching.
 */
export function useSimulation(enabled: boolean = true) {
  const queryClient = useQueryClient();
  const simulationParams = useDashboardStore((s) => s.simulationParams);
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);

  const params: SimulationRequest = { ...simulationParams, series: selectedSeries };

  const query = useQuery<SimulationBands, Error>({
    queryKey: ['simulation', params.series, params.model, params.lookback_years, params.horizon_days, params.n_paths],
    queryFn: () => fetchSimulation(params),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    enabled,
  });

  // Manual re-run that updates the query cache
  const mutation = useMutation<SimulationBands, Error, SimulationRequest>({
    mutationFn: fetchSimulation,
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['simulation', params.series, params.model, params.lookback_years, params.horizon_days, params.n_paths],
        data,
      );
    },
  });

  return {
    data: mutation.data ?? query.data ?? null,
    isPending: query.isLoading && !query.data,
    isRefreshing: mutation.isPending,
    reRun: () => mutation.mutate(params),
  };
}
