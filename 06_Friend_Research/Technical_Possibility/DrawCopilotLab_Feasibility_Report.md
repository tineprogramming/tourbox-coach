# DrawCopilotLab — Technical Feasibility Report

> **Working name:** DrawCopilotLab — *"GitHub Copilot, but for your sketchbook."*
> **Date:** May 2026
> **Status:** Initial research & scope-of-work draft
> **Verdict:** **Technically feasible today.** Every individual capability already ships in production-grade form somewhere in industry. The novelty is the *combination*: a real-time collaborative canvas + Copilot-style stroke autocompletion + Duolingo-style gamified curriculum, all wrapped around an AI companion that draws *with* the user.

---

## 1. Executive Summary

| Question | Short Answer |
| --- | --- |
| Can we build a Drawly-like, real-time, multi-user drawing canvas? | **Yes.** Mature open-source stacks (tldraw sync, Yjs, Liveblocks, Excalidraw) already do this at scale. |
| Can the AI "draw with you" stroke-by-stroke in real time? | **Yes, with caveats.** Sketch-RNN (Magenta) and newer 2025–2026 models (StrokeFusion, SwiftSketch, VideoSketcher) generate stroke sequences. Latency budget is the main engineering challenge. |
| Can we replicate AutoDraw's "complete my doodle"? | **Yes, easily.** A QuickDraw-trained classifier + a curated clip-art library covers the MVP. |
| Can we build Copilot-style ghosted next-stroke suggestions? | **Yes.** This is Sketch-RNN's exact capability — the original 2017 demo is literally called *"Draw Together with a Neural Network"*. Modern models make it faster and prettier. |
| Can the AI chat / voice-companion the user during drawing? | **Yes.** OpenAI Realtime API (GPT-4o-realtime) and equivalents handle speech-to-speech with sub-second latency. |
| Can we gamify lessons like ArtWorkout / Duolingo? | **Yes.** ArtWorkout already proves the UX is viable. Stroke-accuracy scoring is straightforward geometry + DTW. |
| Total estimated time to MVP | **~4–5 months** with a small team (2 FE, 1 BE, 1 ML, 1 designer). |
| Hardest engineering risk | End-to-end **latency** for ghost-stroke prediction (target < 150 ms). |
| Hardest product risk | Making AI suggestions feel **collaborative, not patronizing** — i.e. the "Clippy problem." |

---

## 2. Reference App Analysis

### 2.1 Drawly — *the social/collaborative quality bar*
- **Reference:** <https://getdrawly.com/> (also `drawly.app` — a similar but separate product).
- **What they do well:** real-time, stroke-by-stroke synchronization between friends; instant rooms via shareable code; zero-install web entry; extremely simple toolset (a handful of colors, brush sizes, eraser).
- **Stack signals:** public materials cite **Firebase Realtime Database** for sync — this is fine but cost-inefficient at scale and CRDT-less.
- **What we should copy:** frictionless join (URL → in a room in <2 s), stroke-level liveness, presence cursors.
- **What we should *not* copy:** the limited tool palette and the lack of any AI assistance — that's exactly the gap we fill.

### 2.2 Google AutoDraw — *the minimum AI-assist bar*
- **Reference:** <https://www.autodraw.com/>
- **How it actually works:** the same RNN-based sketch recognizer used by Google's *QuickDraw* (1B+ doodle dataset). The user draws → the model classifies the strokes → the UI offers a row of professionally-drawn clip-art replacements.
- **Limits we'll improve on:** AutoDraw only *replaces* your sketch with clip-art. It does **not** autocomplete strokes mid-drawing, doesn't teach, and has no companion.
- **What we'll reuse:** the QuickDraw-trained classifier as a *category prior* to bias our generative stroke model.

### 2.3 ArtWorkout — *the curriculum & gamification bar*
- **Reference:** <https://artworkout.app/>
- **How it actually works:** 2,500+ bite-sized lessons (10–20 min). The user traces guided prompts on iPad/iPhone; the algorithm scores **accuracy, stroke quality, and pressure** several times per second. Daily energy, streaks, multiplayer mode, Loomis-method/anatomy courses.
- **What we'll reuse:** the lesson-shape (trace overlay → real-time score → retry-to-improve loop) and the daily-streak/energy gamification economy.
- **What we'll improve:** ArtWorkout's feedback is largely *"how close was your stroke to the reference."* We'll replace that with a **language-model tutor** that can verbally explain *why* a stroke is off (proportion, weight, perspective).

