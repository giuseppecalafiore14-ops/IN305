import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions anywhere below it and shows a diagnostic
 * screen instead of leaving the page blank. React error boundaries must be
 * class components — there is no hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="font-display text-4xl tracking-tightest text-ink-900 mb-2">IN305</div>
          <h1 className="font-display text-2xl text-ink-900 tracking-tight mb-3">APPLICATION ERROR</h1>
          <p className="text-ink-500 mb-6">
            {import.meta.env.DEV
              ? 'Something crashed while rendering the app. Details below.'
              : 'Something went wrong. Please refresh the page.'}
          </p>

          {import.meta.env.DEV && (
            <div className="text-left bg-error-50 border border-error-200 text-error-700 text-xs rounded-lg px-4 py-3 mb-6 overflow-auto max-h-64">
              <pre className="whitespace-pre-wrap">{error.stack || error.message}</pre>
            </div>
          )}

          <button onClick={() => window.location.reload()} className="btn-primary">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
