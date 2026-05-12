// Sketch-RNN ghost plugin — predicts the user's *next stroke* given the
// strokes they've already drawn, and renders it as a faint overlay on the
// ghost layer.
//
// Implementation: Google Magenta's `@magenta/sketch` JS port of Sketch-RNN
// (Apache-2.0 licensed). Models are per-QuickDraw-category checkpoints
// hosted on Google Cloud Storage; we lazy-fetch the one for the active
// category on first use and cache it.
//
// Bundle hygiene: the entire `@magenta/sketch` + TF.js dependency (~600 KB
// gzipped) is loaded via a *dynamic* import on first activation, so users
// who never enable Ghost don't pay for it on initial page load.
//
// Stroke format: Sketch-RNN works in a 5-tuple per step
// [Δx, Δy, pen_down, pen_up, pen_end] — encoded as deltas relative to the
// previous point. We convert from our recorder's absolute (x, y) events
// using the model's own `linesToStroke` helper. After prediction we render
// the predicted polyline starting from the user's last pen-down position.

import type { AiPlugin, AiContext, GhostHandle } from "./types";
import type { Stroke } from "../types";
import { useCanvasStore } from "../state/store";

// Magenta's typings — imported lazily, but TS still needs to know the shape.
// Using `import type` keeps these out of the runtime bundle. Note: Magenta
// only re-exports `SketchRNN` from its barrel; the LSTM state is exposed
// here as a structural type (matches `node_modules/@magenta/sketch/es5/
// sketch_rnn/model.d.ts`) so TS doesn't try to drill into the package.
import type { SketchRNN } from "@magenta/sketch";
interface LSTMState {
  c: Float32Array;
  h: Float32Array;
}

// ----------------------------- module loading -----------------------------

type MagentaModule = typeof import("@magenta/sketch");
let magentaPromise: Promise<MagentaModule> | null = null;

function loadMagenta(): Promise<MagentaModule> {
  if (!magentaPromise) {
    magentaPromise = import("@magenta/sketch");
  }
  return magentaPromise;
}

/** Cache of category → initialized SketchRNN. Each model is a separate fetch
 * (~3–5 MB each) so we never want to re-init on every stroke. */
const modelCache = new Map<string, Promise<SketchRNN>>();

/** Magenta hosts pretrained models on GCS at this prefix. The `large_models`
 * variant is higher quality than `small_models`; both are ~3–5 MB. */
const MODEL_BASE_URL =
  "https://storage.googleapis.com/quickdraw-models/sketchRNN/large_models/";

async function getModel(category: string): Promise<SketchRNN> {
  let p = modelCache.get(category);
  if (p) return p;
  p = (async () => {
    const { SketchRNN } = await loadMagenta();
    const url = `${MODEL_BASE_URL}${category}.gen.json`;
    const m = new SketchRNN(url);
    await m.initialize();
    return m;
  })();
  modelCache.set(category, p);
  return p;
}

// ------------------------- coordinate conversion --------------------------

/** Reduce a Stroke's recorded pointer events to a screen-space polyline.
 * We downsample heavily (every Nth event, plus first/last) because Sketch-RNN
 * was trained on QuickDraw's coarse 50-Hz tracks and does not benefit from
 * Wacom's 200-Hz coalesced samples — feeding the model raw is both slower
 * AND lower-quality on its native distribution. */
function strokeToPolyline(stroke: Stroke): [number, number][] {
  const ev = stroke.events;
  if (ev.length === 0) return [];
  const out: [number, number][] = [];
  // Aim for ~16 samples per stroke. Skip tail-heavy raw events.
  const step = Math.max(1, Math.floor(ev.length / 16));
  for (let i = 0; i < ev.length; i += step) {
    out.push([ev[i].x, ev[i].y]);
  }
  // Always include the final sample so pen-lift position is exact.
  const last = ev[ev.length - 1];
  if (out.length === 0 || out[out.length - 1][0] !== last.x || out[out.length - 1][1] !== last.y) {
    out.push([last.x, last.y]);
  }
  return out;
}

/** Compute a `pixelFactor` that brings our screen-pixel polylines into the
 * coordinate space Sketch-RNN was trained on (~256-px QuickDraw doodles).
 * Without this the model treats the whole canvas as a tiny detail and
 * predicts micro-strokes. */
