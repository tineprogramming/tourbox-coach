# TourBox Coach — Project Context

> Handoff document for Claude Code session.
> Built from extensive research + strategic conversation. Use this as the source of truth.

---

## 🎯 Vision

**TourBox Coach** = Local AI drawing tutor for beginners

Transform TourBox จาก niche pro-creative controller ($297, 300K customers, 5M TAM)
→ mass-market beginner learning device (300M TAM globally)

**Tagline:** *"Don't automate creativity, empower it."*

**Positioning:** Tutoring AI, NOT Generative AI
- Samsung/Adobe = generate art FOR you (substitute for skill)
- TourBox Coach = teach you HOW to draw (scaffold for growth)

---

## 🌏 Why this, why now (Strategic timing)

### Market gaps:
1. **Beginner art tools are bad** — Procreate/Photoshop assume you know how to draw
2. **AI drawing apps are generative** — replace skill, don't teach it
3. **No on-device drawing AI** — all competitors are cloud-based
4. **China context** — cloud AI APIs blocked (GFW), local AI is requirement

### Unique advantages:
- 7 years TourBox hardware IP
- 300K existing customer base
- Brand trust in creative community
- Hardware supply chain expertise
- Chinese market = local AI = unfair advantage

### Window of opportunity:
- Edge AI chips at inflection point (Hailo, Snapdragon, RK3588 affordable)
- 12-18 months before competitors enter
- Beginner art segment massively underserved

---

## 👥 Target user

**Mai (14 years old)** — primary persona
- ปกติเขียน fan art อยู่ tablet
- อยาก improve แต่ YouTube tutorials ไม่ตอบคำถามเฉพาะตัว
- พ่อแม่ยอมจ่าย $299 สำหรับ "AI tutor ที่ private"
- ไม่ใช่ professional artist, ไม่อยากเป็น

**Secondary:** Parents of 8-12 year olds buying "creative learning device"

---

## 💰 Business model

### Year 0 (Months 1-6): Validation
- **Budget:** $1.5M
- **Goal:** 1,000 paid beta users
- **Gate metrics:**
  - 40%+ 30-day retention
  - NPS 40+
  - $15+/month willingness to pay

### Year 1: Launch
- **Product:** Coach Bundle $299 (TourBox controller + AI Box + curriculum subscription)
- **Volume:** 50K units
- **Revenue:** $15M
- **Margin target:** 35%+

### Year 2: Pro
- **Product:** Coach Pro $449 (integrated all-in-one)
- **Add Pro track:** AI Bridge app, ComfyUI plugin, Krita/PS plugins

### Year 3: Studio
- **Product:** Coach Studio $999 flagship
- **Ecosystem:** SDK, marketplace, content platform

---

## 🎭 Friend's MVP Memo — Lessons learned

Friend wrote "DrawCopilotLab MVP Decision Memo" (2-week plan).

### What friend got RIGHT (steal these ideas):
✅ **F2: Pen-Process Recorder = THE MOAT**
   - Capture every (x, y, pressure, tilt_x, tilt_y, time)
   - Wacom Universal Ink Model (UIM) export
   - Every session = training data we own
   - 6 months recording = 6 months pristine data for model training

✅ **F3: Replay + Perspective/Symmetry**
   - Stroke replay = process-aware (Samsung can't do this)
   - Perspective grid + symmetry mirror = visible value without ML

✅ **Defer R&D model**
   - Don't build novel stroke prediction in 2 weeks
   - Use off-the-shelf for MVP, R&D for Year 1

### What friend got WRONG (Western blind spot):
❌ **Cloud APIs (fal.ai, Replicate, Azure OpenAI)**
   - All US-hosted, blocked in China (GFW)
   - Payment issues for Chinese companies
   - Demo reliability = depends on internet
   - **TourBox is Chinese company → must be local-first**

### Our approach: Steal F2+F3, REPLACE F1 (cloud SD) with local approach

---

## 🛡️ Privacy story (THE killer narrative for CEO)

```
Samsung Galaxy AI Sketch-to-Image → cloud (US/Korea)
Adobe Firefly → cloud (US)
TourBox Coach → 100% on-device

In China: Samsung/Adobe don't work reliably
In rural areas: We work offline
Kid privacy: Parents trust on-device
"Privacy by architecture" = real moat
```

CEO demo reveal moment:
1. Show Pi disconnect from internet
2. Continue using TourBox Coach
3. "ทุกอย่างรันใน box นี่ — no cloud, no API"
4. "300K customers × stroke recorder = our future training data"
5. "Samsung/Adobe ไม่มี — เราจะเป็น category leader"

---

## 🎯 Year 0 strategy

### Phase 0a (Months 1-3): Software MVP + Validation
- Build software MVP (Next.js + FastAPI on Pi 5 + HAT)
- 100 alpha users (TourBox existing customers)
- Test 4 hypotheses:
  1. มีคนจ่ายมั้ย? (landing page + pre-order)
  2. Retain มั้ย? (DAU/MAU 40%+)
  3. Recommend มั้ย? (NPS 40+)
  4. เกิด organic sharing มั้ย? (5%+ share rate)

### Phase 0b (Months 4-6): Hardware Beta
- 1,000 paid beta units
- Pi 5 + HAT (or transition to Snapdragon Tachyon for R&D)
- Refine curriculum
- Validate Year 1 hardware path

### Gate decision (End Month 6):
- ✅ PASS: All 4 metrics → spend Year 1 $10M for 50K units
- ⚠️ PARTIAL: Pivot specific weak area
- ❌ FAIL: Kill or pivot completely

---

## 🤝 Team (Year 0 hiring)

### Already have:
- Founder/CEO (you)
- Hardware engineer (you)
- Existing TourBox team

### Need to hire:
1. **AI/ML Lead** — on-device LLM + vision expertise
2. **Curriculum Designer** — pedagogy + art teaching
3. **Mobile/Web Engineer** — Next.js + React expertise
4. **GTM Lead** — D2C marketing experience
5. **Pro Parallel Track Lead** — Pro user features ($600K side track)

---

## 📈 Why this can win

1. ✅ **Unique data moat** — pen-process recording at scale
2. ✅ **Hardware advantage** — TourBox controller + AI box bundle
3. ✅ **Local-first** — works where Samsung/Adobe can't (China + privacy markets)
4. ✅ **Beginner focus** — 60× larger TAM than pro segment
5. ✅ **Curriculum + AI** — tutoring (not generating)
6. ✅ **Timing** — edge AI chips just became viable
7. ✅ **Brand trust** — TourBox creative community

## ⚠️ Honest risks

1. ⚠️ Apple could build free version (need hardware differentiation)
2. ⚠️ Beginner segment hard to reach (need viral GTM)
3. ⚠️ Curriculum quality = make or break (need pedagogy expert)
4. ⚠️ AI quality bar high (bad feedback = churn in 2 weeks)
5. ⚠️ Hardware supply chain Year 1 = risky scaling

---

## 🔗 Related documents

- `HARDWARE_DECISIONS.md` — Why Pi 5 + HAT 26T (and rejected alternatives)
- `ARCHITECTURE.md` — Technical system design
- `DEMO_BUILD_PLAN.md` — 7-day plan to demo CEO
- `day1_setup.sh` — Runnable setup script
