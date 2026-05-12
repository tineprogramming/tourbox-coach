import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { ErrorBlock } from "./ErrorBlock";

interface BenchmarkRow {
  id: string;
  label: string;
  category: "coach" | "vision" | "polish";
  direct_s: number | null;
  direct_error: string | null;
  proxied_s: number | null;
  proxied_error: string | null;
  delta_s: number | null;
}

interface BenchmarkResult {
  ran_at: number;
  restored_proxy_enabled: boolean;
  rows: BenchmarkRow[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BenchmarkModal({ open, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
    }
  }, [open]);

  const run = useCallback(async (e?: ReactMouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/proxy/benchmark", { method: "POST" });
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`HTTP ${r.status}: ${text || r.statusText}`);
      }
      setResult((await r.json()) as BenchmarkResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="polish-overlay" role="dialog" aria-modal="true">
      <div className="polish-modal polish-modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="polish-header">
          <h2>🔬 Proxy latency benchmark</h2>
          <button
            type="button"
            className="polish-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="polish-body">
          <p className="bench-intro">
            Pings each provider <strong>twice</strong> — once direct, once via the amazonsg Singapore proxy.
            Coach + Vision providers use a tiny chat/image probe (&lt; 0.1¢). Polish providers are too expensive
            to bench per-call, so we ping the fal.ai gateway instead.
          </p>

          <div className="bench-controls">
            <button
              type="button"
              className="polish-generate"
              onClick={run}
              disabled={busy}
            >
              {busy ? "Running benchmark…" : result ? "Re-run" : "Run benchmark"}
            </button>
            {result && (
              <span className="bench-meta">
                ran {new Date(result.ran_at * 1000).toLocaleTimeString()}
              </span>
            )}
          </div>

          {error && <ErrorBlock error={error} />}

          {result && (
            <div className="bench-table-wrap">
              <table className="bench-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th className="bench-num">Direct</th>
                    <th className="bench-num">Via 🌏 SG proxy</th>
                    <th className="bench-num">Δ</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => {
                    const direct = r.direct_s;
                    const proxied = r.proxied_s;
                    const delta = r.delta_s;
                    const verdict =
                      r.direct_error || r.proxied_error
                        ? "error"
                        : delta == null
                          ? "—"
                          : delta < -0.1
                            ? "proxy-faster"
                            : delta > 0.1
                              ? "proxy-slower"
                              : "tie";

                    return (
                      <tr key={r.id} className={`bench-row bench-${verdict}`}>
                        <td className="bench-provider">{r.label}</td>
                        <td className="bench-num">
                          {direct != null ? `${direct.toFixed(2)}s` : <span className="bench-err">ERR</span>}
                        </td>
                        <td className="bench-num">
                          {proxied != null ? `${proxied.toFixed(2)}s` : <span className="bench-err">ERR</span>}
                        </td>
                        <td className="bench-num bench-delta">
                          {delta != null
                            ? delta > 0
                              ? `+${delta.toFixed(2)}s`
                              : `${delta.toFixed(2)}s`
                            : "—"}
                        </td>
                        <td>
                          {verdict === "proxy-faster" && <span className="bench-tag bench-tag-fast">🚀 proxy faster</span>}
                          {verdict === "proxy-slower" && <span className="bench-tag bench-tag-slow">🐢 direct better</span>}
                          {verdict === "tie" && <span className="bench-tag bench-tag-tie">≈ tied</span>}
                          {verdict === "error" && <span className="bench-tag bench-tag-err">⚠ error</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="bench-legend">
                <p>
                  <strong>How to read:</strong> Δ &lt; 0 means proxy was faster (e.g. amazonsg → DeepSeek
                  path is better than Pi → DeepSeek). Δ &gt; 0 means the extra hop costs latency
                  (typical for our own cluster which is already close to the Pi).
                </p>
                {result.rows.some((r) => r.direct_error || r.proxied_error) && (
                  <details className="bench-errors" open>
                    <summary>Error details (click to expand) — all errors are copyable</summary>
                    {result.rows.map((r) =>
                      r.direct_error || r.proxied_error ? (
                        <div key={r.id} className="bench-error-row">
                          <div className="bench-error-label">{r.label}</div>
                          {r.direct_error && (
                            <ErrorBlock error={`[Direct] ${r.direct_error}`} />
                          )}
                          {r.proxied_error && (
                            <ErrorBlock error={`[Via proxy] ${r.proxied_error}`} />
                          )}
                        </div>
                      ) : null,
                    )}
                  </details>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
