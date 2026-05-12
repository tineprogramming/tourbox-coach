// "Paper tooth" texture for the 6B Pencil — a SOFT, low-contrast value-noise
// pattern that gives strokes a subtle internal grain without ever looking
// like speckle / dots / dirt.
//
// Inspiration: Tong et al., "Sketch Generation with Drawing Process Guided by
// Vector Flow and Grayscale" (AAAI 2021) — their pencil marks have a clean,
// soft body with gentle longitudinal density variation; the gritty look in
// their results comes from *many overlapping marks*, not from per-mark
// speckle. We reproduce that aesthetic with a low-amplitude tooth tile here,
// and rely on the user's hatching strokes to provide the rest.
//
// Generated once and cached. Browser-only.

let cachedSurface: HTMLCanvasElement | null = null;

const TILE = 128;

// Cheap deterministic 2D value-noise. Bilinearly-interpolated hash on an 8-px
// lattice — looks smooth, coherent, no visible blockiness at this scale.
function hash2(ix: number, iy: number): number {
  const h = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy;
}

// Two-octave noise: low-frequency carrier + high-frequency detail. Keeps the
// tone variation gentle and readable as paper tooth, not as random pixels.
function tooth(x: number, y: number): number {
  const lo = valueNoise(x / 12, y / 12);
  const hi = valueNoise(x / 3, y / 3);
  return 0.7 * lo + 0.3 * hi;
}

export function getPencilTexture(): HTMLCanvasElement {
  if (cachedSurface) return cachedSurface;

  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, TILE, TILE);

  const img = ctx.createImageData(TILE, TILE);
  const data = img.data;

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = (y * TILE + x) * 4;
      // n in [0, 1]. We push the distribution toward the dark end so the
      // texture *darkens* the colored body underneath rather than lightening it.
      const n = tooth(x, y);
      // Soft envelope: only the lower ~50% of the noise becomes visible. The
      // rest is transparent. This is what produces the "tooth" feel — small,
      // smooth darker regions scattered in an otherwise clean stroke.
      if (n > 0.55) {
        data[i + 3] = 0; // transparent
        continue;
      }
      const t = (0.55 - n) / 0.55; // 0 at the cutoff, 1 at the darkest
      // Keep colors close to graphite gray, never pure black — graphite is
      // never crisp black, especially in soft pencil grades.
      const gray = Math.round(80 - t * 30); // 50..80
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      // Cap alpha low (≤ 60/255) so the texture is felt, not seen.
      data[i + 3] = Math.round(t * 60);
    }
  }

  ctx.putImageData(img, 0, 0);
  cachedSurface = c;
  return c;
}
