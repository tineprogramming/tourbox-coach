#!/bin/bash
# TourBox Coach — Day 1 Setup Script
# Run on fresh Raspberry Pi OS 64-bit (Bookworm)
#
# Usage:
#   1. Flash Pi OS via Raspberry Pi Imager
#   2. ssh tbc@tourbox-coach.local
#   3. wget [this script] -O day1_setup.sh
#   4. chmod +x day1_setup.sh
#   5. ./day1_setup.sh
#
# Requires: Internet connection (one-time, for downloads)

set -e  # Exit on error

echo "🚀 TourBox Coach — Day 1 Setup"
echo "================================"
echo ""

# Check we're on Pi 5
if ! grep -q "Raspberry Pi 5" /proc/cpuinfo; then
    echo "⚠️  Warning: Not detected as Pi 5"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# ============================================================
# Phase 1: System update
# ============================================================
echo ""
echo "📦 Phase 1: System update"
echo "-------------------------"

sudo apt update
sudo apt upgrade -y

echo "✅ System updated"

# ============================================================
# Phase 2: Essential tools
# ============================================================
echo ""
echo "🔧 Phase 2: Essential tools"
echo "---------------------------"

sudo apt install -y \
    python3-pip \
    python3-venv \
    python3-dev \
    git \
    build-essential \
    cmake \
    htop \
    curl \
    wget \
    vim \
    tmux

# Install Node.js 20
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "✅ Node.js: $(node --version)"
echo "✅ Python: $(python3 --version)"

# ============================================================
# Phase 3: Active Cooler check
# ============================================================
echo ""
echo "🌡️  Phase 3: Thermal check"
echo "-------------------------"

CPU_TEMP=$(vcgencmd measure_temp | grep -oP '\d+\.\d+')
echo "Current CPU temp: ${CPU_TEMP}°C"

if (( $(echo "$CPU_TEMP > 70" | bc -l) )); then
    echo "⚠️  WARNING: CPU running hot (>70°C)"
    echo "   Please install Active Cooler before proceeding"
    echo "   https://www.raspberrypi.com/products/active-cooler/"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# ============================================================
# Phase 4: Install Ollama + Qwen
# ============================================================
echo ""
echo "🤖 Phase 4: Ollama + LLM"
echo "------------------------"

if ! command -v ollama &> /dev/null; then
    echo "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

echo "Pulling Qwen 2:1.5b (this takes a few minutes)..."
ollama pull qwen2:1.5b

echo "✅ Ollama installed"

# ============================================================
# Phase 5: Benchmark LLM speed
# ============================================================
echo ""
echo "📊 Phase 5: LLM benchmark"
echo "-------------------------"
echo "Running benchmark (verifying Jeff Geerling's numbers)..."
echo ""

# Quick benchmark
BENCH_OUTPUT=$(ollama run qwen2:1.5b "Count from 1 to 30 in a single line, separated by commas." --verbose 2>&1)
echo "$BENCH_OUTPUT" | tail -10

# Extract tokens/sec if possible
TOKEN_RATE=$(echo "$BENCH_OUTPUT" | grep -oP 'eval rate:\s+\K[\d.]+' || echo "?")
echo ""
echo "✅ LLM tokens/sec: $TOKEN_RATE"
echo "   Target: 10-12 tok/s for Qwen 2:1.5b"

# ============================================================
# Phase 6: Hailo HAT check
# ============================================================
echo ""
echo "🎨 Phase 6: Hailo HAT detection"
echo "-------------------------------"

# Enable PCIe if not already
if ! grep -q "dtparam=pciex1" /boot/firmware/config.txt; then
    echo "Enabling PCIe..."
    echo "dtparam=pciex1" | sudo tee -a /boot/firmware/config.txt
    echo "⚠️  Reboot required after this script"
    REBOOT_NEEDED=1
fi

# Check for PCIe device (HAT)
if lspci | grep -i hailo; then
    echo "✅ Hailo HAT detected on PCIe"
    HAILO_DETECTED=1
else
    echo "⚠️  Hailo HAT not detected yet"
    echo "   - Is HAT physically installed?"
    echo "   - Has PCIe been enabled? (may need reboot)"
    HAILO_DETECTED=0
fi

# ============================================================
# Phase 7: Hailo SDK install (if HAT detected)
# ============================================================
if [ "${HAILO_DETECTED:-0}" -eq 1 ]; then
    echo ""
    echo "📥 Phase 7: Hailo SDK"
    echo "---------------------"
    echo ""
    echo "⚠️  MANUAL STEP REQUIRED:"
    echo "   1. Register at https://hailo.ai/ (free Developer Zone)"
    echo "   2. Download HailoRT for ARM64 / Raspberry Pi"
    echo "   3. Copy .deb files to ~/hailo-sdk/"
    echo "   4. Re-run this script to install"
    echo ""

    if [ -d ~/hailo-sdk ]; then
        echo "Found ~/hailo-sdk/, installing..."
        cd ~/hailo-sdk
        sudo dpkg -i hailort_*.deb || sudo apt --fix-broken install -y
        sudo dpkg -i hailort-pcie-driver_*.deb 2>/dev/null || true

        # Test
        if command -v hailortcli &> /dev/null; then
            hailortcli scan
            echo "✅ Hailo SDK installed"
        fi
    else
        echo "ℹ️  Skipping Hailo install (no SDK files found)"
        echo "   Re-run after downloading"
    fi
