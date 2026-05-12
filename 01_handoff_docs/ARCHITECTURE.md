# Technical Architecture — TourBox Coach Demo

> System design for Pi 5 + HAT 26T setup.
> Stroke-first architecture, local-only, privacy by design.

---

## 🏗️ High-level architecture

```
┌─────────────────────────────────────────────┐
│  USER DEVICE (laptop/phone)                 │
│                                             │
│  Web Browser:                               │
│  ├─ Next.js 15 + TypeScript                 │
│  ├─ Konva.js canvas + perfect-freehand      │
│  ├─ Wacom via Web HID API                   │
│  ├─ TourBox controller via Web HID          │
│  └─ WebSocket client → Pi                   │
│                                             │
│  User keeps own internet on this device     │
└──────────┬──────────────────────────────────┘
           │
           │  WebSocket over Wi-Fi
           │  (Pi's captive portal AP)
           │
           ▼
┌─────────────────────────────────────────────┐
│  RASPBERRY PI 5 8GB                         │
│  (offline, captive portal AP mode)          │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  CPU (Cortex-A76 4-core, 10W)        │  │
│  │                                       │  │
│  │  • FastAPI + Uvicorn (web server)    │  │
│  │  • WebSocket handler                  │  │
│  │  • Stroke Engine:                     │  │
│  │    - Real-time analyzer               │  │
│  │    - Pen-Process Recorder (JSONL)     │  │
│  │    - Pattern detector                 │  │
│  │  • LLM Engine:                        │  │
│  │    - Ollama + Qwen 2:1.5b             │  │
│  │    - 11-12 tok/s coaching feedback    │  │
│  │  • Pre-cached Library Matcher         │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  HAT 26T (Hailo-8 NPU, 3W)           │  │
│  │                                       │  │
│  │  • YOLO object detection (60+ FPS)   │  │
│  │  • MediaPipe pose/face (on-demand)   │  │
│  │  • Custom CNN if trained             │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Storage:                                   │
│  • microSD 128GB (system + models)         │
│  • Pre-cached reference library (200+ imgs)│
│  • Stroke recording (JSONL append)         │
└─────────────────────────────────────────────┘
```

---

## 🎯 Core architectural principles

### 1. **Stroke-first, vision-second**
- 90% of feedback from stroke data analysis (CPU)
- 10% from vision (NPU, on-demand checkpoints)
- Why: We HAVE ground-truth stroke data, no need to "see"

### 2. **Local-only, no cloud**
- Setup phase: WiFi to download models ONCE
- Production: Pi offline, captive portal AP
- Privacy by architecture

### 3. **Split-brain compute**
- CPU: LLM + logic + recorder (sequential reasoning)
- NPU: Vision tasks (parallel matrix ops)
- Each chip does what it's best at

### 4. **No live SD generation**
- Pre-cached reference library (~200-500 images)
- Generated during setup phase (cloud API or Pi CPU overnight)
- Instant matching at runtime
- Same UX as live SD, more reliable

### 5. **Pen-Process Recorder as moat**
- Every stroke event logged from Day 1
- (x, y, pressure, tilt_x, tilt_y, time)
- Plus context: layer, tool, undo/redo, intent stage
- Export: JSONL + UIM (Wacom standard)
- Future training data we own

---

## 📦 Tech stack

### Frontend (User device)
```
Next.js 15 + TypeScript + Tailwind CSS
├─ Konva.js + perfect-freehand (canvas)
├─ shadcn/ui (UI components)
├─ Zustand (state management)
├─ Web HID API (Wacom + TourBox)
└─ WebSocket client (Pi connection)
```

### Backend (Pi 5)
```
FastAPI + Uvicorn + Python 3.11
├─ WebSocket (real-time stroke stream)
├─ Pydantic (data models)
├─ SQLite (session metadata)
├─ JSONL files (stroke recordings)
└─ Background workers (vision/LLM)
```

### AI Stack
```
LLM (CPU):
├─ Ollama runtime
└─ Qwen 2:1.5b (Q4 quantized, ~1.2GB)

Vision (HAT NPU):
├─ Hailo SDK + HailoRT
├─ Hailo Model Zoo (YOLOv8n preset)
└─ MediaPipe (face mesh, hand tracking)

Stroke analysis (CPU, custom):
├─ NumPy (math)
├─ scipy.signal (smoothing, peaks)
└─ Custom heuristics (no ML needed for v1)
```

