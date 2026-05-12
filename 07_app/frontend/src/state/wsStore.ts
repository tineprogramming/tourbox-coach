// Zustand store for WebSocket connection state, streaming coach feedback,
// and stroke metrics.

import { create } from "zustand";

export type WsStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export interface CoachFeedback {
  text: string;
  strokeId?: string;
  source: string;            // "local" | "deepseek" | "qwen-plus" | "kimi" | "minimax"
  startedAt: number;
  finalizedAt?: number;      // undefined while streaming, set on coach_done
  errored?: boolean;
}

export interface StrokeMetrics {
  strokeId: string;
  smoothness?: number;
  pressureConsistency?: number;
  avgSpeed?: number;
  hesitations?: number;
  confidence?: number;
}

interface WsState {
  status: WsStatus;
  serverSessionId: string | null;
  lastMessage: unknown;
  /** Current streaming feedback (one at a time). Null when no coach in flight. */
  streaming: CoachFeedback | null;
  /** Last finalized coach feedback. Stays visible until next stroke arrives. */
  lastFeedback: CoachFeedback | null;
  lastMetrics: StrokeMetrics | null;
  setStatus: (s: WsStatus) => void;
  recordMessage: (msg: unknown) => void;
}

export const useWsStore = create<WsState>()((set, get) => ({
  status: "idle",
  serverSessionId: null,
  lastMessage: null,
  streaming: null,
  lastFeedback: null,
  lastMetrics: null,

  setStatus: (status) => set({ status }),

  recordMessage: (msg) => {
    set({ lastMessage: msg });
    if (typeof msg !== "object" || msg === null) return;
    const m = msg as Record<string, unknown>;
    const type = m.type as string | undefined;

    if (type === "session_start" && typeof m.session_id === "string") {
      set({ serverSessionId: m.session_id });
      return;
    }

    if (type === "stroke_metrics" && typeof m.strokeId === "string") {
      set({
        lastMetrics: {
          strokeId: m.strokeId,
          smoothness: numOrUndef(m.smoothness),
          pressureConsistency: numOrUndef(m.pressureConsistency),
          avgSpeed: numOrUndef(m.avgSpeed),
          hesitations: numOrUndef(m.hesitations),
          confidence: numOrUndef(m.confidence),
        },
      });
      return;
    }

    if (type === "coach_start" && typeof m.strokeId === "string") {
      set({
        streaming: {
          text: "",
          strokeId: m.strokeId,
          source: (m.source as string) || "local",
          startedAt: Date.now(),
        },
      });
      return;
    }

    if (type === "coach_token" && typeof m.token === "string") {
      const cur = get().streaming;
      if (!cur) return;
      // Append; keep stable identity for React.
      set({ streaming: { ...cur, text: cur.text + m.token } });
      return;
    }

    if (type === "coach_done" && typeof m.strokeId === "string") {
      const cur = get().streaming;
      const text = typeof m.text === "string" ? m.text : cur?.text ?? "";
      const finalized: CoachFeedback = {
        text,
        strokeId: m.strokeId,
        source: (m.source as string) || cur?.source || "local",
        startedAt: cur?.startedAt ?? Date.now(),
        finalizedAt: Date.now(),
      };
      set({ streaming: null, lastFeedback: finalized });
      return;
    }

    if (type === "coach_error" && typeof m.strokeId === "string") {
      const cur = get().streaming;
      const errored: CoachFeedback = {
        text: typeof m.error === "string" ? `⚠️ ${m.error}` : "⚠️ coach error",
        strokeId: m.strokeId,
        source: (m.source as string) || cur?.source || "local",
        startedAt: cur?.startedAt ?? Date.now(),
        finalizedAt: Date.now(),
        errored: true,
      };
      set({ streaming: null, lastFeedback: errored });
      return;
    }
  },
}));

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
