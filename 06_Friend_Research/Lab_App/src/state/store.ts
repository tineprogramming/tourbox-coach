import { create } from "zustand";
import type { Session, Stroke, ToolId } from "../types";
import { TOOL_PRESETS, DEFAULT_TOOL_COLORS } from "../tools/toolPresets";
import { newId } from "../util/id";

const STORAGE_KEY = "drawcopilotlab.session.v1";

function freshSession(): Session {
  return {
    meta: {
      id: newId("sess"),
      startedAt: Date.now(),
      userAgent: typeof navigator === "undefined" ? "node" : navigator.userAgent,
      screen: {
        width: typeof window === "undefined" ? 0 : window.innerWidth,
        height: typeof window === "undefined" ? 0 : window.innerHeight,
        devicePixelRatio:
          typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      },
      sawPen: false,
    },
    strokes: [],
  };
}

function loadSession(): Session {
  if (typeof localStorage === "undefined") return freshSession();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshSession();
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.meta || !Array.isArray(parsed.strokes)) return freshSession();
    return parsed;
  } catch {
    return freshSession();
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(session: Session) {
  if (typeof localStorage === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // QuotaExceeded etc. — silently skip; export-to-file is the safety valve.
    }
  }, 200);
}

/** How the Sketch-RNN ghost behaves.
 * - `"off"`: no ghost ever auto-shows. Pressing the `G` hotkey still runs a
 *   one-shot prediction.
 * - `"manual"`: after every pen-up, predict the next stroke using the
 *   user-selected `ghostCategory`.
 * - `"auto"`: after every pen-up, classify the user's strokes against a
 *   small candidate set and use the best match for prediction. Best-effort;
 *   accuracy depends on how recognizable the early strokes are. */
export type GhostMode = "off" | "manual" | "auto";

/** Lifecycle state of the active Sketch-RNN model load. */
export type GhostModelStatus = "idle" | "loading" | "ready" | "error";

export interface CanvasState {
  // Active tool & rendering settings.
  tool: ToolId;
  thickness: number;
  color: string;
  opacity: number;

  // Persistent session.
  session: Session;

  // Telemetry HUD visibility.
  hudVisible: boolean;

  // ---- Ghost (Sketch-RNN next-stroke suggestion) ----
  ghostMode: GhostMode;
  /** QuickDraw category name (e.g. "cat", "face"). Used in manual mode and as
   * the seed when auto-mode hasn't classified yet. */
  ghostCategory: string;
  /** Lifecycle status of the most recent model load attempt. */
  ghostModelStatus: GhostModelStatus;
  /** Last category the auto-classifier picked, for display. `null` if auto
   * hasn't run yet or classification failed. */
  ghostAutoCategory: string | null;
  /** Convenience: ghosts should be rendered whenever there's anything to show.
   * Stays true while `ghostMode !== "off"` OR a one-shot G-press is active. */
  ghostVisible: boolean;

  // Actions.
  setTool: (tool: ToolId) => void;
  setThickness: (t: number) => void;
  setColor: (c: string) => void;
  setOpacity: (o: number) => void;
  toggleHud: () => void;

  setGhostMode: (mode: GhostMode) => void;
  setGhostCategory: (category: string) => void;
  setGhostModelStatus: (status: GhostModelStatus) => void;
  setGhostAutoCategory: (category: string | null) => void;
  setGhostVisible: (visible: boolean) => void;

  pushStroke: (stroke: Stroke) => void;
  undo: () => void;
  clearCanvas: () => void;
  newSession: () => void;
  markPenSeen: () => void;
}

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  tool: "pencil",
  thickness: TOOL_PRESETS.pencil.defaultSize,
  color: DEFAULT_TOOL_COLORS.pencil,
  opacity: TOOL_PRESETS.pencil.defaultOpacity,
  session: loadSession(),
  hudVisible: true,

  ghostMode: "off",
  ghostCategory: "cat",
  ghostModelStatus: "idle",
  ghostAutoCategory: null,
  ghostVisible: false,

  setTool: (tool) => {
    const preset = TOOL_PRESETS[tool];
    set({
      tool,
      thickness: preset.defaultSize,
      color: DEFAULT_TOOL_COLORS[tool],
      opacity: preset.defaultOpacity,
    });
  },
  setThickness: (t) => set({ thickness: t }),
  setColor: (c) => set({ color: c }),
  setOpacity: (o) => set({ opacity: o }),
  toggleHud: () => set({ hudVisible: !get().hudVisible }),

  setGhostMode: (mode) => {
    // When entering "off", ghost should disappear from the canvas; the layer
    // listens to ghostVisible. When entering an active mode, mark visible so
    // the next pen-up triggers a render.
    set({
      ghostMode: mode,
      ghostVisible: mode !== "off",
      // Reset auto-detection when leaving auto mode so a stale label doesn't
      // linger in the panel.
      ghostAutoCategory: mode === "auto" ? get().ghostAutoCategory : null,
    });
  },
  setGhostCategory: (category) => set({ ghostCategory: category }),
  setGhostModelStatus: (status) => set({ ghostModelStatus: status }),
  setGhostAutoCategory: (category) => set({ ghostAutoCategory: category }),
  setGhostVisible: (visible) => set({ ghostVisible: visible }),

  pushStroke: (stroke) => {
    const session = {
      ...get().session,
      strokes: [...get().session.strokes, stroke],
    };
    set({ session });
    scheduleSave(session);
  },

  undo: () => {
    const { strokes } = get().session;
    if (!strokes.length) return;
    const session = {
      ...get().session,
      strokes: strokes.slice(0, -1),
    };
    set({ session });
    scheduleSave(session);
  },

  clearCanvas: () => {
    const session = { ...get().session, strokes: [] };
    set({ session });
    scheduleSave(session);
  },

  newSession: () => {
    const session = freshSession();
    set({ session });
    scheduleSave(session);
  },

  markPenSeen: () => {
    if (get().session.meta.sawPen) return;
    const session = {
      ...get().session,
      meta: { ...get().session.meta, sawPen: true },
    };
    set({ session });
    scheduleSave(session);
  },
}));
