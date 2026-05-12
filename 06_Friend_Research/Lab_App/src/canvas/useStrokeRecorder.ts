import { useCallback, useRef } from "react";
import type { Stroke, StrokeEvent } from "../types";
import { useCanvasStore } from "../state/store";
import { useTelemetryStore } from "../state/telemetry";
import { tiltToAzimuthAltitude } from "../util/geometry";
import { newId } from "../util/id";
import { aiRegistry } from "../ai/registry";

interface ActiveStroke {
  id: string;
  startedAt: number;
  startedAtPerf: number;
  events: StrokeEvent[];
  lastSampleAt: number;
  lastX: number;
  lastY: number;
}

/**
 * Hook that converts raw browser PointerEvents into our typed StrokeEvent stream
 * and persists completed strokes into the canvas store.
 *
 * Why this is a hook and not a class: we need access to Zustand actions and
 * we want stable callbacks for React-Konva's onPointer* props.
 */
export function useStrokeRecorder() {
  const ref = useRef<ActiveStroke | null>(null);
  const pushStroke = useCanvasStore((s) => s.pushStroke);
  const markPenSeen = useCanvasStore((s) => s.markPenSeen);
  const startStrokeTel = useTelemetryStore((s) => s.startStroke);
  const endStrokeTel = useTelemetryStore((s) => s.endStroke);
  const pushSampleTel = useTelemetryStore((s) => s.pushSample);
  const setCoalescedSupported = useTelemetryStore((s) => s.setCoalescedSupported);

  const sampleFromEvent = useCallback(
    (
      e: PointerEvent,
      stroke: ActiveStroke,
      x: number,
      y: number,
      isFirst: boolean,
    ): StrokeEvent => {
      const tAbs = performance.now();
      const t = tAbs - stroke.startedAtPerf;
      const dt = tAbs - stroke.lastSampleAt;
      const dx = x - stroke.lastX;
      const dy = y - stroke.lastY;
      const dist = Math.hypot(dx, dy);
      const speed = dt > 0 ? (dist / dt) * 1000 : 0;
      const { azimuth, altitude } = tiltToAzimuthAltitude(e.tiltX || 0, e.tiltY || 0);

      return {
        x,
        y,
        // Pressure is 0..1; mouse reports 0.5 by spec on click. Pen reports real values.
        pressure: e.pressure ?? 0,
        tiltX: e.tiltX || 0,
        tiltY: e.tiltY || 0,
        azimuth,
        altitude,
        twist: e.twist || 0,
        tangentialPressure: e.tangentialPressure || 0,
        width: e.width || 0,
        height: e.height || 0,
        pointerType: (e.pointerType as StrokeEvent["pointerType"]) || "unknown",
        t,
        tAbs,
        speed,
        isFirst,
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (native: PointerEvent, x: number, y: number) => {
      // Only act on a single primary pointer.
      if (!native.isPrimary) return;
      // Prevent right-click / middle-click drawing.
      if (native.button !== 0 && native.button !== -1) return;

      if (native.pointerType === "pen") markPenSeen();

      const startedAtPerf = performance.now();
      const stroke: ActiveStroke = {
        id: newId("stk"),
        startedAt: Date.now(),
        startedAtPerf,
        events: [],
        lastSampleAt: startedAtPerf,
        lastX: x,
        lastY: y,
      };
      ref.current = stroke;

      const sample = sampleFromEvent(native, stroke, x, y, true);
      stroke.events.push(sample);
      stroke.lastSampleAt = sample.tAbs;

      startStrokeTel();
      pushSampleTel(sample);
    },
    [markPenSeen, sampleFromEvent, startStrokeTel, pushSampleTel],
  );

  const onPointerMove = useCallback(
    (native: PointerEvent, x: number, y: number) => {
      const stroke = ref.current;
      if (!stroke) return;

      // Recover sub-frame samples from Wacom drivers (200+ Hz).
      const coalesced =
        typeof native.getCoalescedEvents === "function"
          ? native.getCoalescedEvents()
          : [];
      if (coalesced.length > 0) setCoalescedSupported(true);

      // If the driver coalesced multiple events into this frame, recover them.
      // Each coalesced event has its own pressure / tilt / time but shares the
      // current page coordinates as the *last* point — we just trust the data.
      if (coalesced.length > 0) {
        for (const ce of coalesced) {
          // Map page coords → canvas coords using the same transform we applied
          // to the parent event. Since the canvas is at a known offset and is
          // not transformed at the lab stage, we approximate with offsetX/Y.
          // Konva passes us already-converted x/y in the parent handler, so for
          // coalesced events we use offsetX/offsetY relative to the canvas.
          const cx = ce.offsetX;
          const cy = ce.offsetY;
          const sample = sampleFromEvent(ce, stroke, cx, cy, false);
          stroke.events.push(sample);
          stroke.lastSampleAt = sample.tAbs;
          stroke.lastX = cx;
          stroke.lastY = cy;
          pushSampleTel(sample);
        }
      } else {
        const sample = sampleFromEvent(native, stroke, x, y, false);
        stroke.events.push(sample);
        stroke.lastSampleAt = sample.tAbs;
        stroke.lastX = x;
        stroke.lastY = y;
        pushSampleTel(sample);
      }
    },
    [sampleFromEvent, pushSampleTel, setCoalescedSupported],
  );

  const onPointerUp = useCallback(
    (native: PointerEvent, x: number, y: number) => {
      const stroke = ref.current;
      if (!stroke) return;

      const sample = sampleFromEvent(native, stroke, x, y, false);
      stroke.events.push(sample);

      const { tool, thickness, color, opacity } = useCanvasStore.getState();

      const finished: Stroke = {
        id: stroke.id,
        startedAt: stroke.startedAt,
        endedAt: Date.now(),
        tags: {
          tool,
          thickness,
          color,
          opacity,
          layerId: "main",
        },
        events: stroke.events,
      };
      pushStroke(finished);
      ref.current = null;
      endStrokeTel();
      // Notify AI plugins so the ghost overlay (etc.) can update.
      aiRegistry.notifyStrokeEnd(finished);
    },
    [pushStroke, endStrokeTel, sampleFromEvent],
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
