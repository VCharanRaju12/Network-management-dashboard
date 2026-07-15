import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In a real deployment this is where you'd forward to an error-tracking
    // service (Sentry, etc.) — logging to console is the honest baseline
    // for a project at this scale.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-offline/10 border border-offline/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={20} className="text-offline" strokeWidth={1.5} />
            </div>
            <h1 className="text-base font-semibold mb-2">Something went wrong</h1>
            <p className="text-sm text-muted mb-6">
              This part of the dashboard hit an unexpected error. Reloading usually fixes it — your
              data and login session are unaffected.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-semibold bg-signal text-base rounded-lg hover:bg-signal/90 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
