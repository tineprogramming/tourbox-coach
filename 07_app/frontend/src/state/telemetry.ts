import { create } from "zustand";
import type { StrokeEvent } from "../types";

// A small, non-persistent store for the live telemetry HUD. Kept separate from
// the canvas store so HUD updates don't cause canvas re-renders.

interface TelemetryStats {
  totalStrokes: number;
  totalEvents: number;
  // Rolling events-per-second computed in a 1s window.
  eventsPerSec: number;
  // Number of events dropped because of `getCoalescedEvents()` not being
  // supported in the browser. Set on first move event after pen-down.
  coalescedSupported: boolean;
}

export interface TelemetryState {
  // The last sample we saw. null when no stroke is in progress.
  latest: StrokeEvent | null;

  // Rolling pressure history for the sparkline. Bounded to MAX_SAMPLES.
  pressureHistory: number[];

  stats: TelemetryStats;

  pushSample: (e: StrokeEvent) => void;
  startStroke: () => void;
  endStroke: () => void;
  setCoalescedSupported: (s: boolean) => void;
}

const MAX_SAMPLES = 240;

export const useTelemetryStore = create<TelemetryState>()((set, get) => {
  // Rolling 1s window of timestamps to compute eventsPerSec.
  const eventTimestamps: number[] = [];

  return {
    latest: null,
    pressureHistory: [],
    stats: {
      totalStrokes: 0,
      totalEvents: 0,
      eventsPerSec: 0,
      coalescedSupported: false,
    },

    pushSample: (e) => {
      const now = performance.now();
      eventTimestamps.push(now);
      while (eventTimestamps.length && eventTimestamps[0] < now - 1000) {
        eventTimestamps.shift();
      }

      const history = [...get().pressureHistory, e.pressure];
      if (history.length > MAX_SAMPLES) history.splice(0, history.length - MAX_SAMPLES);

      const stats = get().stats;
      set({
        latest: e,
        pressureHistory: history,
        stats: {
          ...stats,
          totalEvents: stats.totalEvents + 1,
          eventsPerSec: eventTimestamps.length,
        },
      });
    },

    startStroke: () => {
      const stats = get().stats;
      set({
        pressureHistory: [],
        stats: { ...stats, totalStrokes: stats.totalStrokes + 1 },
      });
    },

    endStroke: () => {
      set({ latest: null });
    },

    setCoalescedSupported: (s) =>
      set((state) => ({ stats: { ...state.stats, coalescedSupported: s } })),
  };
});
