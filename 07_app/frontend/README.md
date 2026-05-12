# DrawCopilotLab — Initial Lab (macOS)

An offline desktop drawing app for macOS that reads your Wacom pen at full
fidelity, visualizes every dimension of the pen signal in real time, and tags
every stroke with `(tool, thickness, color)` so the resulting dataset is
immediately useful for future model training.

The lab also stands up clean **AI extension points** so the planned
`Polish My Drawing` (sketch-to-image) and `Sketch-RNN` next-stroke ghost
features can be dropped in later without touching the canvas code.

> **Status:** Phase 0–7 of the task tracker shipped, including a real
> Sketch-RNN **Ghost** feature (see `src/ai/sketchRnnGhost.ts`). The
> *Polish My Drawing* plugin is still a stub on purpose — wiring it up
> requires picking and paying for an image-gen API (fal.ai / Replicate /
> Stability / OpenAI Images / etc.). Mission file:
> `../HistoricalPrompt/Initial_OS_Development_Lab.md`. Tracker:
> `../TaskTracker/Initial_Lab_Development/ForMacOS/Tasks.md`.

---

## Quick start (macOS)

```bash
cd Lab_App
npm install   # first run only
npm run dev
```

Then open <http://localhost:5173/> in **Chrome** (recommended) or **Edge**.
Safari on macOS is supported but its `PointerEvent.tiltX/Y` reporting has
historically been spotty; the app shows a yellow banner if it detects Safari.

### One-time Wacom setup checklist

1. Install the latest Wacom driver from <https://wacom.com/support>.
2. Plug in the pen-display (USB-C or Bluetooth pair).
3. In `System Settings → Privacy & Security → Accessibility`, ensure the Wacom
   driver app is allowed (the driver prompts for this on first run).
4. Open Chrome. The app will mark `PEN OK` in the HUD as soon as it sees the
   first `pointerType === 'pen'` event.

---

## What the app does

