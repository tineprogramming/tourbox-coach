"""Cluster · Faithful polish: preserves the user's sketch lines.

Pipeline: sketch → upload to ComfyUI → Canny edge map → Flux dev FP8 + Union
ControlNet (canny mode, strength 0.7) → polished image that follows the
sketch's composition.

Differences from cluster.py (Reimagine):
- Uses Flux dev FP8 (not schnell) because ControlNets are trained for dev.
- 20 sampling steps instead of 4 — needed for non-distilled dev model.
- Adds a Canny preprocessor + ControlNet stack on top of the t2i graph.
- Slightly slower per generation (~25-30s hot vs ~10-15s for Reimagine).

Captions are still produced via Qwen3-VL so the prompt is descriptive even
though structure is locked by Canny. User can override with `custom_prompt`.
"""

from __future__ import annotations

import asyncio
import base64
import io
import os
import random
import re
import time

import httpx
from openai import AsyncOpenAI

from ..upstream_client import make_openai_client, upstream_url, proxy_aware_client  # noqa: E402

from ..image_utils import downscale_data_url

CLUSTER_BASE = os.environ.get("CLUSTER_BASE_URL", "https://tinebritania.tinestuff.com/tourbox")
VISION_URL = f"{CLUSTER_BASE}/vision/v1"
COMFY_URL = f"{CLUSTER_BASE}/polish"

STYLE_PROMPTS: dict[str, str] = {
    "watercolor": "watercolor painting, soft pastel washes, artistic, fine details",
    "anime": "anime style illustration, vibrant clean colors, crisp linework",
    "oil_painting": "oil painting, thick textured brush strokes, dramatic lighting",
    "pencil_sketch": "detailed pencil drawing, fine hatching, monochrome shading",
    "concept_art": "professional concept art, cinematic, painterly, atmospheric",
    "ink_wash": "Chinese ink wash painting, sumi-e, expressive minimal strokes",
    "realistic": "photorealistic, hyperdetailed, professional photography, natural lighting, sharp focus, 8k uhd",
}

POLL_INTERVAL_S = 1.5
POLL_TIMEOUT_S = 300.0  # Faithful is slower than Reimagine; allow more headroom.
DATA_URL_RE = re.compile(r"^data:image/([a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)


class ClusterFaithfulError(RuntimeError):
    pass


_vision_client: AsyncOpenAI | None = None


def _get_vision_client() -> AsyncOpenAI:
    global _vision_client
    if _vision_client is None:
        _vision_client = make_openai_client(api_key="cluster", base_url=VISION_URL)
    return _vision_client


async def _caption(image_data_url: str) -> str:
    client = _get_vision_client()
    resp = await client.chat.completions.create(
        model="tourbox-vision",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                    {
                        "type": "text",
                        "text": (
                            "This is a rough sketch. In one short noun phrase, what does it depict? "
                            "Reply with only the phrase."
                        ),
                    },
                ],
            }
        ],
        max_tokens=40,
        temperature=0.2,
    )
    caption = (resp.choices[0].message.content or "").strip().strip('"').strip("'").rstrip(".")
    return caption or "a sketch"


def _decode_data_url(data_url: str) -> tuple[bytes, str]:
    m = DATA_URL_RE.match(data_url)
    if not m:
        raise ClusterFaithfulError("image must be a base64 data URL for the Faithful pipeline")
    fmt = (m.group(1) or "png").lower()
    if fmt == "jpeg":
        fmt = "jpg"
    raw = base64.b64decode(m.group(2))
    return raw, fmt


async def _upload_to_comfy(client: httpx.AsyncClient, image_bytes: bytes, ext: str) -> str:
    filename = f"tourbox_faithful_{int(time.time()*1000)}_{random.randint(1000,9999)}.{ext}"
    files = {
        "image": (filename, image_bytes, f"image/{ext if ext != 'jpg' else 'jpeg'}"),
        "type": (None, "input"),
    }
    r = await client.post(f"{COMFY_URL}/upload/image", files=files, timeout=60.0)
    if r.status_code != 200:
        raise ClusterFaithfulError(f"/upload/image failed: {r.status_code} {r.text[:300]}")
    return r.json()["name"]


