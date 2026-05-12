import { useTelemetryStore } from "../state/telemetry";
import { useCanvasStore } from "../state/store";
import { PressureSparkline } from "./PressureSparkline";
import { TiltCompass } from "./TiltCompass";
import { useT } from "../i18n/useT";

function fmt(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function TelemetryHUD() {
  const visible = useCanvasStore((s) => s.hudVisible);
  const latest = useTelemetryStore((s) => s.latest);
  const stats = useTelemetryStore((s) => s.stats);
  const session = useCanvasStore((s) => s.session);
  const t = useT();

  if (!visible) return null;

  const totalEventsInSession = session.strokes.reduce(
    (acc, s) => acc + s.events.length,
    0,
  );
  const totalStrokesInSession = session.strokes.length;

  return (
    <aside className="hud" aria-label={t("hud.title")}>
      <header className="hud-header">
        <span className="hud-title">{t("hud.heading")}</span>
        <span className={`pen-badge ${latest?.pointerType === "pen" ? "pen" : "no-pen"}`}>
          {latest?.pointerType
            ? latest.pointerType.toUpperCase()
            : session.meta.sawPen
              ? "PEN OK"
              : "WAITING…"}
        </span>
      </header>

      <section className="hud-block">
        <h3>{t("hud.liveSignal")}</h3>
        <div className="hud-grid">
          <Field label="x" value={`${fmt(latest?.x ?? NaN, 0)} px`} />
          <Field label="y" value={`${fmt(latest?.y ?? NaN, 0)} px`} />
          <Field label="pressure" value={fmt(latest?.pressure ?? NaN, 3)} accent />
          <Field label="speed" value={`${fmt(latest?.speed ?? NaN, 0)} px/s`} />
          <Field label="tiltX" value={`${fmt(latest?.tiltX ?? NaN, 0)}°`} />
          <Field label="tiltY" value={`${fmt(latest?.tiltY ?? NaN, 0)}°`} />
          <Field label="azimuth" value={`${fmt(latest?.azimuth ?? NaN, 0)}°`} />
          <Field label="altitude" value={`${fmt(latest?.altitude ?? NaN, 0)}°`} />
          <Field label="t (stroke)" value={`${fmt(latest?.t ?? NaN, 0)} ms`} />
          <Field label="twist" value={`${fmt(latest?.twist ?? NaN, 0)}°`} />
        </div>
      </section>

      <section className="hud-block">
        <h3>{t("hud.pressureLast")}</h3>
        <PressureSparkline />
        <div className="hud-row">
          <TiltCompass />
          <div className="hud-stats">
            <Field label="strokes (live)" value={`${stats.totalStrokes}`} />
            <Field label="events (live)" value={`${stats.totalEvents}`} />
            <Field label="events/sec" value={`${stats.eventsPerSec}`} />
            <Field
              label="coalesced"
              value={stats.coalescedSupported ? "supported" : "—"}
            />
          </div>
        </div>
      </section>

      <section className="hud-block">
        <h3>{t("hud.session")}</h3>
        <div className="hud-grid">
          <Field label="strokes" value={`${totalStrokesInSession}`} />
          <Field label="events" value={`${totalEventsInSession}`} />
          <Field
            label="started"
            value={new Date(session.meta.startedAt).toLocaleTimeString()}
          />
          <Field label="DPR" value={`${session.meta.screen.devicePixelRatio}×`} />
        </div>
      </section>

      <footer className="hud-footer">press <kbd>H</kbd> to toggle · <kbd>Tab</kbd> to accept ghost</footer>
    </aside>
  );
}

function Field({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`hud-field ${accent ? "accent" : ""}`}>
      <span className="hud-label">{label}</span>
      <span className="hud-value">{value}</span>
    </div>
  );
}
