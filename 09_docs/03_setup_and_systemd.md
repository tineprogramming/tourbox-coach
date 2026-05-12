# Deployment & systemd services

## All systemd units (8 total — auto-start, auto-restart)

### Pi 5 (`pi` SSH alias = tourbox@10.10.1.116)

| Service | Path | Port | Description |
|---|---|---|---|
| `tourbox-coach` | `/etc/systemd/system/tourbox-coach.service` | 8000 | FastAPI backend (uvicorn, WS + REST) |
| `tourbox-coach-frontend` | same dir | 5173 | Vite dev server (binds 0.0.0.0) |
| `tourbox-coach-setup` | same dir | 80 | Setup gateway (WiFi + AP) Basic Auth admin:<AP-password> |
| `tourbox-coach-ap` | same dir | — | WiFi hotspot (creates virtual ap0 iface, brings up NM connection) |
| `tourbox-coach-perf` | same dir | — | CPU governor=performance |

All have:
```ini
Restart=on-failure
RestartSec=10
WantedBy=multi-user.target
```

### 4090 Cluster (`cluster` SSH alias = root@tinebritania.tinestuff.com:2225)

| Service | GPU | Port | Description |
|---|---|---|---|
| `tourbox-cluster-coach` | 0 | 8001 | vLLM Qwen3-32B-AWQ |
| `tourbox-cluster-vision` | 2 | 8002 | vLLM Qwen3-VL-30B-A3B-AWQ |
| `tourbox-cluster-polish` | 1 | 8188 | ComfyUI 0.21 + Flux schnell + Flux dev FP8 + Union ControlNet |

All have:
```ini
Restart=on-failure
RestartSec=10
WantedBy=multi-user.target
```

## Critical vLLM config (cluster coach + vision)

```
--gpu-memory-utilization 0.92
--max-model-len 8192
--port 8001  (coach) / 8002 (vision)
--host 127.0.0.1
--served-model-name tourbox-coach / tourbox-vision
```

**Why 0.92:** vLLM CUDA-graph profiling reserves ~5% headroom. At 0.88 the
KV cache couldn't fit max_model_len=8192. vLLM's startup pre-flight check
fails fast (won't crash mid-request).

## ComfyUI config (cluster polish)

```
--port 8188 --listen 127.0.0.1 --highvram
```

`--highvram` keeps Flux weights resident after first request (saves the ~80s
cold-load per request). VRAM cost: ~22GB resident. Model swap (schnell ↔ dev)
takes ~30s when workflow changes.

## Cold-start sequence (after server reboot)

```
T+0s    systemd starts all 8 services in parallel
T+2s    Pi services ready (FastAPI, Vite, setup, perf)
T+5s    Pi AP hotspot up (ap0 virtual iface created)
T+60s   vLLM coach loads weights → ready
T+90s   vLLM vision loads weights → ready
T+100s  ComfyUI HTTP up (no inference yet)
T+180s  first Polish request triggers Flux cold-load
T+260s  ComfyUI fully hot
```

**Total cluster ready: ~2 min** for steady-state hot.

## Recovery behavior

- **Service crash** → systemd restarts in 10s
- **Out of memory mid-request** → vLLM rejects request with HTTP 400 (doesn't crash worker)
- **Driver crash** → manual reboot needed (rare; never observed in production)
- **Pi network flap** → wsClient auto-reconnects in ~3s

## Public HTTPS endpoints (cluster)

Cloudflare DNS → nginx wildcard subdomain → port forwarding:

```
https://tinebritania.tinestuff.com/tourbox/coach/    → 127.0.0.1:8001  (vLLM coach)
https://tinebritania.tinestuff.com/tourbox/vision/   → 127.0.0.1:8002  (vLLM vision)
https://tinebritania.tinestuff.com/tourbox/polish/   → 127.0.0.1:8188  (ComfyUI)
```

nginx config: 3 location blocks in `/etc/nginx/sites-enabled/tinestuff.com`.
WebSocket support in `/tourbox/polish/` for ComfyUI live progress.

## Verifying auto-start

```bash
# Pi
ssh pi "systemctl is-enabled tourbox-coach tourbox-coach-frontend tourbox-coach-setup tourbox-coach-ap tourbox-coach-perf"
# Expect: enabled × 5

# Cluster
ssh cluster "systemctl is-enabled tourbox-cluster-coach tourbox-cluster-vision tourbox-cluster-polish"
# Expect: enabled × 3
```

## Models cached on cluster (`/root/.cache/huggingface/hub/`)

| Path | Size | Purpose |
|---|---|---|
| `models--Qwen--Qwen3-32B-AWQ` | 22 GB | Coach (vLLM) |
| `models--QuantTrio--Qwen3-VL-30B-A3B-Instruct-AWQ` | 17 GB | Vision (vLLM) |
| `models--black-forest-labs--FLUX.1-schnell` | 23 GB | ComfyUI Reimagine |
| `models--Kijai--flux-fp8 (flux1-dev-fp8-e4m3fn)` | 12 GB | ComfyUI Faithful base |
| `models--Shakker-Labs--FLUX.1-dev-ControlNet-Union-Pro-2.0` | 4 GB | ComfyUI Faithful ControlNet |
| (text encoders + VAE) | ~6 GB | shared |
| **Total** | ~84 GB | well within 558 GB free |

Symlinked into ComfyUI:
```
ComfyUI/models/diffusion_models/flux1-schnell.safetensors  → BFL cache
ComfyUI/models/diffusion_models/flux1-dev-fp8.safetensors  → Kijai cache
ComfyUI/models/controlnet/flux-union-pro-2.safetensors     → Shakker cache
```

## Quick smoke-tests

```bash
# Coach (cluster)
curl -s https://tinebritania.tinestuff.com/tourbox/coach/v1/models | python3 -m json.tool

# Vision (cluster)
curl -X POST https://tinebritania.tinestuff.com/tourbox/vision/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"tourbox-vision","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"https://picsum.photos/256"}},{"type":"text","text":"What do you see?"}]}],"max_tokens":50}'

# Pi backend
curl -s http://10.10.1.116:8000/providers | python3 -m json.tool
curl -s http://10.10.1.116:8000/polish/styles | python3 -m json.tool
curl -s http://10.10.1.116:8000/vision/providers | python3 -m json.tool
```