def _build_workflow(
    uploaded_filename: str,
    positive_prompt: str,
    seed: int,
    width: int = 1024,
    height: int = 1024,
    cn_strength: float = 0.7,
    cn_end: float = 0.7,
    steps: int = 20,
) -> dict:
    return {
        "1": {"class_type": "LoadImage", "inputs": {"image": uploaded_filename, "upload": "image"}},
        "2": {"class_type": "Canny", "inputs": {"image": ["1", 0], "low_threshold": 0.1, "high_threshold": 0.3}},
        "3": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux1-dev-fp8.safetensors", "weight_dtype": "fp8_e4m3fn"}},
        "4": {"class_type": "DualCLIPLoader", "inputs": {
            "clip_name1": "t5xxl_fp8_e4m3fn.safetensors",
            "clip_name2": "clip_l.safetensors",
            "type": "flux",
        }},
        "5": {"class_type": "VAELoader", "inputs": {"vae_name": "flux-ae.safetensors"}},
        "6": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": "flux-union-pro-2.safetensors"}},
        "7": {"class_type": "SetUnionControlNetType", "inputs": {
            "control_net": ["6", 0],
            "type": "canny/lineart/anime_lineart/mlsd",
        }},
        "8": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 0], "text": positive_prompt}},
        "9": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 0], "text": ""}},
        "10": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["8", 0], "guidance": 3.5}},
        "11": {"class_type": "ControlNetApplyAdvanced", "inputs": {
            "positive": ["10", 0], "negative": ["9", 0], "control_net": ["7", 0],
            "image": ["2", 0], "strength": cn_strength,
            "start_percent": 0.0, "end_percent": cn_end, "vae": ["5", 0],
        }},
        "12": {"class_type": "EmptySD3LatentImage", "inputs": {
            "width": width, "height": height, "batch_size": 1,
        }},
        "13": {"class_type": "KSampler", "inputs": {
            "model": ["3", 0],
            "positive": ["11", 0],
            "negative": ["11", 1],
            "latent_image": ["12", 0],
            "seed": seed,
            "steps": steps,
            "cfg": 1.0,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 1.0,
        }},
        "14": {"class_type": "VAEDecode", "inputs": {"samples": ["13", 0], "vae": ["5", 0]}},
        "15": {"class_type": "SaveImage", "inputs": {
            "images": ["14", 0], "filename_prefix": "tourbox_faithful",
        }},
    }


async def _submit(client: httpx.AsyncClient, workflow: dict) -> str:
    body = {"prompt": workflow, "client_id": "tourbox-pi-faithful"}
    r = await client.post(f"{COMFY_URL}/prompt", json=body, timeout=30.0)
    if r.status_code != 200:
        raise ClusterFaithfulError(f"submit failed: {r.status_code} {r.text[:300]}")
    pid = r.json().get("prompt_id")
    if not pid:
        raise ClusterFaithfulError(f"no prompt_id in response: {r.text[:200]}")
    return pid


async def _poll_until_done(client: httpx.AsyncClient, prompt_id: str) -> list[dict]:
    deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT_S
    while asyncio.get_event_loop().time() < deadline:
        await asyncio.sleep(POLL_INTERVAL_S)
        r = await client.get(f"{COMFY_URL}/history/{prompt_id}", timeout=15.0)
        if r.status_code != 200:
            continue
        hist = r.json().get(prompt_id)
        if not hist:
            continue
        status = (hist.get("status") or {}).get("status_str")
        if status == "error":
            msgs = (hist.get("status") or {}).get("messages") or []
            tail = "; ".join(repr(m)[:200] for m in msgs[-3:])
            raise ClusterFaithfulError(f"ComfyUI error: {tail}")
        outputs = hist.get("outputs") or {}
        for _, node_out in outputs.items():
            images = node_out.get("images")
            if images:
                return images
    raise ClusterFaithfulError(f"poll timed out after {POLL_TIMEOUT_S}s (prompt_id={prompt_id})")


async def _fetch_image_data_url(client: httpx.AsyncClient, image_info: dict) -> str:
    params = {
        "filename": image_info["filename"],
        "subfolder": image_info.get("subfolder", ""),
        "type": image_info.get("type", "output"),
    }
    r = await client.get(f"{COMFY_URL}/view", params=params, timeout=30.0)
    if r.status_code != 200:
        raise ClusterFaithfulError(f"fetch /view failed: {r.status_code}")
    mime = r.headers.get("content-type", "image/png")
    encoded = base64.b64encode(r.content).decode("ascii")
    return f"data:{mime};base64,{encoded}"


async def polish_sketch_cluster_faithful(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Faithful sketch-to-image: preserves the user's lines via Canny + ControlNet."""
    started = time.time()
    # Cap input at 1024px so ComfyUI's Canny + Flux dev stay within VRAM.
    image_payload = downscale_data_url(base_image, max_edge=1024)
    image_bytes, ext = _decode_data_url(image_payload)

    caption = (custom_prompt or "").strip() or await _caption(image_payload)
    style_suffix = STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]
    positive = f"{caption}, {style_suffix}, masterpiece, high quality"

    n = max(1, min(n, 4))
    image_urls: list[str] = []
    async with proxy_aware_client() as client:
        uploaded = await _upload_to_comfy(client, image_bytes, ext)
        for i in range(n):
            seed = random.randint(1, 2**31 - 1)
            wf = _build_workflow(uploaded, positive, seed=seed)
            prompt_id = await _submit(client, wf)
            images = await _poll_until_done(client, prompt_id)
            for img in images:
                image_urls.append(await _fetch_image_data_url(client, img))

    return {
        "images": image_urls,
        "style": style,
        "prompt": positive,
        "caption": caption,
        "model": "flux-dev-fp8+union-pro-2+canny",
        "task_id": f"cluster-faithful-{int(started)}",
        "elapsed": round(time.time() - started, 2),
    }


def _reset_client():
    global _client
    _client = None
from ..proxy_state import register_invalidator  # noqa: E402
register_invalidator(_reset_client)


def _reset_vision_client():
    global _vision_client
    _vision_client = None
try:
    from ..proxy_state import register_invalidator as _reg_v  # noqa: E402
    _reg_v(_reset_vision_client)
except Exception: pass
