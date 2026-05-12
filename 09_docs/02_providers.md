# AI Providers — full catalog

All providers categorized by country flag + open-source status.
**Open-source = weights publicly downloadable** (Apache 2.0 / MIT / non-commercial-but-open).

---

## Coach (text feedback per stroke)

| Provider | Flag | OSS | Vendor | Model | API |
|---|---|---|---|---|---|
| **Cluster · Qwen3-32B-AWQ** (default) | 🇹🇭 | ✓ | self-host 4090 | Qwen3-32B AWQ Int4 | OpenAI-compat vLLM |
| Local · Qwen2:1.5b | 🏠 | ✓ | Pi on-device | Qwen2:1.5b | Ollama |
| DeepSeek | 🇨🇳 | ✓ | DeepSeek | deepseek-chat | OpenAI-compat |
| Qwen-Plus | 🇨🇳 | ✗ | Alibaba DashScope | qwen-plus | OpenAI-compat |
| OpenAI GPT-4o-mini | 🇺🇸 | ✗ | OpenAI | gpt-4o-mini | OpenAI |

**Defaults:** Coach → `cluster` (Qwen3-32B-AWQ).

**System prompt** (shared): warm tutor, 1–2 sentences, lead with positive, one specific tip, match user's language. Located: `backend/coach/prompt.py`.

---

## Polish (sketch → polished image), 10 providers

### Mode taxonomy
- **🎨 AI Reimagine** — model reads sketch, generates NEW image from text caption (composition not literal)
- **🎯 Sketch-Faithful** — model uses sketch as structure reference (lines + composition preserved)

### All providers

| Provider | Flag | OSS | Mode | Vendor | Speed | License |
|---|---|---|---|---|---|---|
| **Cluster · Faithful** (default) | 🇹🇭 | ✓ | faithful | self-host | 25-30s | Flux dev non-commercial + Union ControlNet open |
| Cluster · Reimagine | 🇹🇭 | ✓ | reimagine | self-host | 10-15s | Flux schnell Apache 2.0 |
| Wanxiang 2.1 | 🇨🇳 | ✗ | faithful | Alibaba DashScope | 15-20s | closed |
| Seedream 5.0 | 🇨🇳 | ✗ | faithful | ByteDance BytePlus | 25-35s | closed |
| **Z-Image Turbo** | 🇨🇳 | ✓ | reimagine | Alibaba Tongyi (fal.ai) | 3-5s ⚡ | Apache 2.0 |
| **Z-Image · Faithful** | 🇨🇳 | ✓ | faithful | Alibaba Tongyi (fal.ai) | 5-7s ⚡ | Apache 2.0 |
| **Bagel** | 🇨🇳 | ✓ | faithful | ByteDance-Seed (fal.ai) | 100-110s 🐢 | Apache 2.0 |
| Flux Kontext Pro | 🇩🇪 | ✗ | faithful | Black Forest Labs (fal.ai) | 30-40s | Pro closed |
| OpenAI gpt-image-1 | 🇺🇸 | ✗ | faithful | OpenAI | 20-40s | closed |
| Nano Banana 2 | 🇺🇸 | ✗ | faithful | Google (fal.ai) | 10-15s | closed |

### Polish endpoint paths (fal.ai)

```
Nano Banana 2:        fal-ai/nano-banana-2/edit
Z-Image Turbo:        fal-ai/z-image/turbo               (text-to-image only)
Z-Image · Faithful:   fal-ai/z-image/turbo/controlnet    (image_url param)
Bagel:                fal-ai/bagel/edit
Flux Kontext Pro:     fal-ai/flux-pro/kontext
```

### Styles (7 options)
```
watercolor / anime / oil_painting / pencil_sketch / concept_art / ink_wash / realistic
```
Each provider has its own `STYLE_PROMPTS` dict but content is identical across modules
(see `backend/polish/wanxiang.py` as the canonical source).

---

## Vision (grounded sketch analysis with bbox)

| Provider | Flag | OSS | Vendor | Model | Speed | Bbox accuracy |
|---|---|---|---|---|---|---|
| **Cluster · Qwen3-VL-30B-A3B-AWQ** (default) | 🇹🇭 | ✓ | self-host | Qwen3-VL 30B MoE/3B-active AWQ | 1-3s | **pixel-accurate** |
| Qwen-VL-Max | 🇨🇳 | ✗ | Alibaba DashScope | qwen-vl-max | 2-5s | pixel-accurate |
| OpenAI GPT-4o | 🇺🇸 | ✗ | OpenAI | gpt-4o | 4-9s | approximate (~30% off) |

**Endpoints:** `/vision`, `/vision/grounded`, `/vision/providers`

**Grounded prompt** asks model to return `<regions>[{label, bbox}]</regions>` JSON block.
Parser at `backend/vision/cluster.py:_parse_grounded_reply` is shared by all three providers.

---

## Multi-select compare

Both Polish + Vision support **multi-select chip grid** → fires N parallel requests →
shows progressive reveal cells. UI same for both:

- Mode picker on top (Polish only; Vision is mode-less)
- Style/Question picker
- Chip grid grouped by category (cluster / chinese / international)
- "Just cluster" / "Select all (N)" toolbar
- "Compare N models" generate button
- Result grid: source thumb (Polish only) + per-provider cell with shimmer→reveal

Parallel wall-clock = slowest provider (e.g., 5 Polish providers = ~30s, not 120s sequential).

---

## Adding a new provider

1. Create `backend/polish/<name>.py` (mirror `nano_banana.py` for fal.ai HTTP pattern,
   or `openai_polish.py` for SDK pattern)
2. Add error class + async function returning `{images, style, prompt, provider, model, elapsed}`
3. Wire in `backend/main.py`:
   - Import + add `try/except`
   - Add entry to `POLISH_PROVIDERS` list
   - Add `if req.provider == "...":` dispatch
4. Add entry to `frontend/src/components/PolishModal.tsx` `PROVIDER_OPTIONS`
   with flag + openSource + mode + category
5. (Optional) Add i18n key for label in `frontend/src/i18n/strings.ts`

Same pattern for Coach (`backend/coach/cloud.py` for OpenAI-compat) and Vision (`backend/vision/*.py`).
