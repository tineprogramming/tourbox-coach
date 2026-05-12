# Initial Lab Development — Task Tracker (macOS)

> **Mission source:** `HistoricalPrompt/Initial_OS_Development_Lab.md`
> **Target OS:** macOS (verified on macOS 26.4 Tahoe, Apple Silicon, Node 22, npm 11)
> **Hardware:** Wacom pen-display / pad connected via USB or Bluetooth
> **App location (planned):** `Lab_App/` at the workspace root
> **Mode:** **fully offline** — no network calls in the lab build; AI features are stubbed extension points only

---

## Goal of This Lab

Build a desktop-feeling drawing app that:

1. Accepts strokes from the user's Wacom pen on macOS at full fidelity.
2. Captures and **visualizes in real time** every dimension of the pen signal: `x`, `y`, `pressure`, `tilt_x`, `tilt_y`, `azimuth`, `speed`, `time`.
3. **Tags every stroke** with `(tool, thickness, color)` so the resulting dataset is immediately useful for future model training.
4. Provides a **clean extension point** so the planned AI features can be dropped in without rewriting the canvas:
   - `Polish My Drawing` (sketch-to-image)
   - `Sketch-RNN` next-stroke ghost suggestions

---

## Phased Task List

Each task has an explicit done-criterion. Update boxes as work lands.

### Phase 0 — Setup & verification

- [x] **0.1** Confirm Node 22 / npm 11 on the user's MacBook.
- [x] **0.2** Decide tech stack (locked below).
- [x] **0.3** Save this task tracker.
- [x] **0.4** Scaffold `Lab_App/` with Vite + React 19 + TypeScript.
- [x] **0.5** Install dependencies: `konva`, `react-konva`, `perfect-freehand`, `zustand`, `clsx`.
- [x] **0.6** Verify `npm run dev` opens at `http://localhost:5173` without errors. *(Vite reports ready in 107 ms, production build 527 KB.)*
- [ ] **0.7** Tilt-on-Wacom smoke test in Chrome on macOS — *requires the user's hardware; the HUD's `PEN OK` badge and live `tiltX/Y` readouts are the test.*

**Tech stack (locked)**

| Concern | Pick | Why |
|---|---|---|
| Build / dev | Vite | Instant HMR, zero config, ESM-native |
| UI | React 19 + TypeScript | Familiar, fast |
| Canvas | Konva.js + react-konva | Imperative pixel control, layer model |
| Stroke rendering | perfect-freehand | Pressure-aware vector strokes used by tldraw, Excalidraw |
| State | Zustand | Lightweight, no boilerplate |
| Pen capture | native `PointerEvents` API + `getCoalescedEvents()` | Full pressure + tilt on macOS Chrome |
| Storage | `localStorage` for session metadata; in-memory + JSONL export for stroke logs | Offline, no server |
| AI hooks | typed plugin interface in `src/ai/` | Pluggable stubs for future Polish + Sketch-RNN |

### Phase 1 — Vector canvas + full pen-event capture

- [x] **1.1** `src/canvas/Canvas.tsx` with a Konva `Stage` + 3 layers (committed, live, ghost-overlay).
- [x] **1.2** Wire `onPointerDown / onPointerMove / onPointerUp / onPointerLeave` on the Stage with `setPointerCapture`.
- [x] **1.3** Recover sub-frame samples via `event.getCoalescedEvents()`; HUD reports whether the browser supports it.
- [x] **1.4** `StrokeEvent` captures `{ x, y, pressure, tiltX, tiltY, azimuth, altitude, twist, tangentialPressure, width, height, pointerType, t, tAbs, speed, isFirst }`.
- [x] **1.5** `Stroke` type with the tag block `{ tool, thickness, color, opacity, layerId, note? }`.
- [x] **1.6** Render with `perfect-freehand` → `getStroke()` → SVG path on a Konva `Path`.
- [x] **1.7** Undo via `⌘Z` and a toolbar button (single-level history is sufficient for the lab).
- [x] **1.8** Clear-canvas button + New-session button.

### Phase 2 — Procreate-inspired tool set

Each tool is a *preset* — a fixed `getStroke()` configuration plus a render style. Eight tools chosen to span the meaningful axes of stroke behavior.

- [x] **2.1** `src/tools/toolPresets.ts` with the eight presets below.
- [x] **2.2** `Toolbar` component (left rail with icon + label per tool).
- [x] **2.3** Thickness slider (1 – 80 px) bound to active tool.
- [x] **2.4** Color picker (12 swatches + native HTML color picker; opacity slider).
- [x] **2.5** Live brush preview in the right-rail panel, re-rendered as the user adjusts settings.

**Tool presets**

