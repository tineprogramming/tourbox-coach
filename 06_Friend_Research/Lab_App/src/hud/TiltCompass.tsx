import { useTelemetryStore } from "../state/telemetry";

/**
 * Small SVG that visualizes the pen's current tilt as a vector pointing in
 * the direction the tip is leaning. Vertical pen → dot in the center.
 */
export function TiltCompass({ size = 64 }: { size?: number }) {
  const latest = useTelemetryStore((s) => s.latest);
  const tiltX = latest?.tiltX ?? 0;
  const tiltY = latest?.tiltY ?? 0;
  // Magnitude of tilt 0..1 (each axis maxes at 90deg).
  const mag = Math.min(
    1,
    Math.sqrt((tiltX * tiltX + tiltY * tiltY) / (90 * 90 * 2)) * Math.SQRT2,
  );
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  // tiltX positive = pen tilts to the right; tiltY positive = pen tilts toward the user (down on screen).
  const dx = (tiltX / 90) * r;
  const dy = (tiltY / 90) * r;

  return (
    <svg width={size} height={size} className="compass" role="img" aria-label="Pen tilt">
      <circle cx={cx} cy={cy} r={r} fill="#0b0d12" stroke="#2a3142" />
      <circle cx={cx} cy={cy} r={r * 0.5} fill="none" stroke="#2a3142" strokeDasharray="2 3" />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke="#2a3142" />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#2a3142" />
      <line
        x1={cx}
        y1={cy}
        x2={cx + dx}
        y2={cy + dy}
        stroke="#22d3ee"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={cx + dx} cy={cy + dy} r={3} fill="#22d3ee" />
      <circle cx={cx} cy={cy} r={2} fill="#7c879a" />
      <text x={cx} y={size - 2} textAnchor="middle" fontSize="9" fill="#7c879a">
        tilt {Math.round(mag * 100)}%
      </text>
    </svg>
  );
}