### Network
```
Pi captive portal AP mode:
├─ hostapd (WiFi AP)
├─ dnsmasq (DHCP + DNS hijack)
├─ iptables (HTTP redirect to portal)
└─ Captive portal detection handlers
```

---

## 🎨 5 Demo features (detailed specs)

### Feature 1: Ghost Guide Overlay ⭐
**What:** Reference drawing displayed as semi-transparent overlay
**How:**
- User selects lesson (face, animal, landscape)
- Reference loads as transparent layer over canvas
- Opacity controlled by TourBox dial (knob input)
- 0% = solo, 100% = trace mode
**Tech:**
- Frontend: Canvas layer with adjustable opacity
- TourBox HID → opacity value mapped to dial position
- Pre-loaded reference images in `/public/lessons/`

### Feature 2: Real-time Stroke Analysis ⭐
**What:** Live analysis of every stroke as user draws
**Metrics:**
- Pressure consistency (variance over stroke)
- Speed profile (acceleration patterns)
- Line confidence (smoothness × pressure × straightness)
- Hesitation detection (gaps > 200ms mid-stroke)
**How:**
- Stream stroke events via WebSocket
- Python analyzer computes metrics per stroke
- Display via real-time visualization (sparkline, score)
**Tech:**
- WebSocket pipeline (Pointer events → Pi → analysis → response)
- Latency target: <50ms

### Feature 3: AI Coaching Text ⭐
**What:** LLM generates encouraging, specific feedback
**Trigger:** After completed stroke OR section
**Example output:**
- "เส้นโค้งช่วงคางสวยมาก confidence ดี"
- "ลองวาดยาวกว่านี้ก่อนยกมือ"
- "Pressure ลดลงตอนใกล้จบ — focus ทั้งเส้น"
**Tech:**
- Qwen 2:1.5b via Ollama (~11 tok/s)
- Pre-engineered prompts (encouraging tone, specific advice)
- Template fallback for common patterns (faster)

### Feature 4: Pen-Process Recorder ⭐ THE MOAT
**What:** Capture every stroke event with full fidelity
**Data captured per event:**
```json
{
  "timestamp": 1715000000000,
  "x": 234.5,
  "y": 188.3,
  "pressure": 0.67,
  "tiltX": 12,
  "tiltY": -5,
  "azimuth": 78,  // derived
  "speed": 124.5,  // derived px/s
  "buttonState": 1,
  "layerId": "layer_001",
  "toolId": "pencil",
  "sessionId": "session_xyz",
  "intentStage": "outline"  // user-tagged
}
```
**Storage:**
- `/var/tourbox/sessions/{session_id}.jsonl` (append-only)
- Compressed gzip after session
- Optional: `.uim` Wacom Universal Ink Model export
**Critical:** Implement Day 1, even before features

### Feature 5: Vision Feedback (on-demand) ⭐
**What:** Compositional check using HAT NPU
**Triggers:**
- User taps "Check proportions" button
- Auto every 30 seconds (configurable)
- After section complete
**Analyses:**
- Face mesh: detect eye/nose/mouth positions, compare to ideal ratios
- Symmetry score: left vs right side
- Composition: subject placement (rule of thirds, etc.)
**Output:**
- Overlay markers on canvas
- Suggested corrections ("ตาสูงไป 15%")
**Tech:**
- Render canvas snapshot → image
- Send to HAT for inference (YOLO + custom proportion model)
- Return result via WebSocket
- Latency: <500ms total

---

## 🗂️ Data flow

### Stroke event pipeline
```
1. Wacom pen → User device PointerEvent
2. JS captures event → WebSocket message
3. Pi FastAPI handler receives
4. Stroke Engine: append to JSONL recorder
5. Real-time analyzer: compute metrics
6. Response → WebSocket → frontend overlay
7. Latency target: <50ms end-to-end
```

### LLM feedback pipeline
```
1. Stroke completes (pen lift)
2. Backend: gather context (last 5 strokes, current session)
3. Build prompt: stroke metrics + session intent
4. Ollama: Qwen generates feedback (2-3 seconds)
5. Stream tokens → frontend bubble
6. Display: typing animation as tokens arrive
```

### Vision check pipeline
```
1. User triggers (button or auto)
2. Frontend: canvas → PNG → base64
3. WebSocket send to Pi
4. Pi: decode → preprocess → HAT inference
5. Post-process: extract landmarks/scores
6. Return: overlay coordinates + suggestions
7. Frontend: draw overlay on canvas
```

---

## 🚀 Setup phase vs Production phase

