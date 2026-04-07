import { useState, useEffect, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditorialLayout } from './components/layout/EditorialLayout';
import { HeroSection } from './components/hero/HeroSection';
import { SetupScreen } from './components/setup/SetupScreen';
import { KitchenTableTicker } from './components/layout/KitchenTableTicker';
import { SectionErrorBoundary } from './components/ui/SectionErrorBoundary';
import { useSimulation } from './hooks/useSimulation';
import { checkSetup } from './lib/api';

// Lazy-load below-fold sections — keeps initial bundle small, speeds up LCP
const ForecastSection = lazy(() => import('./components/sections/ForecastSection').then(m => ({ default: m.ForecastSection })));
const PredictionMarketsSection = lazy(() => import('./components/sections/PredictionMarketsSection').then(m => ({ default: m.PredictionMarketsSection })));
const StatsBand = lazy(() => import('./components/sections/StatsBand').then(m => ({ default: m.StatsBand })));
const RiskSection = lazy(() => import('./components/sections/RiskSection').then(m => ({ default: m.RiskSection })));
const SupplyChainSection = lazy(() => import('./components/sections/SupplyChainSection').then(m => ({ default: m.SupplyChainSection })));
const WarTimelineSection = lazy(() => import('./components/sections/WarTimelineSection').then(m => ({ default: m.WarTimelineSection })));
const CrisisComparisonSection = lazy(() => import('./components/sections/CrisisComparisonSection').then(m => ({ default: m.CrisisComparisonSection })));
const DownstreamSection = lazy(() => import('./components/sections/DownstreamSection').then(m => ({ default: m.DownstreamSection })));
const EventManager = lazy(() => import('./components/events/EventManager').then(m => ({ default: m.EventManager })));
const CommodityDetailPanel = lazy(() => import('./components/supply-chain/CommodityDetailPanel').then(m => ({ default: m.CommodityDetailPanel })));
const DataTable = lazy(() => import('./components/data-table/DataTable').then(m => ({ default: m.DataTable })));
const CollapsibleSection = lazy(() => import('./components/ui/collapsible-section').then(m => ({ default: m.CollapsibleSection })));

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Dashboard crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#CC2936', background: '#04060C', minHeight: '100vh', fontFamily: "'JetBrains Mono', monospace" }}>
          <h1 style={{ color: '#E8ECF4', marginBottom: 16, fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 36 }}>Dashboard Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#CC2936' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#4A5568', marginTop: 16 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: '8px 16px', background: '#D4A012', color: '#04060C', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

/** Thin skeleton placeholder for lazy-loaded sections */
function SectionSkeleton() {
  return <div className="py-16 flex items-center justify-center"><div className="text-text-secondary animate-pulse font-[family-name:var(--font-mono)] text-xs tracking-widest uppercase">Loading&hellip;</div></div>;
}

function DashboardApp() {
  // Optimistic: assume configured so ticker + hero render IMMEDIATELY
  const [configured, setConfigured] = useState<boolean>(true);
  const [setupChecked, setSetupChecked] = useState(false);
  const [eventManagerOpen, setEventManagerOpen] = useState(false);

  useEffect(() => {
    checkSetup()
      .then((res) => {
        setConfigured(res.configured);
        setSetupChecked(true);
      })
      .catch(() => {
        // If setup check fails, still show dashboard (API might just be slow)
        setSetupChecked(true);
      });
  }, []);

  // If setup check completed and NOT configured, show setup screen
  if (setupChecked && !configured) {
    return <SetupScreen onComplete={() => setConfigured(true)} />;
  }

  // Render dashboard immediately — don't block on setup check
  return <DashboardContent eventManagerOpen={eventManagerOpen} setEventManagerOpen={setEventManagerOpen} />;
}

interface DashboardContentProps {
  eventManagerOpen: boolean;
  setEventManagerOpen: (open: boolean) => void;
}

function DashboardContent({ eventManagerOpen, setEventManagerOpen }: DashboardContentProps) {
  const sim = useSimulation();

  return (
    <>
      {/* Sticky ticker — outside EditorialLayout for correct fixed positioning */}
      <KitchenTableTicker />

      <EditorialLayout>
      {/* Section 1: Full-viewport hero with price */}
      <SectionErrorBoundary name="Hero">
        <HeroSection onOpenEventManager={() => setEventManagerOpen(true)} />
      </SectionErrorBoundary>

      {/* Below-fold sections: lazy-loaded for faster initial paint */}
      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 2: Forecast — chart + scenarios + sim controls */}
        <SectionErrorBoundary name="Forecast">
          <ForecastSection
            simulationResult={sim.data}
            isSimulating={sim.isPending}
            onRunSimulation={sim.reRun}
          />
        </SectionErrorBoundary>
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 3: Prediction Markets — crowd odds on oil price targets */}
        <SectionErrorBoundary name="Prediction Markets">
          <PredictionMarketsSection />
        </SectionErrorBoundary>
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 4: Thin stats band */}
        <SectionErrorBoundary name="Stats Band">
          <StatsBand simulationResult={sim.data} />
        </SectionErrorBoundary>
      </Suspense>

      {/* Editorial pull quote — breaks visual monotony */}
      <div className="section-narrow py-12">
        <div className="pull-quote">
          Every dollar increase in crude oil costs American households an estimated $1.4 billion per year in higher energy and consumer goods prices.
          <span className="pull-quote-source">U.S. Energy Information Administration</span>
        </div>
      </div>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 5: Risk — vol + distribution side-by-side */}
        <SectionErrorBoundary name="Risk Analysis">
          <RiskSection simulationResult={sim.data} />
        </SectionErrorBoundary>
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 6: Supply Chain Flow — animated downstream visualization */}
        <SectionErrorBoundary name="Supply Chain">
          <SupplyChainSection />
        </SectionErrorBoundary>
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 7: War Impact Timeline — week-by-week narrative */}
        <SectionErrorBoundary name="War Timeline">
          <WarTimelineSection />
        </SectionErrorBoundary>
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 8: Historical Crisis Comparison — how bad is it vs history */}
        <SectionErrorBoundary name="Crisis Comparison">
          <CrisisComparisonSection />
        </SectionErrorBoundary>
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 9: Downstream correlations — editorial grid */}
        <SectionErrorBoundary name="Downstream Correlations">
          <DownstreamSection />
        </SectionErrorBoundary>
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        {/* Section 10: Raw Data */}
        <div className="section-reading py-8 pb-24">
          <CollapsibleSection title="Raw Data" defaultOpen={false}>
            <DataTable />
          </CollapsibleSection>
        </div>
      </Suspense>

        {/* Section 10: Raw data — collapsible, narrow */}
        <div className="section-reading py-8 pb-24">
          <CollapsibleSection title="Raw Data" defaultOpen={false}>
            <DataTable />
          </CollapsibleSection>
        </div>

      {/* Footer spacer */}
      <div className="h-16" />

      {/* Event manager dialog */}
      <Suspense fallback={null}>
        <EventManager open={eventManagerOpen} onOpenChange={setEventManagerOpen} />
      </Suspense>

      {/* Commodity detail slide-out (must be at app level for fixed positioning) */}
      <Suspense fallback={null}>
        <CommodityDetailPanel />
      </Suspense>
    </EditorialLayout>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DashboardApp />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
