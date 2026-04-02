import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSimulation } from '../lib/api';
import { useDashboardStore } from '../stores/dashboardStore';
import type { SimulationRequest, SimulationBands } from '../types';

/**
 * Auto-runs simulation on mount via useQuery (cached, no double-fire in StrictMode).
 * Also provides a manual reRun function via useMutation that updates the cache.
 */
export function useSimulation() {
  const queryClient = useQueryClient();
  const simulationParams = useDashboardStore((s) => s.simulationParams);
  const selectedSeries = useDashboardStore((s) => s.selectedSeries);

  const params: SimulationRequest = { ...simulationParams, series: selectedSeries };

  // Auto-run on mount via useQuery — cached, StrictMode-safe
  const query = useQuery<SimulationBands, Error>({
    queryKey: ['simulation', params.series, params.model, params.lookback_years, params.horizon_days, params.n_paths],
    queryFn: () => fetchSimulation(params),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
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