---

## 3. Core Feature → Feasibility Matrix

| # | Feature | Closest Prior Art | Feasibility | Confidence | Notes |
|---|---|---|---|---|---|
| F1 | Web-based vector canvas with pressure / Apple-Pencil support | tldraw, Excalidraw, Konva, perfect-freehand | **Solved** | 99% | Off-the-shelf |
| F2 | Real-time multiplayer (presence, cursor, stroke sync) | tldraw sync, Liveblocks, Yjs + y-websocket, Drawly | **Solved** | 99% | CRDT-based recommended for offline+merge |
| F3 | "Auto-finish my doodle" (AutoDraw clone) | Google AutoDraw, QuickDraw RNN classifier | **Solved** | 95% | MVP-ready in weeks |
| F4 | Copilot-style ghost-stroke prediction (Tab to accept) | Sketch-RNN ("Draw Together"), StrokeFusion (AAAI '26), SwiftSketch (SIGGRAPH '25) | **Feasible** | 85% | Latency engineering is the work |
| F5 | AI companion that draws *with* you in real time | VideoSketcher (2026) — supports "real-time human-model co-drawing" | **Feasible** | 75% | Newest research; expect bumpy edges |
| F6 | Voice/chat companion ("art teacher" or "friend" persona) | OpenAI Realtime API (GPT-4o-realtime), Gemini Live, ElevenLabs Conversational | **Solved** | 95% | Persona = system prompt + voice |
| F7 | Gamified curriculum (lessons, streaks, energy, XP) | ArtWorkout, Duolingo | **Solved** | 99% | Pure product engineering |
| F8 | Real-time stroke scoring (accuracy/pressure/flow) | ArtWorkout, DTW + Fréchet distance, ML stroke embeddings | **Solved** | 95% | Geometric metrics work; ML refines |
| F9 | "Why is my stroke wrong?" verbal feedback | GPT-4o vision + stroke-stream tool-calling | **Feasible** | 80% | Novel UX, but tech is there |
| F10 | Cross-device (web + iPad PWA + Apple Pencil) | tldraw, Procreate-style PWAs | **Solved** | 90% | PointerEvents API + `pressure` |

> **Bottom line:** every cell is green or amber. There is no red.

---

## 4. Scope of Work

### Phase 0 — Spike & Validate (2 weeks)
- Stand up a tldraw-based canvas with Yjs sync.
- Get Sketch-RNN (or a re-implementation) running in-browser via TF.js / ONNX-Web; measure first-stroke latency.
- Decide: **edge inference (browser/WebGPU) vs. server inference (low-latency WebSocket)**. (Recommendation: browser-first for ghost strokes; server for richer companion drawings.)

### Phase 1 — MVP "DrawCopilot v0.1" (8–10 weeks)
**Goal:** A single user can open the app, draw on a canvas, get AutoDraw-style replacement *and* ghosted next-stroke suggestions. No multiplayer, no curriculum.
- Vector canvas (tldraw or custom Konva/perfect-freehand).
- Stroke-event stream architecture (every pen-down, pen-move, pen-up is a typed event with timestamp + pressure).
- **F3 (AutoDraw clone):** wire up a fine-tuned QuickDraw classifier; ship a clip-art library of ~300 categories.
- **F4 (Ghost stroke):** in-browser Sketch-RNN; render top-3 next-stroke candidates as ghosted SVG overlays; **Tab** to accept.
- Basic accounts, project save/load (Postgres + S3-compatible blob storage).
- Telemetry from day 1: stroke events, accept/reject of suggestions — *this dataset becomes our training flywheel*.

