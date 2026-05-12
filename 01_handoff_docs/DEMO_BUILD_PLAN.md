# 7-Day Build Plan — TourBox Coach Demo

> From "HAT arrives" to "demo CEO". Realistic, tight, but achievable.
> Assumes: solo developer or small team, full-time focus.

---

## 📅 Timeline overview

```
Day 1: Hardware setup + benchmark
Day 2: Frontend skeleton + Wacom + Recorder
Day 3: Backend skeleton + WebSocket pipeline
Day 4: Hailo NPU integration + Vision pipeline
Day 5: LLM integration + Coaching
Day 6: Ghost Guide + Polish + Captive portal
Day 7: Demo rehearsal + Backup plan
```

---

## 🔧 Day 1: Hardware Setup + Benchmarks

### Morning (3-4 hours)

#### Step 1: Pi OS install
```bash
# On Mac/PC, use Raspberry Pi Imager:
# - OS: Raspberry Pi OS (64-bit, Bookworm)
# - SSH: enabled, hostname: tourbox-coach, user: tbc
# - WiFi: home WiFi
# - Flash to microSD
```

#### Step 2: First boot + system update
```bash
ssh tbc@tourbox-coach.local

# Update system
sudo apt update && sudo apt upgrade -y

# Install basics
sudo apt install -y python3-pip python3-venv git build-essential cmake

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # v20.x
python3 --version  # 3.11.x
```

#### Step 3: Active Cooler installation
- **CRITICAL** — install official Pi 5 Active Cooler ($5)
- Without it: throttle in 5 minutes, demo dies
- Take 5 minutes, save the demo

#### Step 4: Install Ollama + Qwen
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull qwen2:1.5b

# Test
ollama run qwen2:1.5b "Hello, how are you?"

# Should respond in Thai/English in ~3 seconds
```

#### Step 5: Benchmark LLM speed
```bash
# Verify Jeff Geerling's numbers
ollama run qwen2:1.5b --verbose "Explain photosynthesis in 50 words"

# Look for: tokens/second metric
# Target: 10-12 tok/s ✅
```

### Afternoon (3-4 hours)

#### Step 6: Install Hailo SDK (HAT arrived!)
```bash
# Physical install:
# - Power off Pi
# - Mount HAT 26T on Pi 5 (PCIe connector)
# - Reboot

# Register at hailo.ai (free Developer Zone account)
# Download HailoRT for ARM64 / Raspberry Pi

# Install HailoRT
sudo dpkg -i hailort_*.deb
sudo apt --fix-broken install

# Install drivers
sudo dpkg -i hailort-pcie-driver_*.deb

# Reboot
sudo reboot

# After reboot, verify:
hailortcli scan
# Should show: Hailo-8 device detected
```

#### Step 7: First Hailo demo
```bash
# Clone official examples
git clone https://github.com/hailo-ai/hailo-rpi5-examples.git
cd hailo-rpi5-examples

# Setup
./install.sh

# Run YOLO detection demo (on test video)
source setup_env.sh
python basic_pipelines/detection.py --input resources/detection.mp4

# Verify: 30+ FPS YOLO detection working
```

#### Step 8: Install Python environment
```bash
mkdir -p ~/tourbox-coach
cd ~/tourbox-coach

# Create venv
python3 -m venv venv
source venv/bin/activate

# Install deps
pip install fastapi uvicorn[standard] websockets
pip install numpy scipy pillow
pip install ollama
pip install pydantic
```

### Day 1 deliverable
✅ Pi 5 running
✅ HAT installed and verified
✅ Qwen 2:1.5b running at 10-12 tok/s
✅ YOLO running on HAT NPU
✅ Python environment ready

---

## 🎨 Day 2: Frontend Skeleton

### Morning: Next.js + Canvas (3 hours)

```bash
# On dev laptop, create project
mkdir -p ~/projects/tourbox-coach
cd ~/projects/tourbox-coach

# Initialize
npx create-next-app@latest frontend \
  --typescript --tailwind --app \
  --src-dir --no-import-alias

cd frontend

