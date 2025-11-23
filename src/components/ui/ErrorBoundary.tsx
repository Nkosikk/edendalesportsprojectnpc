import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('App crashed:', error, info);
    // Also log to localStorage for debugging
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.toString(),
      stack: error.stack,
      componentStack: info.componentStack,
      url: window.location.href
    };
    localStorage.setItem('lastError', JSON.stringify(errorLog));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full border rounded-lg p-6 bg-white">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">An unexpected error occurred. Try reloading the page. If the problem persists, check the browser console for details.</p>
            {this.state.error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm text-gray-500">Error Details</summary>
                <pre className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded bg-primary-600 text-white"
                onClick={() => window.location.reload()}
              >Reload</button>
              <button
                className="px-4 py-2 rounded border border-gray-300 text-gray-700"
                onClick={() => window.location.href = '/app/bookings'}
              >Back to Bookings</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