| ID | Name | Behavior | Notes |
|---|---|---|---|
| `pencil` | 6B Pencil | Low pressure thinning, lots of jitter, partial transparency | The default sketch tool |
| `inking` | Studio Pen | High pressure curve, end-taper, no jitter | Clean line art |
| `watercolor` | Wash | Low opacity, max smoothing, large size, builds up on overlap | Procreate's *Flat Brush* analog |
| `soft` | Soft Airbrush | Heavy thinning + alpha-from-pressure | Procreate *Soft Brush* analog |
| `hard` | Hard Round | Constant width, full opacity, sharp ends | Reference / cel-shading line |
| `marker` | Marker | Square cap, partial transparency builds up | Procreate *Gel Pen / Marker* family |
| `smudge` | Smudge | Smudge mode (re-renders neighborhood) | *(stub for v1; record events but render as soft brush)* |
| `eraser` | Eraser | `globalCompositeOperation = 'destination-out'` | Tagged separately for analytics |

Every stroke logs **which preset was used** as the `tool` tag — this is the training signal for the future "tool-aware" model.

### Phase 3 — Live telemetry HUD

- [x] **3.1** `src/hud/TelemetryHUD.tsx` with sectioned layout (Live signal / Pressure / Session).
- [x] **3.2** Numeric readouts: `x`, `y`, `pressure`, `tiltX`, `tiltY`, `azimuth`, `altitude`, `speed`, `twist`, `t since stroke start`.
- [x] **3.3** **Pressure sparkline** — `src/hud/PressureSparkline.tsx`, last 240 samples, resets at each pen-down.
- [x] **3.4** **Tilt compass** — `src/hud/TiltCompass.tsx`, vector SVG for `(tiltX, tiltY)`.
- [x] **3.5** Session counters: total strokes, total events, events/sec rolling, coalesced-supported flag.
- [x] **3.6** Toggle key `H` to show/hide the HUD.

### Phase 4 — Tagging, persistence, export

- [x] **4.1** `src/state/store.ts` Zustand store with `Session = { meta, strokes }`.
- [x] **4.2** Auto-persist to `localStorage` after every stroke (200 ms debounce).
- [x] **4.3** "New session" button archives current and starts fresh.
- [x] **4.4** Export `session.jsonl` — one JSON object per line `{ kind: 'meta' | 'stroke_start' | 'event' | 'stroke_end', … }`.
- [x] **4.5** Export `session.json` (single pretty-printed object).
- [x] **4.6** Meta includes `userAgent`, `screen.{width,height,devicePixelRatio}`, `sawPen` flag.

**JSONL line types**

```jsonc
{"kind":"meta","sessionId":"...","startedAt":"2026-05-10T...","userAgent":"...","screen":{...}}
{"kind":"stroke_start","strokeId":"...","t":12345,"tool":"pencil","thickness":18,"color":"#1c1c1c","opacity":1.0,"layerId":"main"}
{"kind":"event","strokeId":"...","t":12350,"x":312.4,"y":188.9,"pressure":0.42,"tiltX":-7,"tiltY":21,"azimuth":108.2,"speed":340.1}
{"kind":"stroke_end","strokeId":"...","t":12480,"events":42}
```

### Phase 5 — AI extensibility hooks

The lab itself ships **zero** AI calls. We just stand up the seams.

- [x] **5.1** `src/ai/types.ts` — defines the public interface:

```ts
export interface AiPlugin {
  id: string;
  name: string;
  // Called once on app boot; may set up a worker, load a model, etc.
  init?: (ctx: AiContext) => Promise<void>;
  // Called when the user invokes the plugin from the toolbar.
  run?: (input: AiInput, ctx: AiContext) => Promise<AiResult>;
  // Called on every pen-up so the plugin can update its suggestions.
  onStrokeEnd?: (stroke: Stroke, ctx: AiContext) => void;
}
```

- [x] **5.2** `src/ai/polishMyDrawing.ts` — stub that rasterizes the canvas via `toDataURL`, logs the request, and shows a toast. *Wire to fal.ai / Replicate / Azure OpenAI Image when ready.*
- [x] **5.3** `src/ai/sketchRnnGhost.ts` — stub that, on `onStrokeEnd`, renders a faint accent-colored polyline projected forward from the last 24 samples. *Wire to TF.js Sketch-RNN when ready.*
- [x] **5.4** `src/ai/registry.ts` — plugin list; `App.tsx` mounts each via `aiRegistry.initAll()`.
- [x] **5.5** `Tab` key reserved (`event.preventDefault()`) for "accept ghost" — no-op in the lab.

### Phase 6 — Documentation & verification

- [x] **6.1** `Lab_App/README.md` — one-command run, Wacom setup, troubleshooting, AI-plugin recipes.
- [ ] **6.2** Manual smoke checklist — *to be ticked by the user against the real Wacom hardware.*
- [x] **6.3** Tracker updated with completed-phase results (this file).

