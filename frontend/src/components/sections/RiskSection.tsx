import { VolatilityChart } from '../charts/VolatilityChart';
import { DistributionChart } from '../charts/DistributionChart';
import { useOilPrices } from '../../hooks/useOilPrices';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import type { SimulationBands } from '../../types';

interface RiskSectionProps {
  simulationResult: SimulationBands | null;
}

export function RiskSection({ simulationResult }: RiskSectionProps) {
  const { data: wtiData, isLoading: wtiLoading } = useOilPrices('wti');
  const ref = useScrollReveal();

  return (
    <section className="py-24 scroll-reveal" ref={ref as any}>
      <div className="section-reading">
        <div className="mb-8">
          <span className="section-number">03 / Risk</span>
          <h2 className="editorial-header">Risk Profile</h2>
          <p className="editorial-subhead">Volatility analysis and price distribution</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <VolatilityChart wtiData={wtiData} isLoading={wtiLoading} />
            <p className="figure-caption">Annualized realized volatility across different lookback windows</p>
          </div>
          <div>
            <DistributionChart simulationResult={simulationResult} />
            <p className="figure-caption">Simulated end-of-horizon price distribution with VaR and CVaR risk measures</p>
          </div>
        </div>
      </div>
    </section>
  );
}