function pixelFactorFor(canvasWidth: number, canvasHeight: number): number {
  // QuickDraw's normalized coordinate range is roughly 256 px diagonal. We
  // want our drawing's diagonal to map to ~256 in model space. The factor
  // is "how many model pixels per screen pixel", inverted to get the
  // model's `pixelFactor` parameter.
  const screenDiag = Math.hypot(canvasWidth, canvasHeight);
  const modelDiag = 256;
  // pixelFactor = model_units_per_screen_pixel; keep within sane bounds.
  return Math.max(0.5, Math.min(8, screenDiag / modelDiag));
}

/** Run the sampled `[Δx, Δy, p1, p2, p3]` outputs back into an absolute
 * polyline that starts at the user's last pen-down position. We stop at
 * the first pen-up (`p2 === 1`) or pen-end (`p3 === 1`) marker so the
 * ghost is always a *single* next stroke, not a multi-stroke ramble. */
function deltasToPolyline(
  startX: number,
  startY: number,
  samples: number[][],
  /** Inverse of pixelFactor — how many screen pixels per model unit. */
  modelToScreen: number,
): [number, number][] {
  const path: [number, number][] = [[startX, startY]];
  let x = startX;
  let y = startY;
  for (const s of samples) {
    const [dx, dy, , p2, p3] = s;
    x += dx * modelToScreen;
    y += dy * modelToScreen;
    path.push([x, y]);
    if (p2 === 1 || p3 === 1) break;
  }
  return path;
}

function polylineToSvgPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)}`;
  }
  return d;
}

// ----------------------------- prediction --------------------------------

interface PredictArgs {
  category: string;
  strokes: Stroke[];
  canvasSize: { width: number; height: number };
  /** 0–1; lower = more conservative / closer to training distribution. */
  temperature?: number;
  /** Hard cap on dabs sampled before we give up. */
  maxSteps?: number;
}

interface PredictResult {
  /** Absolute screen-space polyline, ready to convert to a path. */
  polyline: [number, number][];
  /** Pixel-space SVG `d` attribute. */
  svgPath: string;
  /** Echoed back so a caller knows which model produced this result
   * (useful for the auto-classifier confidence display). */
  category: string;
}

async function predictNextStroke(args: PredictArgs): Promise<PredictResult | null> {
  const { category, strokes, canvasSize, temperature = 0.4, maxSteps = 80 } = args;
  if (strokes.length === 0) return null;

  const model = await getModel(category);
  const pixelFactor = pixelFactorFor(canvasSize.width, canvasSize.height);
  model.setPixelFactor(pixelFactor);

  // Build the lines-of-points representation Magenta expects: an array per
  // stroke of `[x, y]` points in screen pixels. The model then internally
  // normalizes these via setPixelFactor.
  const lines: number[][][] = strokes.map((s) => strokeToPolyline(s));
  // Magenta also exposes Ramer-Douglas-Peucker simplification; using their
  // own implementation keeps the input distribution closer to training.
  const simplified = model.simplifyLines(lines, 2.0);
  if (simplified.length === 0 || simplified[0].length < 2) return null;

  // `linesToStroke` produces the canonical [Δx, Δy, p1, p2, p3] sequence,
  // including the pen-end marker for each completed line.
  const tokens = model.linesToStroke(simplified);

  // Feed the prefix (everything except the last token) to the LSTM so it
  // is conditioned on what the user has drawn so far.
  let state: LSTMState = model.zeroState();
  state = model.updateStrokes(tokens.slice(0, -1), state);

  // Sample the next stroke autoregressively. Each step yields
  // [Δx, Δy, p1, p2, p3] where p1=pen-down, p2=pen-up (stroke ends), p3=
  // pen-end (drawing done). Two complications worth handling:
  //
  //  1. After a one-stroke prefix the model frequently samples p3=1
  //     ("the drawing is over") on the very first step, especially for
  //     simple categories. We *cannot* return null in that case — the
  //     user just drew and is asking "what's next?", so we keep going
  //     until we have a non-trivial proposal.
  //  2. Even mid-stroke, a stray p2=1 can occur after only 2-3 samples,
  //     producing an unsatisfying nub. We require at least `MIN_LEN`
  //     samples before honoring the pen-up signal.
  const MIN_LEN = 8;
  const sampled: number[][] = [];
  let lastInput = tokens[tokens.length - 1] ?? model.zeroInput();
  let earlyPenEndSkipped = false;
  for (let i = 0; i < maxSteps; i++) {
    state = model.update(lastInput, state);
    const pdf = model.getPDF(state, temperature);
    const out = model.sample(pdf);
    // Veto premature pen-end / pen-up: rewrite the pen state to a
    // continued-down so we keep going. We retain the predicted Δx,Δy
    // since those still carry useful direction info.
    const wantsEnd = out[3] === 1 || out[4] === 1;
    if (wantsEnd && sampled.length < MIN_LEN) {
      earlyPenEndSkipped = true;
      out[2] = 1;
      out[3] = 0;
      out[4] = 0;
    }
    sampled.push(out);
    if (out[3] === 1 || out[4] === 1) break;
    lastInput = out;
  }
  if (sampled.length < 2) return null;
  // Sanity log when we had to suppress an early pen-end. Useful when
  // diagnosing "ghost is too short" complaints in the field.
  if (earlyPenEndSkipped) {
    console.debug(`[ghost] suppressed early pen-end for category ${category}`);
  }

  // Translate the deltas back into absolute screen-space points starting
  // at the user's pen-lift position. `setPixelFactor` baked the screen↔
  // model scale into the model's *output* deltas, so we use a 1:1 ratio
  // here — the outputs already account for our chosen pixelFactor.
  const lastStroke = strokes[strokes.length - 1];
  const lastEvent = lastStroke.events[lastStroke.events.length - 1];
  const polyline = deltasToPolyline(lastEvent.x, lastEvent.y, sampled, 1);
  return {
    polyline,
    svgPath: polylineToSvgPath(polyline),
    category,
  };
}

// ----------------------- auto-mode classification -----------------------

/** Candidate categories used by the auto-classifier. Kept short to bound
 * the cost (each candidate is one full model load). Picked to span obvious
 * QuickDraw archetypes a user might attempt early in a doodle. */
export const AUTO_CANDIDATES = [
  "cat",
  "face",
  "flower",
  "bird",
  "fish",
  "tree",
  "house",
  "butterfly",
] as const;

/** Picks the candidate whose model rates the user's strokes highest under
 * its own learned distribution. This is a *light* classifier — accuracy
 * goes up with stroke count, and short scribbles can land arbitrary
 * categories. We lean on Magenta's `getPDF` after consuming the prefix:
 * the higher the joint probability of the prefix, the better that model
 * "explains" the user's drawing.
 *
 * If you find yourself wanting better results: swap this for a real
 * pretrained QuickDraw image classifier (rasterize → MobileNet → linear
 * head). The seam is `classifyStrokes()`; the rest of the plugin doesn't
 * care how the category was chosen. */
export async function classifyStrokes(
  strokes: Stroke[],
  canvasSize: { width: number; height: number },
): Promise<string | null> {
  if (strokes.length === 0) return null;
  // Build the prefix tokens once (same for every candidate).
  const lines: number[][][] = strokes.map((s) => strokeToPolyline(s));

  let bestCategory: string | null = null;
  let bestScore = -Infinity;

  for (const cat of AUTO_CANDIDATES) {
    let model: SketchRNN;
    try {
      model = await getModel(cat);
    } catch {
      continue;
    }
    model.setPixelFactor(pixelFactorFor(canvasSize.width, canvasSize.height));
    const simplified = model.simplifyLines(lines, 2.0);
    if (simplified.length === 0 || simplified[0].length < 2) continue;
    const tokens = model.linesToStroke(simplified);

    // Score = mean log-likelihood of the next pen-state under the model
    // after consuming the prefix. Higher = the model expects the user's
    // strokes to keep going. Surprisingly informative on early sketches
    // because each per-category model *strongly* expects characteristic
    // continuation patterns (e.g. a face wants two more strokes for eyes).
    let state: LSTMState = model.zeroState();
    state = model.updateStrokes(tokens.slice(0, -1), state);
    const pdf = model.getPDF(state, 0.4);
    // Magenta's pen distribution is in pdf.pen[3] (3-vec: down/up/end).
    // Use the max probability — high max means the model is *confident*
    // about what comes next, which empirically tracks "good fit".
    let pMax = 0;
    for (let i = 0; i < pdf.pen.length; i++) {
      if (pdf.pen[i] > pMax) pMax = pdf.pen[i];
    }
    if (pMax > bestScore) {
      bestScore = pMax;
      bestCategory = cat;
    }
  }
  return bestCategory;
}

// ---------------------------- plugin object -----------------------------

let lastHandle: GhostHandle | null = null;
/** Most recently emitted ghost polyline. Exposed so the App-level Tab
 * handler can commit it as a real stroke when the user accepts. */
let lastPolyline: [number, number][] | null = null;
/** True while a prediction is in flight; lets us debounce so back-to-back
 * pen-ups don't queue up redundant inferences. */
let inFlight = false;

/** Cached canvas size, refreshed on every onStrokeEnd from the AiContext. */
let lastCanvasSize: { width: number; height: number } = { width: 0, height: 0 };

function clearGhost() {
  if (lastHandle) {
    lastHandle.clear();
    lastHandle = null;
  }
  lastPolyline = null;
}

export function getLastGhostPolyline(): [number, number][] | null {
  return lastPolyline;
}

// Dev-only debug hook: expose polyline state to window so headless smoke
// tests can introspect without going through React. Guarded by NODE_ENV
// so production bundles don't carry the surface area. The condition checks
// `import.meta.env.DEV`, which Vite replaces at build time.
if (import.meta.env?.DEV && typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__ghostDebug = {
    getPolyline: () => lastPolyline,
    pendingInFlight: () => inFlight,
  };
}

/** Imperative one-shot prediction trigger, used by the `G` hotkey. */
export async function triggerGhostNow(ctx: AiContext): Promise<void> {
  const session = ctx.getSession();
  if (session.strokes.length === 0) {
    ctx.log("Ghost: nothing drawn yet");
    return;
  }
  await runPrediction(session.strokes, ctx);
}

async function runPrediction(strokes: Stroke[], ctx: AiContext): Promise<void> {
  const store = useCanvasStore.getState();
  if (inFlight) return;
  inFlight = true;
  try {
    store.setGhostModelStatus("loading");

    // Use cached canvas size from the most recent canvas mount; if nothing
    // has set it yet, infer from the strokes' bounding box (fallback for
    // unit tests / odd init orderings).
    const canvasSize =
      lastCanvasSize.width > 0
        ? lastCanvasSize
        : strokeBoundsAsCanvasSize(strokes);

    let category = store.ghostCategory;
    if (store.ghostMode === "auto") {
      const detected = await classifyStrokes(strokes, canvasSize);
      if (detected) {
        store.setGhostAutoCategory(detected);
        category = detected;
      } else {
        // Fall back to whatever was set; show a hint in the UI.
        store.setGhostAutoCategory(null);
      }
    }

    const result = await predictNextStroke({ category, strokes, canvasSize });
    if (!result) {
      // Status stays "loading"; UI conveys "we tried but produced nothing
      // useful" via the absence of a ghost overlay rather than a misleading
      // "ready" pill. (This case is rare now that we suppress early pen-end.)
      store.setGhostModelStatus("idle");
      ctx.log(`Ghost: ${category} produced no prediction`);
      return;
    }
    clearGhost();
    lastPolyline = result.polyline;
    lastHandle = ctx.renderGhost(result.svgPath, "#7c5cff", 0.45);
    // Only flip to "ready" once we've actually emitted a ghost — that way
    // the pill never lies about the canvas state.
    store.setGhostModelStatus("ready");
  } catch (err) {
    console.warn("[ghost] prediction failed:", err);
    useCanvasStore.getState().setGhostModelStatus("error");
    ctx.log(`Ghost: prediction failed (${(err as Error).message ?? err})`);
  } finally {
    inFlight = false;
  }
}

function strokeBoundsAsCanvasSize(strokes: Stroke[]): { width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of strokes) {
    for (const e of s.events) {
      if (e.x < minX) minX = e.x;
      if (e.y < minY) minY = e.y;
      if (e.x > maxX) maxX = e.x;
      if (e.y > maxY) maxY = e.y;
    }
  }
  if (!Number.isFinite(minX)) return { width: 800, height: 600 };
  return { width: Math.max(1, maxX - minX) * 1.5, height: Math.max(1, maxY - minY) * 1.5 };
}

/** Allow the Canvas component to publish its current size on resize so that
 * predictions know the right pixel-factor without a stale value. */
export function publishGhostCanvasSize(size: { width: number; height: number }) {
  lastCanvasSize = size;
}

export const sketchRnnGhostPlugin: AiPlugin = {
  id: "sketch-rnn-ghost",
  name: "Sketch-RNN Ghost",
  description:
    "Predicts the next stroke using Magenta's Sketch-RNN (per-category QuickDraw models). Press G to trigger manually, Tab to accept the suggestion.",

  onStrokeEnd(_stroke, ctx) {
    const { ghostMode } = useCanvasStore.getState();
    // The registry already gates on `ghostVisible`, but also gate on `mode`
    // so the one-shot G-press path doesn't accidentally trigger continuous
    // predictions afterward.
    if (ghostMode === "off") return;
    const strokes = ctx.getSession().strokes;
    // Drop the last user stroke through the model. Async, but we don't
    // block pen events on it — fire and forget.
    void runPrediction(strokes, ctx);
  },
};
