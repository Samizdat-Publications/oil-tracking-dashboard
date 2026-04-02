import { useQuery } from '@tanstack/react-query';
import { fetchPolymarketMarkets, fetchPolymarketSummary } from '../lib/api';
import type { PolymarketMarket, PolymarketSummary } from '../types';

export function usePolymarketMarkets() {
  return useQuery<{ markets: PolymarketMarket[]; updated_at: string }>({
    queryKey: ['polymarket', 'markets'],
    queryFn: fetchPolymarketMarkets,
    staleTime: 5 * 60 * 1000, // 5 min — prediction markets move faster
    retry: 2,
  });
}

export function usePolymarketSummary() {
  return useQuery<PolymarketSummary>({
    queryKey: ['polymarket', 'summary'],
    queryFn: fetchPolymarketSummary,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
