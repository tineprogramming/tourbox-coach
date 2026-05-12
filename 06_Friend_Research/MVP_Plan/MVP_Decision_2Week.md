# 2-Week MVP — Feature Decision Memo

> **Author:** Engineering / Product
> **Date:** May 2026
> **Decision needed by:** Day 0 of the sprint
> **Delivery deadline:** Day 14 (internal demo to client + their CEO)

---

## TL;DR — Recommended MVP Scope

Build a **single-user, web-based "DrawCopilot Demo Bench"** that does three things, all on top of the client's pen-display hardware:

1. **"Polish My Drawing" — Sketch-to-Image polish** (the CEO's favorite). User scribbles → AI returns 4 polished variants in 4 styles. *This is the AutoDraw + Samsung Gemini moment the CEO wants to see.*
2. **Pen-Process Recorder** — the canvas captures and persists a high-fidelity log of every stroke event: `(x, y, pressure, tilt_x, tilt_y, azimuth, time, layer, undo_id)`. Exportable as JSONL **and** as a Wacom-WILL-compatible stream. *This is the data-flywheel seed corn — the unique IP the client owns and nobody else can replicate.*
3. **Stroke Replay + Perspective/Symmetry Assist** — playback the drawing stroke-by-stroke; toggle a perspective grid or a symmetry mirror that uses real pen tilt to align. *This proves the rich data is wired in **today** — even before any new ML model exists — and lights up two of the client CEO's slide-10 concepts (driver-level assist + replay).*

**What we explicitly defer:** the novel pressure/tilt/time-aware *next-stroke prediction model* the client deck describes. Its R&D risk does not fit a 2-week box (see §5).

---

## 1. The Decision Problem

We have two pressures pulling on the 2-week scope:

| Pressure | Source | What it implies |
|---|---|---|
| **Land a CEO-pleasing demo fast** | Client CEO loves Google **AutoDraw** and Samsung Galaxy AI's **Drawing Assist / Sketch-to-Image**; explicitly told us *"this is something that can be built fast."* | Use existing image-gen APIs (ControlNet-scribble / SDXL / fal.ai / Replicate / Azure OpenAI image). Ships in days. |
| **Prove the strategic wedge** | Client deck (slides 4, 7, 12): the moat is *stroke-process data*, not the polished image. Their value is the data ingress — `(x, y, p, tilt, t)` at 200 Hz with full session context. | We must demonstrate the data pipeline, not just call someone else's image API. |
| **Honor the team's R&D realism** | Engineering memo from product owner: *"R&D takes longer; building a new model with pressure / time / tilt dimensions takes try-and-error… ship in 1–2 months first, work on new models longer term."* | Defer novel sequence-modeling ML. Use only models that exist off-the-shelf in the 2-week window. |

The MVP must satisfy *all three* in 14 days. The recommended scope above does that by **decoupling the visible demo from the strategic infrastructure**, while making sure the strategic infrastructure produces at least one visible demo (perspective assist + replay).

---

## 2. Recommended Feature Set

### F1 — "Polish My Drawing" (Sketch-to-Image polish) — **CEO crowd-pleaser**
- **What the user sees:** draws on the canvas → clicks *Polish* → 2–4 styles appear (Watercolor, Anime/Manga, Concept Art, Pencil Sketch). Each style produces 1–2 variants. User picks one to keep on a new layer.
- **How:** call an off-the-shelf scribble-conditioned image model (ControlNet-Scribble / SDXL-Turbo via fal.ai or Replicate; alternative: Azure OpenAI Image / Nano-Banana). Server-side only — no in-house model training.
- **Why it's safe in 2 weeks:** zero novel ML. ~1 day to integrate, ~2 days for the UI / styling presets.
- **Why it matches CEO's mental model:** this is exactly the AutoDraw + Samsung Gemini interaction.
- **Critical caveat:** this is the *least* differentiated feature on the list — every consumer phone now ships it. We frame it as the *demo-friendly veneer*, while §F2 is the actual moat.

### F2 — Pen-Process Recorder + Standard Export — **the strategic wedge**
- **What the user sees:** a small "Recording" indicator in the corner. After the session, a *Download session log* button.
- **What's actually happening:** every PointerEvent is written to a typed event stream, including `pressure`, `tiltX`, `tiltY`, derived `azimuth` and `instantaneous speed`, plus session context (layer id, tool id, undo/redo id, intent-stage tag if user opts in to label).
- **Two export formats:**
  - **`session.jsonl`** — our own line-delimited format, easy for ML.
  - **`session.uim`** — Wacom **Universal Ink Model** (Protocol Buffers v3 + RIFF) for cross-tool interoperability. *This directly answers slide 9: "extend WILL / Wintab / HID."* Implementation = use Wacom's published [UIM SDK](https://developer-docs.wacom.com/docs/sdk-for-ink/uim/encoding) — no need to invent a format.
- **Why it's safe in 2 weeks:** the browser already gives us all the fields via the `PointerEvents` API; we just have to log them. Wacom's UIM SDK does the binary serialization for us.
- **Why it's the moat in disguise:** every recorded session is *training data we own*. Even if our long-term model takes 6 months to build, we have 6 months of pristine data by the time we start training.

### F3 — Stroke Replay + Perspective/Symmetry Assist — **process-aware feature, no ML required**
- **Stroke replay:** scrub a timeline; the canvas redraws stroke-by-stroke at original speed (or 4×). Used in demos to show "look — we have the *whole process*, not just the picture." Zero ML.
- **Perspective grid:** toggle 1-/2-/3-point perspective overlay. Pen tilt aligns the active vanishing line. *This uses tilt data immediately — pure geometry, no model.*
- **Symmetry mirror:** vertical / radial mirror. Strokes are reflected with *correct pressure and tilt* on the mirrored side — a small but visible flex of why the rich data matters.
- **Why these three together:** they collectively prove that "rich pen data → visible value" is real **without** waiting for a new model. They line up with slide 10 ("driver-level smart pen — perspective / symmetry assist; teachable / replayable").

### F4 (stretch, only if F1–F3 ship by Day 9) — Off-the-shelf next-stroke ghost
- Drop in **Sketch-RNN** (Magenta) via TF.js, gated behind a feature flag. Just to put the *Copilot UX gesture* in front of the CEO.
- We must be honest in the demo: this is the public 2017 model on QuickDraw — *not* the model we'll eventually build with their pressure/tilt data. Its job is to validate the UX, not the IP.

### What's deliberately **out of scope** for the 2-week MVP

| Out | Why |
|---|---|
| Multiplayer / shared rooms (Drawly-style) | Not on the CEO's wish list; adds CRDT / WebSocket complexity that will eat the whole sprint. |
| Voice companion (Realtime API) | Not asked for; runs over budget on day-1 cost discussion. |
| Gamified curriculum (ArtWorkout-style lessons, streaks, energy) | Big content + product effort; not asked for in this meeting. |
| **Novel pressure/tilt/time-aware next-stroke model** | Per §5 — genuinely R&D, requires data we'll only have *after* F2 ships and accumulates. |
| iPad / mobile native shell | Web demo first; client's hardware is Windows-attached pen displays. |
| User accounts, billing, sharing | Demo runs on a fresh laptop with the client's hardware plugged in. Local-first is fine. |

---

## 3. Day-by-Day Plan (10 working days × 14 calendar days)

Assumes a small team: **2 frontend, 1 backend / glue, 1 ML / integration, 1 designer (part-time)**. Single dev or pair-only changes the math; flag this on Day 0.

| Day | Workstream A — Canvas + Recorder | Workstream B — Polish API + UI | Workstream C — Replay + Assist |
|---|---|---|---|
| **D1** | Scope freeze, repo + CI, hardware bring-up on dev laptops with the client's pen display. Confirm `PointerEvents` exposes `pressure`, `tiltX/Y` for *their* driver (this is the #1 risk to de-risk on day 1). | Spike: pick image-gen vendor (fal.ai vs. Replicate vs. Azure OpenAI Image). Latency + cost test on 20 sample scribbles. | Wireframes for replay scrubber, perspective overlay, symmetry mirror. |
| **D2** | Vector canvas (tldraw or Konva + perfect-freehand), pen-event stream architecture. | Style-preset list locked (4 styles). Prompt templates. | Math for perspective grid (1/2/3-point) + symmetry transforms. |
| **D3** | Local stroke log → JSONL on disk; basic viewer for verification. | First end-to-end "scribble → polished image" round-trip in dev. | Replay scrubber MVP (forward-only). |
| **D4** | Wacom UIM SDK integration; export `.uim` file. | UI: style picker grid, generate button, result lightbox. | Perspective overlay rendered on canvas. |
| **D5** | Add session context: layer id, tool id, undo/redo id, intent-stage tag (manual dropdown). | Variant rejection / accept-as-layer flow. | Symmetry mirror with correct pressure & tilt reflection. |
| **D6** | Recorder telemetry: events/sec, log size, dropped events. | Style A/B test harness (which preset wins on test set). | Replay 4×/timeline scrubbing both directions. |
| **D7** | **Mid-sprint demo internally** (the team plays artist for an hour and watches what the recorder logs). Fix gaps. | Cost guardrails (per-session $ cap; queue + rate limit). | Polish replay UX. |
| **D8** | Stretch: Sketch-RNN ghost-stroke (F4) behind feature flag, *only* if A/B/C all green. | Style fine-tune of prompts based on D7 demo. | Polish perspective + symmetry UX. |
| **D9** | Demo dataset: 5 pre-recorded sessions exported as `.uim` to show on demo day. | Demo-ready: 4 scribbles × 4 styles pre-cached for offline backup. | Demo-ready replay clips. |
| **D10** | End-to-end smoke + load test. Telemetry dashboard for the demo. | Story: build the demo script. | Buffer / bug fixes. |
| D11–D12 | Buffer days. Dress rehearsal Day 12. | | |
| D13 | Demo dry-run with internal stakeholders. Lock build. | | |
| D14 | **Demo to client.** | | |

**Daily standup discipline:** every standup answers *"is the recorder still capturing every event with full fidelity?"* That is the single most important non-negotiable, because it defines whether we're really collecting the moat data.

---

## 4. Tech Stack — Conservative Choices for a 2-Week Sprint

We're keeping every decision boring, because boring ships.

- **Frontend:** Next.js 15 + TypeScript + Tailwind. Canvas: **Konva.js + perfect-freehand** (over tldraw — we want full control of the recorder hooks, and we're not building multiplayer this sprint).
- **Pen capture:** native `PointerEvents` API. Validate on day 1 that the client's driver populates `pressure`, `tiltX`, `tiltY`. (Wacom and Huion drivers do; we should not assume the client's does.)
- **Stroke standard:** **Wacom Universal Ink Model (UIM)** via the published SDK — keeps us protocol-aligned with slide 9's WILL/Wintab/HID extension theme, *without* inventing our own format.
- **Backend:** FastAPI on Azure Container Apps. SQLite for sessions in the demo (not Postgres — too much yak-shaving for a 2-week build).
- **Storage:** local `./sessions/` on the demo box; optional Azure Blob if we have time on Day 9–10.
- **Sketch-to-image vendor:** primary candidate **fal.ai** (lowest p95 latency on scribble-conditioned models in our prior tests); fallback **Replicate** (broader model catalog, slightly slower); enterprise fallback **Azure OpenAI Image** (compliance-friendly, useful for the partnership story).
- **CI / hosting:** GitHub Actions; demo runs on the client's laptop locally — no cloud demo dependency on demo day.
- **Observability:** simple structured logs + a one-page Grafana / Application Insights dashboard for stroke-rate, polish-API latency, and model cost.

**No frameworks added in week 2.** Whatever we picked Day 1, we live with.

---

## 5. Why We Are NOT Building the Novel Stroke-Prediction Model in 2 Weeks

This deserves its own section because it's where we'll get the most pushback from the client.

The client's deck (slides 4, 7, 8, 10) describes a model that takes `(x, y, pressure, tilt, time)` sequences and predicts the next stroke in the *artist's own style*. Building that model in 2 weeks is unrealistic for five concrete reasons:

1. **No labeled training data exists yet.** The whole *point* of this partnership is that nobody has process-data corpora. The first-party data starts arriving the day F2 ships. We need at least weeks of recordings before we can train *any* personalization model meaningfully.
2. **Public stroke models (Sketch-RNN, StrokeFusion, SwiftSketch) ignore pressure and tilt.** They treat strokes as `(x, y, pen_state)` triples. Adapting their architectures to add 3 more dimensions is a research project, not a sprint task — empirical sequence-model work routinely takes weeks per ablation.
3. **Personalization (slide 8: "few-shot adaptation to an individual's drawing handwriting") needs an evaluation harness** before we can claim it works. A 2-week MVP can't ship that harness *and* the model *and* the UX.
4. **End-to-end latency budget is very tight.** Slide 7 promises sub-10 ms feedback. Even a small Transformer at 200 Hz strokes is hard to keep under that bar; we'd need NPU-level inference and quantization. Out of scope for the first demo.
5. **"Try-and-error" is exactly what the product memo flagged.** Spending sprint capacity on a research bet that might not produce a runnable artifact is the worst use of the 2 weeks.

**What we propose instead:** position §F2 (the recorder + UIM export) as **Phase 0** in the client's own roadmap (slide 13: *"Phase 0 — jointly define the standard & data-collection spec"*). We are literally delivering the artifact slide 13 asks for in Phase 0, *plus* a CEO-level demo that papers over the model gap with off-the-shelf image-gen.

Then we propose a follow-on plan:

| When | What |
|---|---|
| **Weeks 3–6 (post-MVP)** | Recruit ~30 artists onto the recorder. Accumulate ~200 hours of process data tagged with intent-stages. |
| **Weeks 4–8** | First model spike: a Transformer over `(x, y, p, tx, ty, dt)` token streams. Evaluate next-stroke top-k accuracy and held-out user adaptation. |
| **Months 3–6** | The proper *Phase 1* of the client's roadmap: stroke-prediction + perspective assist productized. |

This timeline both (a) honors the engineering team's "R&D takes longer" memo and (b) lands inside the client's own slide-13 *"Phase 1 (3–6 months)"* window — i.e. we are not slipping their plan, we are rephasing the first 14 days inside Phase 0.

---

## 6. Risks for the 2-Week Window

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Client's pen driver doesn't expose `tiltX/Y` to the browser** | Medium | Day-1 verification on real hardware. Fallback A: native helper app (Electron / Win32) reading Wintab and forwarding via WebSocket. Fallback B: degrade gracefully — log the fields that exist, mark tilt as `null` in `.uim`. |
| **Sketch-to-image vendor goes down on demo day** | Low–Medium | Pre-cache 4 scribbles × 4 styles on Day 9. Demo can fall back to playback from cache without the audience noticing. |
| **`PointerEvents` rate is too low (<60 Hz) on the demo machine** | Medium | Use `getCoalescedEvents()` to recover sub-frame samples (Wacom drivers report 200+ Hz this way). Verify on Day 1. |
| **Cost spike from unmetered image API calls** | Low | Per-session cap, daily $ ceiling, kill-switch in admin. |
| **Scope creep — "can we add multiplayer / voice / lessons?"** | High | This memo. Get sign-off Day 0. |
| **Expectation mismatch — CEO sees the polish demo and asks "where's the next-stroke prediction?"** | High | Demo script must lead with §F3 (the perspective/symmetry/replay piece) explicitly framed as *"this is what's possible with your pen data, today, with no new model"*, then §F1 as the polish layer. F4 (Sketch-RNN ghost) only if shipped, with the candid disclaimer it's a public model, not theirs. |

---

## 7. Open Questions for the Client (raise on Day 0)

1. Which pen-display SKU should the demo target? Confirm OS (Windows? Wacom-Bamboo-style USB-HID? Their own driver?) and whether they have a Linux/macOS variant.
2. Do they have a preferred **on-device runtime** for future work — ONNX Runtime, TensorRT, Qualcomm SNPE, MediaTek APU? Affects Phase-1 model choice but not the 2-week MVP.
3. Will their driver team give us access to the **raw HID report** (potentially higher sample rate / extra bytes) or just the OS-level `(x, y, pressure, tilt)` stream? This is the real-moat question.
4. Are they comfortable with the demo invoking a third-party image-gen API (fal/Replicate/Azure OpenAI), or do they require that be self-hosted? Compliance-driven; affects vendor pick.
5. Whose brand fronts the demo — theirs, ours, or neutral "DrawCopilot Lab"?

---

## 8. Decision Asks

We need three sign-offs from product/leadership before Day 0:

- [ ] **Scope** — approve the F1+F2+F3 set; explicitly approve the deferral of the novel stroke-prediction model.
- [ ] **Vendor** — approve the sketch-to-image vendor pick (recommended: **fal.ai**, with Azure OpenAI as the enterprise alternative).
- [ ] **Demo framing** — approve the script's *"the moat is in the data we just started recording, not the polish API the demo opens with"* narrative. This is the single most important framing decision; it determines whether the CEO walks out impressed by *AutoDraw* (commodity) or impressed by *what they alone can build over the next 6 months* (the real partnership thesis).

---

## Appendix — Mapping This MVP to the Client's Slide-13 Roadmap

| Client phase | Client deliverable | What our 2-week MVP gives them |
|---|---|---|
| **Phase 0 — joint standards** | Define standard + collection spec | ✅ §F2 ships a `.uim`-compatible recorder; spec doc produced as part of the MVP; we extend WILL/Wintab on paper. |
| **Phase 1 — 3–6 months MVP** | Stroke prediction + perspective assist | 🟡 Perspective + symmetry assist shipped today (no ML); stroke-prediction prep work begins post-MVP with the data the recorder produces. |
| **Phase 2 — 6–12 months GA** | Process replay + teaching mode | 🟡 Stroke replay shipped today as a demo feature; productization in Phase 2. |
| **Phase 3 — 12–18 months ecosystem** | SDK + content platform | ⏳ Out of scope for the MVP; the recorder format becomes the seed of the eventual SDK. |

The 2-week MVP is **a complete Phase-0 deliverable + a CEO-grade preview slice of Phases 1–2**. That's a credible promise we can keep.
