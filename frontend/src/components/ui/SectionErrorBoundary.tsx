import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Per-section error boundary. If a section throws during render,
 * only that section shows a fallback — the rest of the dashboard stays up.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] Section render error:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="py-12">
          <div className="section-reading">
            <div className="rounded-lg border border-red/20 bg-red/5 px-6 py-8 text-center">
              <p className="font-[family-name:var(--font-mono)] text-sm tracking-widest uppercase text-red mb-2">
                {this.props.name}
              </p>
              <p className="text-sm text-text-secondary mb-4">
                This section encountered an error and couldn&apos;t render.
              </p>
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-1.5 text-sm font-[family-name:var(--font-mono)] tracking-wider uppercase rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </section>
      );
    }
    return this.props.children;
  }
}
