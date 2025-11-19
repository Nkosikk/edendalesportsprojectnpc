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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full border rounded-lg p-6 bg-white">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">An unexpected error occurred. Try reloading the page. If the problem persists, check the browser console for details.</p>
            <button
              className="px-4 py-2 rounded bg-primary-600 text-white"
              onClick={() => window.location.reload()}
            >Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
