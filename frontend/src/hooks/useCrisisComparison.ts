import { useQuery } from '@tanstack/react-query';
import { fetchCrisisComparison } from '../lib/api';
import type { CrisisComparisonResponse } from '../types';

export function useCrisisComparison() {
  return useQuery<CrisisComparisonResponse>({
    queryKey: ['crisis', 'comparison'],
    queryFn: fetchCrisisComparison,
    staleTime: 30 * 60 * 1000, // 30 min — historical data rarely changes
    retry: 2,
  });
}