### Phase 2 — "Draw With Me" social layer (6–8 weeks)
**Goal:** Drawly-parity multiplayer + first AI companion.
- Real-time rooms (tldraw sync or custom Yjs + y-websocket on Cloudflare Durable Objects).
- Presence (live cursor, name, color), spectator mode, room invite links.
- **AI companion v1**: a server-side agent that joins a room as a participant, reads the live stroke stream, and contributes its own strokes. Persona-driven (Friendly Buddy / Patient Teacher / Cheeky Critic).
- **F6 voice:** optional voice channel via OpenAI Realtime API; companion can chat *and* draw.

### Phase 3 — "Learn With Me" curriculum (6–8 weeks)
**Goal:** ArtWorkout-style daily-lesson loop with AI-personalised feedback.
- Lesson authoring tool (internal). Each lesson = (reference image, target stroke skeleton, rubric).
- Real-time scoring engine (DTW + per-stroke metrics).
- AI tutor: GPT-4o-vision rates the finished piece *and* narrates verbal corrections via Realtime API.
- Streaks, hearts/energy, XP, league boards.

### Phase 4 — Polish, mobile, growth (ongoing)
- iPad PWA + native wrapper (Capacitor/Expo) for Pencil pressure & palm rejection.
- Custom-trained stroke models on our own user data.
- Marketplace / community gallery.
- Optional: image-to-lesson pipeline (upload any artwork → auto-generate a learn-to-draw lesson).

---

## 5. Recommended Tech Stack

### 5.1 Frontend
| Concern | Pick | Why |
|---|---|---|
| Framework | **Next.js 15 (React 19) + TypeScript** | Mature, SSR, easy deployment |
| Canvas | **tldraw SDK** *or* **Konva.js + perfect-freehand** | tldraw if we want batteries included; Konva if we need full control over the Copilot-style UX |
| Pressure / Pencil | **PointerEvents API** (`pressure`, `tiltX/Y`) | Native, no library needed |
| Real-time sync | **Yjs + y-websocket** (or **tldraw sync**) | CRDT, offline-tolerant, battle-tested |
| State mgmt | Zustand + Immer | Lightweight |
| Styling | Tailwind CSS + shadcn/ui | Fast iteration |
| ML inference (client) | **TensorFlow.js** *or* **ONNX Runtime Web** with **WebGPU** backend | Sub-100ms stroke generation possible on modern hardware |

### 5.2 Backend
| Concern | Pick | Why |
|---|---|---|
| API | **Node.js (Fastify)** or **Python (FastAPI)** | Pick FastAPI if ML team prefers Python end-to-end |
| Realtime room server | **Cloudflare Workers + Durable Objects** | Per-room isolation, WebSocket-native, pay-per-use |
| Database | **Postgres** (managed, e.g. Neon / Supabase / Azure Database for PostgreSQL) | Users, lessons, scores |
| Blob storage | **S3 / R2 / Azure Blob** | Drawings, exports, reference imagery |
| Auth | **Clerk** or **Auth.js + Microsoft Entra External ID** | Speed to market |
| Cache / pubsub | **Redis** (Upstash) | Presence, rate limits |

### 5.3 AI / ML
| Capability | Model / Service | Hosting |
|---|---|---|
| Sketch classification (AutoDraw) | Fine-tuned **QuickDraw RNN** or a small Transformer trained on the 50M-doodle QuickDraw dataset | TF.js in-browser (≤5 MB) |
| Next-stroke prediction (Copilot) | **Sketch-RNN** baseline → upgrade to **StrokeFusion** / **SwiftSketch** | Browser via ONNX-Web; fall back to GPU server when WebGPU unavailable |
| Co-drawing companion | **VideoSketcher**-style sequential generation, *or* a custom fine-tune on artist demonstration videos | Server-side GPU (A10/A100), WebSocket-streamed strokes |
| Voice companion | **OpenAI Realtime API (gpt-4o-realtime)** or **Gemini 2.x Live** | Vendor-hosted |
| Vision feedback (lesson grading) | **GPT-4o** / **Claude Sonnet 4.x** with vision | Vendor-hosted |
| Stroke scoring | Dynamic Time Warping (DTW) + Fréchet distance; learned stroke embeddings later | In-house, lightweight |

