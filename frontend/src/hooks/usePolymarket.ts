import { useQuery } from '@tanstack/react-query';
import { fetchPolymarketSummary } from '../lib/api';
import type { PolymarketWarEconomy } from '../types';

export function usePolymarketSummary() {
  return useQuery<PolymarketWarEconomy>({
    queryKey: ['polymarket', 'summary'],
    queryFn: fetchPolymarketSummary,
    staleTime: 5 * 60 * 1000, // 5 min — prediction markets move faster
    retry: 2,
  });
}
