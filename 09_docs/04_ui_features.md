# UI Features

## Layout (top to bottom)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ◆ TourBox Coach   Pi 5+HAT · hybrid AI   [Pi·Connected] [Cloud·Online]  │
│                                          [🌐 EN/中文]  [Undo Clear ...] │
├─────────────────────────────────────────────────────────────────────────┤
│ 🤖 AI   Coach · Polish · Vision                                         │
│   [Coach dropdown (categorized)]   [🎨 Polish My Drawing]  [👁 Ask Vision]│
├─────────────────────────────────────────────────────────────────────────┤
│ Toolbar │   Canvas (Konva + perfect-freehand + libmypaint)   │ Settings │
│ pencil  │                                                    │ thickness│
│ char-   │   [stroke recorder, ghost-guide overlay,           │ color    │
│ coal    │    pen telemetry HUD]                              │ opacity  │
│ pastel  │                                                    │ swatches │
│  ...    │   [CoachingBubble appears here on stroke end]      │ brush    │
├─────────────────────────────────────────────────────────────────────────┤
│ Press H for HUD · ⌘Z undo · G ghost · Tab accept · Pi network setup → │
└─────────────────────────────────────────────────────────────────────────┘
```

## AI Box panel

Distinct gradient-border section between topbar and workspace.

**Coach dropdown** — categorized `<optgroup>`:
```
🇹🇭 Remote Thailand cluster
  🇹🇭 Qwen3-32B-AWQ (opensource) · Thailand 4090 cluster
🏠 Local Pi model
  🏠 Qwen2:1.5b (opensource) · on-device, private
🇨🇳 Cloud Chinese model
  🇨🇳 DeepSeek (opensource) · DeepSeek
  🇨🇳 Qwen-Plus · Alibaba DashScope
🌎 International model
  🇺🇸 OpenAI GPT-4o-mini · OpenAI
