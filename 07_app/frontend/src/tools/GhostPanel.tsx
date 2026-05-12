import { useCanvasStore } from "../state/store";

/** Curated subset of the ~80 categories Magenta has Sketch-RNN models for.
 * Keeping the dropdown short prevents decision paralysis; categories were
 * picked for being:
 *  - high-quality (clean training data, recognizable strokes)
 *  - frequently doodled (face, cat, flower, etc.)
 *  - varied across topology (closed forms, radial forms, line art)
 *
 * To add more: any QuickDraw category at
 * `https://storage.googleapis.com/quickdraw-models/sketchRNN/large_models/<name>.gen.json`
 * works. The plugin lazy-fetches on first use. */
export const GHOST_CATEGORIES: string[] = [
  "cat",
  "face",
  "flower",
  "bird",
  "fish",
  "tree",
  "house",
  "butterfly",
  "owl",
  "pig",
  "dog",
  "bicycle",
  "snail",
  "crab",
  "elephant",
  "rabbit",
  "swan",
  "duck",
];

const STATUS_LABEL: Record<string, string> = {
  idle: "ready when you draw",
  loading: "loading model…",
  ready: "ghost shown",
  error: "model failed",
};

export function GhostPanel() {
  const ghostMode = useCanvasStore((s) => s.ghostMode);
  const ghostCategory = useCanvasStore((s) => s.ghostCategory);
  const ghostModelStatus = useCanvasStore((s) => s.ghostModelStatus);
  const ghostAutoCategory = useCanvasStore((s) => s.ghostAutoCategory);
  const setGhostMode = useCanvasStore((s) => s.setGhostMode);
  const setGhostCategory = useCanvasStore((s) => s.setGhostCategory);

  // The "current" category the user sees is whichever is actually in use:
  // - manual mode: the dropdown selection
  // - auto mode: the classifier's pick (or the dropdown until classified)
  const effectiveCategory =
    ghostMode === "auto" ? ghostAutoCategory ?? ghostCategory : ghostCategory;

  return (
    <div className="ghost-panel" role="group" aria-label="Ghost suggestion controls">
      <div className="ghost-panel__row">
        <label className="ghost-panel__label" htmlFor="ghost-mode">
          Ghost
        </label>
        <select
          id="ghost-mode"
          className="ghost-panel__select"
          value={ghostMode}
          onChange={(e) => setGhostMode(e.target.value as "off" | "manual" | "auto")}
          title="When should the AI suggest the next stroke?"
        >
          <option value="off">Off</option>
          <option value="manual">Manual category</option>
          <option value="auto">Auto-detect</option>
        </select>
      </div>

      {ghostMode === "manual" && (
        <div className="ghost-panel__row">
          <label className="ghost-panel__label" htmlFor="ghost-category">
            Drawing
          </label>
          <select
            id="ghost-category"
            className="ghost-panel__select"
            value={ghostCategory}
            onChange={(e) => setGhostCategory(e.target.value)}
            title="Which Sketch-RNN model to use"
          >
            {GHOST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {ghostMode !== "off" && (
        <div className={`ghost-panel__pill ghost-panel__pill--${ghostModelStatus}`}>
          <span className="ghost-panel__pill-dot" aria-hidden />
          <span className="ghost-panel__pill-text">
            {ghostMode === "auto" && ghostAutoCategory ? (
              <>
                detected: <strong>{ghostAutoCategory}</strong>
              </>
            ) : (
              <>
                {effectiveCategory} · {STATUS_LABEL[ghostModelStatus] ?? ghostModelStatus}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
