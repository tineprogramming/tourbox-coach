import type { AiContext, AiPlugin, GhostHandle } from "./types";
import type { Stroke } from "../types";
import { polishMyDrawingPlugin } from "./polishMyDrawing";
import { sketchRnnGhostPlugin } from "./sketchRnnGhost";
import { useCanvasStore } from "../state/store";

// All plugins registered with the app. Add a new file in src/ai/ and append
// it here to make it available to the toolbar.
const PLUGINS: AiPlugin[] = [polishMyDrawingPlugin, sketchRnnGhostPlugin];

// The canvas component registers a render-ghost callback on mount; the registry
// stores it so plugins can reach it without prop-drilling.
type GhostRenderer = (svgPath: string, color?: string, opacity?: number) => GhostHandle;
let renderGhostFn: GhostRenderer | null = null;
let logFn: (msg: string) => void = (msg) => console.log(msg);

function buildContext(): AiContext {
  return {
    getSession: () => useCanvasStore.getState().session,
    renderGhost: (path, color, opacity) => {
      if (!renderGhostFn) {
        // No ghost layer yet (canvas not mounted). Return a no-op handle.
        return { clear: () => {} };
      }
      return renderGhostFn(path, color, opacity);
    },
    log: (msg) => logFn(msg),
  };
}

export const aiRegistry = {
  list(): AiPlugin[] {
    return PLUGINS;
  },

  setGhostRenderer(fn: GhostRenderer | null) {
    renderGhostFn = fn;
  },

  setLogger(fn: (msg: string) => void) {
    logFn = fn;
  },

  /** Build a context that other modules (e.g. the App-level `G` hotkey
   * handler) can pass to a plugin without needing visibility into the
   * registry's private ghost-renderer state. */
  context(): AiContext {
    return buildContext();
  },

  async initAll() {
    const ctx = buildContext();
    for (const p of PLUGINS) {
      try {
        await p.init?.(ctx);
      } catch (err) {
        console.warn(`[ai] plugin init failed: ${p.id}`, err);
      }
    }
  },

  async run(id: string, pngDataUrl: string, options?: Record<string, unknown>) {
    const plugin = PLUGINS.find((p) => p.id === id);
    if (!plugin?.run) return null;
    const ctx = buildContext();
    return plugin.run(
      {
        pngDataUrl,
        strokes: useCanvasStore.getState().session.strokes,
        options,
      },
      ctx,
    );
  },

  notifyStrokeEnd(stroke: Stroke) {
    if (!useCanvasStore.getState().ghostVisible) return;
    const ctx = buildContext();
    for (const p of PLUGINS) {
      try {
        p.onStrokeEnd?.(stroke, ctx);
      } catch (err) {
        console.warn(`[ai] onStrokeEnd failed: ${p.id}`, err);
      }
    }
  },
};
