import { useTelemetryStore } from "../state/telemetry";

interface Props {
  width?: number;
  height?: number;
}

/**
 * Tiny inline SVG showing the most recent pressure samples as a filled area.
 * Resets on each pen-down (the telemetry store clears history on startStroke).
 */
export function PressureSparkline({ width = 220, height = 56 }: Props) {
  const samples = useTelemetryStore((s) => s.pressureHistory);
  const n = samples.length;

  if (n === 0) {
    return (
      <svg
        width={width}
        height={height}
        className="sparkline empty"
        role="img"
        aria-label="Pressure over time"
      >
        <rect width={width} height={height} fill="transparent" />
        <text
          x={width / 2}
          y={height / 2 + 4}
          textAnchor="middle"
          fontSize="11"
          fill="#7c879a"
        >
          waiting for pen down…
        </text>
      </svg>
    );
  }

  const stepX = width / Math.max(n - 1, 1);
  const points = samples
    .map((p, i) => `${(i * stepX).toFixed(2)},${(height - p * height).toFixed(2)}`)
    .join(" ");
  const area = `M0,${height} L${points} L${width},${height} Z`;
  const line = `M${points.split(" ").join(" L")}`;

  const last = samples[samples.length - 1];

  return (
    <svg
      width={width}
      height={height}
      className="sparkline"
      role="img"
      aria-label="Pressure over time"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke="#7c5cff" strokeWidth={1.5} />
      <line
        x1={0}
        x2={width}
        y1={height * 0.5}
        y2={height * 0.5}
        stroke="#2a3142"
        strokeDasharray="2 3"
      />
      <circle
        cx={width - 1}
        cy={height - last * height}
        r={2.5}
        fill="#22d3ee"
      />
    </svg>
  );
}
