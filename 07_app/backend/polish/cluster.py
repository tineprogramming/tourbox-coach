"""Polish via our 4090 cluster.

Pipeline: sketch → Qwen3-VL (caption) → Flux.1 schnell (text-to-image).

This is *vision-captioned* polish — different from Wanxiang/Seedream which
do pixel-level sketch-to-image. The cluster sees the sketch, describes what
it depicts, and reimagines it in the chosen style. Result preserves the
*idea* of the sketch, not its lines.

Why this design: ComfyUI on the cluster has no Flux ControlNet installed
yet, so a true Canny/img2img path isn't available. Captioning is the
cleanest workaround using what's deployed, and it makes the polish output
materially different from the cloud providers (a feature, not a bug — users
get a creative reimagine option alongside the literal-translation cloud
options).
"""

from __future__ import annotations

import asyncio
import base64
import os
import random
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

POLL_INTERVAL_S = 1.0
POLL_TIMEOUT_S = 180.0  # cold-load Flux can take 80s on first request


class ClusterPolishError(RuntimeError):
    pass


_vision_client: AsyncOpenAI | None = None


def _get_vision_client() -> AsyncOpenAI:
    global _vision_client
    if _vision_client is None:
        _vision_client = make_openai_client(api_key="cluster", base_url=VISION_URL)
    return _vision_client


async def caption_sketch(image_data_url: str) -> str:
    """Ask Qwen3-VL to describe what the sketch depicts."""
    client = _get_vision_client()
    image_payload = downscale_data_url(image_data_url)
    resp = await client.chat.completions.create(
        model="tourbox-vision",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_payload}},
                    {
                        "type": "text",
                        "text": (
                            "This is a rough sketch by a beginner. Describe what the drawing "
                            "depicts in one short noun phrase (e.g. 'a cat sitting by a window'). "
                            "Be generous — interpret unclear lines charitably. Reply with only "
                            "the noun phrase, no preamble."
                        ),
                    },
                ],
            }
        ],
        max_tokens=60,
        temperature=0.3,
    )
    caption = (resp.choices[0].message.content or "").strip()
    # Strip wrapping quotes/punctuation the model sometimes adds.
    caption = caption.strip('"').strip("'").rstrip(".")
    return caption or "an abstract drawing"


def _build_flux_workflow(prompt: str, seed: int, width: int = 1024, height: int = 1024) -> dict:
    """ComfyUI API workflow: Flux.1 schnell text-to-image, 4 steps."""
    return {
        "5": {
            "class_type": "EmptySD3LatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["11", 0], "text": prompt},
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["13", 0], "vae": ["10", 0]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"images": ["8", 0], "filename_prefix": "tourbox_cluster"},
        },
        "10": {
            "class_type": "VAELoader",
            "inputs": {"vae_name": "flux-ae.safetensors"},
        },
        "11": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": "t5xxl_fp8_e4m3fn.safetensors",
                "clip_name2": "clip_l.safetensors",
                "type": "flux",
            },
        },
        "12": {
            "class_type": "UNETLoader",
            "inputs": {
                "unet_name": "flux1-schnell.safetensors",
                "weight_dtype": "fp8_e4m3fn",
            },
        },
        "13": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["12", 0],
                "positive": ["6", 0],
                "negative": ["33", 0],
                "latent_image": ["5", 0],
                "seed": seed,
                "steps": 4,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0,
            },
        },
        "33": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["11", 0], "text": ""},
        },
    }


async def _submit_workflow(client: httpx.AsyncClient, workflow: dict) -> str:
    body = {"prompt": workflow, "client_id": "tourbox-pi"}
    r = await client.post(f"{COMFY_URL}/prompt", json=body, timeout=30.0)
    if r.status_code != 200:
        raise ClusterPolishError(f"submit /prompt failed: {r.status_code} {r.text[:300]}")
    data = r.json()
    prompt_id = data.get("prompt_id")
    if not prompt_id:
        raise ClusterPolishError(f"no prompt_id in response: {data}")
    return prompt_id


async def _poll_until_done(client: httpx.AsyncClient, prompt_id: str) -> list[dict]:
    """Returns list of {filename, subfolder, type} from the SaveImage node."""
    deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT_S
    while asyncio.get_event_loop().time() < deadline:
        await asyncio.sleep(POLL_INTERVAL_S)
        r = await client.get(f"{COMFY_URL}/history/{prompt_id}", timeout=15.0)
        if r.status_code != 200:
            continue
        history = r.json().get(prompt_id)
        if not history:
            continue
        status = (history.get("status") or {})
        if status.get("status_str") == "error":
            raise ClusterPolishError(f"ComfyUI error: {status}")
        outputs = history.get("outputs") or {}
        # Find images under any output node (we used "9" = SaveImage).
        for node_id, node_out in outputs.items():
            images = node_out.get("images")
            if images:
                return images
    raise ClusterPolishError(f"poll timed out after {POLL_TIMEOUT_S}s (prompt_id={prompt_id})")


async def _fetch_image_data_url(client: httpx.AsyncClient, image_info: dict) -> str:
    params = {
        "filename": image_info["filename"],
        "subfolder": image_info.get("subfolder", ""),
        "type": image_info.get("type", "output"),
    }
    r = await client.get(f"{COMFY_URL}/view", params=params, timeout=30.0)
    if r.status_code != 200:
        raise ClusterPolishError(f"fetch /view failed: {r.status_code}")
    mime = r.headers.get("content-type", "image/png")
    encoded = base64.b64encode(r.content).decode("ascii")
    return f"data:{mime};base64,{encoded}"


async def polish_sketch_cluster(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """End-to-end: caption sketch → Flux schnell t2i → return data URLs.

    Matches Wanxiang's return shape so PolishModal renders identically.
    """
    started = time.time()
    caption = await caption_sketch(base_image)
    style_suffix = (STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"])
    full_prompt = f"{caption}, {style_suffix}, masterpiece, high quality"
    if custom_prompt:
        full_prompt = f"{custom_prompt.strip()}, {full_prompt}"

    seed = random.randint(1, 2**31 - 1)
    workflow = _build_flux_workflow(full_prompt, seed=seed)

    # We may need to submit multiple times for n>1; cap at 4 like Wanxiang.
    n = max(1, min(n, 4))
    image_urls: list[str] = []
    async with proxy_aware_client() as client:
        for i in range(n):
            wf = workflow if i == 0 else _build_flux_workflow(full_prompt, seed=seed + i)
            prompt_id = await _submit_workflow(client, wf)
            images = await _poll_until_done(client, prompt_id)
            for img in images:
                data_url = await _fetch_image_data_url(client, img)
                image_urls.append(data_url)

    return {
        "images": image_urls,
        "style": style,
        "prompt": full_prompt,
        "caption": caption,
        "model": "flux-schnell+qwen3-vl",
        "task_id": f"cluster-{int(started)}",
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
