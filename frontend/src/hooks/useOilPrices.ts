import { useQuery } from '@tanstack/react-query';
import { fetchPrices, fetchSummary, fetchDownstream } from '../lib/api';
import type { PriceSeries, PriceSummary, DownstreamData } from '../types';

export function useOilPrices(series: string, start?: string, end?: string) {
  return useQuery<PriceSeries>({
    queryKey: ['prices', series, start, end],
    queryFn: () => fetchPrices(series, start, end),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function usePriceSummary() {
  return useQuery<PriceSummary>({
    queryKey: ['summary'],
    queryFn: fetchSummary,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useDownstream() {
  return useQuery<DownstreamData>({
    queryKey: ['downstream'],
    queryFn: fetchDownstream,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

export function useOilSparkline(series: string = 'wti') {
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const startStr = start.toISOString().split('T')[0];

  return useQuery<PriceSeries>({
    queryKey: ['sparkline', series, startStr],
    queryFn: () => fetchPrices(series, startStr),
    staleTime: 30 * 60 * 1000, // 30 min — sparkline doesn't need to be super fresh
    retry: 1,
  });
}
