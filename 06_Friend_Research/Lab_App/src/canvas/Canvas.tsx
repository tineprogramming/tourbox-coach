import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Path, Group, Image as KonvaImage } from "react-konva";
import Konva from "konva";
import { getStroke } from "perfect-freehand";
import { useCanvasStore } from "../state/store";
import { TOOL_PRESETS } from "../tools/toolPresets";
import { outlinePointsToSvgPath } from "../util/geometry";
import { useStrokeRecorder } from "./useStrokeRecorder";
import type { Stroke, ToolPreset } from "../types";
import { aiRegistry } from "../ai/registry";
import type { GhostHandle } from "../ai/types";
import { publishGhostCanvasSize } from "../ai/sketchRnnGhost";
import { getPencilTexture } from "../util/pencilTexture";
import { getEngine, type PencilEngine } from "../brush/mypaintBrush";

interface Size {
  width: number;
  height: number;
}

/**
 * Render-time effective stroke size. For brushes that opt in via
 * `tiltSizeBoost`, the size is scaled by the average tilt magnitude across
 * the stroke — mimicking how a real pencil broadens when you lay it on its
 * side. The original chosen `thickness` is still what gets exported in tags.
 */
function effectiveSize(
  thickness: number,
  preset: ToolPreset,
  events: Array<{ tiltX: number; tiltY: number }>,
): number {
  const boost = preset.tiltSizeBoost ?? 0;
  if (!boost || events.length === 0) return thickness;
  let acc = 0;
  for (const e of events) {
    // Magnitude as fraction of the maximum representable tilt (90° on each axis).
    const m = Math.min(1, Math.hypot(e.tiltX, e.tiltY) / 90);
    acc += m;
  }
  const avg = acc / events.length;
  return thickness * (1 + boost * avg);
}

// Convert a finished Stroke to an SVG path string using its tool preset.
function strokeToPath(stroke: Stroke): string {
  const preset = TOOL_PRESETS[stroke.tags.tool];
  const points: [number, number, number][] = stroke.events.map((e) => [
    e.x,
    e.y,
    // perfect-freehand wants pressure as the third coordinate. Mouse pressure
    // is 0.5; pen ranges 0..1. We let `simulatePressure` stay false so the
    // values we pass are honored as-is.
    e.pressure === 0 && e.pointerType !== "pen" ? 0.5 : e.pressure,
  ]);
  const outline = getStroke(points, {
    size: effectiveSize(stroke.tags.thickness, preset, stroke.events),
    ...preset.strokeOptions,
  });
  return outlinePointsToSvgPath(outline);
}

/**
 * Render a stroke. Most tools render as a single crisp Path. The pencil
 * renders as a Group of two Paths:
 *
 *   1. A colored body with a small same-color drop-shadow. The shadow
 *      gives the stroke *soft anti-aliased flanks* — the single biggest
 *      thing that makes a digital pencil mark stop looking like a marker
 *      and start looking like graphite. (Inspired by the AAAI 2021 paper
 *      "Sketch Generation with Drawing Process Guided by Vector Flow and
 *      Grayscale": each individual mark in their results has a clean
 *      tapered body with soft fuzzy edges; we reproduce that here.)
 *   2. A subtle paper-tooth overlay clipped to the same outline, adding
 *      gentle internal density variation without ever speckling.
 *
 * Tone build-up — the gritty, hatched look of a heavily-shaded region —
 * comes from the *user* drawing many overlapping strokes, exactly like
 * real pencil work and exactly like the paper does it. We don't fake it
 * inside a single mark.
 */
function StrokeView({
  path,
  color,
  opacity,
  preset,
  pencilTexture,
}: {
  path: string;
  color: string;
  opacity: number;
  preset: ToolPreset;
  pencilTexture: HTMLCanvasElement | null;
}) {
  if (!path) return null;
  const isPencil = preset.texture === "pencil" && pencilTexture;

  if (!isPencil) {
    return (
      <Path
        data={path}
        fill={color}
        opacity={opacity}
        globalCompositeOperation={preset.compositeOperation}
      />
    );
  }

  return (
    <Group>
      <Path
        data={path}
        fill={color}
        opacity={opacity}
        globalCompositeOperation={preset.compositeOperation}
        shadowColor={color}
        shadowBlur={3}
        shadowOffsetX={0}
        shadowOffsetY={0}
        // Cap shadow alpha low so it reads as a soft flank, never as a glow.
        shadowOpacity={Math.min(0.4, opacity * 0.7)}
      />
      <Path
        data={path}
        // Konva accepts HTMLCanvasElement at runtime; its types want HTMLImageElement.
        fillPatternImage={pencilTexture as unknown as HTMLImageElement}
        fillPatternRepeat="repeat"
        // Tooth is felt, not seen. Scale gently with body opacity so light
        // pressure marks have light tooth too.
        opacity={Math.min(0.45, 0.2 + opacity * 0.4)}
      />
    </Group>
  );
}

