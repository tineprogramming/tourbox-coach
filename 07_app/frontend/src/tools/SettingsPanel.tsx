import { useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import { useCanvasStore } from "../state/store";
import { TOOL_PRESETS } from "./toolPresets";
import { outlinePointsToSvgPath } from "../util/geometry";
import { getActiveEngine, onEngineReady } from "../brush/mypaintBrush";
import { useT } from "../i18n/useT";

const SWATCHES = [
  "#0b0b0b",
  "#1c1c1c",
  "#5b5b5b",
  "#ffffff",
  "#e63946",
  "#f5a623",
  "#f7d51d",
  "#34d399",
  "#22d3ee",
  "#3a8fd1",
  "#5b3df5",
  "#d946ef",
];

export function SettingsPanel() {
  const tool = useCanvasStore((s) => s.tool);
  const thickness = useCanvasStore((s) => s.thickness);
  const color = useCanvasStore((s) => s.color);
  const opacity = useCanvasStore((s) => s.opacity);
  const setThickness = useCanvasStore((s) => s.setThickness);
  const setColor = useCanvasStore((s) => s.setColor);
  const setOpacity = useCanvasStore((s) => s.setOpacity);
  const preset = TOOL_PRESETS[tool];
  const t = useT();

  return (
    <section className="settings">
      <header className="settings-header">
        <span className="settings-tool">{preset.label}</span>
        <span className="settings-help">{preset.description}</span>
      </header>

      <div className="settings-row">
        <label htmlFor="thickness">
          {t("settings.thickness")} <span className="mono">{thickness} px</span>
        </label>
        <input
          id="thickness"
          type="range"
          min={1}
          max={80}
          step={1}
          value={thickness}
          onChange={(e) => setThickness(Number(e.target.value))}
        />
      </div>

      <div className="settings-row">
        <label htmlFor="opacity">
          {t("settings.opacity")} <span className="mono">{opacity.toFixed(2)}</span>
        </label>
        <input
          id="opacity"
          type="range"
          min={0.05}
          max={1}
          step={0.01}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          disabled={tool === "eraser"}
        />
      </div>

      <div className="settings-row">
        <label>{t("settings.color")}</label>
        <div className="swatches">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${color.toLowerCase() === c.toLowerCase() ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Use color ${c}`}
              disabled={tool === "eraser"}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="swatch swatch-picker"
            disabled={tool === "eraser"}
            aria-label={t("settings.customColor")}
          />
        </div>
      </div>

      <div className="brush-preview">
        <BrushPreview />
      </div>
    </section>
  );
}

/**
 * Live preview of the active tool. We render an actual libmypaint stroke (a
 * gentle S-curve with a pressure ramp 0 → 1 → 0.5) into an offscreen canvas
 * so the user sees the *real* brush — not a perfect-freehand stand-in. The
 * preview re-runs every time the active tool, color, or thickness changes,
 * and on initial engine readiness.
 *
 * The smudge / palette-knife brushes use the canvas underneath them as
 * source color. To avoid showing a transparent stripe (no source pixels =
 * transparent dab), we lay down a faint colored streak with a different
 * brush first when previewing those tools, so smudge has something to pull.
 *
 * For tools with `engine !== "mypaint"` (currently none, but the type stays
 * open for future plugins), or while the engine is still loading, we fall
 * back to the legacy perfect-freehand SVG preview.
 */
function BrushPreview() {
  const tool = useCanvasStore((s) => s.tool);
  const thickness = useCanvasStore((s) => s.thickness);
  const color = useCanvasStore((s) => s.color);
  const opacity = useCanvasStore((s) => s.opacity);
  const preset = TOOL_PRESETS[tool];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Mirror the engine's readiness so we re-render once it loads. We can't
  // use Zustand here because the engine lives outside the store.
  const [engineReady, setEngineReady] = useState(() => !!getActiveEngine());

  useEffect(() => {
    if (engineReady) return;
    const unsub = onEngineReady(() => setEngineReady(true));
    // Polling fallback: if `getEngine` resolved before this effect ran,
    // the listener will never fire. Check once after mount.
    if (getActiveEngine()) setEngineReady(true);
    return unsub;
  }, [engineReady]);

  // Fixed render dimensions. The DOM <canvas> is letter-boxed via CSS to
  // remain crisp on HiDPI; we keep our internal coords stable.
  const W = 240;
  const H = Math.max(thickness * 1.4 + 16, 56);

  useEffect(() => {
    if (!engineReady) return;
    if (preset.engine !== "mypaint" || !preset.brushFile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    // Smudge / palette-knife brushes call getImageData per dab when they
    // render into this preview ctx; opt into the readback-optimized backend.
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const eng = getActiveEngine();
    if (!eng) return;

    // Smudge / knife tools pull color from the canvas; without an underlying
    // wash they'd render to nothing. Lay down a soft swipe of the active
    // color first, with the airbrush, so they have material to push around.
    const isPullTool = preset.brushFile === "smudge" || preset.brushFile === "knife";
    if (isPullTool) {
      eng.renderPreview({
        ctx,
        brushId: "soft_airbrush",
        color,
        thicknessPx: Math.max(thickness * 1.2, 14),
        radiusScale: 1.4,
        width: W,
        height: H,
      });
    }

    eng.renderPreview({
      ctx,
      brushId: preset.brushFile,
      color,
      thicknessPx: thickness,
      radiusScale: preset.radiusScale,
      width: W,
      height: H,
    });
    // We intentionally re-render on every prop change.
  }, [engineReady, tool, thickness, color, opacity, preset, W, H]);

  // Vector fallback while the engine isn't ready yet (or for any future
  // non-mypaint tool). Re-uses the prior perfect-freehand preview path.
  const showFallback = !engineReady || preset.engine !== "mypaint";

  return (
    <div className="brush-preview-frame" style={{ height: H }}>
      {showFallback ? (
        <FallbackPreview width={W} height={H} />
      ) : (
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
          aria-label={`Live ${preset.label} preview`}
        />
      )}
    </div>
  );
}

function FallbackPreview({ width, height }: { width: number; height: number }) {
  const tool = useCanvasStore((s) => s.tool);
  const thickness = useCanvasStore((s) => s.thickness);
  const color = useCanvasStore((s) => s.color);
  const opacity = useCanvasStore((s) => s.opacity);
  const preset = TOOL_PRESETS[tool];

  const samples: [number, number, number][] = [];
  const N = 24;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const pressure = Math.sin(u * Math.PI) * 0.8 + 0.2;
    samples.push([10 + u * (width - 20), height / 2, pressure]);
  }
  const outline = getStroke(samples, {
    size: thickness,
    ...preset.strokeOptions,
  });
  const path = outlinePointsToSvgPath(outline);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label={`${preset.label} preview (loading)`}
    >
      <path
        d={path}
        fill={tool === "eraser" ? "#7c879a" : color}
        opacity={opacity}
        style={{
          mixBlendMode:
            preset.compositeOperation === "multiply" ? "multiply" : "normal",
        }}
      />
    </svg>
  );
}
