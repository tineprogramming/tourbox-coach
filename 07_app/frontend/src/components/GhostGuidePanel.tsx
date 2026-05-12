import { LESSONS, useCanvasStore } from "../state/store";
import { useT } from "../i18n/useT";

export function GhostGuidePanel() {
  const lesson = useCanvasStore((s) => s.ghostLesson);
  const opacity = useCanvasStore((s) => s.ghostOpacity);
  const setLesson = useCanvasStore((s) => s.setGhostLesson);
  const setOpacity = useCanvasStore((s) => s.setGhostOpacity);
  const t = useT();

  const pct = Math.round(opacity * 100);

  return (
    <div className="ghost-guide-panel" title={t("ghost.title")}>
      <label className="ghost-guide-field">
        <span>{t("ghost.label")}</span>
        <select
          value={lesson ?? ""}
          onChange={(e) => setLesson(e.target.value || null)}
        >
          <option value="">— off —</option>
          {LESSONS.map((L) => (
            <option key={L.id} value={L.id}>
              {L.label}
            </option>
          ))}
        </select>
      </label>
      <label className="ghost-guide-field ghost-guide-slider">
        <span>{t("settings.opacity")} {pct}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          disabled={!lesson}
          onChange={(e) => setOpacity(Number(e.target.value) / 100)}
        />
      </label>
    </div>
  );
}
