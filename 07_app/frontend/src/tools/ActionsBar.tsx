import { useCanvasStore } from "../state/store";
import { exportSessionAsJsonl, exportSessionAsJson } from "../storage/exporter";
import { GhostGuidePanel } from "../components/GhostGuidePanel";
import { useT } from "../i18n/useT";

export function ActionsBar() {
  const undo = useCanvasStore((s) => s.undo);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const newSession = useCanvasStore((s) => s.newSession);
  const session = useCanvasStore((s) => s.session);
  const toggleHud = useCanvasStore((s) => s.toggleHud);
  const t = useT();

  return (
    <div className="actions-bar">
      <div className="actions-group">
        <button type="button" onClick={undo} title="⌘Z">
          {t("act.undo")}
        </button>
        <button type="button" onClick={clearCanvas}>
          {t("act.clear")}
        </button>
        <button type="button" onClick={newSession}>
          {t("act.new")}
        </button>
      </div>

      <div className="actions-group">
        <GhostGuidePanel />
        <button type="button" onClick={toggleHud} title="H">
          {t("act.hud")}
        </button>
      </div>

      <div className="actions-group">
        <button type="button" onClick={() => exportSessionAsJsonl(session)}>
          {t("act.exportJsonl")}
        </button>
        <button type="button" onClick={() => exportSessionAsJson(session)}>
          {t("act.exportJson")}
        </button>
      </div>
    </div>
  );
}
