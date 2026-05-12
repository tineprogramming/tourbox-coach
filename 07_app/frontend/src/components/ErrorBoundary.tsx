import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches uncaught errors anywhere in the React tree below it. Without
 * this, an unhandled error would unmount the entire App and the user would
 * see a blank canvas with no UI — which is what we hit when Compare-all
 * misbehaves. With it, the user sees a clear message + can reload. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[ErrorBoundary] caught:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const err = this.state.error;
    return (
      <div
        role="alert"
        style={{
          maxWidth: 720,
          margin: "60px auto",
          padding: 24,
          background: "rgba(220, 80, 80, 0.08)",
          border: "1px solid rgba(220, 80, 80, 0.35)",
          borderRadius: 10,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#222",
        }}
      >
        <h2 style={{ marginTop: 0 }}>⚠️ TourBox Coach hit an error</h2>
        <p>
          The React tree crashed but your canvas is safe (persisted to{" "}
          <code>localStorage</code>). Try reloading.
        </p>
        <pre
          style={{
            background: "rgba(0, 0, 0, 0.06)",
            padding: 12,
            borderRadius: 6,
            fontSize: 13,
            overflow: "auto",
            maxHeight: 240,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {err.name}: {err.message}
          {err.stack ? `\n\n${err.stack}` : ""}
        </pre>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => location.reload()}
            style={{ padding: "8px 14px", cursor: "pointer" }}
          >
            Reload page
          </button>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{ padding: "8px 14px", cursor: "pointer" }}
          >
            Dismiss + continue
          </button>
        </div>
      </div>
    );
  }
}
