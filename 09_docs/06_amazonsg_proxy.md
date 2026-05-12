# amazonsg.tinestuff.com — pass-through API proxy

A FastAPI proxy on `amazonsg.tinestuff.com` (Singapore VPS, IP `47.129.50.234`)
that forwards any HTTPS API request to any upstream host, gated by a single
shared `X-Proxy-Token`. **Zero hardcoded endpoint list** — adding a new
provider requires no config change.

## When to use

- **Bypass GFW** — clients in mainland China can reach OpenAI / Anthropic /
  Google via the Singapore POP
- **Unified base URL** — change one env var instead of per-provider URLs
- **(Future)** Add logging / rate-limit / key rotation server-side

## URL pattern

```
https://amazonsg.tinestuff.com/proxy/<upstream-host>/<rest>
```

Examples:
```
/proxy/api.openai.com/v1/chat/completions
/proxy/api.anthropic.com/v1/messages
/proxy/fal.run/fal-ai/nano-banana-2/edit
/proxy/dashscope.aliyuncs.com/api/v1/services/aigc/...
/proxy/tinebritania.tinestuff.com/tourbox/coach/v1/models
```

## Required headers

| Header | Value | Notes |
|---|---|---|
| `X-Proxy-Token` | secret from `/opt/tine-proxy/.env` on amazonsg | mandatory — 401 if missing/wrong |
| `Authorization` | provider's own auth (e.g. `Bearer sk-...`) | forwarded as-is |
| `Content-Type` | as needed | forwarded |

## Verified performance

| Upstream | Latency through proxy | Status |
|---|---|---|
| OpenAI chat completion | 1.56s | ✓ |
| OpenAI list models | 1.20s | ✓ |
| OpenAI streaming SSE | real-time chunks | ✓ |
| fal.ai Z-Image Turbo | 1.83s | ✓ |
| Tinebritania cluster vLLM | 0.35s | ✓ |
| Bad host (127.0.0.1) | — | ✓ 403 blocked |
| Missing token | — | ✓ 401 returned |

## Client snippets

### Python — OpenAI SDK (Coach)

```python
import os
from openai import AsyncOpenAI

PROXY_BASE = os.environ["PROXY_URL"]          # https://amazonsg.tinestuff.com/proxy
PROXY_TOKEN = os.environ["PROXY_TOKEN"]

client = AsyncOpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    base_url=f"{PROXY_BASE}/api.openai.com/v1",   # ← change base_url, that's it
    default_headers={"X-Proxy-Token": PROXY_TOKEN},
)

# Now use client.chat.completions.create(...) exactly as before — including streaming.
```

### Python — httpx for fal.ai (Polish)

```python
import os, httpx

PROXY_BASE = os.environ["PROXY_URL"]
PROXY_TOKEN = os.environ["PROXY_TOKEN"]
FAL_KEY = os.environ["FAL_KEY"]

async with httpx.AsyncClient() as client:
    r = await client.post(
        f"{PROXY_BASE}/fal.run/fal-ai/nano-banana-2/edit",
        headers={
            "X-Proxy-Token": PROXY_TOKEN,
            "Authorization": f"Key {FAL_KEY}",
            "Content-Type": "application/json",
        },
        json={"prompt": "...", "image_url": "..."},
        timeout=120.0,
    )
```

### Python — cluster Qwen via proxy

```python
client = AsyncOpenAI(
    api_key="cluster",
    base_url=f"{PROXY_BASE}/tinebritania.tinestuff.com/tourbox/coach/v1",
    default_headers={"X-Proxy-Token": PROXY_TOKEN},
)
```

### Frontend — browser direct (if needed)

```typescript
const PROXY_BASE = "https://amazonsg.tinestuff.com/proxy";
const PROXY_TOKEN = "<fetched-from-pi-backend>";  // never bake into source

await fetch(`${PROXY_BASE}/api.openai.com/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${userOpenAIKey}`,
    "X-Proxy-Token": PROXY_TOKEN,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({...}),
});
```

CORS is enabled (`*` origins) so browser calls work.

## Deployment

### On amazonsg
```
/opt/tine-proxy/proxy.py        — FastAPI app (123 lines)
/opt/tine-proxy/.env            — PROXY_TOKEN=<32-char-random> (chmod 600)
/etc/systemd/system/tine-proxy.service  — systemd unit, uvicorn workers=2
/etc/nginx/sites-enabled/tinestuff.com  — added `location /proxy/` block
/etc/nginx/backups/             — previous configs
```

### systemd unit
```
[Service]
ExecStart=/usr/bin/python3 -m uvicorn proxy:app --host 127.0.0.1 --port 3001 --workers 2
EnvironmentFile=/opt/tine-proxy/.env
Restart=on-failure
```

### nginx location (added to existing server block)
```nginx
location /proxy/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_read_timeout 10m;
    proxy_send_timeout 5m;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    client_max_body_size 25m;  # data URLs for Polish ~3MB but allow headroom
}
```

## Security

- **`X-Proxy-Token`** — 32-byte URL-safe secret, constant-time compare
- **Private IP block** — regex blocks `localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`, `172.16-31.*`, `::1`, `fc00::/7`, `fe80::/10`
- **HTTPS-only outbound** — proxy always uses `https://` for upstream
- **No persistent storage** — body + headers streamed, never logged to disk
- **CORS open** — but auth still gates everything

## Adding a new provider

**Just use it.** Examples already work:
- Anthropic: `POST /proxy/api.anthropic.com/v1/messages` (with `x-api-key` header)
- Mistral: `POST /proxy/api.mistral.ai/v1/chat/completions`
- Replicate: `POST /proxy/api.replicate.com/v1/predictions`
- Together AI: `POST /proxy/api.together.xyz/v1/chat/completions`
- Cohere: `POST /proxy/api.cohere.ai/v1/chat`

No code changes, no config edits, no nginx reload. The proxy doesn't care what's downstream.

## Failure modes

| What goes wrong | Status | Recovery |
|---|---|---|
| Invalid token | 401 | check `PROXY_TOKEN` matches `/opt/tine-proxy/.env` |
| Private IP target | 403 | use public hostname |
| Upstream timeout | 504 | check upstream health; retry |
| Upstream DNS fail | 502 | check upstream hostname spelling |
| FastAPI crash | 502 from nginx | systemd auto-restarts in 5s |
| nginx down | curl fails | `systemctl restart nginx` |

## Pending — rotate post-demo

`PROXY_TOKEN` was generated 2026-05-12. Currently saved in:
- `/opt/tine-proxy/.env` on amazonsg
- `~/tourbox-coach/.env` on Pi (as `PROXY_TOKEN=...`)

Rotate by regenerating with `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`
and updating both files.