### 5.4 DevOps / Observability
- **Cloud:** Azure (App Service / Container Apps for API; AKS or Container Apps for GPU inference; Azure OpenAI for managed models) — natural fit given the org's existing Azure footprint. Alternatives: Vercel + Cloudflare for the public-facing surface.
- **CI/CD:** GitHub Actions → Azure Container Registry → Container Apps.
- **Observability:** Application Insights + OpenTelemetry. Track latency percentiles for `firstSuggestionLatency` and `companionStrokeLatency` as first-class SLOs.
- **Feature flags:** ConfigCat or LaunchDarkly — we *will* be A/B-testing how aggressive the Copilot suggestions are.

---

## 6. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser / iPad PWA                              │
│  ┌────────────────────┐   ┌─────────────────┐   ┌────────────────────┐  │
│  │ tldraw / Konva     │   │ Yjs CRDT doc    │   │ Local ML (TF.js /  │  │
│  │ + perfect-freehand │◄─►│ (strokes,       │   │ ONNX-Web, WebGPU)  │  │
│  │ Pointer/Pressure   │   │  presence)      │   │ → ghost strokes    │  │
│  └────────┬───────────┘   └────────┬────────┘   └─────────┬──────────┘  │
│           │ stroke events          │ y-protocol            │ candidates  │
└───────────┼────────────────────────┼───────────────────────┼─────────────┘
            │                        │                       │
            ▼                        ▼                       ▼
┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────┐
│  Edge: CF Worker /   │   │  Realtime Room Svc   │   │ Inference API    │
│  App Service (HTTP)  │   │  (Durable Object /   │   │ (GPU pool, gRPC) │
│  • Auth, lessons     │   │   WebSocket fan-out) │   │ • StrokeFusion   │
│  • Score persistence │   │  • Presence          │   │ • Co-draw agent  │
└──────────┬───────────┘   │  • Snapshot persist  │   │ • Vision grader  │
           │               └──────────┬───────────┘   └────────┬─────────┘
           ▼                          ▼                        ▼
   ┌────────────────┐         ┌─────────────────┐    ┌─────────────────┐
   │ Postgres (Neon)│         │ Blob (R2/Azure) │    │ Voice: OpenAI   │
   │ users, lessons │         │ drawings, refs  │    │ Realtime / Live │
   │ scores, XP     │         │                 │    │ (WebRTC direct) │
   └────────────────┘         └─────────────────┘    └─────────────────┘