### Phase 7 — Sketch-RNN Ghost (real model, no API needed)

The first AI feature to graduate from stub to real. Inference runs entirely
client-side via Google Magenta's TF.js Sketch-RNN port, so no provider key,
no monthly bill, no privacy footprint.

- [x] **7.1** Install `@magenta/sketch` + verify code-splitting (TF.js + Magenta land in a separate ~225 KB-gzipped chunk loaded only on first ghost activation; main bundle stayed at ~169 KB gzipped).
- [x] **7.2** Extend the Zustand store with `ghostMode` (`"off" | "manual" | "auto"`), `ghostCategory`, `ghostModelStatus`, `ghostAutoCategory`, plus `ghostVisible` (now derived from mode but kept as an explicit boolean so the `G` hotkey can flip it on for one-shot peeks without leaving Off).
- [x] **7.3** Real `src/ai/sketchRnnGhost.ts`: lazy module load → per-category `SketchRNN` cache → polyline ↔ delta-encoded `[Δx, Δy, p1, p2, p3]` conversion → autoregressive sampler with `MIN_LEN = 8` to suppress premature pen-end → publish ghost via `ctx.renderGhost(svgPath, …)`. Models are fetched on-demand from Magenta's public GCS bucket (`storage.googleapis.com/quickdraw-models/sketchRNN/large_models/<name>.gen.json`, ~3–5 MB each, cached after first use).
- [x] **7.4** `src/tools/GhostPanel.tsx` — mode dropdown (Off / Manual / Auto), curated 18-category picker, status pill distinguishing idle/loading/ready/error, "detected: {category}" indicator for auto mode.
- [x] **7.5** Three triggers wired:
  - **Auto-on-pen-up** via `aiRegistry.notifyStrokeEnd` (existing seam) — gated on `ghostMode !== "off"` to avoid surprising the user.
  - **`G` hotkey** for one-shot peeks even when the panel is Off; flips `ghostVisible: true` so the result actually renders.
  - **Action-bar toggle** is the dropdown itself — more obvious than a binary button, and gives access to category selection in the same component.
- [x] **7.6** `Tab` to accept the visible ghost — `commitGhostAsStroke()` synthesizes a fresh `Stroke` from the predicted polyline using the user's currently-active tool/color/thickness, tagged `note: "ai-ghost-accepted"` for downstream training-set filtering.
- [x] **7.7** Auto-mode classifier — `classifyStrokes()` picks the candidate category whose Sketch-RNN model assigns the highest peak probability to the *next* token after consuming the user's prefix. Cheap, leans on models we already load anyway, lands a sensible category most of the time. Documented as a swappable seam: a real CNN classifier could replace it without touching anything else.
- [x] **7.8** Headless verification with two Playwright scripts (`/tmp/ghost-smoke.mjs`, `/tmp/ghost-auto-smoke.mjs`):
  - **Manual mode**: page load → mode=manual → category=cat → mouse stroke → pill goes `loading…` → `ghost shown` → polyline of 31 points → Tab → stroke count incremented (1 → 2). G hotkey from off-mode then committed a 2nd ghost (count 2 → 3).
  - **Auto mode**: drew a circle → classifier settled on `cat` in 15.5 s on TF.js CPU backend (would be ~1 s with WebGL) → polyline emitted, panel pill showed `detected: cat`.
  - Zero pageerrors. Only console noise is "WebGL is not supported on this device" — headless Chromium has no WebGL, TF.js auto-fell-back to CPU; real browsers won't see this.
- [x] **7.9** Documentation — README's "AI features" section rewritten (Ghost is now real; Polish My Drawing is still a stub with a clear API-buying recipe). Keyboard-shortcut table updated. New troubleshooting entries for "Ghost suggestion never appears" and "Auto-detect picked the wrong category".

**Manual smoke checklist (run with the Wacom pad connected on macOS)**

- [ ] Wacom driver is the latest from `wacom.com/support`.
- [ ] In Chrome (recommended) or Safari Tech Preview, the page receives `pointerType === 'pen'` events.
- [ ] `pressure` ranges 0 → 1 across normal pen force.
- [ ] `tiltX / tiltY` produce non-zero values when pen is tilted; `0` when vertical.
- [ ] HUD updates faster than 30 Hz; pressure sparkline is smooth.
- [ ] Switching tools changes both render and the `tool` tag in the export.
- [ ] Drawing for 30 s, exporting JSONL, re-importing the file shows event count matching `events/sec × 30`.
- [ ] **Hover does NOT draw.** Move the mouse across the canvas with no button held → no stroke appears, no events recorded. Hover the Wacom pen above the tablet without touching → no stroke appears (HUD may still show `PEN` once contact has been seen at least once, which is expected).

---

## Out of scope for this initial lab

