# TourBox Coach — Architecture

## Three-tier system

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CLIENT                                                                 │
│  Wacom/iPad/Tablet → Browser at http://10.10.1.116:5173                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTP/WS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  PI 5 + Hailo HAT 26T   (10.10.1.116)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Frontend (Vite + React + Konva + perfect-freehand + libmypaint) │    │
│  │  :5173  →  proxy /ws + /api to backend :8000                    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Backend (FastAPI uvicorn)                                       │    │
│  │  :8000  /providers /polish /vision /vision/grounded /ws etc.    │    │
│  │   ↓ async dispatch to provider modules                          │    │
│  │   ↓ stroke metrics + JSONL session logger                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ Setup gateway (FastAPI :80, Basic Auth)                         │    │
│  │  WiFi STA scan + AP toggle + captive portal endpoints           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│  Local Ollama (Qwen2:1.5b)  ← fallback coach when cluster + cloud down  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │ HTTPS (Cloudflare proxy)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  4090 CLUSTER   tinebritania.tinestuff.com:2225  (3 × RTX 4090 24GB)    │
│  GPU 0  Coach    vLLM   Qwen3-32B-AWQ           :8001 → /tourbox/coach/ │
│  GPU 1  Polish   ComfyUI 0.21 + Flux schnell    :8188 → /tourbox/polish/│
│                  + Flux dev FP8 + Union ControlNet (cluster-faithful)   │
│  GPU 2  Vision   vLLM   Qwen3-VL-30B-A3B-AWQ    :8002 → /tourbox/vision/│
│  nginx wildcard subdomain proxies + ports forwarded via Cloudflare      │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼ (clusterless fallbacks)
┌─────────────────────────────────────────────────────────────────────────┐
│  EXTERNAL CLOUDS                                                        │
│  🇨🇳  DeepSeek · Qwen-Plus DashScope (coach)                            │
│      Wanxiang · Seedream (polish, BytePlus)                             │
│      Z-Image Turbo + ControlNet · Bagel (polish, via fal.ai)            │
│      Qwen-VL-Max DashScope (vision)                                     │
│  🇩🇪  Flux Kontext Pro (polish, via fal.ai)                             │
│  🇺🇸  OpenAI GPT-4o-mini coach / gpt-image-1 polish / GPT-4o vision     │
│      Nano Banana 2 polish (Google via fal.ai)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data flow per feature

### Coach (per-stroke feedback)

```
User draws on canvas
  → useStrokeRecorder collects pointer events
  → onStrokeEnd: wsClient.send("stroke_complete", stroke, provider, lang)
  → Pi backend WS /ws receives → analyze_stroke(numpy) → emit stroke_metrics
  → spawn async _run_coach(provider) → stream_coaching dispatch
      ├─ local   → ollama.chat (Qwen2:1.5b)
      ├─ cluster → AsyncOpenAI(base_url=cluster) (Qwen3-32B-AWQ, /no_think)
      ├─ deepseek/qwen-plus/openai → AsyncOpenAI(base_url=vendor)
  → tokens stream back: coach_start, coach_token×N, coach_done
  → CoachingBubble.tsx renders streaming text with caret
  → JSONL append to ~/tourbox-coach/sessions/{session_id}.jsonl
```

### Polish (sketch → polished image)