```

**Latency budget for ghost-stroke suggestions (Phase 1 target):**

| Hop | Budget |
|---|---|
| PointerUp → stroke event ready | 10 ms |
| Stroke encode + inference (browser, WebGPU) | 80 ms |
| Render ghost overlay | 20 ms |
| **Total user-perceived latency** | **≤ 150 ms** |

Anything above ~250 ms feels "AI is thinking" instead of "AI is drawing with me." This is the single most important non-functional requirement.

---

## 7. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Ghost-stroke latency feels sluggish on mid-range devices | **High** | Ship a small (≤5 MB) on-device model first; use server inference only as fallback; aggressive caching of recent latent states. |
| AI suggestions become annoying (the "Clippy problem") | **High** | Suggestions are *opt-in* (must press Tab); ghost strokes fade automatically; user can dial intensity 0–100%. |
| Copyright / training-data concerns with stroke models | Medium | Train baseline on QuickDraw (CC-licensed) only; commission original artist demonstrations for higher-quality fine-tunes; clear opt-in for using user data in training. |
| Realtime API costs at scale (voice companion) | Medium | Voice is opt-in & per-session; cap session length; downgrade to text-only when user is silent. |
| Multiplayer abuse (NSFW drawings, harassment) | Medium | Vision moderation (Azure Content Safety / OpenAI Moderation) on canvas snapshots; report/mute; rooms gated by share-link by default. |
| Mobile Safari quirks with WebGPU | Medium | Detect; fall back to WebGL backend; fall back to server inference. |
| Curriculum quality at scale | Medium | Start with 30 expert-authored lessons; only after Phase 3 validates retention do we invest in the auto-lesson pipeline. |
| Differentiating from incumbents (Procreate, Drawly, ArtWorkout) | Strategic | The wedge is the *combination* + the *Copilot UX metaphor* — none of the incumbents have ghosted next-stroke suggestions. |

---

## 8. Brainstorm — Product Ideas We're Sitting On

These are not commitments, just things worth keeping on the radar:

1. **Persona marketplace.** Let creators publish AI companions ("Bob Ross," "Studio Ghibli senpai," "grumpy art prof"). Revenue share. Each persona = system prompt + voice + drawing-style fine-tune.
2. **Replay & timelapse.** Because every stroke is a typed event, we get free time-lapse export. Great for TikTok/IG growth.
3. **"Tab-to-improve" globally.** Beyond next-stroke, allow Tab on a finished drawing → AI proposes a *whole-drawing* polish that you can accept stroke-by-stroke.
4. **Daily challenge multiplayer.** ArtWorkout-style daily prompt, drawn live with a stranger + an AI judge. Combines all three pillars in one feature.
5. **Drawing-style transfer.** Trained on user's own past drawings, the companion adapts to *their* style instead of forcing them into a generic one.
6. **Accessibility angle.** Ghost-stroke + voice tutor is unusually friendly for users with motor-control limitations or visual-processing differences. Worth designing for explicitly.
7. **Education partnerships.** ArtWorkout proves the consumer market; the *real* TAM expansion is K-12 and adult-ed bundles.
8. **Local-first option.** A "private mode" where Sketch-RNN runs entirely in-browser, no server hop, no telemetry. Privacy is a moat against bigger players.

---

## 9. Open Questions for the Team

1. **Brand positioning:** *"Copilot for drawing"* (developer-flavored) vs. *"Your AI drawing buddy"* (consumer-flavored)? Pick before any UI work — they imply different aesthetics.
2. **Monetization:** subscription (ArtWorkout-style) vs. credits (per AI-call) vs. freemium with cosmetic brushes?
3. **Default companion behavior:** does the AI draw *unprompted* in a shared room, or only when summoned? (Strong opinion: only when summoned, in v1.)
4. **Platform priority:** Web-first (largest reach, easiest dev) or iPad-first (best pen UX, highest willingness to pay)? Suggest **web-first, iPad-PWA fast-follow**.
5. **Data strategy:** opt-in donate-your-strokes flywheel? With what rev-share or perks?

---

## 10. Recommendation

**Proceed.** Build the Phase-0 spike in two weeks. The decisive question is *not* whether the technology exists — it does — but whether we can keep ghost-stroke latency under ~150 ms on a mid-tier laptop with our chosen model. If we hit that bar in the spike, every other feature is "just engineering" and well-precedented.

The strategic insight is that **none of Drawly, AutoDraw, or ArtWorkout currently has a Copilot-style stroke-completion UX.** That's our wedge. The collaborative canvas and the gamified curriculum are *table stakes* we add to make the wedge a product.

---

## Appendix A — Key References

- **Drawly:** <https://getdrawly.com/> · <https://drawly.app/>
- **Google AutoDraw:** <https://www.autodraw.com/>
- **Quick, Draw! dataset:** <https://quickdraw.withgoogle.com/data>
- **Sketch-RNN (Magenta):** <https://magenta.tensorflow.org/sketch_rnn> · <https://magenta.tensorflow.org/sketch-rnn-demo>
- **StrokeFusion (AAAI 2026):** <https://arxiv.org/abs/2503.23752>
- **SwiftSketch (SIGGRAPH 2025):** <https://swiftsketch.github.io/>
- **VideoSketcher (2026):** <https://arxiv.org/html/2602.15819v1>
- **ArtWorkout:** <https://artworkout.app/>
- **tldraw sync:** <https://tldraw.dev/reference/sync-core/TLSocketRoom>
- **Excalidraw collab post-mortem:** <https://blog.excalidraw.com/building-excalidraw-p2p-collaboration-feature>
- **OpenAI Realtime API:** <https://platform.openai.com/docs/guides/realtime>
- **perfect-freehand:** <https://github.com/steveruizok/perfect-freehand>