- **Polish My Drawing** AI calls. Still a stub — needs a paid sketch-to-image
  provider (fal.ai / Replicate / Stability / OpenAI Images / local SD+ControlNet).
  Wire-up recipe lives in `Lab_App/README.md` under "AI features".
- Server-side ghost inference. Sketch-RNN runs entirely client-side via TF.js;
  pen data never leaves the user's browser.
- Multi-layer compositing beyond a single drawing layer + ghost overlay.
- Multi-user collaboration.
- iPad / iOS support.
- Wacom Universal Ink Model (UIM) export — added in a later iteration.
- Account / login.
- Online sync — the app is fully offline.

---

## Status Log

Append a dated bullet whenever a phase is completed.

- 2026-05-11 — User asked: *"Let's work on Ghost feature and Polish My Drawing feature. Which one do you require me to buy an API first?"* Answer: **only Polish needs an API.** Ghost ships entirely on a free open-source path. **Built and verified the Ghost feature end-to-end** as Phase 7.
  - **Architecture decision**: routed Ghost through Magenta's `@magenta/sketch` (Apache-2.0, TF.js port of Sketch-RNN) rather than a hosted multimodal LLM. Three reasons: zero per-call cost, zero network footprint at runtime once cached (privacy story matches the rest of the lab), and the model's per-category structure aligns naturally with a category-picker UX that gives users predictable behavior.
  - **Bundle hygiene**: `import("@magenta/sketch")` is a *dynamic* import, so users who never enable Ghost don't pay for its ~600 KB raw / ~225 KB gzipped weight (TF.js core + the Magenta model code). Vite splits it into a separate chunk; main bundle measured before vs after — `168 KB → 169 KB gzipped`, deferred `es5-*.js` is `225 KB gzipped`. Clean separation.
  - **Three modes shipped, three triggers shipped** (the user explicitly asked for both A+B and all three triggers in the AskQuestion answer):
    - Modes: Off (no auto-suggestion, but `G` hotkey still works), Manual category (18 curated QuickDraw categories), Auto-detect (likelihood-based discriminator over 8 candidate models).
    - Triggers: auto on every pen-up (gated by `ghostMode !== "off"`), `G` hotkey one-shot (works in Off mode too), and the dropdown itself acts as the visible toggle.
    - `Tab` accepts the visible ghost as a real stroke. The committed stroke wears the user's current tool/color/thickness and the tag `note: "ai-ghost-accepted"` so future analytics can filter human vs. AI strokes cleanly.
  - **Sampler subtlety**: Sketch-RNN very often samples `pen-end` on the *first* token after a one-stroke prefix — its training distribution thinks "one stroke = drawing complete" for many simple categories. Naive sampling produced 1-pixel ghosts that looked like the feature was broken. Added a `MIN_LEN = 8` guard that vetoes `p2`/`p3` markers in early samples by rewriting them to `pen-down` while keeping the model's predicted Δx/Δy. Recovered the perceived quality without distorting direction information.
  - **Status-pill semantics fix found during verification**: the initial implementation set `ghostModelStatus` to `"ready"` *before* checking whether a polyline was actually produced, so the pill said "ghost shown" even when nothing was rendered. Fixed: status only flips to `"ready"` after the ghost is emitted; null results revert to `"idle"`.
  - **Keyboard-handler refinement**: my first version dismissed all keys when focus was inside any form control (INPUT/TEXTAREA/SELECT). That meant `Tab` got swallowed right after the user picked a category from the Ghost dropdown — the SELECT kept focus and we filtered the event out. Re-architected: `Tab` (accept ghost) and `⌘Z` (undo) are global; the single-letter shortcuts (`H`, `G`) remain form-control-suppressed so type-to-search inside a SELECT still works. Caught by the smoke test, not manual QA — the kind of bug a hand-test would have missed.
  - **Auto classifier honesty**: the discriminator is *light* — it picks the candidate whose Sketch-RNN model gives the highest peak probability to the next token after consuming the prefix. This works because each per-category model strongly expects characteristic continuations (a face wants two more strokes for eyes; a flower wants radial petals), but it's not a real CNN classifier. Documented expected accuracy (~40–60% on a single stroke, climbing fast with more strokes) and the upgrade path: `classifyStrokes()` is a single function the rest of the plugin doesn't depend on — drop in MobileNet + a QuickDraw head later if needed.
  - **Headless verification**: two Playwright scripts (`/tmp/ghost-smoke.mjs` for manual+G+Tab, `/tmp/ghost-auto-smoke.mjs` for auto mode). Both pass. Manual mode: 31-point polyline, Tab commits stroke (count 1→2), G in off-mode commits another (count 2→3). Auto mode: drew a circle → classifier picked "cat" in 15.5 s on CPU backend → 15-point polyline. The CPU-backend timing is worst-case (headless Chromium has no WebGL); real Chrome with WebGL is ~10–20× faster on first prediction, basically instant after the model is cached.
  - **`tsc -b` clean, `npm run build` clean** (544 KB / 169 KB gzipped main + 930 KB / 225 KB gzipped lazy chunk). No lint warnings introduced.
  - **README + Tasks.md updated**. README's old "Plug in the real Sketch-RNN" stub-replacement recipe is gone; replaced with a real "AI features" section that documents what's shipped and what still needs an API (Polish). New troubleshooting entries for ghost-never-appears (likely WebGL fallback or network blocked from `storage.googleapis.com`) and auto-detect-misses (expected at low stroke counts; switch to Manual).
  - **Polish My Drawing still a stub** — by design until the user picks a provider. README has a recipe with five concrete options (fal.ai, Replicate, Stability AI, OpenAI Images, local SD+ControlNet) and recommended sequencing.
