// Capture the current canvas as a PNG data URL.
//
// We composite *all* canvases inside `.konvajs-content` so that the raster
// layer (libmypaint) and the vector layer (perfect-freehand strokes) both
// land in the output. Konva renders one <canvas> per layer, and grabbing
// only the first one misses the libmypaint pixels.
//
// We also upscale to at least MIN_DIM on the shorter side so Polish
// providers (Seedream ≥ 1920px, Wanxiang ≥ 512px) don't reject the input.
// The browser canvas at typical laptop sizes (~800-1200px) would otherwise
// fail Seedream's minimum.

const CANVAS_BG  = "#fbfbf8";
const MIN_SHORT  = 2048; // shorter side minimum (Seedream needs ≥ 1920)
const MAX_LONG   = 3840; // longest side maximum (Wanxiang/Seedream cap 4096)

export function getCanvasSnapshot(): string | null {
  const container = document.querySelector(".konvajs-content") as HTMLElement | null;
  if (!container) return null;
  const canvases = Array.from(container.querySelectorAll("canvas")) as HTMLCanvasElement[];
  if (canvases.length === 0) return null;

  const first = canvases[0];
  const srcW = first.width;
  const srcH = first.height;
  if (!srcW || !srcH) return null;

  // Scale so: shorter side ≥ MIN_SHORT AND longest side ≤ MAX_LONG.
  // On big monitors (4K) the canvas can already exceed 4096px — which
  // Wanxiang and Seedream reject. Prioritise staying under MAX_LONG.
  const scaleForMin = MIN_SHORT / Math.min(srcW, srcH);
  const scaleForMax = MAX_LONG  / Math.max(srcW, srcH);
  const scale = Math.min(scaleForMin, scaleForMax); // both constraints
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);
  // Safety check — never produce images outside Wanxiang's 512-4096 range.
  if (outW < 512 || outH < 512 || outW > 4096 || outH > 4096) {
    console.warn(`[canvasSnapshot] output ${outW}x${outH} out of range`);
  }

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  // High-quality upscale (browser's bicubic). Same look-feel as the
  // original strokes, just at higher resolution.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = CANVAS_BG;
  ctx.fillRect(0, 0, outW, outH);
  for (const c of canvases) {
    try {
      ctx.drawImage(c, 0, 0, outW, outH);
    } catch {
      // tainted-canvas guard; shouldn't happen for our local layers.
    }
  }
  return out.toDataURL("image/png");
}
