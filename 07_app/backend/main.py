"""TourBox Coach — FastAPI backend (Pi 5).

Day 2.5 scope:
- WebSocket recorder logs every event to JSONL (the moat).
- Stroke metrics computed inline (numpy).
- Coaching feedback STREAMED token-by-token from selected provider
  (local Qwen3 / cloud DeepSeek / Qwen-plus / Kimi / MiniMax).
- Per-session "one coach in flight" guard.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path
from typing import Any

import ollama
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Load .env (API keys) from project root BEFORE importing coach modules
# so client construction sees the keys.
load_dotenv(Path.home() / "tourbox-coach" / ".env")

from .analyzers.stroke import analyze_stroke  # noqa: E402
from .coach.local import model_name as local_model_name  # noqa: E402
from .coach.router import list_providers, stream_coaching  # noqa: E402
from .pi import internet as pi_internet  # noqa: E402
from .polish.cluster import ClusterPolishError, polish_sketch_cluster  # noqa: E402
from .polish.cluster_faithful import ClusterFaithfulError, polish_sketch_cluster_faithful  # noqa: E402
from .polish.flux_kontext import FluxKontextError, polish_sketch_flux_kontext  # noqa: E402
from .polish.nano_banana import NanoBananaError, polish_sketch_nano_banana  # noqa: E402
from .polish.openai_polish import OpenAIPolishError, polish_sketch_openai  # noqa: E402
from .polish.seedream import SeedreamError, polish_sketch_seedream  # noqa: E402
from .polish.z_image import ZImageError, polish_sketch_z_image  # noqa: E402
from .polish.bagel import BagelError, polish_sketch_bagel  # noqa: E402
from .polish.wanxiang import STYLE_PROMPTS, PolishError, polish_sketch as polish_sketch_wanxiang  # noqa: E402
from .vision.cluster import VisionError, ask_vision, ask_vision_grounded  # noqa: E402
from .image_utils import downscale_data_url  # noqa: E402
from .vision.dashscope import VisionDashScopeError, ask_vision_dashscope, ask_vision_dashscope_grounded  # noqa: E402
from .vision.openai_vision import VisionOpenAIError, ask_vision_openai, ask_vision_openai_grounded  # noqa: E402
from . import proxy_state  # noqa: E402
from .benchmark import run_benchmark  # noqa: E402

SESSIONS_DIR = Path.home() / "tourbox-coach" / "sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="TourBox Coach API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Per-session lock: drop new coach requests if one is already in flight.
_coach_in_flight: dict[str, bool] = {}


@app.get("/")
async def root() -> dict:
    return {
        "name": "TourBox Coach API",
        "version": "0.3.0",
        "status": "running",
        "local_model": local_model_name(),
    }


@app.get("/health")
async def health() -> dict:
    return {"status": "healthy", "timestamp": time.time()}


@app.get("/providers")
async def providers() -> dict:
    return list_providers()


@app.get("/proxy/status")
async def proxy_status() -> dict:
    return {"enabled": proxy_state.is_enabled()}


class ProxyToggleRequest(BaseModel):
    enabled: bool


@app.post("/proxy/toggle")
async def proxy_toggle(req: ProxyToggleRequest) -> dict:
    proxy_state.set_enabled(req.enabled)
    return {"enabled": proxy_state.is_enabled()}


@app.post("/proxy/benchmark")
async def proxy_benchmark() -> dict:
    return await run_benchmark()


class PolishRequest(BaseModel):
    image: str          # data URL: "data:image/png;base64,..."
    style: str = "watercolor"
    prompt: str = ""
    n: int = 1
    provider: str = "cluster-faithful"  # default = our cluster, sketch-preserving
    lang: str = "en"            # "en" | "zh-CN" — only affects cluster captions for now


class VisionRequest(BaseModel):
    image: str          # data URL or public http URL
    prompt: str = ""
    lang: str = "en"
    provider: str = "cluster"  # "cluster" | "openai" | "dashscope"


VISION_PROVIDERS = [
    {"id": "cluster",   "label": "Cluster · Qwen3-VL-30B-A3B-AWQ", "vendor": "Thailand 4090", "category": "cluster",       "estimate_s": "1-3"},
    {"id": "dashscope", "label": "Qwen-VL-Max",                    "vendor": "Alibaba",       "category": "chinese",       "estimate_s": "2-5"},
    {"id": "openai",    "label": "OpenAI GPT-4o",             "vendor": "OpenAI",        "category": "international", "estimate_s": "2-5"},
]


POLISH_PROVIDERS = [
    # category: "cluster" | "chinese" | "international"
    # mode:     "faithful" (preserves lines) | "reimagine" (creative)
    {"id": "cluster-faithful", "label": "Cluster · Faithful", "estimate_s": "25-30 hot", "vendor": "Thailand 4090", "category": "cluster", "mode": "faithful"},
    {"id": "cluster", "label": "Cluster · Reimagine", "estimate_s": "10-15 hot", "vendor": "Thailand 4090", "category": "cluster", "mode": "reimagine"},
    {"id": "wanxiang", "label": "Wanxiang 2.1", "estimate_s": "15-20", "vendor": "Alibaba", "category": "chinese", "mode": "faithful"},
    {"id": "seedream", "label": "Seedream 5.0", "estimate_s": "25-35", "vendor": "ByteDance", "category": "chinese", "mode": "faithful"},
    {"id": "flux-kontext", "label": "Flux Kontext Pro", "estimate_s": "30-40", "vendor": "fal.ai", "category": "international", "mode": "faithful"},
    {"id": "openai", "label": "OpenAI gpt-image-1", "estimate_s": "20-40", "vendor": "OpenAI", "category": "international", "mode": "faithful"},
    {"id": "nano-banana", "label": "Nano Banana 2", "estimate_s": "10-15", "vendor": "Google · fal.ai", "category": "international", "mode": "faithful"},
    {"id": "z-image", "label": "Z-Image Turbo", "estimate_s": "3-5", "vendor": "Alibaba Tongyi · fal.ai", "category": "chinese", "mode": "reimagine"},
    {"id": "bagel", "label": "Bagel", "estimate_s": "8-15", "vendor": "ByteDance-Seed · fal.ai", "category": "chinese", "mode": "faithful"},
]

# Max input image size per Polish provider (longest edge in pixels).
# main.py downscales once before dispatch — no per-module downscale needed.
# cluster-faithful uses full res for better Canny edge detection.
# Everything else: 2048 is plenty for composition guidance.
_POLISH_MAX_EDGE: dict[str, int] = {
    "cluster-faithful": 4096,
    "_default": 2048,
}

# Max input size for Vision providers (analysis task — 1024 is ample).
_VISION_MAX_EDGE = 1024


# ────────── Internet status (for React cloud-provider gating) ──────────
# Full WiFi / AP management lives on the setup gateway at port 80 (see
# `setup_app.py`). We keep just the internet check here so the React app's
# /api/pi/internet proxy stays clean.


@app.get("/pi/internet")
async def pi_internet_check(force: bool = False) -> dict:
    return await pi_internet.check_internet(force=force)


@app.get("/polish/styles")
async def polish_styles() -> dict:
    return {
        "styles": [{"id": k, "prompt": v} for k, v in STYLE_PROMPTS.items()],
        "providers": POLISH_PROVIDERS,
    }


@app.post("/polish")
async def polish(req: PolishRequest) -> dict:
    """Sketch-to-image. User picks the provider explicitly — no auto fallback
    so they understand the speed/quality trade-off and can retry the other
    if one fails."""
    if not req.image.startswith("data:image") and not req.image.startswith("http"):
        raise HTTPException(status_code=400, detail="image must be a data URL or public http URL")
    # Global payload preprocessing — downscale once here, never per-module.
    max_edge = _POLISH_MAX_EDGE.get(req.provider, _POLISH_MAX_EDGE["_default"])
    image = downscale_data_url(req.image, max_edge=max_edge)
    try:
        if req.provider == "seedream":
            return await polish_sketch_seedream(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "flux-kontext":
            return await polish_sketch_flux_kontext(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "cluster":
            return await polish_sketch_cluster(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "cluster-faithful":
            return await polish_sketch_cluster_faithful(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "openai":
            return await polish_sketch_openai(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "nano-banana":
            return await polish_sketch_nano_banana(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "z-image":
            return await polish_sketch_z_image(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "bagel":
            return await polish_sketch_bagel(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        if req.provider == "wanxiang":
            return await polish_sketch_wanxiang(image, style=req.style, custom_prompt=req.prompt, n=req.n)
        raise HTTPException(status_code=400, detail=f"unknown provider: {req.provider}")
    except PolishError as e:
        raise HTTPException(status_code=502, detail=f"Wanxiang: {e}")
    except SeedreamError as e:
        raise HTTPException(status_code=502, detail=f"Seedream: {e}")
    except FluxKontextError as e:
        raise HTTPException(status_code=502, detail=f"Flux Kontext: {e}")
    except ClusterPolishError as e:
        raise HTTPException(status_code=502, detail=f"Cluster: {e}")
    except ClusterFaithfulError as e:
        raise HTTPException(status_code=502, detail=f"Cluster Faithful: {e}")
    except OpenAIPolishError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI: {e}")
    except NanoBananaError as e:
        raise HTTPException(status_code=502, detail=f"Nano Banana: {e}")
    except ZImageError as e:
        raise HTTPException(status_code=502, detail=f"Z-Image: {e}")
    except BagelError as e:
        raise HTTPException(status_code=502, detail=f"Bagel: {e}")


@app.get("/vision/providers")
async def vision_providers() -> dict:
    return {"providers": VISION_PROVIDERS}


@app.post("/vision")
async def vision(req: VisionRequest) -> dict:
    """Vision Q&A, dispatched by provider (cluster / openai / dashscope)."""
    if not req.image.startswith("data:image") and not req.image.startswith("http"):
        raise HTTPException(status_code=400, detail="image must be a data URL or public http URL")
    image = downscale_data_url(req.image, max_edge=_VISION_MAX_EDGE)
    try:
        if req.provider == "openai":
            return await ask_vision_openai(image, prompt=req.prompt, lang=req.lang)
        if req.provider == "dashscope":
            return await ask_vision_dashscope(image, prompt=req.prompt, lang=req.lang)
        return await ask_vision(image, prompt=req.prompt, lang=req.lang)
    except VisionError as e:
        raise HTTPException(status_code=502, detail=f"Vision (cluster): {e}")
    except VisionOpenAIError as e:
        raise HTTPException(status_code=502, detail=f"Vision (OpenAI): {e}")
    except VisionDashScopeError as e:
        raise HTTPException(status_code=502, detail=f"Vision (DashScope): {e}")


@app.post("/vision/grounded")
async def vision_grounded(req: VisionRequest) -> dict:
    """Vision answer + per-element bounding boxes, dispatched by provider."""
    if not req.image.startswith("data:image") and not req.image.startswith("http"):
        raise HTTPException(status_code=400, detail="image must be a data URL or public http URL")
    image = downscale_data_url(req.image, max_edge=_VISION_MAX_EDGE)
    try:
        if req.provider == "openai":
            return await ask_vision_openai_grounded(image, prompt=req.prompt, lang=req.lang)
        if req.provider == "dashscope":
            return await ask_vision_dashscope_grounded(image, prompt=req.prompt, lang=req.lang)
        return await ask_vision_grounded(image, prompt=req.prompt, lang=req.lang)
    except VisionError as e:
        raise HTTPException(status_code=502, detail=f"Vision (cluster): {e}")
    except VisionOpenAIError as e:
        raise HTTPException(status_code=502, detail=f"Vision (OpenAI): {e}")
    except VisionDashScopeError as e:
        raise HTTPException(status_code=502, detail=f"Vision (DashScope): {e}")


@app.get("/llm/smoke")
async def llm_smoke() -> dict:
    """Smoke test the LOCAL model (synchronous, non-streaming)."""
    started = time.time()
    response = ollama.chat(
        model=local_model_name(),
        messages=[{"role": "user", "content": "Say hello in one word."}],
    )
    return {
        "model": local_model_name(),
        "reply": response["message"]["content"].strip(),
        "eval_count": response.get("eval_count"),
        "eval_seconds": (response.get("eval_duration") or 0) / 1e9,
        "wall_seconds": round(time.time() - started, 2),
    }


def _append_jsonl(log_file: Path, event: dict[str, Any]) -> None:
    with log_file.open("a") as f:
        f.write(json.dumps(event, default=str) + "\n")


async def _run_coach(
    ws: WebSocket,
    session_id: str,
    stroke_id: str,
    tool: str,
    metrics: dict,
    provider: str,
    log_file: Path,
    lang: str = "en",
) -> None:
    """Stream coaching tokens to the client. Drops if one already in flight."""
    if _coach_in_flight.get(session_id):
        return
    _coach_in_flight[session_id] = True

    full_text_parts: list[str] = []
    actual_source = provider
    started = time.time()
    # Augment metrics with the requested reply language so the coach
    # router can pass it into the user prompt.
    metrics_with_lang = {**metrics, "_lang": lang}

    try:
        await ws.send_json({
            "type": "coach_start",
            "strokeId": stroke_id,
            "source": provider,
        })

        async for source, token in stream_coaching(provider, tool, metrics_with_lang):
            actual_source = source
            full_text_parts.append(token)
            await ws.send_json({
                "type": "coach_token",
                "strokeId": stroke_id,
                "token": token,
            })

        full_text = "".join(full_text_parts).strip()
        elapsed = time.time() - started

        await ws.send_json({
            "type": "coach_done",
            "strokeId": stroke_id,
            "text": full_text,
            "source": actual_source,
            "elapsed": round(elapsed, 2),
        })
        _append_jsonl(log_file, {
            "kind": "coach_done",
            "strokeId": stroke_id,
            "text": full_text,
            "source": actual_source,
            "requested": provider,
            "elapsed": round(elapsed, 2),
        })
    except Exception as e:
        print(f"[coach] error session={session_id} provider={provider}: {e}")
        try:
            await ws.send_json({
                "type": "coach_error",
                "strokeId": stroke_id,
                "error": str(e),
                "source": provider,
            })
        except Exception:
            pass
    finally:
        _coach_in_flight[session_id] = False


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    session_id = uuid.uuid4().hex[:12]
    log_file = SESSIONS_DIR / f"{session_id}.jsonl"

    print(f"[ws] open  session={session_id}")
    _append_jsonl(log_file, {"kind": "session_start", "session_id": session_id, "t": time.time()})
    await ws.send_json({"type": "session_start", "session_id": session_id})

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type", "?")

            _append_jsonl(log_file, {"kind": "event", "received_at": time.time(), **data})

            if msg_type == "stroke_complete":
                stroke = data.get("stroke", {}) or {}
                events = stroke.get("events", []) or []
                tool = (stroke.get("tags", {}) or {}).get("tool", "pencil")
                stroke_id = stroke.get("id", uuid.uuid4().hex[:8])
                provider = data.get("provider", "local")
                lang = data.get("lang", "en")

                # 1) Metrics — fast, send back immediately.
                metrics = analyze_stroke(events)
                metrics_msg = {
                    "type": "stroke_metrics",
                    "strokeId": stroke_id,
                    **metrics,
                }
                await ws.send_json(metrics_msg)
                _append_jsonl(log_file, {"kind": "stroke_metrics", **metrics_msg})

                # 2) Coach — streaming background task.
                asyncio.create_task(
                    _run_coach(ws, session_id, stroke_id, tool, metrics, provider, log_file, lang)
                )
            else:
                await ws.send_json({"type": "ack", "received": msg_type})

    except WebSocketDisconnect:
        _append_jsonl(log_file, {"kind": "session_end", "t": time.time()})
        _coach_in_flight.pop(session_id, None)
        print(f"[ws] close session={session_id}")