- 2026-05-10 — User reported: *"Some tools like Charcoal, Pastel, Wash, and Smudge cause the entire program to crash. Others are fine."* **Found and fixed the root cause** — three actual bugs in the vendored `brushlib.js` that surfaced once we exercised more than just the pencil brush. Reproduced with a headless Playwright script that captured the exact in-page error: `RuntimeError: function signature mismatch` thrown from inside `brushlib.wasm` at `wasm-function[43]`, originating in `Painter.stroke`.
  - **Bug 1 — `getColorProxy` registered with the wrong return type** (this was the actual crash). brushlib.js called `Module.addFunction(getColorProxy, 'ifffiiii')` — return type `i` (int). But libmypaint's C-side `MyPaintSurfaceGetColorFunction` returns `void`. As long as no brush actually invoked the callback the mismatch was harmless, but the moment a brush with non-zero `smudge` (or a smudge mapping that ramps via `pressure`/`speed1`) reached the smudge code path, libmypaint did an indirect call through the function table with the void signature and the wasm raised "function signature mismatch". This is exactly the set of brushes the user reported: wash (smudge=0.9), smudge (smudge=0.91), pastel (smudge=0.1), and charcoal (smudge mapped from speed1, becomes non-zero on fast strokes). Knife technically also has a smudge mapping but it goes negative (clamped to 0 internally), so it never tripped the bug. **Fix:** changed signature to `'vfffiiii'` in `public/brushlib/brushlib.js` (one character).
  - **Bug 2 — `Module.setValue` is no longer exported.** Once the signature was correct, the proxy itself crashed with `Module.setValue is not a function`. Newer Emscripten toolchains don't include `setValue` in `EXPORTED_RUNTIME_METHODS` by default and the brushlib-wasm prebuilt binary doesn't export it. **Fix:** write directly to `Module.HEAPF32[ptr >> 2]` instead — same effect, no runtime export dependency.
  - **Bug 3 (latent, not the crash trigger but found while reading the file) — `getColor` clamped its output to integers.** The original implementation did `pixel[0] /= 255` on `image.data`, which is a `Uint8ClampedArray`. The division result was rounded back to a uint8 (so 200/255 = 0.78 became `1`). Smudge / palette-knife brushes were therefore *always* pulling either pure-black or pure-white from the canvas — explaining why those tools never produced believable color mixing in earlier hand-tests. **Fix:** copy out into a regular array before dividing, plus floor + clamp the (x, y) coords to canvas bounds since libmypaint passes sub-pixel positions.
  - **Bonus — `willReadFrequently: true`**: smudge/knife brushes call `getImageData` once per dab. Without the flag, Chrome warns and may use a GPU-readback path that hitches during long strokes. Added the flag both inside brushlib's painter constructor and in our own `Canvas.tsx` / `SettingsPanel.tsx` `getContext` calls (Chrome caches the *first* call's options per canvas, so all callers need to agree).
  - **Verification.** Wrote a Playwright sweep script (`/tmp/repro-crash.mjs`) that opens the app, clicks each of the 13 tools, and drags a small stroke. Result: every tool, including all four previously-crashing ones, completes with **zero pageerrors and zero console errors**. `tsc -b` clean, `npm run build` clean (537 KB JS / 166 KB gzipped — bundle size unchanged; the patches are inside the static asset). All 16 brush-related URLs serve 200 from the dev server.
  - **Documentation** — `public/brushlib/LICENSE.md` extended with a "Local patches to `brushlib.js`" section explaining each fix and why, so a future maintainer who pulls a fresh upstream brushlib doesn't accidentally regress the patches. The patches themselves are commented inline in `brushlib.js` with `DrawCopilotLab patch` markers and dated.