# Install canvas + drawing
npm install konva react-konva perfect-freehand

# UI library
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog input

# State
npm install zustand

# WebSocket
npm install reconnecting-websocket
```

#### Build canvas component
**File: `src/components/DrawingCanvas.tsx`**
- Konva Stage + Layer setup
- Pointer event capture (pressure, tilt)
- perfect-freehand for smooth strokes
- Send events to backend via WebSocket

### Afternoon: Pen-Process Recorder (3 hours)

#### Why first: This is the moat
- Implement BEFORE features
- Capture every stroke from Day 1
- Even if features fail, data accumulates

**Critical fields:**
```typescript
interface StrokeEvent {
  timestamp: number;
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  buttonState: number;
  pointerType: 'pen' | 'mouse' | 'touch';
}

interface SessionMetadata {
  sessionId: string;
  userId?: string;
  lessonId?: string;
  intentStage?: string;
  startTime: number;
  endTime?: number;
}
```

#### Test pressure capture
- Plug Wacom into laptop
- Open Chrome DevTools
- Check that `pointerEvent.pressure` returns real values (not 0.5)
- If not: use `getCoalescedEvents()` for higher sample rate

### Day 2 deliverable
✅ Next.js project running
✅ Canvas with pressure-sensitive drawing
✅ Stroke events captured + logged to console
✅ WebSocket connection established (to mock backend)

---

## 🔌 Day 3: Backend + WebSocket Pipeline

### Morning: FastAPI server (3 hours)

**File: `backend/main.py`**
```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
from pathlib import Path

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = generate_session_id()
    log_file = Path(f"/var/tourbox/sessions/{session_id}.jsonl")
    log_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        while True:
            data = await websocket.receive_json()

            # Log every event (the moat)
            with log_file.open("a") as f:
                f.write(json.dumps(data) + "\n")

            # Process stroke
            if data["type"] == "stroke_complete":
                feedback = await analyze_stroke(data)
                await websocket.send_json(feedback)

    except WebSocketDisconnect:
        # Finalize session
        finalize_session(session_id)
```

### Afternoon: Stroke analysis module (3 hours)

**File: `backend/analyzers/stroke.py`**

```python
import numpy as np
from scipy import signal

def analyze_stroke(stroke_events: list) -> dict:
    """Real-time stroke analysis (no ML, pure math)"""
    points = np.array([(e['x'], e['y']) for e in stroke_events])
    pressures = np.array([e['pressure'] for e in stroke_events])
    times = np.array([e['timestamp'] for e in stroke_events])

    # Speed analysis
    deltas = np.diff(points, axis=0)
    distances = np.linalg.norm(deltas, axis=1)
    time_diffs = np.diff(times) / 1000  # ms to s
    speeds = distances / time_diffs

    # Smoothness (curvature consistency)
    smoothness = compute_smoothness(points)

    # Pressure consistency
    pressure_variance = np.var(pressures)
    pressure_consistency = 1.0 / (1.0 + pressure_variance)

    # Hesitation detection
    hesitations = detect_hesitations(time_diffs)

    # Overall confidence
    confidence = compute_confidence(
        speeds, smoothness, pressure_consistency, hesitations
    )

    return {
        "type": "stroke_analysis",
        "confidence": float(confidence),
        "smoothness": float(smoothness),
        "pressure_consistency": float(pressure_consistency),
        "avg_speed": float(np.mean(speeds)),
        "hesitations": int(hesitations),
    }
```

### Day 3 deliverable
✅ FastAPI server running on Pi (port 8000)
✅ WebSocket bi-directional pipeline working
✅ Strokes flow: Wacom → Browser → Pi → JSONL log
✅ Real-time stroke metrics returned to frontend

---

## 👁️ Day 4: Hailo Vision Pipeline

### Morning: HAT integration (3 hours)

**Reference:**
- Hailo Model Zoo: https://github.com/hailo-ai/hailo_model_zoo
- Pre-compiled models: download YOLOv8n for Hailo-8

```python
# backend/vision/hailo_inference.py
from hailo_platform import (
    HEF, ConfigureParams, FormatType,
    VDevice, HailoStreamInterface
)
import numpy as np

