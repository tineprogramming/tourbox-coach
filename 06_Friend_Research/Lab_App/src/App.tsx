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

export function App() {
  const toggleHud = useCanvasStore((s) => s.toggleHud);
  const undo = useCanvasStore((s) => s.undo);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    aiRegistry.setLogger((msg) => console.log(msg));
    aiRegistry.initAll();
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
          <span className="brand-name">DrawCopilotLab</span>
          <span className="brand-tag">Initial Lab · macOS · offline</span>
        </div>
        <ActionsBar />
      </header>

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
        </div>
        <SettingsPanel />
      </main>

      <footer className="bottombar">
        <span>
          Press <kbd>H</kbd> for HUD · <kbd>⌘Z</kbd> to undo · <kbd>G</kbd> to
          peek a ghost · <kbd>Tab</kbd> to accept it · all data stays in this
          browser
        </span>
      </footer>
    </div>
  );
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
