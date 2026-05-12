// Thin, typed wrapper around eliot-akira/brushlib-wasm — a WebAssembly port
// of MyPaint's brush engine (libmypaint v1.3.0). The engine is lazy-loaded on
// first use so the Vite bundle isn't paying for it on initial page load.
//
// Why we use it: filling a vector outline cannot reproduce the per-position
// grain of a real natural-media mark. libmypaint instead *stamps* a textured
// dab at every sub-pixel along the stroke (the same technique Krita,
// Procreate, and Photoshop use), with each dab's size, rotation, and opacity
// driven by the brush model + our pen events. Many overlapping dabs naturally
// produce real internal grain — there is nothing to fake.
//
// We feed it our recorder's events directly: `stroke(x, y, dt, pressure,
// xtilt, ytilt)` is a 1:1 fit for what `useStrokeRecorder` already produces.
//
// This wrapper supports many brushes per painter — every tool routes through
// the same `Painter` instance, but `startStroke` reloads the underlying
// brush definition for the requested brush ID. Brush JSONs are fetched and
// cached on demand the first time a tool is used.
//
// Licenses (see public/brushlib/LICENSE.md):
//   - brushlib.wasm / brushlib.js : ISC (MyPaint Development Team).
//   - All brush JSONs under public/brushlib/brushes/ : CC0-1.0 (per-artist
//     attribution in that LICENSE.md).

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MyPaintBrushSettingInputs {
  // Each entry maps an input curve like "pressure" → array of [x, y] points
  // that libmypaint treats as a piecewise linear mapping.
  [inputName: string]: [number, number][];
}

interface MyPaintBrushSetting {
  base_value: number;
  inputs?: MyPaintBrushSettingInputs;
}

export interface MyPaintBrushDef {
  comment?: string;
  group?: string;
  parent_brush_name?: string;
  version?: number;
  settings: { [settingName: string]: MyPaintBrushSetting };
}

interface BrushlibPainter {
  setBrush(brush: MyPaintBrushDef): BrushlibPainter;
  setColor(r: number, g: number, b: number): BrushlibPainter;
  setBrushSize(ratio: number): BrushlibPainter;
  newStroke(x: number, y: number): BrushlibPainter;
  stroke(
    x: number,
    y: number,
    dt: number,
    pressure?: number,
    xtilt?: number,
    ytilt?: number,
  ): BrushlibPainter;
  hover(x: number, y: number, dt: number): BrushlibPainter;
}

interface BrushlibGlobal {
  create(canvas: HTMLCanvasElement | CanvasRenderingContext2D): Promise<BrushlibPainter>;
}

declare global {
  interface Window {
    brushlib?: BrushlibGlobal;
  }
}

/** Brush IDs corresponding to files under `public/brushlib/brushes/<id>.json`. */
export type MyPaintBrushId =
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

/** Public engine handle returned from `getEngine()`. All brushes used by
 * the current tool palette are pre-loaded before this resolves, so methods
 * here are synchronous and safe to call from React event handlers. */
export interface PencilEngine {
  /**
   * Begin a new stroke with the given brush. Reloads the underlying brush
   * definition, sets color/size, and stamps the first dab at (x, y).
   */
  startStroke(args: {
    brushId: MyPaintBrushId;
    x: number;
    y: number;
    color: string;
    /** Logical thickness from our UI (px). Mapped onto the brush's radius. */
    thicknessPx: number;
    /** Per-tool radius calibration. Defaults to 1.0. */
    radiusScale?: number;
  }): void;

  /**
   * Continue the active stroke. dtMs is wall-clock millis since the previous
   * event; libmypaint expects seconds.
   */
  strokeTo(args: {
    x: number;
    y: number;
    pressure: number;
    tiltX: number;
    tiltY: number;
    dtMs: number;
  }): void;

  /** Force-finalize the active stroke. Safe to call when no stroke is active. */
  endStroke(): void;

