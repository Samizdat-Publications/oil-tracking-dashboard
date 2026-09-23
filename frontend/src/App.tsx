import { Component, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Page crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#CC2936', background: '#04060C', minHeight: '100vh', fontFamily: 'ui-monospace, monospace' }}>
          <h1 style={{ color: '#E8ECF4', marginBottom: 16, fontFamily: 'Georgia, serif', fontSize: 36 }}>Something broke</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: '#CC2936' }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#4A5568', marginTop: 16 }}>{this.state.error.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 20, padding: '8px 16px', background: '#D4A012', color: '#04060C', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em' }}>
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** The page module is chosen and loaded in main.tsx; this only adds the boundary. */
export default function App({ page: Page }: { page: ComponentType }) {
  return (
    <ErrorBoundary>
      <Page />
    </ErrorBoundary>
  );
}