```
User clicks "Polish My Drawing"
  → getCanvasSnapshot() composites all canvases at ≥2048px
  → toDataURL("image/png") → base64 data URL (~3 MB)
  → POST /api/polish { image, style, provider, n, lang }
  → main.py dispatches to provider module:
      ├─ cluster-faithful  → polish/cluster_faithful.py (ComfyUI workflow)
      │     Pi → ComfyUI: upload image → submit Flux dev + Canny + ControlNet
      │     workflow → poll /history → fetch /view → return data URL
      ├─ cluster (reimagine) → polish/cluster.py (vision-captioned t2i)
      │     Pi → cluster vision: caption sketch →
      │     Pi → ComfyUI: t2i Flux schnell with caption + style prompt
      ├─ wanxiang   → polish/wanxiang.py (DashScope async polling)
      ├─ seedream   → polish/seedream.py (BytePlus sync)
      ├─ flux-kontext → polish/flux_kontext.py (fal.ai sync)
      ├─ openai     → polish/openai_polish.py (images.edit endpoint)
      ├─ nano-banana → polish/nano_banana.py (fal-ai/nano-banana-2/edit)
      ├─ z-image    → polish/z_image.py (vision caption → fal Z-Image t2i)
      ├─ z-image-faithful → polish/z_image_faithful.py (fal Z-Image ControlNet)
      ├─ bagel      → polish/bagel.py (fal-ai/bagel/edit)
  → Each module returns { images: [url|dataURL], style, prompt, ... }

Multi-select compare mode:
  Frontend fires N parallel fetch() with Promise.allSettled-style
  Per-cell state machine: loading → done | error
  Results render with shimmer + reveal fade-in animations
```

### Vision (grounded sketch analysis)

```
User clicks "👁 Ask vision"
  → captures canvas same as Polish
  → POST /api/vision/grounded { image, prompt, lang, provider }
  → dispatch:
      ├─ cluster   → vision/cluster.py (Qwen3-VL-30B-A3B-AWQ)
      ├─ dashscope → vision/dashscope.py (qwen-vl-max via DashScope)
      ├─ openai    → vision/openai_vision.py (GPT-4o)
  → all use the same shared GROUNDED_PROMPT template (asks for
    <regions>[{label, bbox}]</regions> JSON block)
  → image_utils.downscale_data_url() caps at 1024px before send
  → response parsed by _parse_grounded_reply → { reply, regions, dims }
  → frontend renders source thumb with SVG <rect> overlay per region
    + hover state syncs between bbox + region chip below
```

## VRAM budget per GPU

```
GPU 0  (coach, vLLM Qwen3-32B-AWQ)         24 GB
  ├─ Weights AWQ Int4                       17 GB
  ├─ KV cache (max_model_len 8192)           3 GB
  ├─ CUDA graphs + activations               3 GB
  ├─ gpu_memory_utilization 0.92
  └─ Steady-state: 22.8 GB used

GPU 1  (polish, ComfyUI + --highvram)      24 GB
  ├─ Flux schnell BF16 (when active)        22 GB (or)
  ├─ Flux dev FP8 + Union ControlNet:
  │     dev FP8 weights                     12 GB
  │     ControlNet Union Pro 2.0             4 GB
  │     KV + activations + text encoders     5 GB
  ├─ Model swap on workflow change (ComfyUI auto-handles)
  └─ Cold-load first request: ~80s, hot ~5-25s

GPU 2  (vision, vLLM Qwen3-VL-30B-A3B-AWQ) 24 GB
  ├─ Weights AWQ Int4                       18 GB
  ├─ KV cache (max_model_len 8192)           2.5 GB
  ├─ Vision encoder + activations            2 GB
  ├─ gpu_memory_utilization 0.92
  └─ Steady-state: 21.0 GB used
```

## Why this stack

- **Pi 5 + Hailo HAT** — portable, on-device privacy fallback (ollama Qwen2:1.5b)
- **Self-hosted 4090 cluster** — owns the production stack, $0 marginal per request,
  same provider category as OpenAI/Google for credibility comparison
- **Multiple cloud providers** — China-friendly (DeepSeek, Qwen, Wanxiang, Seedream,
  Z-Image, Bagel) AND international (OpenAI, Google Nano Banana, BFL Flux Kontext)
  so users in mainland China or USA both see something working
- **Multi-select compare** — single drawing, parallel results, side-by-side. Demo gold.
- **Open-source tagging** — buyers care which models they can self-host