  /** Direct synchronous render for the brush preview — runs a fixed sample
   * stroke using the named brush onto the supplied 2D context. The caller
   * is responsible for clearing the context first. */
  renderPreview(args: {
    ctx: CanvasRenderingContext2D;
    brushId: MyPaintBrushId;
    color: string;
    thicknessPx: number;
    radiusScale?: number;
    width: number;
    height: number;
  }): void;
}

let painterPromise: Promise<BrushlibPainter> | null = null;
let scriptLoadPromise: Promise<void> | null = null;
/** Most recently constructed engine. Exposed via `getActiveEngine()` so
 * sibling components (e.g. the brush-preview panel) can drive renders
 * without prop-drilling a ref through the React tree. */
let activeEngine: PencilEngine | null = null;
/** Subscribers notified when `activeEngine` first becomes available, so
 * components can re-render their previews on engine readiness. */
const engineReadyListeners = new Set<() => void>();

export function getActiveEngine(): PencilEngine | null {
  return activeEngine;
}

export function onEngineReady(listener: () => void): () => void {
  engineReadyListeners.add(listener);
  return () => engineReadyListeners.delete(listener);
}

/** Promise-keyed cache for in-flight fetches (deduplicates concurrent fetches). */
const brushPromiseCache = new Map<MyPaintBrushId, Promise<MyPaintBrushDef>>();
/** Synchronously-readable cache for brushes whose fetch has resolved. The
 * engine is only ever exposed to callers after every brush they'll need
 * has been populated into this map. */
const brushDefCache = new Map<MyPaintBrushId, MyPaintBrushDef>();

function loadScriptOnce(src: string): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    if (window.brushlib) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

function fetchBrush(id: MyPaintBrushId): Promise<MyPaintBrushDef> {
  const cached = brushDefCache.get(id);
  if (cached) return Promise.resolve(cached);
  let p = brushPromiseCache.get(id);
  if (p) return p;
  p = (async () => {
    const res = await fetch(`/brushlib/brushes/${id}.json`);
    if (!res.ok) {
      throw new Error(`Failed to fetch brush '${id}': ${res.status}`);
    }
    const def = (await res.json()) as MyPaintBrushDef;
    brushDefCache.set(id, def);
    return def;
  })();
  brushPromiseCache.set(id, p);
  return p;
}

/** All brush IDs the app's tool palette currently maps to. Kept in sync
 * with `toolPresets.ts`. Engine init blocks until all of these resolve so
 * `startStroke` is a synchronous lookup. */
const ALL_BRUSH_IDS: MyPaintBrushId[] = [
  "pencil",
  "studio_pen",
  "wash",
  "soft_airbrush",
  "hard_round",
  "marker",
  "smudge",
  "eraser",
  "charcoal",
  "pastel",
  "ballpen",
  "calligraphy",
  "knife",
];

/**
 * Acquire (or build) a brush engine bound to the given raster canvas.
 *
 * The same canvas can be re-used; calling this again with the same canvas
 * returns the same engine. Calling with a different canvas constructs a
 * fresh painter for it.
 *
 * Returns null if loading fails — callers should treat this as "fall back
 * to the vector renderer" rather than crashing.
 */