fi

# ============================================================
# Phase 8: Python environment
# ============================================================
echo ""
echo "🐍 Phase 8: Python project setup"
echo "--------------------------------"

mkdir -p ~/tourbox-coach
cd ~/tourbox-coach

if [ ! -d venv ]; then
    python3 -m venv venv
fi

source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install \
    fastapi \
    uvicorn[standard] \
    websockets \
    numpy \
    scipy \
    pillow \
    pydantic \
    ollama \
    mediapipe \
    opencv-python-headless

echo "✅ Python environment ready"

# ============================================================
# Phase 9: Create project skeleton
# ============================================================
echo ""
echo "📁 Phase 9: Project skeleton"
echo "----------------------------"

mkdir -p ~/tourbox-coach/{backend,sessions,models,scripts}

# Create directories
mkdir -p ~/tourbox-coach/backend/{analyzers,vision,llm,api}
mkdir -p /var/tourbox/sessions
sudo chown -R $USER:$USER /var/tourbox

# Create minimal FastAPI server
cat > ~/tourbox-coach/backend/main.py <<'EOF'
"""
TourBox Coach — Main FastAPI Server
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import json
import uuid
import time

app = FastAPI(title="TourBox Coach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS_DIR = Path("/var/tourbox/sessions")
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
async def root():
    return {"status": "TourBox Coach API running", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": time.time()}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    session_id = str(uuid.uuid4())
    log_file = SESSIONS_DIR / f"{session_id}.jsonl"

    print(f"📝 New session: {session_id}")

    try:
        await websocket.send_json({
            "type": "session_start",
            "session_id": session_id,
            "timestamp": time.time()
        })

        while True:
            data = await websocket.receive_json()

            # Log every event (THE MOAT)
            with log_file.open("a") as f:
                f.write(json.dumps(data) + "\n")

            # Echo back for now (replace with real analysis)
            await websocket.send_json({
                "type": "ack",
                "received": data.get("type", "unknown"),
                "timestamp": time.time()
            })

    except WebSocketDisconnect:
        print(f"👋 Session ended: {session_id}")
        with log_file.open("a") as f:
            f.write(json.dumps({
                "type": "session_end",
                "timestamp": time.time()
            }) + "\n")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF

# Create start script
cat > ~/tourbox-coach/scripts/start_server.sh <<'EOF'
#!/bin/bash
cd ~/tourbox-coach
source venv/bin/activate
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
EOF
chmod +x ~/tourbox-coach/scripts/start_server.sh

echo "✅ Project skeleton created at ~/tourbox-coach/"

# ============================================================
# Phase 10: Test server starts
# ============================================================
echo ""
echo "🧪 Phase 10: Test server"
echo "------------------------"

cd ~/tourbox-coach/backend
timeout 5 uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/server_test.log 2>&1 &
SERVER_PID=$!
sleep 2

if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo "✅ FastAPI server starts successfully"
else
    echo "⚠️  Server test failed, check /tmp/server_test.log"
fi

kill $SERVER_PID 2>/dev/null || true

# ============================================================
# Summary
# ============================================================
echo ""
echo "================================"
echo "🎉 Day 1 Setup Complete!"
echo "================================"
echo ""
echo "✅ System updated"
echo "✅ Ollama + Qwen 2:1.5b installed"
echo "✅ LLM tokens/sec: $TOKEN_RATE"
if [ "${HAILO_DETECTED:-0}" -eq 1 ]; then
    echo "✅ Hailo HAT detected"
else
    echo "⚠️  Hailo HAT setup pending"
fi
echo "✅ Python venv with FastAPI ready"
echo "✅ Project skeleton at ~/tourbox-coach/"
echo ""
echo "Next steps (Day 2):"
echo "  1. cd ~/tourbox-coach && ./scripts/start_server.sh"
echo "  2. On laptop: build Next.js frontend"
echo "  3. Test WebSocket connection"
echo ""

if [ "${REBOOT_NEEDED:-0}" -eq 1 ]; then
    echo "⚠️  REBOOT REQUIRED (PCIe enabled)"
    echo "   Run: sudo reboot"
    echo "   Then re-run this script to install Hailo SDK"
fi

echo ""
echo "Pi IP address: $(hostname -I | awk '{print $1}')"
echo "SSH from laptop: ssh $USER@$(hostname).local"
