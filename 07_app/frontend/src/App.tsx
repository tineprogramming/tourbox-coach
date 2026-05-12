import { useEffect, useState } from "react";
import { Canvas } from "./canvas/Canvas";
import { Toolbar } from "./tools/Toolbar";
import { SettingsPanel } from "./tools/SettingsPanel";
import { ActionsBar } from "./tools/ActionsBar";
import { TelemetryHUD } from "./hud/TelemetryHUD";
import { useCanvasStore } from "./state/store";
import { aiRegistry } from "./ai/registry";
import {
  triggerGhostNow,
  getLastGhostPolyline,
} from "./ai/sketchRnnGhost";
import { newId } from "./util/id";
import type { Stroke, StrokeEvent } from "./types";
import { wsClient } from "./net/wsClient";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { CloudStatus } from "./components/CloudStatus";
import { CoachingBubble } from "./components/CoachingBubble";
import { LanguagePicker } from "./components/LanguagePicker";
import { AIBox } from "./components/AIBox";
import { useT } from "./i18n/useT";

export function App() {
  const toggleHud = useCanvasStore((s) => s.toggleHud);
  const undo = useCanvasStore((s) => s.undo);
  const [warning, setWarning] = useState<string | null>(null);
  const t = useT();

  useEffect(() => {
    aiRegistry.setLogger((msg) => console.log(msg));
    aiRegistry.initAll();
  }, []);

  // Connect to TourBox Coach backend (Pi) on mount.
  useEffect(() => {
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  // Browser warning: Safari has historically poor PointerEvent tilt support
  // on macOS. Recommend Chrome.
  useEffect(() => {
    const ua = navigator.userAgent;
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
    if (isSafari) {
      setWarning(
        "You're using Safari. For best Wacom support on macOS (especially `tiltX`/`tiltY`), use Chrome or Edge.",
      );
    }
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inFormControl =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");

      // Tab (accept ghost) and ⌘Z (undo) are global — they should fire even
      // while the ghost-mode SELECT has focus, since the user just used the
      // dropdown and may now want to act on the result. The single-letter
      // shortcuts (`H`, `G`) are form-control-suppressed so type-to-search
      // in the SELECT still works.
      if (e.key === "Tab") {
        e.preventDefault();
        const polyline = getLastGhostPolyline();
        if (!polyline || polyline.length < 2) return;
        commitGhostAsStroke(polyline);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }

      if (inFormControl) return;

      if (e.key === "h" || e.key === "H") {
        toggleHud();
      } else if (e.key === "g" || e.key === "G") {
        // One-shot ghost prediction. Works regardless of ghost mode so the
        // user can peek at a suggestion without leaving "off" mode.
        e.preventDefault();
        useCanvasStore.getState().setGhostVisible(true);
        void triggerGhostNow(aiRegistry.context());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleHud, undo]);

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span className="brand-name">{t("brand.name")}</span>
          <span className="brand-tag">{t("brand.tag")}</span>
        </div>
        <ConnectionStatus />
        <CloudStatus />
        <LanguagePicker />
        <ActionsBar />
      </header>
      <AIBox />

      {warning && (
        <div className="warning-banner" role="status">
          {warning}
        </div>
      )}

      <main className="workspace">
        <Toolbar />
        <div className="canvas-area">
          <Canvas />
          <TelemetryHUD />
          <CoachingBubble />
        </div>
        <SettingsPanel />
      </main>

      <footer className="bottombar">
        <span>
          {t("footer.help")}
          <a href={piSetupUrl()} target="_blank" rel="noopener" className="footer-link">
            {t("footer.piSetup")}
          </a>
        </span>
      </footer>
    </div>
  );
}

/** Link to the Pi setup gateway. We prefer the current host so it works
 * whether the user is on the LAN (10.10.1.116) or on the AP (10.42.0.1). */
function piSetupUrl(): string {
  if (typeof window === "undefined") return "/";
  return `http://${window.location.hostname}/`;
}

/** Convert a Sketch-RNN-predicted polyline into a Stroke that lives in the
 * session like any user-drawn one. We synthesize plausible-but-flat
 * `StrokeEvent`s (constant pressure, even time spacing) so downstream
 * exports/replays don't choke on missing fields, but we tag the stroke with
 * `note: "ai-ghost-accepted"` so analytics / training pipelines can filter
 * them out (or in) later. */
function commitGhostAsStroke(polyline: [number, number][]) {
  const store = useCanvasStore.getState();
  const tool = store.tool;
  const startedAt = Date.now();
  const PRESSURE_DEFAULT = 0.55;
  const STEP_MS = 12;
  const events: StrokeEvent[] = polyline.map((pt, i) => ({
    x: pt[0],
    y: pt[1],
    pressure: PRESSURE_DEFAULT,
    tiltX: 0,
    tiltY: 0,
    azimuth: 0,
    altitude: 90,
    twist: 0,
    tangentialPressure: 0,
    width: 0,
    height: 0,
    pointerType: "pen",
    t: i * STEP_MS,
    tAbs: startedAt + i * STEP_MS,
    speed: 0,
    isFirst: i === 0,
  }));
  const stroke: Stroke = {
    id: newId("stk"),
    startedAt,
    endedAt: startedAt + (events.length - 1) * STEP_MS,
    tags: {
      tool,
      thickness: store.thickness,
      color: store.color,
      opacity: store.opacity,
      layerId: "default",
      note: "ai-ghost-accepted",
    },
    events,
  };
  store.pushStroke(stroke);
}
