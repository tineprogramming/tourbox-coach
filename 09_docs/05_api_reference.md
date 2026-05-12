# Backend API reference (Pi FastAPI :8000)

## REST endpoints

### `GET /`
```json
{"name": "TourBox Coach API", "version": "0.3.0", "status": "running", "local_model": "qwen2:1.5b"}
```

### `GET /health`
```json
{"status": "healthy", "timestamp": 1731536400.12}
```

### `GET /providers` — Coach providers list
```json
{
  "local":   {"id": "local",   "label": "Local · qwen2:1.5b"},
  "cluster": {"id": "cluster", "label": "Cluster · Qwen3-32B-AWQ"},
  "cloud":   [
    {"id": "deepseek",  "label": "DeepSeek"},
    {"id": "qwen-plus", "label": "Qwen-Plus"},
    {"id": "openai",    "label": "OpenAI GPT-4o-mini"}
  ]
}
```

### `GET /polish/styles` — Polish styles + providers
```json
{
  "styles": [
    {"id": "watercolor", "prompt": "watercolor painting, soft pastel washes, ..."},
    ...
  ],
  "providers": [
    {"id": "cluster-faithful", "label": "Cluster · Faithful", ...},
    ...
  ]
}
```

### `POST /polish` — Sketch-to-image
**Body:**
```json
{
  "image": "data:image/png;base64,..." | "http://...",
  "style": "watercolor",
  "prompt": "",
  "n": 1,
  "provider": "cluster-faithful",
  "lang": "en"
}
```

**Valid `provider` values:**
```
cluster-faithful | cluster | wanxiang | seedream | flux-kontext |
openai | nano-banana | z-image | z-image-faithful | bagel
```

**Response:**
```json
{
  "images": ["data:image/png;base64,..." | "http://..."],
  "style": "watercolor",
  "prompt": "<final prompt sent to model>",
  "provider": "cluster-faithful",
  "model": "flux-dev-fp8+union-pro-2+canny",
  "task_id": "...",
  "elapsed": 16.5,
  "caption": "<vision caption>"  // cluster reimagine + z-image only
}
```

**Errors:** HTTP 400 (bad input), 502 (provider failure with `Provider: <error message>` detail).

### `GET /vision/providers`
```json
{"providers": [
  {"id": "cluster", "label": "Cluster · Qwen3-VL-30B-A3B-AWQ", ...},
  {"id": "dashscope", "label": "Qwen-VL-Max", ...},
  {"id": "openai", "label": "OpenAI GPT-4o", ...}
]}
```

### `POST /vision` — Free-form vision Q&A
**Body:**
```json
{
  "image": "data:image/png;base64,..." | "http://...",
  "prompt": "What do you see?",  // optional, defaults to coach-style prompt
  "lang": "en",                  // "en" | "zh-CN"
  "provider": "cluster"          // "cluster" | "dashscope" | "openai"
}
```

**Response:**
```json
{
  "reply": "I see a stick figure...",
  "model": "Qwen3-VL-30B-A3B-AWQ",
  "prompt": "<actual prompt sent>",
  "elapsed": 1.6
}
```

### `POST /vision/grounded` — Vision + bbox regions
Same input as `/vision`. Adds bbox identification.

**Response:**
```json
{
  "reply": "You see a stick figure standing under a sun. Tip: ...",
  "regions": [
    {"label": "stick figure", "bbox": [185, 395, 571, 942]},
    {"label": "sun", "bbox": [575, 77, 881, 353]}
  ],
  "image_width": 1024,
  "image_height": 1024,
  "model": "Qwen3-VL-30B-A3B-AWQ",
  "prompt": "...",
  "elapsed": 1.6
}
```

Bbox coordinates: pixels, origin top-left of input image (after Pi downscaling to ≤1024px).

### `GET /pi/internet[?force=true]`
Cached internet check (Pi uses it to gate cloud provider availability).

### `GET /llm/smoke`
Synchronous smoke test of local Ollama coach.

### `GET /polish/styles`
Returns `{styles, providers}`.

---

## WebSocket: `/ws`

### Server → Client message types

```json
{"type": "session_start", "session_id": "abc123"}

{"type": "stroke_metrics", "strokeId": "xyz",
  "smoothness": 0.85, "pressureConsistency": 0.72,
  "avgSpeed": 142, "hesitations": 2, "confidence": 0.78,
  "samples": 38}

{"type": "coach_start", "strokeId": "xyz", "source": "cluster"}

{"type": "coach_token", "strokeId": "xyz", "token": "Nice"}
{"type": "coach_token", "strokeId": "xyz", "token": " smooth"}
...

{"type": "coach_done", "strokeId": "xyz",
  "text": "Nice smooth curve! ...", "source": "cluster",
  "elapsed": 2.25}

{"type": "coach_error", "strokeId": "xyz",
  "error": "...", "source": "cluster"}

{"type": "ack", "received": "<msg_type>"}
```

### Client → Server

```json
{
  "type": "stroke_complete",
  "provider": "cluster",
  "lang": "en",
  "stroke": {
    "id": "stroke_id",
    "tags": {"tool": "pencil", "thickness": 6, "color": "#000", ...},
    "events": [
      {"x": 100, "y": 50, "p": 0.5, "t": 0.0},
      ...
    ]
  }
}
```

---

## Provider error detail format

All providers return HTTP 502 on failure with `detail: "<Provider name>: <error message>"`:

```
"Wanxiang: HTTP 401: invalid API key"
"Cluster Faithful: ComfyUI error: ..."
"OpenAI: ..."
"Z-Image: HTTP 422: missing field 'image_url'"
"Bagel: HTTP 503: ..."
"Vision (cluster): ..."
"Vision (DashScope): ..."
```

Frontend `<ErrorBlock>` renders these copyable.

---

## Coach prompt structure

System prompt (`backend/coach/prompt.py`):
```
You are a warm, encouraging drawing tutor for absolute beginners.
- Reply in 1–2 short sentences. Match the user's language (English or Chinese 中文).
- Lead with what went well; *then* offer one specific improvement.
- Reference the metrics you're given (smoothness, pressure consistency, hesitations).
- Never lecture. Never list. Speak like a friend looking over their shoulder.
[examples...]
```

User prompt (`build_user_prompt`):
```
The student just finished a stroke with the {tool} tool.
Metrics:
- smoothness: 0.85 (0=jerky, 1=smooth)
- pressure consistency: 0.72
- avg speed: 142 px/s
- hesitations: 2
- overall confidence: 0.78

Give one short encouraging note plus one concrete tip. Reply in {English|Simplified Chinese (简体中文)}.
```

Cluster coach: `/no_think` directive appended so Qwen3 skips thinking-mode preamble.

---

## Environment variables (`~/tourbox-coach/.env` on Pi)

```bash
# All optional — missing keys cause graceful fallback to local
DASHSCOPE_API_KEY=...      # Wanxiang + Qwen-Plus coach + Qwen-VL-Max vision
DEEPSEEK_API_KEY=...       # DeepSeek coach
BYTEPLUS_API_KEY=...       # Seedream
FAL_KEY=...                # Flux Kontext + Nano Banana + Z-Image + Bagel
OPENAI_API_KEY=...         # OpenAI coach + polish + vision
HF_TOKEN=...               # For gated HF models on cluster (FLUX dev)

# Optional overrides
CLUSTER_BASE_URL=https://tinebritania.tinestuff.com/tourbox
CLUSTER_COACH_URL=...
```
