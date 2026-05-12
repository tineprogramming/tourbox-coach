import { useCallback, useState } from "react";
import { useCanvasStore } from "../state/store";
import { exportSessionAsJsonl, exportSessionAsJson } from "../storage/exporter";
import { aiRegistry } from "../ai/registry";
import { GhostPanel } from "./GhostPanel";

export function ActionsBar() {
  const undo = useCanvasStore((s) => s.undo);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const newSession = useCanvasStore((s) => s.newSession);
  const session = useCanvasStore((s) => s.session);
  const toggleHud = useCanvasStore((s) => s.toggleHud);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const runPolish = useCallback(async () => {
    setBusy("polish");
    try {
      // For the stub we don't even need to rasterize, but we do so the wiring
      // is exercised end-to-end.
      const stage = document.querySelector(".konvajs-content canvas") as
        | HTMLCanvasElement
        | null;
      const dataUrl = stage?.toDataURL("image/png") ?? "";
      const result = await aiRegistry.run("polish-my-drawing", dataUrl);
      showToast(result?.message ?? "Polish stub returned no message.");
    } finally {
      setBusy(null);
    }
  }, [showToast]);

  return (
    <div className="actions-bar">
      <div className="actions-group">
        <button type="button" onClick={undo} title="Undo last stroke (⌘Z)">
          Undo
        </button>
        <button type="button" onClick={clearCanvas} title="Clear canvas">
          Clear
        </button>
        <button type="button" onClick={newSession} title="Archive and start fresh">
          New session
        </button>
      </div>

      <div className="actions-group">
        <GhostPanel />
        <button type="button" onClick={runPolish} disabled={busy === "polish"}>
          {busy === "polish" ? "Polishing…" : "Polish My Drawing"}
        </button>
        <button type="button" onClick={toggleHud} title="Toggle telemetry HUD (H)">
          HUD
        </button>
      </div>

      <div className="actions-group">
        <button type="button" onClick={() => exportSessionAsJsonl(session)} title="Export training-friendly JSONL">
          Export .jsonl
        </button>
        <button type="button" onClick={() => exportSessionAsJson(session)} title="Export single-file JSON">
          Export .json
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
