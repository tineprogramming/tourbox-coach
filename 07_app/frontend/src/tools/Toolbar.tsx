import clsx from "clsx";
import { useCanvasStore } from "../state/store";
import { TOOL_ORDER, TOOL_PRESETS } from "./toolPresets";
import type { ToolId } from "../types";
import { useT } from "../i18n/useT";

const TOOL_ICONS: Record<ToolId, string> = {
  pencil: "✎",
  charcoal: "■",
  pastel: "▰",
  inking: "✒︎",
  ballpen: "✏︎",
  calligraphy: "ƒ",
  marker: "▮",
  watercolor: "≋",
  soft: "○",
  hard: "●",
  knife: "◣",
  smudge: "～",
  eraser: "⌫",
};

export function Toolbar() {
  const tool = useCanvasStore((s) => s.tool);
  const setTool = useCanvasStore((s) => s.setTool);
  const t = useT();

  return (
    <nav className="toolbar" aria-label={t("tools.label")}>
      {TOOL_ORDER.map((id) => {
        const preset = TOOL_PRESETS[id];
        const active = tool === id;
        return (
          <button
            key={id}
            type="button"
            className={clsx("tool-btn", { active })}
            onClick={() => setTool(id)}
            title={`${preset.label} — ${preset.description}`}
          >
            <span className="tool-icon" aria-hidden>
              {TOOL_ICONS[id]}
            </span>
            <span className="tool-label">{preset.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