### Setup phase (one-time, with internet)
```bash
# Connect Pi to home WiFi
# Run setup script:
./day1_setup.sh

# Downloads:
- Qwen 2:1.5b model (~1.2GB)
- YOLO weights for HAT (~50MB)
- MediaPipe models (~50MB)
- Hailo runtime + drivers
- Pre-cache reference library (optional, ~500MB)

# Test all components
# Disconnect from WiFi
```

### Production phase (demo, offline)
```bash
# Pi switches to AP mode
sudo systemctl start hostapd
sudo systemctl start dnsmasq

# Pi broadcasts "TourBox-Coach" WiFi
# User connects → captive portal auto-opens
# Web app loads from Pi
# All inference local
# Zero internet traffic
```

---

## 📊 Performance budgets

### Memory (Pi 5 8GB)
- OS + system: 1.0 GB
- Web server + Python: 0.8 GB
- LLM Qwen 1.5b (Q4): 1.2 GB
- Models (vision, mediapipe): 0.5 GB
- Buffers + caches: 1.0 GB
- App + sessions: 0.5 GB
- **Total used: ~5.0 GB**
- **Free buffer: ~3.0 GB** ✅

### Latency targets
- Stroke event → analysis → display: <50ms
- LLM feedback (30 tokens): 2-3 seconds
- Vision check: <500ms
- Pre-cached reference match: <100ms

### Power
- Pi 5 under load: ~10W
- HAT NPU during inference: +3W
- Total: ~13W (USB-C 27W PSU has plenty headroom)
- ⚠️ Active Cooler MANDATORY (otherwise throttle in 5 min)

---

## 🔒 Privacy architecture

### Data flow boundaries
```
User device → Pi: stroke data over WebSocket
Pi → User device: feedback responses
Pi → Internet: ZERO (after setup)
Pi → Local storage: stroke recordings (JSONL)
```

### What goes where:
- ✅ Strokes stored locally on Pi
- ✅ LLM inference local
- ✅ Vision inference local
- ❌ NO cloud APIs called
- ❌ NO telemetry to TourBox servers (Year 0)
- ✅ User can export/delete data anytime

### Demo proof for CEO:
1. Open browser DevTools → Network tab
2. Use feature → no external requests
3. Disable Pi's WiFi → still works
4. Show JSONL file → "this is YOUR data, on YOUR device"

---

## 🎬 Demo flow (script for CEO)

### Setup (before CEO arrives)
- Pi 5 + HAT booted, AP mode active
- Wacom plugged into demo laptop
- Browser connected to Pi (10.0.0.1 or tourbox-coach.local)
- Lesson loaded ("Draw a face")

### Demo (~3 minutes)

**Scene 1: Connection (15s)**
- "Connect laptop WiFi to TourBox-Coach"
- Captive portal auto-opens
- "Open Drawing Studio"

**Scene 2: Ghost Guide + Real-time analysis (45s)**
- Reference face appears (low opacity)
- User starts drawing
- Pressure curve visualizes in corner
- Confidence score updates per stroke
- "AI tracks every stroke — pressure, speed, smoothness"

**Scene 3: AI Coaching (30s)**
- After 5-6 strokes, coaching bubble appears
- "เส้นโค้งคางสวย confident มาก. ตาตรงนี้สูงไป 15%"
- Specific, encouraging, helpful
- "นี่ AI tutor — ไม่ใช่ generative"

**Scene 4: Vision check (30s)**
- Tap "Check proportions"
- HAT NPU runs face mesh (<500ms)
- Overlay shows ideal eye positions
- "เห็นมั้ย — AI ดูภาพรวม + แนะนำ"

**Scene 5: The moat reveal (45s)**
- Open recorder log → JSONL of all strokes
- "นี่คือ training data ของ TourBox — 7 ปี hardware + 300K users = นี่"
- Open network panel → zero requests
- "All offline. Privacy by architecture."
- Disable Pi WiFi → still works
- "Samsung ทำไม่ได้. Adobe ทำไม่ได้. เราจะเป็น category leader."

**Close (15s)**
- "Demo box: $185 hardware. Year 1 production: $80 BOM Snapdragon."
- "300M TAM, $15M Year 1 revenue, 50K units."
- "$1.5M Year 0 to validate. Ready to commit?"

---

## 🔗 Related documents

- `PROJECT_CONTEXT.md` — strategy + business
- `HARDWARE_DECISIONS.md` — why this hardware
- `DEMO_BUILD_PLAN.md` — 7-day plan
- `day1_setup.sh` — runnable setup script