export async function getEngine(
  canvas: HTMLCanvasElement,
): Promise<PencilEngine | null> {
  try {
    await loadScriptOnce("/brushlib/brushlib.js");
    if (!window.brushlib) {
      throw new Error("brushlib global was not registered after script load");
    }
    if (!painterPromise || (painterPromise as any).__canvas !== canvas) {
      painterPromise = window.brushlib.create(canvas);
      (painterPromise as any).__canvas = canvas;
    }
    const painter = await painterPromise;

    // Block resolution until every brush the tool palette references is
    // populated into `brushDefCache`. After this, `startStroke` can be a
    // synchronous lookup — safe to call from React pointer handlers without
    // worrying about microtask ordering or losing the first event.
    await Promise.all(ALL_BRUSH_IDS.map((id) => fetchBrush(id)));

    let strokeActive = false;

    function applyBrush(
      brushId: MyPaintBrushId,
      color: string,
      thicknessPx: number,
      radiusScale: number,
    ) {
      const brush = brushDefCache.get(brushId);
      if (!brush) {
        // Should be unreachable after the preload above. Don't crash —
        // libmypaint will silently no-op rather than mis-render.
        console.warn(`[mypaintBrush] brush '${brushId}' missing from cache`);
        return false;
      }
      // Always re-set the brush; libmypaint persists settings until the
      // next setBrush so we can't skip this even if `brushId` matches the
      // last stroke (color / size would still need updating, and certain
      // brushes mutate state internally during a stroke).
      painter.setBrush(brush);
      painter.setColor(...hexToRgb(color));
      // Each MyPaint brush has its own native radius (encoded in its
      // `radius_logarithmic.base_value`). Our UI thickness slider becomes
      // a multiplier on that base, and per-tool `radiusScale` normalizes
      // the *feel* across brushes whose native sizes differ wildly
      // (e.g. ballpen vs. wide watercolor wash).
      painter.setBrushSize(Math.max(0.25, (thicknessPx / 4) * radiusScale));
      return true;
    }

    const engine: PencilEngine = {
      startStroke({ brushId, x, y, color, thicknessPx, radiusScale = 1 }) {
        if (!applyBrush(brushId, color, thicknessPx, radiusScale)) return;
        painter.newStroke(x, y);
        strokeActive = true;
      },
      strokeTo({ x, y, pressure, tiltX, tiltY, dtMs }) {
        if (!strokeActive) return;
        // libmypaint wants seconds; our recorder gives millis. A reasonable
        // floor (1 ms) prevents division blow-ups during very fast moves.
        const dt = Math.max(0.001, dtMs / 1000);
        painter.stroke(x, y, dt, clamp01(pressure), tiltX, tiltY);
      },
      endStroke() {
        strokeActive = false;
      },
      renderPreview({ ctx, brushId, color, thicknessPx, radiusScale = 1, width, height }: {
        ctx: CanvasRenderingContext2D; brushId: MyPaintBrushId; color: string;
        thicknessPx: number; radiusScale?: number; width: number; height: number;
      }) {
        // The painter writes to whichever canvas it was created with, so to
        // render to the preview ctx we'd need a separate painter. As a
        // workaround — which is the actual technique brushlib's demo uses —
        // we install a temporary `drawDab` binding that targets THIS ctx
        // for the duration of the call, then restore.
        //
        // brushlib's painter exposes `setBindings()` privately via its
        // closure, but we can re-route by replacing the ctx field on the
        // painter object itself for the call.
        const painterAny = painter as any;
        const savedCtx = painterAny.ctx;
        painterAny.ctx = ctx;
        try {
          if (!applyBrush(brushId, color, thicknessPx, radiusScale)) return;
          // Sample stroke: a gentle S-curve across the preview area with a
          // pressure ramp, so each tool's pressure response is visible.
          const margin = Math.max(8, thicknessPx);
          const x0 = margin;
          const y0 = height / 2;
          const x1 = width - margin;
          painter.newStroke(x0, y0);
          const N = 40;
          for (let i = 1; i <= N; i++) {
            const t = i / N;
            const x = x0 + (x1 - x0) * t;
            const arch = Math.sin(t * Math.PI * 1.6);
            const y = y0 + arch * (height * 0.28);
            // Pressure ramps 0 → 1 → 0.5 across the stroke so the preview
            // visualizes each tool's pressure response.
            const pressure = t < 0.6 ? t / 0.6 : 1 - (t - 0.6) * 1.0;
            painter.stroke(x, y, 0.016, clamp01(pressure), 0, 0);
          }
        } finally {
          painterAny.ctx = savedCtx;
        }
      },
    };

    activeEngine = engine;
    for (const listener of engineReadyListeners) {
      try { listener(); } catch { /* swallow listener errors */ }
    }
    return engine;
  } catch (err) {
    console.warn("[mypaintBrush] engine unavailable, falling back:", err);
    return null;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function hexToRgb(hex: string): [number, number, number] {
  // Accepts "#rgb", "#rrggbb". Returns 0-255 components for the brush engine.
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [Number.isNaN(r) ? 0 : r, Number.isNaN(g) ? 0 : g, Number.isNaN(b) ? 0 : b];
}