```

**Two action buttons:** Polish + Vision (both gradient-style purple/cyan).

## Polish modal

### Structure (top-down)
1. **Mode picker** (2 large cards): 🎯 Sketch-Faithful  /  🎨 AI Reimagine
2. **Style dropdown** (7 options) + **Generate button** (label adapts: "Generate" / "Compare N models")
3. **Multi-select chip grid** of providers — grouped by category, "Just cluster" / "Select all" toolbar
4. **Results compare grid** — source thumb (cell #1) + per-provider cells in `repeat(auto-fit, minmax(320px, 1fr))`
5. Per-cell: header (flag + label + (opensource) pill + vendor) + image/shimmer/error + footer (style · elapsed)

### Animations
- **Shimmer** while loading: `polishShimmer` keyframe animates `background-position` for liquid gradient effect
- **Reveal fade-in** when image lands: `polishReveal` keyframe `blur(28px) scale(1.06) opacity(0) → blur(0) scale(1) opacity(1)` over 1.2s cubic-bezier
- Source thumb explicitly has `animation: none` (input is static, only outputs animate)

### Modes (results show mode hint banner)
- **AI reimagine mode** (purple banner): "AI read your sketch and reimagined it in this style — lines aren't preserved literally."
- **Faithful mode** (green banner): "AI used your sketch as a structure guide — lines + composition are preserved."

### Result metadata shown
- Mode hint banner
- "What the AI saw in your sketch" (caption from vision step, cluster only)
- "Prompt sent to Flux" (final prompt with style suffix)

## Vision modal

### Structure
1. Question textarea + provider dropdown + Ask button
2. Suggested prompt chips (4 ready-to-use questions)
3. Multi-select chip grid (3 providers)
4. Results compare grid: source thumb + per-provider cells

### Per-cell rendering
```
┌──────────────────────────────┐
│ 🇹🇭 Qwen3-VL (opensource)    │  ← header
│                              │
│  [sketch image with SVG       │  ← bbox overlay layer
│   rect overlays per region —  │     hue-rotated colors
│   hover-active highlight]     │
│                              │
│ "I see a stick figure under  │  ← reply text
│  a sun. Try adding facial    │
│  features to make it more    │
│  expressive."                │
│                              │
│ [stick figure] [sun]         │  ← region chips (hover ↔ overlay sync)
│                              │
│ Qwen3-VL-30B-AWQ · 1.6s · 2  │  ← footer
└──────────────────────────────┘
```

### Region grounding
- Backend prompt asks for `<regions>[{label, bbox}]</regions>` JSON block
- Parser extracts coords, normalizes (x1<x2, y1<y2), drops malformed
- SVG `<rect>` with `vectorEffect="non-scaling-stroke"` so border weight stays constant when image scales
- Active region: stroke 4px + fill 0.28 alpha + label text overlay
- Active state is PER-PROVIDER (so hovering one cell doesn't light up another)

## Internationalization

- **3 locales**: EN, zh-CN, (Thai = source language but not in UI yet)
- **~75 translation keys** in `frontend/src/i18n/strings.ts`
- **Auto-detect** from `navigator.language` on first load, persisted in Zustand
- **Language picker** 🌐 in topbar (flag + label dropdown)
- **AI replies match UI locale** — coach prompt + vision prompt + region labels all
  receive a "Reply in {language}" directive based on `lang` field in API request

## Multi-language back-propagation

When user changes 🌐 language:
1. Zustand `setLocale` fires
2. All useT() hooks re-render with new strings
3. Next stroke / vision / polish request sends `lang: newLocale` to backend
4. Backend `_with_lang()` appends "Reply in {label}" to prompts
5. AI responds in new language (including region labels in Vision)

## Persistent prefs (Zustand → localStorage)

Saved on change (debounced 150ms):
```
tool, thickness, color, opacity,
ghostLesson, ghostOpacity,
coachProvider, locale
```

Storage key: `tourbox-coach.prefs.v1`
Session strokes separately: `drawcopilotlab.session.v1`

## Defensive measures

| Layer | Mechanism |
|---|---|
| Image rendering | Hard `max-height: 420px` + `object-fit: contain` on compare cells |
| Modal portal | `createPortal(modal, document.body)` — isolates from any ancestor `<form>` |
| Button defaults | All `type="button"` + `e.preventDefault() + e.stopPropagation()` on Generate |
| React crashes | `<ErrorBoundary>` wraps `<App/>` — shows error UI with reload + stack trace |
| Error display | `<ErrorBlock>` component: copyable `<pre>` + "Copy" button (clipboard API + fallback selection) |
| WS reconnect | wsClient auto-reconnects in 3s on disconnect |
| Provider timeout | Pi backend per-provider TIMEOUT_S (60-300s) |

## Bug history & fixes

1. **Modal "page refresh" bug** — `.polish-reveal-img { position: absolute; inset: 0 }` from old single-result design escaped to `.polish-overlay` viewport-sized parent when cells had no `position: relative`. Fixed by renaming class to `polish-compare-cell-img` (dedicated, no absolute positioning).

2. **Vision context overflow** — Qwen3-VL tokenizes 2048×2048 PNG → 7199 tokens > max_model_len 4096. Fixed: `image_utils.downscale_data_url(max_edge=1024)` on Pi + cluster `--max-model-len 8192` + `--gpu-memory-utilization 0.92`.

3. **Shimmer animation broken** — keyframe `polishShimmer` (camelCase) but CSS called `polish-shimmer` (kebab). Renamed in CSS to match.

4. **Reveal fade-in lost** — kept on `.polish-reveal-img.is-loaded` which we removed. Added back via `@keyframes polishReveal` running on-mount.

5. **Source thumbnail huge** — `figure.polish-compare-source { max-width: 320px }` was insufficient because img had `width: 100%` and `<img>` ancestor positioning chain wasn't bounded. Moved source out of grid into separate `.polish-source-thumb` with explicit caps, then merged back as cell #1 in compare grid with neutral border (distinct from accent-bordered result cells).
