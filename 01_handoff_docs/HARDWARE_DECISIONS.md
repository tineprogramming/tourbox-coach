# Hardware Decisions — Research Log & Final Choices

> Extensive research conducted. This document captures findings + decisions.
> Source: Jeff Geerling benchmarks, Hailo docs, Rockchip community, Particle docs, multiple reviews

---

## ✅ FINAL DECISION

### Demo phase (now): **Pi 5 8GB + AI HAT+ 26T (Hailo-8)**
### Year 1 production: **Snapdragon path** (Tachyon for R&D, then custom board)

---

## 🔬 Why Pi 5 + HAT 26T won (not the other options)

### Current setup:
- Raspberry Pi 5, 8GB LPDDR5
- AI HAT+ original (Hailo-8, 26 TOPS INT8)
- Wacom drawing tablet (connects to laptop)
- Cost: $185 total (have already)

### Performance verified (Jeff Geerling, Jan 2026):

**LLM on Pi 5 CPU (no NPU help):**
- Qwen 2:1.5b → **12.47 tok/s** ⚡
- Qwen 2.5-instruct:1.5b → 11.41 tok/s
- DeepSeek-R1-Distill:1.5b → 10.99 tok/s
- Qwen 2.5-coder:1.5b → 9.77 tok/s
- Llama 3.2:3b → 5.55 tok/s

**Vision on Hailo NPU:**
- YOLO inference: 60+ FPS
- 10× faster than Pi CPU
- Real-time pose/face detection

### Why this is enough:
- LLM 12 tok/s × 30 tokens = 2.4s feedback bubble
- Vision real-time on HAT
- Stroke analysis on CPU (fast)
- **Total demo experience = responsive**

---

## ❌ Why we rejected alternatives

### Hailo-10H (AI HAT+ 2, $130)
**Marketing:** SD 2.1 in 5s, LLM acceleration
**Reality (Jeff Geerling):**
- LLM **slower** than Pi CPU on all models tested
- llama3.2:3b: 2.66 t/s (vs 5.55 on CPU)
- qwen2:1.5b: 8.25 t/s (vs 12.47 on CPU)
- Same 8GB RAM bottleneck as Pi
- Lower power budget (3W vs Pi CPU 10W)
**SD support:** Marketing claims < 5s, but NOT in public Hailo Model Zoo (only LLMs available)
**Verdict:** Don't upgrade — saves $30, no LLM benefit

