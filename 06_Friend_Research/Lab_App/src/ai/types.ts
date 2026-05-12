// Public interface for AI plugins. The lab itself ships with two stubs:
// - polishMyDrawing: future sketch-to-image
// - sketchRnnGhost:  future next-stroke ghost suggestions
//
// The point of this file is to LOCK the shape of the contract NOW, so that
// when we drop in real models later we don't have to refactor the canvas.

import type { Session, Stroke } from "../types";

export interface AiContext {
  // Snapshot of the current session, read-only.
  getSession: () => Session;
  // Imperatively render a "ghost" SVG path on the dedicated overlay layer.
  // Returns a handle that the caller can use to clear the ghost.
  renderGhost: (svgPath: string, color?: string, opacity?: number) => GhostHandle;
  // Toast / status messages.
  log: (msg: string) => void;
}

export interface GhostHandle {
  clear: () => void;
}

export interface AiInput {
  // Rasterized canvas snapshot. Provided as a data URL so plugins can POST it
  // anywhere without needing access to the canvas DOM node.
  pngDataUrl: string;
  // The strokes that produced this snapshot, in the order they were drawn.
  strokes: Stroke[];
  // Free-form options from the toolbar (style preset, etc.).
  options?: Record<string, unknown>;
}

export interface AiResult {
  // Optional image variants returned by the plugin (sketch-to-image style).
  images?: { url: string; label: string }[];
  // Optional message to display.
  message?: string;
}

export interface AiPlugin {
  id: string;
  name: string;
  description: string;
  // Called once when the app boots. May warm up a worker, load a model, etc.
  init?: (ctx: AiContext) => Promise<void>;
  // Called when the user invokes the plugin from the AI menu.
  run?: (input: AiInput, ctx: AiContext) => Promise<AiResult>;
  // Called on every pen-up so streaming plugins (ghost-stroke) can refresh.
  onStrokeEnd?: (stroke: Stroke, ctx: AiContext) => void;
}
