import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log for debugging; in production this could be sent to a logging service
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full bg-card border border-border/40 rounded-2xl p-6 sm:p-8 shadow-lg text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">
            예상치 못한 오류가 발생했습니다
          </h1>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            일시적인 문제일 수 있습니다. 다시 시도하거나 페이지를 새로고침해 주세요.
          </p>
          {this.state.error?.message && (
            <details className="text-left mb-5 bg-muted/40 rounded-lg p-3">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">
                오류 상세
              </summary>
              <pre className="mt-2 text-[11px] text-muted-foreground/80 whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              다시 시도
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              새로고침
            </button>
          </div>
        </div>
      </div>
    );
  }
}