/**
 * Renders the in-progress stroke that hasn't been committed yet. We re-render
 * the path on every pointer move using local React state so the user sees
 * smooth feedback. Once pointerup fires, this clears and the parent renders
 * the committed stroke instead.
 */
function useLiveStroke() {
  const [livePoints, setLivePoints] = useState<[number, number, number][]>([]);
  const tool = useCanvasStore((s) => s.tool);
  const thickness = useCanvasStore((s) => s.thickness);
  const color = useCanvasStore((s) => s.color);
  const opacity = useCanvasStore((s) => s.opacity);
  const preset = TOOL_PRESETS[tool];

  const path = useMemo(() => {
    if (!livePoints.length) return "";
    const outline = getStroke(livePoints, {
      size: thickness,
      ...preset.strokeOptions,
    });
    return outlinePointsToSvgPath(outline);
  }, [livePoints, thickness, preset.strokeOptions]);

  return {
    livePoints,
    setLivePoints,
    path,
    color,
    opacity,
    preset,
  };
}

export function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [size, setSize] = useState<Size>({ width: 800, height: 600 });

  const strokes = useCanvasStore((s) => s.session.strokes);
  const ghostVisible = useCanvasStore((s) => s.ghostVisible);

  const recorder = useStrokeRecorder();
  const live = useLiveStroke();

  // Cached procedural texture for the pencil tool. Generated once per page load.
  // Only used as a fallback if the libmypaint engine fails to load.
  const pencilTexture = useMemo(
    () => (typeof document === "undefined" ? null : getPencilTexture()),
    [],
  );

  // ---- libmypaint raster layer ----
  // An offscreen HTMLCanvasElement that libmypaint paints onto whenever the
  // active tool's preset has `engine === "mypaint"` (every tool we ship). A
  // Konva.Image displays it as the bottom-most drawing layer. The vector
  // live-preview / committed-strokes layers are only used as a brief
  // fallback while the wasm engine is loading.
  // We hold the canvas in a ref (not state) because libmypaint mutates it
  // in place at pointermove rate — we don't want React reconciliation in
  // the hot path.
  const rasterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  if (!rasterCanvasRef.current && typeof document !== "undefined") {
    rasterCanvasRef.current = document.createElement("canvas");
  }
  const rasterLayerRef = useRef<Konva.Layer | null>(null);
  const engineRef = useRef<PencilEngine | null>(null);
  const engineLoadingRef = useRef(false);
  // State (not just a ref) because layers below need to know when to start
  // hiding the vector fallback in favor of the raster.
  const [engineReady, setEngineReady] = useState(false);
  // IDs of strokes already rasterized (live or replayed). Lets the replay
  // effect skip strokes the live painter already drew, avoiding double-draw.
  const renderedIdsRef = useRef<Set<string>>(new Set());
  // True while a libmypaint-routed stroke is being live-painted onto the
  // raster. Vector-fallback strokes (only used while engine is loading)
  // take the legacy live-preview path instead.
  const isMypaintStrokeRef = useRef(false);
  // Wall-clock millis of the previous event fed to libmypaint during the
  // active stroke. Lets us pass real `dt` so libmypaint's speed-dependent
  // dab spacing/jitter behaves correctly.
  const lastMypaintEventTRef = useRef<number>(0);
  // True between pointerdown and pointerup. We use a ref (not state) so we
  // don't re-render the whole canvas on every drawing toggle, and so the
  // pointer handlers see the latest value without a stale closure.
  const isDrawingRef = useRef(false);

  /** Does this tool route to libmypaint when the engine is ready? */
  function isMypaintTool(toolId: Stroke["tags"]["tool"]): boolean {
    return TOOL_PRESETS[toolId].engine === "mypaint";
  }

  // Replay a single stroke through libmypaint onto the raster canvas.
  // Used on initial mount (to reconstruct strokes loaded from localStorage)
  // and after destructive edits (undo / clear). Picks the brush definition
  // from the stroke's recorded tool tag, so a session that mixes pencils,
  // markers, watercolor, etc. replays each with the right brush.
  function replayMypaintStroke(stroke: Stroke) {
    const eng = engineRef.current;
    if (!eng || stroke.events.length === 0) return;
    const preset = TOOL_PRESETS[stroke.tags.tool];
    if (!preset.brushFile) return;
    const first = stroke.events[0];
    eng.startStroke({
      brushId: preset.brushFile,
      x: first.x,
      y: first.y,
      color: stroke.tags.color,
      thicknessPx: stroke.tags.thickness,
      radiusScale: preset.radiusScale,
    });
    for (let i = 1; i < stroke.events.length; i++) {
      const ev = stroke.events[i];
      const prev = stroke.events[i - 1];
      eng.strokeTo({
        x: ev.x,
        y: ev.y,
        pressure: ev.pressure || (ev.pointerType === "pen" ? 0 : 0.5),
        tiltX: ev.tiltX,
        tiltY: ev.tiltY,
        dtMs: ev.tAbs - prev.tAbs,
      });
    }
    eng.endStroke();
  }

  // Wipe the raster and replay every mypaint-routed stroke currently in
  // the store. Idempotent and safe to call any time the engine is loaded.
  function rebuildRaster(strokeList: Stroke[]) {
    const canvas = rasterCanvasRef.current;
    if (!canvas) return;
    // `willReadFrequently` matches what brushlib asks for inside its painter
    // constructor; passing it here too ensures the 2D backend is the
    // readback-optimized one regardless of which call grabs the context
    // first (Chrome caches the first call's options).
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    renderedIdsRef.current.clear();
    if (engineRef.current) {
      for (const s of strokeList) {
        if (!isMypaintTool(s.tags.tool)) continue;
        replayMypaintStroke(s);
        renderedIdsRef.current.add(s.id);
      }
    }
    rasterLayerRef.current?.batchDraw();
  }

  // Lazy-load libmypaint on mount and replay any persisted pencil strokes.
  useEffect(() => {
    if (engineRef.current || engineLoadingRef.current) return;
    const canvas = rasterCanvasRef.current;
    if (!canvas) return;
    canvas.width = size.width;
    canvas.height = size.height;
    engineLoadingRef.current = true;
    getEngine(canvas).then((eng) => {
      engineLoadingRef.current = false;
      if (!eng) return;
      engineRef.current = eng;
      setEngineReady(true);
      const current = useCanvasStore.getState().session.strokes;
      rebuildRaster(current);
    });
    // We deliberately mount the engine once. Subsequent size changes are
    // handled by the resize effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On stage resize, resize the raster to match and replay pencil strokes.
  useEffect(() => {
    const canvas = rasterCanvasRef.current;
    if (!canvas) return;
    if (canvas.width === size.width && canvas.height === size.height) return;
    canvas.width = size.width;
    canvas.height = size.height;
    if (engineRef.current) {
      rebuildRaster(useCanvasStore.getState().session.strokes);
    }
  }, [size.width, size.height]);

  // When committed strokes change, detect destructive edits (undo / clear) and
  // rebuild the raster. Live additions are already painted in real time and
  // their IDs are pre-recorded in `renderedIdsRef`, so they no-op here.
  useEffect(() => {
    if (!engineRef.current) return;
    const currentIds = new Set(strokes.map((s) => s.id));
    let needRebuild = false;
    for (const id of renderedIdsRef.current) {
      if (!currentIds.has(id)) {
        needRebuild = true;
        break;
      }
    }
    if (needRebuild) rebuildRaster(strokes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  // Ghost overlay state (managed by AI registry).
  const [ghosts, setGhosts] = useState<
    { id: number; path: string; color: string; opacity: number }[]
  >([]);
  const ghostIdRef = useRef(0);

  // Resize observer.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
        // Tell the Sketch-RNN ghost plugin about the current canvas size so
        // its pixel-factor calibration uses fresh dimensions on every resize.
        publishGhostCanvasSize({ width, height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Register the ghost renderer with the AI registry.
  useEffect(() => {
    aiRegistry.setGhostRenderer((path, color = "#7c5cff", opacity = 0.35) => {
      const id = ++ghostIdRef.current;
      setGhosts((prev) => [...prev, { id, path, color, opacity }]);
      const handle: GhostHandle = {
        clear: () => setGhosts((prev) => prev.filter((g) => g.id !== id)),
      };
      return handle;
    });
    return () => aiRegistry.setGhostRenderer(null);
  }, []);

  // Clear ghosts when ghost visibility is turned off.
  useEffect(() => {
    if (!ghostVisible) setGhosts([]);
  }, [ghostVisible]);

  // Disable native gestures (pinch-zoom, swipe-back) on the canvas.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const node = stage.content;
    const prevent = (e: Event) => e.preventDefault();
    node.addEventListener("touchstart", prevent, { passive: false });
    node.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      node.removeEventListener("touchstart", prevent);
      node.removeEventListener("touchmove", prevent);
    };
  }, []);

  function relativePos(e: PointerEvent): { x: number; y: number } {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.container().getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    const native = e.evt;

    // Only start a stroke when the user has actually committed to drawing:
    //  - mouse  → left button must be held (buttons & 1)
    //  - pen    → tip must be in contact with non-zero pressure
    //  - touch  → contact is implicit (`buttons` is set on touch by spec)
    // This is the fix for: "hovering my mouse on the canvas starts drawing".
    const isMouse = native.pointerType === "mouse";
    const isPen = native.pointerType === "pen";
    const leftButtonHeld = (native.buttons & 1) === 1;
    if (isMouse && !leftButtonHeld) return;
    if (isPen && (native.pressure ?? 0) <= 0) return;
    if (native.button !== 0 && native.button !== -1) return;

    // Capture the pointer so we keep getting moves even if the cursor leaves the canvas.
    (native.target as Element)?.setPointerCapture?.(native.pointerId);
    const { x, y } = relativePos(native);
    recorder.onPointerDown(native, x, y);
    isDrawingRef.current = true;

    const { tool, color, thickness } = useCanvasStore.getState();
    const preset = TOOL_PRESETS[tool];
    const pressure = native.pressure || (isPen ? 0 : 0.5);

    if (preset.engine === "mypaint" && preset.brushFile && engineRef.current) {
      // Tool routes through libmypaint and rasterizes directly. No vector
      // live preview needed — the raster IS the preview. The eraser also
      // takes this path: its CC0 brush definition has `eraser: 1.0`, so
      // libmypaint's drawDab callback sets `globalCompositeOperation =
      // 'destination-out'` and the same code path erases pixels.
      isMypaintStrokeRef.current = true;
      engineRef.current.startStroke({
        brushId: preset.brushFile,
        x,
        y,
        color,
        thicknessPx: thickness,
        radiusScale: preset.radiusScale,
      });
      lastMypaintEventTRef.current = performance.now();
      rasterLayerRef.current?.batchDraw();
    } else {
      isMypaintStrokeRef.current = false;
      live.setLivePoints([[x, y, pressure]]);
    }
  }

  function handlePointerMove(e: Konva.KonvaEventObject<PointerEvent>) {
    const native = e.evt;

    // Ignore hover moves. Only when a stroke is active do we extend the
    // live preview and feed the recorder.
    if (!isDrawingRef.current) return;

    // Defensive: if the user released the mouse button outside the window
    // (so we never got a pointerup), end the stroke now.
    if (native.pointerType === "mouse" && (native.buttons & 1) === 0) {
      finishStroke(native);
      return;
    }

    const { x, y } = relativePos(native);
    recorder.onPointerMove(native, x, y);

    const coalesced =
      typeof native.getCoalescedEvents === "function"
        ? native.getCoalescedEvents()
        : [];

    if (isMypaintStrokeRef.current && engineRef.current) {
      // Feed each event (or coalesced sub-event) into libmypaint. Same code
      // path for pencil, marker, watercolor, eraser, smudge, etc. — what
      // changes is just the brush definition that was loaded at startStroke.
      const rect = stageRef.current!.container().getBoundingClientRect();
      const events = coalesced.length > 0 ? coalesced : [native];
      // Distribute the inter-frame interval across coalesced sub-events so
      // libmypaint's speed-dependent dynamics (offset_by_speed, etc.) get
      // the right per-dab dt rather than seeing them all at the same time.
      const nowT = performance.now();
      const totalDt = Math.max(1, nowT - lastMypaintEventTRef.current);
      const perEventDt = totalDt / events.length;
      for (const ev of events) {
        const cx = coalesced.length > 0 ? ev.clientX - rect.left : x;
        const cy = coalesced.length > 0 ? ev.clientY - rect.top : y;
        engineRef.current.strokeTo({
          x: cx,
          y: cy,
          pressure: ev.pressure || (ev.pointerType === "pen" ? 0 : 0.5),
          tiltX: ev.tiltX || 0,
          tiltY: ev.tiltY || 0,
          dtMs: perEventDt,
        });
      }
      lastMypaintEventTRef.current = nowT;
      rasterLayerRef.current?.batchDraw();
      return;
    }

    // Vector fallback path — only reached if the engine isn't ready yet.
    const newPoints: [number, number, number][] = [];
    if (coalesced.length > 0) {
      const rect = stageRef.current!.container().getBoundingClientRect();
      for (const ce of coalesced) {
        newPoints.push([
          ce.clientX - rect.left,
          ce.clientY - rect.top,
          ce.pressure || (ce.pointerType === "pen" ? 0 : 0.5),
        ]);
      }
    } else {
      newPoints.push([x, y, native.pressure || (native.pointerType === "pen" ? 0 : 0.5)]);
    }
    live.setLivePoints((prev) => [...prev, ...newPoints]);
  }

  function finishStroke(native: PointerEvent) {
    if (!isDrawingRef.current) return;
    const { x, y } = relativePos(native);
    recorder.onPointerUp(native, x, y);
    if (isMypaintStrokeRef.current) {
      engineRef.current?.endStroke();
      // The recorder just pushed the finished stroke into the store — mark
      // its ID as already-rasterized so the strokes-changed effect doesn't
      // clear and replay it.
      const last = useCanvasStore.getState().session.strokes.at(-1);
      if (last && isMypaintTool(last.tags.tool)) {
        renderedIdsRef.current.add(last.id);
      }
      isMypaintStrokeRef.current = false;
      rasterLayerRef.current?.batchDraw();
    } else {
      live.setLivePoints([]);
    }
    isDrawingRef.current = false;
  }

  function handlePointerUp(e: Konva.KonvaEventObject<PointerEvent>) {
    finishStroke(e.evt);
  }

  return (
    <div ref={containerRef} className="canvas-host">
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: "none", cursor: "crosshair" }}
      >
        {/* Raster pencil layer (libmypaint pixels). Sits beneath the vector
            strokes so vector tools (markers, ink, etc.) can still composite
            on top via Konva's normal alpha blending. */}
        <Layer ref={rasterLayerRef} listening={false}>
          {rasterCanvasRef.current && (
            <KonvaImage
              image={rasterCanvasRef.current}
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              listening={false}
            />
          )}
        </Layer>

        {/* Committed strokes. When the libmypaint engine is ready every
            mypaint-routed tool's strokes already live on the raster layer
            below, so they're skipped here. The vector renderer is only
            visible for strokes captured during the brief window before
            the engine finished loading (graceful fallback). */}
        <Layer listening={false}>
          {strokes
            .filter((s) => !(engineReady && isMypaintTool(s.tags.tool)))
            .map((s) => (
              <StrokeView
                key={s.id}
                path={strokeToPath(s)}
                color={s.tags.color}
                opacity={s.tags.opacity}
                preset={TOOL_PRESETS[s.tags.tool]}
                pencilTexture={pencilTexture}
              />
            ))}
        </Layer>

        {/* Live (in-progress) stroke fallback for tools whose engine route
            isn't available (only true while the wasm is still loading). */}
        <Layer listening={false}>
          {(live.preset.engine !== "mypaint" || !engineReady) && (
            <StrokeView
              path={live.path}
              color={live.color}
              opacity={live.opacity}
              preset={live.preset}
              pencilTexture={pencilTexture}
            />
          )}
        </Layer>

        {/* Ghost overlay (Sketch-RNN stub). */}
        <Layer listening={false} visible={ghostVisible}>
          {ghosts.map((g) => (
            <Path key={g.id} data={g.path} fill={g.color} opacity={g.opacity} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