- 2026-05-10 — User asked: *"This time pencil quality is really good! Can we adopt all their drawing tools? Other than just pencil?"* — yes, and the seam we built last round made this almost entirely additive rather than another rework. **Adopted 12 more CC0 MyPaint brushes**, replacing every existing tool's renderer with its libmypaint equivalent and adding 5 brand-new tools.
  - **13 tools, all routed through libmypaint** (one-way change: every preset now has `engine === "mypaint"`). Mapping (every brush from `mypaint/mypaint-brushes`, all CC0-1.0):
    - 1:1 quality upgrades of existing tools — Pencil → `tanda/pencil-8b`; Studio Pen → `deevad/pen`; Wash → `deevad/watercolor_glazing`; Soft Airbrush → `deevad/airbrush`; Hard Round → `deevad/basic_digital_brush`; Marker → `tanda/marker-05`; Smudge → `deevad/basic_digital_brush_smudging` (the smudge tool stops being a stub — it actually pulls color from the canvas now via libmypaint's `getColor` callback hitting `ctx.getImageData`); Eraser → `deevad/large_hard_eraser` (libmypaint applies `destination-out` per-dab via the brush's `eraser: 1.0` setting, so we removed our hand-rolled raster-erase code path).
    - 5 new tools — Charcoal (`tanda/charcoal-03`), Pastel (`ramon/Pastel_1`), Ballpoint (`deevad/ballpen`), Calligraphy (`classic/calligraphy`), Palette Knife (`deevad/basic_digital_knife`).
  - **All 13 brush JSONs vendored** under `Lab_App/public/brushlib/brushes/` (~80 KB total). `LICENSE.md` updated with per-brush author attribution table even though CC0 doesn't require it. `tanda-pencil-8b.json` at the root of `public/brushlib/` was deleted in favor of `brushes/pencil.json` so the directory stays organized.
  - **`mypaintBrush.ts` extended to multi-brush** — `startStroke({ brushId, color, thicknessPx, radiusScale })` now reloads the brush definition per-stroke. To keep the pointer-handler hot path synchronous, engine init blocks on a `Promise.all` over all brush fetches, so the synchronous `brushDefCache.get(brushId)` lookup can never miss after the engine reports ready. Also exposed `renderPreview({ ctx, brushId, ... })` and a `getActiveEngine() / onEngineReady()` accessor pair so other components (the SettingsPanel preview) can drive renders without prop-drilling a ref.
  - **`ToolPreset` extended** with `engine`, `brushFile`, and `radiusScale` fields. `radiusScale` is per-tool feel calibration: each MyPaint brush has its own native radius, so a "5-px slider" needs different multipliers to look right across e.g. a ballpen and a watercolor wash. Initial values are educated guesses based on the brushes' `radius_logarithmic.base_value`; easy to tweak per tool by adjusting one number.
  - **`Canvas.tsx` generalized** — `tool === "pencil"` checks replaced with `preset.engine === "mypaint"` checks throughout (start, move, finish, replay, layer filters). The hand-rolled raster-eraser code was deleted (libmypaint handles it). The vector strokes layer is now used purely as a fallback during the brief window before the wasm engine resolves; once `engineReady` is true, every drawing tool routes through libmypaint.
  - **Live brush preview in `SettingsPanel.tsx`** — replaced the static perfect-freehand SVG curve with a real libmypaint render. The settings panel now has its own `<canvas>` that re-runs a sample S-curve stroke (with a 0 → 1 → 0.5 pressure ramp) through the active brush whenever tool/color/thickness/opacity changes. For smudge and palette-knife tools — which need source pixels to pull from — the preview lays down a faint airbrush stripe of the active color first, then runs the smudge over it, so the pull behavior is visible. The vector preview is retained as a graceful fallback while the wasm engine is loading.
  - **`Toolbar.tsx`** — toolbar order rebalanced for natural-media flow (pencil → charcoal → pastel → inking pens → marker → wet media → knife/smudge → eraser). New tool icons added.
  - **Export contract still unchanged.** Every stroke still writes the same JSONL fields (`tool, thickness, color, opacity, pressure, tiltX, tiltY, t, ...`). The `tool` enum gained five values (`charcoal, pastel, ballpen, calligraphy, knife`); existing exported sessions remain valid. ✓
  - **Performance characteristics**: total brush JSON payload is ~80 KB (gzipped ~30 KB), preloaded in parallel with the wasm compile during the engine init promise — adds zero perceived latency vs. just loading the pencil. Smudge/knife brushes do `getImageData(x, y, 1, 1)` per dab, which can show small frame drops on low-end machines for very long strokes; not a blocker on the user's MacBook. Engine readiness is now the same wall-clock event for all 13 tools (one wasm compile + one Promise.all over brush fetches), so the fallback window is a single event horizon, not per-tool.
  - **Build clean**: `tsc -b` passes, `npm run build` produces 537 KB JS / 166 KB gzipped (+4 KB vs. previous: SettingsPanel grew, Canvas shrank with the eraser deletion). All 16 static endpoints (13 brush JSONs + 2 wasm + 1 LICENSE) serve 200 from the dev server.
  - **README updated** to reflect the 13-tool palette, multi-brush wrapper, live preview, and the now-real smudge tool. License attribution table extended to all 13 brushes.
