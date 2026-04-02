import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditorialLayout } from './components/layout/EditorialLayout';
import { HeroSection } from './components/hero/HeroSection';
import { ForecastSection } from './components/sections/ForecastSection';
import { StatsBand } from './components/sections/StatsBand';
import { RiskSection } from './components/sections/RiskSection';
import { DownstreamSection } from './components/sections/DownstreamSection';
import { SupplyChainSection } from './components/sections/SupplyChainSection';
import { CommodityDetailPanel } from './components/supply-chain/CommodityDetailPanel';
import { DataTable } from './components/data-table/DataTable';
import { CollapsibleSection } from './components/ui/collapsible-section';
import { EventManager } from './components/events/EventManager';
import { SetupScreen } from './components/setup/SetupScreen';
import { KitchenTableTicker } from './components/layout/KitchenTableTicker';
import { useSimulation } from './hooks/useSimulation';
import { checkSetup } from './lib/api';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Dashboard crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#FF3366', background: '#04060C', minHeight: '100vh', fontFamily: "'IBM Plex Mono', monospace" }}>
          <h1 style={{ color: '#E8ECF4', marginBottom: 16, fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: '0.08em' }}>DASHBOARD ERROR</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#FF3366' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#4A5568', marginTop: 16 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: '8px 16px', background: '#00F0FF', color: '#04060C', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.05em' }}>
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

function DashboardApp() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [eventManagerOpen, setEventManagerOpen] = useState(false);

  useEffect(() => {
    checkSetup()
      .then((res) => setConfigured(res.configured))
      .catch(() => setConfigured(false));
  }, []);

  if (configured === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-accent animate-pulse font-[family-name:var(--font-mono)] text-sm tracking-widest uppercase">
          Initializing...
        </div>
      </div>
    );
  }

  if (!configured) {
    return <SetupScreen onComplete={() => setConfigured(true)} />;
  }

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
      <HeroSection onOpenEventManager={() => setEventManagerOpen(true)} />

      {/* Section 2: Forecast — chart + scenarios + sim controls */}
      <ForecastSection
        simulationResult={sim.data}
        isSimulating={sim.isPending}
        onRunSimulation={sim.reRun}
      />

      {/* Section 3: Thin stats band */}
      <StatsBand simulationResult={sim.data} />

      {/* Section 4: Risk — vol + distribution side-by-side */}
      <RiskSection simulationResult={sim.data} />

      {/* Section 5: Supply Chain Flow — animated downstream visualization */}
      <SupplyChainSection />

      {/* Section 6: Downstream correlations — editorial grid */}
      <DownstreamSection />

      {/* Section 7: Raw data — collapsible, narrow */}
      <div className="section-reading py-8 pb-24">
        <CollapsibleSection title="Raw Data" defaultOpen={false}>
          <DataTable />
        </CollapsibleSection>
      </div>

      {/* Footer spacer */}
      <div className="h-16" />

      {/* Event manager dialog */}
      <EventManager open={eventManagerOpen} onOpenChange={setEventManagerOpen} />

      {/* Commodity detail slide-out (must be at app level for fixed positioning) */}
      <CommodityDetailPanel />
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