### Rockchip RK3588 (Orange Pi 5, Khadas Edge2)
**Strengths:**
- NPU LLM: Qwen3-1.7B at 13.6 tok/s (faster than Pi CPU!)
- Qwen2.5 3B: 7-8 tok/s
- VLM support: Qwen-VL, MiniCPM-V (Hailo doesn't have)
- LCM Stable Diffusion via rkllama (community)
- Cost: $150-200

**Weaknesses:**
- RKNN toolchain learning curve (1-2 weeks)
- SD speed: ~30-60s (rkllama) to 8 minutes (Mali GPU TVM)
- Community smaller than Pi (debugging harder)
- Setup 10-14 days vs Pi 1-2 days

**Verdict:** Great for Year 1 budget option, NOT for demo (delays timeline)

### Hailo-15 family SoC
**What:** Hailo's own complete SoC (not accelerator)
**Specs:** ARM Cortex-A53 (3 generations OLDER than Pi 5's A76!) + NPU 7-20 TOPS
**Verdict:** Designed for cameras, CPU too weak for general use. SKIP.

### Orange Pi 6 Plus (CIX P1)
**Specs:** 12-core ARMv9.2, 30 TOPS NPU, $300+
**Strengths:** Newest ARM, biggest NPU
**Weaknesses:**
- Software ecosystem extremely young (reviewer spent 2 months to make work)
- $300+ exceeds Year 1 $80 BOM target
- CIX = startup founded 2024, long-term viability uncertain
**Verdict:** Year 2+ R&D bet, not now

### Allwinner T527/A733
**Verdict:** ❌ SKIP
- NPU only 3 TOPS
- Software support poor
- Allwinner deprioritizes open source
- Community has shifted to Rockchip

### Particle Tachyon (Snapdragon QCM6490)
**Specs:** Snapdragon QCM6490, 12 TOPS NPU, 8GB/128GB, 5G + WiFi 6E, Pi-compatible
**Strengths:**
- Snapdragon path (aligns with Year 1 vision)
- 10-year chip availability (production safety)
- Pi-compatible (can use Hailo HAT)
- 5G built-in

**Weaknesses (per Sept 2025 CNX review):**
- Setup buggy (Ubuntu install incomplete, headless workaround needed)
- Whisper model NOT available in AI Hub for QCM6490 (red flag)
- SD support exists but performance estimated 15-20s (vs Snapdragon 8 Gen 3's <1s)
- Community smaller than Pi

**Verdict:** ⭐ Phase 2 R&D platform (Month 2-4), NOT demo phase

### Snapdragon 8 Gen 3 (Galaxy phones)
**Specs:** 45 TOPS Hexagon NPU
**Reality:**
- SD 2.1 in 0.6-1 second (verified in production phones)
- Powers Samsung Galaxy AI Sketch-to-Image
- Phone-class SoC, dev kits $600-900 expensive
**Verdict:** ⭐ Year 1 production target (custom board)

### Mac Mini M4 ($599)
**Strengths:** Best dev experience, MLX for Apple Silicon, SDXL Turbo 1-2s
**Verdict:** Demo backup only — doesn't match Year 1 production hardware story

### Jetson Orin Nano Super ($249)
**Strengths:** 67 TOPS, CUDA mature, NVIDIA community
**Verdict:** Good but NVIDIA = doesn't fit ARM production path for Year 1

---

## 🎯 Critical insights

### 1. NPU TOPS ≈ predictable SD speed
```
45+ TOPS (Snapdragon 8 Gen 3) → SD <1s        (production phones)
20-30 TOPS (Hailo-10H, claim)  → SD ~5s        (marketing)
12-15 TOPS (Tachyon QCM6490)   → SD ~15-30s    (estimate)
6 TOPS (RK3588)                → SD minutes    (community)
0 TOPS NPU                     → SD minutes    (CPU only)
```

### 2. Marketing claims ≠ developer reality
- Hailo "5s SD" = demoed at CES 2025, NOT in public Model Zoo
- RK3588 "supports SD" = community project, 8 minutes practical
- Tachyon "QCM6490 = 12 TOPS" = marketing combined, Whisper missing

### 3. LLM speed is RAM-bound, not NPU-bound
- Pi 5 8GB CPU > Hailo-10H NPU for most LLMs (Jeff Geerling pattern)
- Reason: Same RAM, CPU has higher power budget
- Implication: Pi 5 16GB > Pi 5 8GB + any NPU for LLM use case

### 4. Stroke data > Image data for drawing analysis
- We have (x, y, pressure, tilt, time) directly from Wacom
- Don't need vision to "see" what user drew
- Vision = supplement (face mesh for proportion, etc.)
- Stroke-first architecture saves CPU, faster feedback

### 5. Live SD = nice-to-have, not must-have
- Pre-cached library = instant + better story ("curated by master artists")
- Works on ANY hardware
- No dependency on chip Performance
- Year 1 production can add live SD if Snapdragon 8 Gen 3

---

## 🌐 Network architecture decision

### Demo phase: **Pi as captive portal AP**
- Pi broadcasts "TourBox-Coach" Wi-Fi
- User device connects → captive portal auto-opens
- User keeps internet on cellular (5G) or different WiFi
- Pi 100% offline by design

### Why captive portal:
- ✅ "No internet" story strongest for CEO
- ✅ Plug-and-play UX
- ✅ Privacy by architecture
- ⚠️ iOS quirks (test before demo)

### Setup phase: WiFi with internet (one-time)
- Download models (Qwen, YOLO weights, MediaPipe)
- Install dependencies
- Then disable WiFi → production mode

---

## 💰 Year 1 production hardware path

### Primary candidates:

**A. Snapdragon 8 Gen 3 (premium)**
- Cost: $80-100 BOM
- LLM, Vision, SD all <5s
- Mature ecosystem
- Phone-class quality

**B. Snapdragon QCM6490 (budget)**
- Cost: $30-40 BOM
- LLM + Vision good, SD slow (use pre-cached)
- 10-year chip availability
- Industrial IoT grade

**C. Rockchip RK3588 (cost-optimized)**
- Cost: $30-40 BOM
- LLM good, SD slow
- Chinese supply chain advantage
- RKLLM toolchain maturing

### Decision matrix (Year 1):
| Priority | Choose |
|----------|--------|
| Best overall | Snapdragon 8 Gen 3 |
| Cost-conscious | Snapdragon QCM6490 |
| Chinese supply | Rockchip RK3588 |

### R&D plan:
- Month 2-3: Order Particle Tachyon ($199), benchmark QCM6490
- Month 4: Decision on chip family
- Month 5-6: Custom board design
- Month 7-12: Manufacturing partner + supply chain

---

## 📋 Shopping list (current setup)

### Have:
- ✅ Raspberry Pi 5, 8GB LPDDR5 ($80)
- ✅ AI HAT+ 26 TOPS (Hailo-8) — arriving
- ✅ Wacom drawing tablet
- ✅ Laptop for development

### Need (verify):
- [ ] Active Cooler for Pi 5 ($5) — MUST HAVE to prevent throttle
- [ ] microSD 128GB Samsung Pro ($20)
- [ ] USB-C 27W power supply ($12)
- [ ] Case (optional, $10)
- [ ] (Optional) NVMe SSD + PCIe HAT ($60) for 5× faster model load

### Total: ~$185 + $50 accessories = $235

### Phase 2 R&D (Month 2-3):
- [ ] Particle Tachyon 8GB ($199)

---

## 🔗 Sources

- Jeff Geerling: https://www.jeffgeerling.com/blog/2026/raspberry-pi-ai-hat-2/
- Hailo Model Zoo: https://github.com/hailo-ai/hailo_model_zoo_genai
- RK3588 benchmarks: https://tinycomputers.io/posts/rockchip-rk3588-npu-benchmarks.html
- Particle Tachyon review: https://www.cnx-software.com/2025/09/24/particle-tachyon-review-a-qualcomm-qcm6490-edge-ai-and-5g-cellular-sbc-tested-with-ubuntu/
- Qualcomm AI Hub: https://aihub.qualcomm.com/
