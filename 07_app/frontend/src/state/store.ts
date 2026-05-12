import { create } from "zustand";
import type { Session, Stroke, ToolId } from "../types";
import { TOOL_PRESETS, DEFAULT_TOOL_COLORS } from "../tools/toolPresets";
import { newId } from "../util/id";
import { detectLocale, type Locale } from "../i18n/strings";

const STORAGE_KEY = "drawcopilotlab.session.v1";
const PREFS_KEY = "tourbox-coach.prefs.v1";

interface PersistedPrefs {
  tool?: ToolId;
  thickness?: number;
  color?: string;
  opacity?: number;
  ghostLesson?: string | null;
  ghostOpacity?: number;
  coachProvider?: string;
  locale?: Locale;
}

function loadPrefs(): PersistedPrefs {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as PersistedPrefs) : {};
  } catch {
    return {};
  }
}

let prefsTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePrefsSave(prefs: PersistedPrefs) {
  if (typeof localStorage === "undefined") return;
  if (prefsTimer) clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore quota — prefs are tiny, this shouldn't fire
    }
  }, 150);
}

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

/** AI coach provider. Categorized so the UI can group them visually. */
export type CoachProviderId =
  | "local"
  | "cluster"
  | "deepseek"
  | "qwen-plus"
  | "openai";

export type CoachCategory = "cluster" | "local" | "chinese" | "international";

export interface CoachProviderMeta {
  id: CoachProviderId;
  label: string;
  category: CoachCategory;
  /** True if it needs internet (cluster + cloud do; local doesn't). */
  needsInternet: boolean;
  /** Hardcoded short tagline shown next to the name in dropdowns. */
  hint: string;
  /** Country-of-origin flag emoji, prefixed to label in UI. */
  flag: string;
  /** True if model weights are publicly downloadable. False for closed APIs. */
  openSource: boolean;
}

export const COACH_PROVIDERS: CoachProviderMeta[] = [
  { id: "cluster",   label: "Qwen3-32B-AWQ",      category: "cluster",       needsInternet: true,  hint: "Thailand 4090 cluster", flag: "🇹🇭", openSource: true  },
  { id: "local",     label: "Qwen2:1.5b",         category: "local",         needsInternet: false, hint: "on-device, private",    flag: "🏠", openSource: true  },
  { id: "deepseek",  label: "DeepSeek",           category: "chinese",       needsInternet: true,  hint: "DeepSeek",              flag: "🇨🇳", openSource: true  },
  { id: "qwen-plus", label: "Qwen-Plus",          category: "chinese",       needsInternet: true,  hint: "Alibaba DashScope",     flag: "🇨🇳", openSource: false },
  { id: "openai",    label: "OpenAI GPT-4o-mini", category: "international", needsInternet: true,  hint: "OpenAI",                flag: "🇺🇸", openSource: false },
];

export const COACH_CATEGORY_META: Record<CoachCategory, { icon: string; labelEn: string; labelZh: string }> = {
  cluster:       { icon: "🇹🇭", labelEn: "Remote Thailand cluster", labelZh: "泰国远程集群"  },
  local:         { icon: "🏠", labelEn: "Local Pi model",          labelZh: "本地 Pi 模型"   },
  chinese:       { icon: "🇨🇳", labelEn: "Cloud Chinese model",     labelZh: "中国云端模型"   },
  international: { icon: "🌎", labelEn: "International model",     labelZh: "国际模型"       },
};

/** Curated Ghost Guide lessons. Images live in `frontend/public/lessons/`,
 * generated by `scripts/generate_lessons.py`. */
export interface Lesson {
  id: string;
  label: string;
  src: string;
}

export const LESSONS: Lesson[] = [
  { id: "face", label: "Friendly face", src: "/lessons/face.png" },
  { id: "hand", label: "Open hand", src: "/lessons/hand.png" },
  { id: "leaf", label: "Botanical leaf", src: "/lessons/leaf.png" },
  { id: "eye", label: "Eye study", src: "/lessons/eye.png" },
  { id: "cat", label: "Sitting cat", src: "/lessons/cat.png" },
  { id: "flower", label: "Tulip", src: "/lessons/flower.png" },
];

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

  // ---- AI coach provider selection ----
  coachProvider: CoachProviderId;
  setCoachProvider: (p: CoachProviderId) => void;

  // ---- UI language ----
  locale: Locale;
  setLocale: (l: Locale) => void;

  // ---- Ghost Guide (lesson reference overlay) ----
  /** Active lesson id (e.g. "face") or null for no overlay. */
  ghostLesson: string | null;
  /** Opacity 0..1 for the lesson reference. The hero "dial" interaction. */
  ghostOpacity: number;
  setGhostLesson: (id: string | null) => void;
  setGhostOpacity: (op: number) => void;

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

const prefs = loadPrefs();

function persist(get: () => CanvasState) {
  const s = get();
  schedulePrefsSave({
    tool: s.tool,
    thickness: s.thickness,
    color: s.color,
    opacity: s.opacity,
    ghostLesson: s.ghostLesson,
    ghostOpacity: s.ghostOpacity,
    coachProvider: s.coachProvider,
    locale: s.locale,
  });
}

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  tool: (prefs.tool as ToolId) ?? "pencil",
  thickness: prefs.thickness ?? TOOL_PRESETS.pencil.defaultSize,
  color: prefs.color ?? DEFAULT_TOOL_COLORS.pencil,
  opacity: prefs.opacity ?? TOOL_PRESETS.pencil.defaultOpacity,
  session: loadSession(),
  hudVisible: true,

  coachProvider: (prefs.coachProvider as CoachProviderId) ?? "cluster",
  setCoachProvider: (p) => { set({ coachProvider: p }); persist(get); },

  locale: prefs.locale ?? detectLocale(),
  setLocale: (l) => { set({ locale: l }); persist(get); },

  ghostLesson: prefs.ghostLesson ?? null,
  ghostOpacity: prefs.ghostOpacity ?? 0.45,
  setGhostLesson: (id) => { set({ ghostLesson: id }); persist(get); },
  setGhostOpacity: (op) => { set({ ghostOpacity: Math.max(0, Math.min(1, op)) }); persist(get); },

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
    persist(get);
  },
  setThickness: (t) => { set({ thickness: t }); persist(get); },
  setColor: (c) => { set({ color: c }); persist(get); },
  setOpacity: (o) => { set({ opacity: o }); persist(get); },
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
