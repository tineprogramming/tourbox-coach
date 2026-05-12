// Core types for DrawCopilotLab.
// Shared by the canvas, the recorder, the HUD, exports, and AI plugins.

export type ToolId =
  | "pencil"
  | "inking"
  | "watercolor"
  | "soft"
  | "hard"
  | "marker"
  | "smudge"
  | "eraser"
  | "charcoal"
  | "pastel"
  | "ballpen"
  | "calligraphy"
  | "knife";

/** Brush IDs as files under `public/brushlib/brushes/<id>.json`. Kept in
 * sync with `MyPaintBrushId` in `brush/mypaintBrush.ts`. */
export type MyPaintBrushFile =
  | "pencil"
  | "studio_pen"
  | "wash"
  | "soft_airbrush"
  | "hard_round"
  | "marker"
  | "smudge"
  | "eraser"
  | "charcoal"
  | "pastel"
  | "ballpen"
  | "calligraphy"
  | "knife";

export interface ToolPreset {
  id: ToolId;
  label: string;
  description: string;
  // Default size in CSS pixels (user can override via the thickness slider).
  defaultSize: number;
  // Default opacity 0..1.
  defaultOpacity: number;
  // perfect-freehand stroke options. Used by the vector renderer (still the
  // graceful-fallback path while libmypaint is loading) and by the in-panel
  // brush preview when the engine isn't yet ready.
  strokeOptions: {
    thinning: number;
    smoothing: number;
    streamline: number;
    simulatePressure: boolean;
    start: { taper: number; cap: boolean };
    end: { taper: number; cap: boolean };
    easing: (t: number) => number;
  };
  // Compositing mode for the rendered vector path (fallback only).
  compositeOperation: GlobalCompositeOperation;
  // True if the rendered fill should be a flat color; false if we want a
  // brush-specific render path (currently only used for the marker's tinted blend).
  flatFill: boolean;
  // Optional procedural texture overlaid on the colored body in the vector
  // fallback. Used only when libmypaint isn't ready yet.
  texture?: "pencil";
  // 0..1 — multiplier on the size that's added per unit of pen-tilt magnitude.
  // Used in the vector fallback only; libmypaint brushes have their own
  // tilt-aware dab dynamics baked into the brush definition.
  tiltSizeBoost?: number;

  // ---- libmypaint primary render path ----
  // Which rendering engine to use. "mypaint" routes the stroke through
  // libmypaint into the raster layer; absent or "vector" uses perfect-freehand
  // (legacy path, still used as the offline fallback). Every tool we ship
  // sets this to "mypaint".
  engine?: "mypaint" | "vector";
  // The brush JSON this tool maps to under `public/brushlib/brushes/`.
  brushFile?: MyPaintBrushFile;
  // Per-tool calibration on libmypaint's brush radius. Each MyPaint brush
  // has its own native size; this multiplier normalizes the feel of the
  // thickness slider across tools so a "5 px" pencil and a "5 px" marker
  // both look like their respective natural-media equivalents.
  radiusScale?: number;
}

// One captured pointer sample. We store every numeric channel the browser
// gives us, so future model training can use whatever subset it likes.
export interface StrokeEvent {
  // Position in CSS pixels, relative to the canvas top-left.
  x: number;
  y: number;
  // Pressure 0..1.
  pressure: number;
  // Tilt in degrees from vertical, -90..90 for each axis.
  tiltX: number;
  tiltY: number;
  // Derived azimuth (0..360, 0 = "up" on screen, clockwise) and altitude (0..90).
  azimuth: number;
  altitude: number;
  // Tangential pressure (barrel pressure) and twist if the device exposes them.
  twist: number;
  tangentialPressure: number;
  // Pointer width / height (radius if available).
  width: number;
  height: number;
  // Pointer type as reported by the browser.
  pointerType: "pen" | "mouse" | "touch" | "unknown";
  // Time in ms since stroke start.
  t: number;
  // Absolute time in ms since session start (used for cross-stroke alignment).
  tAbs: number;
  // Instantaneous speed in px/s, derived from previous sample.
  speed: number;
  // True for the very first event of a stroke (the pen-down sample).
  isFirst: boolean;
}

// Tags that travel with every stroke. This is the *training signal* for any
// future tool-aware model.
export interface StrokeTags {
  tool: ToolId;
  thickness: number;
  color: string; // CSS hex, e.g. "#1c1c1c"
  opacity: number; // 0..1
  layerId: string;
  // Free-form note the user may attach (intent-stage labels, etc.). Not used
  // in the lab UI yet, but the type is here so we don't break exports later.
  note?: string;
}

export interface Stroke {
  id: string;
  startedAt: number; // ms since epoch
  endedAt?: number;
  tags: StrokeTags;
  events: StrokeEvent[];
}

export interface SessionMeta {
  id: string;
  startedAt: number;
  endedAt?: number;
  userAgent: string;
  screen: { width: number; height: number; devicePixelRatio: number };
  // Whether the session was actually drawn with a Wacom-class pen (any pen,
  // really). Set true the first time we see a pointerType === "pen" event.
  sawPen: boolean;
}

export interface Session {
  meta: SessionMeta;
  strokes: Stroke[];
}