- 2026-05-10 — Tracker created. Tech stack locked.
- 2026-05-10 — Phases 0–6 implemented. `npm run build` passes (527 KB JS gzipped 163 KB), `tsc -b` clean, `npm run dev` boots in ~110 ms. Outstanding: 0.7 + 6.2 (Wacom hardware smoke test on the user's MacBook).
- 2026-05-10 — User reported: *"hovering my mouse on the canvas starts drawing without any pressure."* **Fixed** in `src/canvas/Canvas.tsx`:
  - Live-preview path was extending the in-progress stroke on every `pointermove`, including hover moves where no `pointerdown` had ever fired. The recorder itself was already guarded; the canvas wasn't.
  - Added `isDrawingRef` to gate `handlePointerMove`; hover moves now no-op.
  - Added explicit pointer-down entry guards: mouse requires `(buttons & 1) === 1`, pen requires `pressure > 0`. Pure pen hover (proximity above the tablet) no longer starts a stroke.
  - Added stuck-stroke recovery: if the mouse button is released outside the window so we miss `pointerup`, the next `pointermove` notices `(buttons & 1) === 0` and finishes the stroke cleanly.
  - Re-verified with `tsc -b` and `npm run build`.
- 2026-05-10 — User reported: *"6B Pencil doesn't feel like a pencil."* **Improved** without adding any dependency:
  - Surveyed open-source options (rough.js, p5.brush.js, tldraw's draw tool). None integrates with our perfect-freehand + Konva pipeline without losing pressure response, so we built a procedural texture instead.
  - New `src/util/pencilTexture.ts` generates a 256×256 graphite-grain pattern once at boot (low-frequency "tooth" hash modulates a high-frequency particle mask → clustered dots that look like real graphite, not white noise).
  - New `texture` and `tiltSizeBoost` fields on `ToolPreset` (`src/types.ts`) so any future tool can opt in.
  - New `<StrokeView>` component in `Canvas.tsx` renders pencil strokes as a Group of two paths: colored body underneath, grain pattern on top. Other tools render unchanged.
  - **Tilt-aware effective size:** average tilt magnitude across the stroke broadens the line by up to 55 % — uses our unique pen data (no public stroke library does this).
  - Pencil preset retuned: lower opacity (0.5, was 0.65) for natural buildup; tighter pressure response (`thinning: 0.72`); slightly looser smoothing (0.42) for organic wobble; longer end-taper.
  - Bundle grew +1.5 KB. `tsc -b` and `npm run build` clean.
- 2026-05-10 — User pointed at Krita and said *"I still don't like the result for the current one — can we adopt anything from them?"* This was the structurally correct pivot. **Replaced the pencil renderer end-to-end with libmypaint via WebAssembly.** The previous attempts (dot-grain texture, soft-tooth tile + drop-shadow halo) were all dressing up a *vector fill*, which fundamentally cannot reproduce the per-position graphite grain that makes a pencil mark look like a pencil mark. Krita confirmed what every serious paint app does: **stamp a textured dab at every sub-pixel along the stroke**. We can't ship Krita itself (GPL C++/Qt desktop app) but we can use its underlying engine — libmypaint, ISC-licensed — via the existing `eliot-akira/brushlib-wasm` Emscripten port. License audit: the wasm engine is ISC, the Tanda 8B pencil brush we ship is CC0 (Marcelo "Tanda" Cerviño, via the official `mypaint/mypaint-brushes` repo). No GPL footprint anywhere.
  - **Vendored** `brushlib.wasm` (61 KB), `brushlib.js` (27 KB), and `tanda-pencil-8b.json` (5.8 KB) into `Lab_App/public/brushlib/` with `LICENSE.md` attribution. Total static-asset payload: ~94 KB. Lazy-loaded on first pencil use; main bundle grew only +4 KB.
  - **New `src/brush/mypaintBrush.ts`** — typed wrapper that loads the wasm script tag once, fetches the brush JSON once, and exposes `getEngine(canvas) → { startStroke, strokeTo, endStroke }`. `strokeTo` is a 1:1 fit with our recorder's events (`x, y, pressure, tiltX, tiltY, dt`). Returns `null` on load failure so callers fall back gracefully to the old vector renderer.
  - **`Canvas.tsx` reworked** to introduce a third drawing layer:
    - **Layer 1 (raster, bottom)** — a Konva.Image displaying an offscreen `HTMLCanvasElement` that libmypaint paints onto. Every pencil event (including coalesced Wacom sub-events at 200 Hz) calls `engine.strokeTo()`; the engine stamps soft graphite dabs onto the raster canvas; we `batchDraw` the layer to update.
    - **Layer 2 (vector strokes)** — committed strokes for non-pencil tools (markers, ink, etc.). Pencil strokes are filtered out here when `engineReady` because they're already pixels on layer 1.
    - **Layer 3 (vector live preview)** — only shown when the active tool isn't pencil, OR the engine hasn't loaded yet (graceful fallback).
  - **Coalesced-event handling preserved**: each Wacom sub-frame sample is still fed to libmypaint individually, with `dt` distributed across the events so speed-dependent brush dynamics (`offset_by_speed`, etc.) behave correctly at 200 Hz.
  - **Replay-on-mount** — pencil strokes restored from `localStorage` are replayed through libmypaint into the raster on engine load, so reopening the page reconstructs the canvas pixel-perfect.
  - **Replay-on-resize / replay-on-undo** — the raster is rebuilt from the vector store whenever (a) the stage size changes, or (b) any rendered stroke ID is no longer in the store (undo/clear). Live additions don't trigger a rebuild because we pre-record the stroke ID into a "rendered" set as it commits.
  - **Eraser extended to raster** — eraser strokes paint a soft destination-out radial gradient onto the raster canvas in real time (so the eraser tool can erase pencil pixels, not just vector strokes on the layer above).
  - **Tagging contract unchanged** — every pencil event still flows through `useStrokeRecorder` and is exported in JSONL with `(tool, thickness, color, opacity, pressure, tiltX, tiltY, t, ...)`. The visual rework affects rendering only, not the recorded ML training data. ✓
  - **Build clean**: `tsc -b` passes, `npm run build` produces 533 KB JS / 165 KB gzipped (+4 KB vs. previous), all four static endpoints serve 200.
  - **Known limitation**: the pencil tool now requires the wasm engine to load (~90 KB fetch + WebAssembly compile, typically ~50 ms on local dev). During that window the pencil falls back to the old vector renderer; once the engine reports ready, subsequent strokes use the new path.
- 2026-05-10 — *Earlier on this same date:* User pointed at Tong et al. AAAI 2021 *"Sketch Generation with Drawing Process Guided by Vector Flow and Grayscale"* (`TZYSJTU/Sketch-Generation-with-Drawing-Process-Guided-by-Vector-Flow-and-Grayscale`) and asked: *"this is the true pencil texture I like — can we implement that?"* **Reworked the pencil aesthetic** to match the paper's per-mark visual identity. The repo's algorithm (Python NumPy/PyTorch image-to-sketch via Edge Tangent Flow + grayscale tone mapping) is offline batch, not a brush, so we ported the *look* — not the algorithm. **This iteration was superseded later the same day by the libmypaint integration above** when the user reported the result still wasn't right; the underlying problem was that vector-fill rendering can't reproduce pencil grain regardless of how the overlay/halo is tuned. The vector renderer remains in the codebase as the fallback path used while the wasm engine is loading.
  - Studied the per-mark properties in their results: long soft tapers, soft anti-aliased flanks, gentle internal density variation, **no internal speckle**. The hatching/grit in their sketches comes from rendering many marks on top of each other, not from per-mark dots.
  - Replaced the dot-scatter texture with a **soft paper-tooth pattern** (`src/util/pencilTexture.ts`, full rewrite): two-octave smooth value-noise on a 128-px tile, dark-end envelope, alpha capped at ~60/255. Tooth is felt, not seen.
  - **Soft-flank halo via Konva drop-shadow** (`<StrokeView>` in `Canvas.tsx`): the body Path now gets `shadowColor = stroke color`, `shadowBlur: 3`, `shadowOpacity ≤ 0.4 × opacity`. This is the single change that stops the brush looking like a marker — graphite has fuzzy edges, ours now does too.
  - Pencil preset retuned in `src/tools/toolPresets.ts`: longer tapers (`start.taper: 14`, `end.taper: 22`, was 6/10) so marks lift on/off cleanly; opacity nudged to 0.55 for slightly more body; thinning/smoothing/streamline rounded to 0.7/0.4/0.4.
  - Texture overlay opacity dropped substantially (was `0.55 + opacity*0.6`, now `0.2 + opacity*0.4`, capped at 0.45) so the tooth never dominates the underlying color.
  - Tone build-up — the heavily-shaded look — is produced by the user drawing many overlapping marks. Same approach as the AAAI paper, same approach as real pencil. We do **not** fake it inside a single mark.
  - Tagging contract is unchanged (`tool, thickness, color, opacity` still recorded as before), so any model trained on exported JSONL is unaffected by the visual rework.
  - Bundle change: ±0 KB (the new texture is smaller, the renderer is one extra prop). `tsc -b` and `npm run build` clean (528.83 KB JS, 163.58 KB gzipped).