| Feature | Where |
|---|---|
| Vector canvas with Konva.js + perfect-freehand | `src/canvas/Canvas.tsx` |
| Full pen-event capture: `x, y, pressure, tiltX/Y, azimuth, altitude, twist, tangentialPressure, width, height, t, speed` | `src/canvas/useStrokeRecorder.ts` |
| Sub-frame sample recovery via `PointerEvent.getCoalescedEvents()` (≈200 Hz on Wacom) | same |
| **Thirteen natural-media tools, every one rendered by libmypaint** (the brush engine behind MyPaint and Krita): Pencil, Charcoal, Pastel, Studio Pen, Ballpoint, Calligraphy, Marker, Wash (watercolor), Soft Airbrush, Hard Round, Palette Knife, Smudge, Eraser. Pen events are stamped as textured dabs onto a raster layer; the engine consumes pressure + tilt + dt straight from our recorder. Smudge and Palette Knife actually pull color from the canvas underneath (libmypaint reads pixels via the painter's `getColor` callback). Vector renderer is preserved as a graceful fallback for the brief window before the wasm finishes loading. | `src/brush/mypaintBrush.ts`, `src/canvas/Canvas.tsx` (raster layer + `engineReady`), `src/tools/toolPresets.ts`, `public/brushlib/` (vendored ISC-licensed wasm + 13 CC0 brushes) |
| Per-tool thickness / opacity / color sliders, with a **live libmypaint-rendered brush preview** that re-runs an actual sample stroke through the active brush whenever any control changes | `src/tools/SettingsPanel.tsx` |
| Floating telemetry HUD: numeric readouts, pressure sparkline, tilt compass | `src/hud/` |
| Auto-persist sessions to `localStorage`; export `.jsonl` and `.json` | `src/state/store.ts`, `src/storage/exporter.ts` |
| Pluggable AI plugins with shared `AiContext` and ghost-overlay rendering | `src/ai/` |
| **Sketch-RNN ghost** — predicts the next stroke conditional on what you've drawn so far, using Magenta's per-category QuickDraw models. Three trigger modes (off / manual category / auto-detect from strokes), three accept paths (auto-show after every pen-up, on-demand `G` hotkey, or accept ghost as a real stroke with `Tab`). All inference happens client-side; ~225 KB gzipped of TF.js + Magenta is dynamically imported on first activation so the main bundle stays at ~170 KB. | `src/ai/sketchRnnGhost.ts`, `src/tools/GhostPanel.tsx`, top-bar dropdown |

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `H` | Toggle telemetry HUD |
| `⌘Z` | Undo last stroke |
| `G` | Trigger a one-shot Sketch-RNN ghost prediction (works even with the ghost panel set to *Off*; uses the currently-selected category) |
| `Tab` | Accept the visible ghost suggestion as a real stroke. The committed stroke is tagged `note: "ai-ghost-accepted"` so future analytics / training pipelines can filter them in or out |

## Input behavior

Drawing requires an explicit *contact* signal — the canvas does not draw on hover.

- **Mouse:** the left button must be held. Pure mouse-over does nothing.
- **Wacom pen:** the pen tip must touch the tablet (`pressure > 0`). Hovering the
  pen *above* the tablet (proximity / pre-contact) does not start a stroke,
  even though the browser may still report position events. Once you've made
  contact at least once in a session, the HUD's `PEN` badge stays lit and the
  numeric readouts continue to update during hover so you can verify tilt and
  azimuth without committing a stroke.
- **Right- and middle-click**, and **pen barrel buttons**, are filtered out —
  only the primary tip / left-button action draws.

---

## Data export format

The `.jsonl` export is line-delimited JSON, easy to feed into PyTorch / TF /
pandas later. One JSON object per line. Line types:

```jsonc
{"kind":"meta","id":"sess_…","startedAt":1746864000000,"userAgent":"…","screen":{…},"sawPen":true}
{"kind":"stroke_start","strokeId":"stk_…","startedAt":1746864001234,"tool":"pencil","thickness":18,"color":"#1c1c1c","opacity":0.65,"layerId":"main"}
{"kind":"event","strokeId":"stk_…","x":312.4,"y":188.9,"pressure":0.42,"tiltX":-7,"tiltY":21,"azimuth":108.2,"altitude":68.4,"twist":0,"tangentialPressure":0,"width":1,"height":1,"pointerType":"pen","t":12,"tAbs":345.7,"speed":340.1,"isFirst":false}
{"kind":"stroke_end","strokeId":"stk_…","endedAt":1746864001480,"events":42}
```

The `tool`, `thickness`, `color`, `opacity` fields on `stroke_start` are the
**training tags** — every stroke event is implicitly labeled by its enclosing
stroke's tags, which is exactly what a future tool-aware model needs.

---

## AI features

### Sketch-RNN Ghost (shipped)

The Ghost panel in the top action bar exposes three modes:

- **Off** — no auto-suggestions. The `G` hotkey still works for one-shot peeks.
- **Manual category** — pick from ~18 curated QuickDraw categories
  (`cat`, `face`, `flower`, `bird`, `fish`, `tree`, `house`, …); after every
  pen-up, the matching Sketch-RNN model predicts your next stroke and renders
  it as a faint purple overlay.
- **Auto-detect** — runs all 8 candidate models on your existing strokes
  and picks the one whose model rates the prefix highest. The pill in the
  panel shows the detected category. Accuracy depends on how recognizable
  your early strokes are; expect 40–60% on a single stroke, climbing fast as
  you draw more. Misses are recoverable by switching to *Manual* and picking
  the right category.

Press **`Tab`** at any time to accept the visible ghost — the suggestion is
committed as a real stroke using your currently-active tool/color/thickness,
tagged `note: "ai-ghost-accepted"` for downstream analytics.

Implementation notes:

- Each per-category model (`<name>.gen.json` from
  `https://storage.googleapis.com/quickdraw-models/sketchRNN/large_models/`)
  is **lazy-loaded** on first use and cached in module scope. First request
  is 3–5 MB and ~1–2 s on Chrome with WebGL; subsequent picks of the same
  category are instant.
- The plugin and TF.js (~225 KB gzipped) are **dynamic-imported** so users
  who never touch Ghost don't pay for them on initial page load.
- The Sketch-RNN sampler is bounded by `MIN_LEN = 8` to suppress the model's
  occasional "the drawing is over after one stroke" output, which would
  otherwise produce 1-pixel ghosts.

### Polish My Drawing (still a stub — needs an API)

`src/ai/polishMyDrawing.ts` is still the placeholder it always was. To wire
it up to a real sketch-to-image model:

1. Pick a provider:
   - **fal.ai** — easiest API, generous free credit, fastest cold-starts;
     endpoints like `fal-ai/fast-sdxl-controlnet-canny` or `fal-ai/flux/dev`.
   - **Replicate** — pay-per-second; great for `sd-controlnet-scribble` or
     `sdxl-controlnet`.
   - **Stability AI** — direct `Stable Image Sketch` endpoint.
   - **OpenAI Images (`gpt-image-1`)** — simplest if you already have a key,
     but the model treats your sketch as a soft prompt rather than a hard
     constraint, so output looks less faithful to the strokes.
2. Drop your API key into a `.env.local` (Vite will surface it as
   `import.meta.env.VITE_*`).
3. Replace the body of `run()` in `polishMyDrawing.ts` with a `fetch()` to
   the provider. The function already receives `{ pngDataUrl, strokes }`
   pre-rasterized from the canvas.
4. Return `{ images: [{ url, label }, …], message }`. The "Polish My Drawing"
   button in the action bar surfaces `message` as a toast.

---

## Project layout

```
src/
  App.tsx                  # shell, keyboard, browser warning
  main.tsx                 # React entry
  styles.css               # all styles, no Tailwind / no CDN
  types.ts                 # Stroke, StrokeEvent, ToolPreset, Session
  canvas/
    Canvas.tsx             # Konva stage + 3 layers (committed / live / ghost)
    useStrokeRecorder.ts   # PointerEvent → typed StrokeEvent stream
  tools/
    toolPresets.ts         # 13 natural-media tools mapped to libmypaint brushes
    Toolbar.tsx            # left rail
    SettingsPanel.tsx      # right rail (thickness, opacity, color, brush preview)
    ActionsBar.tsx         # top bar (undo, clear, export, AI buttons)
  hud/
    TelemetryHUD.tsx       # floating dashboard
    PressureSparkline.tsx  # last 4s of pressure
    TiltCompass.tsx        # SVG vector for current tilt
  state/
    store.ts               # canvas + session Zustand store, auto-persist
    telemetry.ts           # transient HUD store
  storage/
    exporter.ts            # .jsonl / .json export
  ai/
    types.ts               # AiPlugin, AiContext, AiInput, AiResult
    registry.ts            # plugin registry; ghost-renderer wiring
    polishMyDrawing.ts     # STUB — needs a provider API key (see "AI features")
    sketchRnnGhost.ts      # REAL — Magenta Sketch-RNN with 3 modes + classifier
  tools/
    GhostPanel.tsx         # mode + category dropdown, status pill (in ActionsBar)
  util/
    geometry.ts            # tilt → azimuth/altitude; SVG-path builder
    id.ts                  # crypto.randomUUID wrapper
```

---

## Things that are intentionally NOT in this lab

- The **Polish My Drawing** AI feature (still a stub — needs a paid
  sketch-to-image API; see "AI features" above).
- A **server-side Ghost** path. Inference is client-only by design — the
  models live on Google's CDN and TF.js runs them in the user's browser, so
  the lab never sends pen data to any third party.
- Multi-layer compositing beyond `main` + ghost overlay.
- Multi-user collaboration / sharing.
- iPad / iOS support (web canvas runs there but the layout is desktop-tuned).
- Wacom **Universal Ink Model** (UIM) export. Coming in a later iteration —
  the export path lives in `src/storage/exporter.ts` and is the natural seam.
- Account / login.
- Online sync. The app is **fully offline** — there is no `fetch()` to a
  network endpoint anywhere in the lab build.

---

## Troubleshooting

**The HUD stays on `WAITING…`.** The browser hasn't seen a `pen` pointer
event yet. Tap your Wacom pen on the canvas. If the badge still doesn't flip
to `PEN OK`, your Wacom driver isn't being picked up by the browser — check
Chrome's `chrome://gpu/` page (you should see normal compositing) and that
the Wacom driver process is running (Activity Monitor → search "Wacom").

**`tiltX` and `tiltY` are always 0.** The pen is reporting position but not
tilt. This usually means: (a) you're using a non-tilt-capable pen
(e.g. an old Bamboo Stylus), or (b) Safari is masking tilt — switch to
Chrome.

**`events/sec` shows ~60 even when I draw fast.** Check the HUD's `coalesced`
field — if it says `—`, your browser doesn't expose
`PointerEvent.getCoalescedEvents()`. Chrome on macOS does. The recorder still
captures every event the browser reports; you just won't get sub-frame samples.

**Strokes look chunky / pixellated.** The canvas renders at the device pixel
ratio. If your display is HiDPI but the browser is in a low-resolution
compatibility mode, force-quit Chrome and reopen it. The HUD shows the active
DPR under "Session".

**Hovering the cursor over the canvas does nothing.** That's by design — see
*Input behavior* above. To draw with the mouse you must hold the left button;
to draw with the Wacom pen you must press the tip onto the tablet
(`pressure > 0`). If you *want* to capture pre-contact hover events for
research purposes, replace the `if (isPen && pressure <= 0) return;` guard in
`src/canvas/Canvas.tsx` with a stroke-tag flag instead — the recorder will
happily log `pressure: 0` events; we just don't render them as strokes today.

**The drawing tools feel different in the first second after page load.**
Every tool is now rendered by libmypaint (compiled to WebAssembly). The wasm
binary, the brushlib JS shim, and all 13 brush JSONs are fetched in parallel
on first page load (`brushlib.wasm` + `brushlib.js` + 13 × `brushes/*.json`).
Until the engine is ready (typically ~80–150 ms on a warm cache), the active
tool falls back to the legacy vector renderer. Look at the Network tab on
first load — you should see all 15 files come back 200 once.

**The smudge / palette knife brushes look pale.** Both pull color from the
*existing pixels* on the canvas and re-stamp them. If you smudge over an
area that has only a faint mark, the result will be faint too. Lay down a
heavier base stroke first (e.g. with the Hard Round or Marker tool) and
then smudge into it.

**Some tools throw `RuntimeError: function signature mismatch` from the
wasm.** This means a future upstream pull of `brushlib.js` has reverted the
local patches in `public/brushlib/brushlib.js` — see the "Local patches"
section in `public/brushlib/LICENSE.md` for what those patches do. Re-apply
them (each is one to four lines), or fail-soft by routing the affected tool
through the vector fallback by temporarily setting its `engine` to
`"vector"` in `src/tools/toolPresets.ts`.

**The eraser doesn't fully remove a heavily-built-up mark.** The eraser is
now itself a pressure-sensitive libmypaint brush. A heavy build-up may need
several passes — exactly like erasing real graphite. Use *Undo* (or *Clear*)
for whole-stroke removal.

**Ghost suggestion never appears.** Open DevTools → Console. The most common
causes:

- *"Initialization of backend webgl failed"* — your browser session has no
  WebGL. TF.js falls back to CPU; predictions still work, just slower (≈3–8 s
  for the first prediction in a category, vs ≈0.3–1 s on WebGL). Restart
  Chrome / check `chrome://gpu/`.
- *"NotFoundError" on the model JSON URL* — Google's QuickDraw CDN
  occasionally rejects an unusual category name. Pick a different category;
  the curated list in `src/tools/GhostPanel.tsx` (`GHOST_CATEGORIES`) only
  contains names verified against the bucket.
- The pill says *"loading model…"* forever — confirm the network can reach
  `storage.googleapis.com`. The lab is offline-only for **drawing**, but
  Sketch-RNN model checkpoints are fetched on demand the first time.

**Auto-detect picked the wrong category.** Expected at low stroke counts;
the candidate set is short by design (8 archetypes, see
`AUTO_CANDIDATES` in `src/ai/sketchRnnGhost.ts`) and the discriminator is a
lightweight likelihood score — not a real CNN classifier. Switch the panel
to *Manual* and pick the right category, or add more strokes and let the
score re-stabilize. To upgrade later: replace `classifyStrokes()` with a
real pretrained QuickDraw image classifier; the rest of the plugin doesn't
care how the category was chosen.

---

## Third-party assets vendored under `public/brushlib/`

### Engine

| File | Source | License | Author |
|---|---|---|---|
| `brushlib.js`, `brushlib.wasm` | [`eliot-akira/brushlib-wasm`](https://github.com/eliot-akira/brushlib-wasm) — Emscripten port of [`mypaint/libmypaint`](https://github.com/mypaint/libmypaint) v1.3.0 | ISC | MyPaint Development Team |

> **Note:** `brushlib.js` carries four small local patches (callback signature, `setValue` removal, `getColor` float fix, `willReadFrequently`) without which any brush that exercises `smudge > 0` crashes the wasm with a function-signature mismatch. Each patch is marked inline with a `DrawCopilotLab patch` comment, and the rationale is documented in `public/brushlib/LICENSE.md`. The wasm binary itself is unmodified.

### Brushes (all from [`mypaint/mypaint-brushes`](https://github.com/mypaint/mypaint-brushes), all CC0-1.0)

| Local file | Upstream | Author |
|---|---|---|
| `brushes/pencil.json` | `tanda/pencil-8b.myb` | Marcelo "Tanda" Cerviño |
| `brushes/studio_pen.json` | `deevad/pen.myb` | David Revoy |
| `brushes/wash.json` | `deevad/watercolor_glazing.myb` | David Revoy |
| `brushes/soft_airbrush.json` | `deevad/airbrush.myb` | David Revoy |
| `brushes/hard_round.json` | `deevad/basic_digital_brush.myb` | David Revoy |
| `brushes/marker.json` | `tanda/marker-05.myb` | Marcelo "Tanda" Cerviño |
| `brushes/smudge.json` | `deevad/basic_digital_brush_smudging.myb` | David Revoy |
| `brushes/eraser.json` | `deevad/large_hard_eraser.myb` | David Revoy |
| `brushes/charcoal.json` | `tanda/charcoal-03.myb` | Marcelo "Tanda" Cerviño |
| `brushes/pastel.json` | `ramon/Pastel_1.myb` | Ramón Miranda |
| `brushes/ballpen.json` | `deevad/ballpen.myb` | David Revoy |
| `brushes/calligraphy.json` | `classic/calligraphy.myb` | MyPaint contributors |
| `brushes/knife.json` | `deevad/basic_digital_knife.myb` | David Revoy |

CC0 doesn't legally require attribution, but the artists are credited above
as a courtesy. ISC is permissive and imposes no restrictions on the lab
build's own license. Full attribution lives in `public/brushlib/LICENSE.md`.

---

## License

Internal lab build. No license declared yet — see the project root for the
intended license once the work moves out of the lab.