class HailoYOLO:
    def __init__(self, hef_path: str):
        self.hef = HEF(hef_path)
        self.target = VDevice()
        config_params = ConfigureParams.create_from_hef(
            hef=self.hef,
            interface=HailoStreamInterface.PCIe
        )
        self.network_group = self.target.configure(
            self.hef, config_params
        )[0]
        self.input_vstream_info = self.hef.get_input_vstream_infos()[0]
        self.output_vstream_info = self.hef.get_output_vstream_infos()[0]

    def infer(self, image: np.ndarray) -> dict:
        # Preprocess
        input_data = preprocess(image, self.input_vstream_info)

        # Inference
        with self.network_group.activate():
            outputs = self.network_group.infer(input_data)

        # Postprocess
        detections = postprocess(outputs)
        return detections
```

### Afternoon: MediaPipe face mesh (3 hours)

```python
# backend/vision/face_mesh.py
import mediapipe as mp
import cv2

mp_face_mesh = mp.solutions.face_mesh

class FaceProportionChecker:
    def __init__(self):
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5
        )

    def check(self, image: np.ndarray) -> dict:
        results = self.face_mesh.process(image)
        if not results.multi_face_landmarks:
            return {"detected": False}

        landmarks = results.multi_face_landmarks[0]

        # Compute key ratios
        eye_position_y = compute_eye_position(landmarks)
        face_symmetry = compute_symmetry(landmarks)

        return {
            "detected": True,
            "eye_y_ratio": eye_position_y,  # ideal: 0.5
            "symmetry_score": face_symmetry,
            "suggestions": generate_suggestions(landmarks)
        }
```

### Day 4 deliverable
✅ YOLO running on HAT via Python
✅ MediaPipe face mesh working
✅ Vision check endpoint (`POST /vision/check`)
✅ Frontend "Check proportions" button works

---

## 💬 Day 5: LLM Coaching

### Morning: Ollama integration (3 hours)

```python
# backend/llm/coach.py
import ollama
from pydantic import BaseModel

class CoachingContext(BaseModel):
    stroke_metrics: dict
    session_history: list[dict]
    lesson_intent: str
    user_skill_level: str = "beginner"

class AICoach:
    def __init__(self):
        self.model = "qwen2:1.5b"

    async def generate_feedback(self, context: CoachingContext) -> str:
        prompt = self._build_prompt(context)

        response = ollama.chat(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            stream=True
        )

        # Stream tokens back
        async for chunk in response:
            yield chunk['message']['content']

SYSTEM_PROMPT = """คุณเป็น AI tutor สอนวาดภาพให้ผู้เริ่มต้น

หลักการ:
- พูดสั้น, เฉพาะเจาะจง (1-2 ประโยค)
- เริ่มด้วยสิ่งที่ทำดี
- แล้วค่อยแนะนำสิ่งที่ปรับปรุงได้
- ใช้ภาษาให้กำลังใจ ไม่ตำหนิ
- ตัวอย่าง: "เส้นโค้งช่วงคางสวยมาก! ลองวาดยาวกว่านี้ก่อนยกมือ"
"""
```

### Afternoon: Streaming + Template fallback (3 hours)

- LLM streaming through WebSocket
- Template-based fallback for instant feedback
- Mix: instant template + slower LLM for richer detail

### Day 5 deliverable
✅ Coaching text generated from stroke data
✅ Streaming response (typing animation in UI)
✅ Template + LLM hybrid for snappy feel
✅ 2-3 second feedback latency

---

## 🎨 Day 6: Ghost Guide + Polish

### Morning: Ghost Guide overlay (3 hours)

```typescript
// frontend/src/components/GhostGuide.tsx
import { Image as KonvaImage } from 'react-konva';

