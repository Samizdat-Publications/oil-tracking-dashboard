import { useMemo } from 'react';
import { useDownstream } from '../../hooks/useOilPrices';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import {
  COMMODITY_DATA,
  IRAN_WAR_DATE,
  alignSeries,
  computeCorrelation,
  getValueBeforeDate,
} from '../../lib/commodity-data';
import { OilSourceNode } from '../supply-chain/OilSourceNode';
import { FlowConnector } from '../supply-chain/FlowConnector';
import { BranchGrid } from '../supply-chain/BranchGrid';
import type { DownstreamItemData } from '../supply-chain/BranchGrid';

export function SupplyChainSection() {
  const { data: downstream, isLoading } = useDownstream();
  const ref = useScrollReveal();

  const items: DownstreamItemData[] = useMemo(() => {
    if (!downstream?.oil?.observations?.length || !downstream?.series?.length) return [];

    return Object.entries(COMMODITY_DATA).map(([key, info]) => {
      const ds = downstream.series.find((s) => s.name === info.displayName);
      if (!ds || !ds.observations.length) return null;

      const aligned = alignSeries(downstream.oil, ds);
      const corr = computeCorrelation(aligned.oilValues, aligned.dsValues);
      const warBaseline = getValueBeforeDate(ds, IRAN_WAR_DATE);
      const latestVal = ds.observations.at(-1)?.value ?? null;
      const changePct = warBaseline && latestVal ? ((latestVal - warBaseline) / warBaseline) * 100 : null;

      return {
        seriesKey: key,
        displayName: info.displayName,
        icon: info.icon,
        why: info.why,
        changePct,
        correlation: corr,
      } satisfies DownstreamItemData;
    }).filter((x): x is DownstreamItemData => x !== null);
  }, [downstream]);

  if (isLoading) {
    return (
      <section className="py-16 scroll-reveal" ref={ref as any}>
        <div className="section-wide">
          <h2 className="editorial-header">The Supply Chain</h2>
          <p className="editorial-subhead mb-4">Loading supply chain data...</p>
          {/* Skeleton matching the flow layout */}
          <div className="rounded-[10px] border border-border h-24 bg-surface animate-pulse mb-4" />
          <div className="h-[60px]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-6 bg-surface animate-pulse rounded w-32" />
                <div className="h-14 bg-surface animate-pulse rounded" />
                <div className="h-14 bg-surface animate-pulse rounded" />
                <div className="h-14 bg-surface animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!items.length || !downstream?.oil) return null;

  return (
    <section className="py-16 scroll-reveal" ref={ref as any}>
      <div className="section-wide">
        <div className="mb-8">
          <h2 className="editorial-header">The Supply Chain</h2>
          <p className="editorial-subhead mb-4">Follow the money from the oil barrel to your kitchen table. Click any item to explore.</p>
          <div className="section-rule" />
        </div>

        <OilSourceNode oilData={downstream.oil} />
        <FlowConnector />
        <BranchGrid items={items} />
      </div>
    </section>
  );
}
