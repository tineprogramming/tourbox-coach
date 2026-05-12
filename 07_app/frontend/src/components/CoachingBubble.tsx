import { useWsStore } from "../state/wsStore";

const SOURCE_ICON: Record<string, string> = {
  local: "🔒",
  deepseek: "☁️",
  "qwen-plus": "☁️",
  kimi: "☁️",
  minimax: "☁️",
};

const SOURCE_LABEL: Record<string, string> = {
  local: "Local",
  deepseek: "DeepSeek",
  "qwen-plus": "Qwen+",
  kimi: "Kimi",
  minimax: "MiniMax",
};

export function CoachingBubble() {
  const streaming = useWsStore((s) => s.streaming);
  const lastFeedback = useWsStore((s) => s.lastFeedback);
  const metrics = useWsStore((s) => s.lastMetrics);

  // Prefer streaming while in flight; otherwise show last finalized.
  const display = streaming ?? lastFeedback;

  if (!display && !metrics) return null;

  return (
    <div className="coaching-bubble" role="status" aria-live="polite">
      {display && (
        <div className={`coach-text ${display.errored ? "errored" : ""}`}>
          <span className="coach-icon">{SOURCE_ICON[display.source] ?? "🤖"}</span>
          <span className="coach-body">
            {display.text}
            {streaming && <span className="coach-caret">▍</span>}
          </span>
          {display.finalizedAt && (
            <span className="coach-source">
              {SOURCE_LABEL[display.source] ?? display.source}
            </span>
          )}
        </div>
      )}
      {metrics && (
        <div className="coach-metrics">
          {metrics.confidence !== undefined && (
            <Metric label="Confidence" value={metrics.confidence} format="pct" />
          )}
          {metrics.smoothness !== undefined && (
            <Metric label="Smoothness" value={metrics.smoothness} format="pct" />
          )}
          {metrics.pressureConsistency !== undefined && (
            <Metric label="Pressure" value={metrics.pressureConsistency} format="pct" />
          )}
          {metrics.avgSpeed !== undefined && (
            <Metric label="Speed" value={metrics.avgSpeed} format="px/s" />
          )}
          {metrics.hesitations !== undefined && metrics.hesitations > 0 && (
            <Metric label="Hesitations" value={metrics.hesitations} format="int" />
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format: "pct" | "px/s" | "int";
}) {
  let display: string;
  if (format === "pct") display = `${Math.round(value * 100)}%`;
  else if (format === "px/s") display = `${value.toFixed(0)} px/s`;
  else display = `${value}`;
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{display}</span>
    </div>
  );
}