export function GhostGuide({ opacity, lessonRef }: Props) {
  return (
    <KonvaImage
      image={lessonRef}
      opacity={opacity}  // 0.0 to 1.0
      listening={false}
    />
  );
}
```

- TourBox dial input → opacity value
- Web HID API for TourBox controller
- Smooth opacity transitions

### Afternoon: Captive portal + offline mode (3 hours)

```bash
# Install AP stack
sudo apt install hostapd dnsmasq -y

# Configure hostapd
sudo tee /etc/hostapd/hostapd.conf <<EOF
interface=wlan0
ssid=TourBox-Coach
hw_mode=g
channel=7
wpa=2
wpa_passphrase=draw2026
EOF

# Configure dnsmasq (DNS hijack for captive portal)
sudo tee /etc/dnsmasq.conf <<EOF
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
address=/#/192.168.4.1
EOF

# iptables redirect
sudo iptables -t nat -A PREROUTING -i wlan0 -p tcp \
  --dport 80 -j DNAT --to-destination 192.168.4.1:3000
```

### Day 6 deliverable
✅ Ghost Guide working with smooth opacity control
✅ TourBox dial connected (Web HID)
✅ Pi AP mode + captive portal functional
✅ All 5 demo features integrated

---

## 🎬 Day 7: Demo Rehearsal

### Morning: End-to-end testing (3 hours)
- Run full demo flow 5 times
- Identify pain points, polish UI
- Test on iPhone Safari, Chrome, etc.
- Verify "offline" mode dramatic moment

### Afternoon: Backup plan + recording (3 hours)
- Record video demo (backup if live fails)
- Setup duplicate Pi as backup
- Print demo script (paper backup)
- Test all hardware connections

### Final checks:
- [ ] Pi 5 boots reliably
- [ ] HAT detected on every reboot
- [ ] Wacom pressure values working
- [ ] LLM responds in <3 seconds
- [ ] Vision check completes in <500ms
- [ ] Captive portal opens on iPhone
- [ ] All 5 features work in flow
- [ ] Stroke recorder writes JSONL
- [ ] "Offline reveal" moment works

### Day 7 deliverable
✅ Polished 3-minute demo
✅ Backup video recorded
✅ Backup Pi ready
✅ Script rehearsed 3+ times

---

## 🚨 Risk mitigation

### Risk 1: HAT doesn't work
- **Mitigation:** Day 1 verify with example code
- **Fallback:** Skip vision feedback, focus stroke + LLM
- **Demo still works:** 4/5 features still strong

### Risk 2: LLM too slow
- **Mitigation:** Template-based feedback as primary
- **LLM = enrichment** of templates, not blocker

### Risk 3: Captive portal iOS issues
- **Mitigation:** Day 6 test on iPhone EARLY
- **Fallback:** USB-C tethering laptop↔Pi (simpler)

### Risk 4: Wacom pressure not detected
- **Mitigation:** Day 2 verify pressure values
- **Fallback:** Mouse-based demo (still shows AI)

### Risk 5: Demo day crash
- **Mitigation:** Backup Pi pre-configured
- **Backup video** ready to play

---

## 🎯 Success metrics

By end of Day 7:
- ✅ 5 features working live
- ✅ <500ms vision response
- ✅ <3s LLM coaching
- ✅ Pi 5 offline-capable
- ✅ Captive portal works
- ✅ Recorder logs every stroke
- ✅ Demo rehearsed 5+ times
- ✅ Backup plan tested

---

## 📦 Daily commits

Day 1: `chore: pi setup, hailo verified, qwen benchmarked`
Day 2: `feat: drawing canvas + wacom + stroke recorder`
Day 3: `feat: fastapi backend, websocket pipeline, stroke analysis`
Day 4: `feat: hailo yolo integration, mediapipe face mesh`
Day 5: `feat: ollama llm coaching, streaming feedback`
Day 6: `feat: ghost guide overlay, captive portal, polish`
Day 7: `polish: demo flow, rehearsal, backup`

---

## 🔗 Related documents

- `PROJECT_CONTEXT.md` — strategy
- `HARDWARE_DECISIONS.md` — why this hardware
- `ARCHITECTURE.md` — system design
- `day1_setup.sh` — runnable setup script
