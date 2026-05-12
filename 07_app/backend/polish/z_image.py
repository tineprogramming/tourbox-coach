"""Polish via Alibaba's Z-Image Turbo on fal.ai.

Z-Image Turbo is Tongyi Lab's (Alibaba research) fast distilled image
generation model. Open-weight Apache 2.0, ~0.6s pure inference (fal.ai
endpoint adds queue + transport so wall-clock is ~2-4s).

Caveat: Z-Image Turbo is **text-to-image only** at the fal.ai endpoint —
no image_url input parameter. So this provider runs in "reimagine" mode:
sketch → vision caption (Qwen3-VL on our cluster) → text → z-image-turbo.

Why offer it: very different lineage from Flux schnell (which our cluster
reimagine uses) — gives a side-by-side of "Chinese open research" (Z-Image)
vs "German closed weights" (Flux).
"""

from __future__ import annotations

import os
import time

import httpx
from openai import AsyncOpenAI

from ..upstream_client import make_openai_client, upstream_url, proxy_aware_client  # noqa: E402

from ..image_utils import downscale_data_url
from .wanxiang import STYLE_PROMPTS

CLUSTER_BASE = os.environ.get("CLUSTER_BASE_URL", "https://tinebritania.tinestuff.com/tourbox")
VISION_URL = f"{CLUSTER_BASE}/vision/v1"

FAL_BASE = os.environ.get("FAL_BASE_URL", "https://fal.run").rstrip("/")
FAL_MODEL_PATH = os.environ.get("Z_IMAGE_MODEL", "fal-ai/z-image/turbo").strip("/")
TIMEOUT_S = 60.0


class ZImageError(RuntimeError):
    pass


_vision_client: AsyncOpenAI | None = None


def _get_vision_client() -> AsyncOpenAI:
    global _vision_client
    if _vision_client is None:
        _vision_client = make_openai_client(api_key="cluster", base_url=VISION_URL)
    return _vision_client


async def _caption(image_data_url: str) -> str:
    """Qwen3-VL captions the sketch in one short noun phrase."""
    client = _get_vision_client()
    payload = downscale_data_url(image_data_url, max_edge=1024)
    resp = await client.chat.completions.create(
        model="tourbox-vision",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": payload}},
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
    return caption or "an abstract drawing"


async def polish_sketch_z_image(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Sketch → caption → Z-Image Turbo text-to-image."""
    key = os.environ.get("FAL_KEY")
    if not key:
        raise ZImageError("missing FAL_KEY env var")

    started = time.time()
    caption = (custom_prompt or "").strip() or await _caption(base_image)
    style_suffix = STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]
    full_prompt = f"{caption}, {style_suffix}, masterpiece, high quality"

    body = {
        "prompt": full_prompt,
        "num_images": max(1, min(n, 4)),
        "output_format": "png",
    }
    headers = {
        "Authorization": f"Key {key}",
        "Content-Type": "application/json",
    }

    async with proxy_aware_client(timeout=TIMEOUT_S) as client:
        r = await client.post(f"{FAL_BASE}/{FAL_MODEL_PATH}", headers=headers, json=body)

    if r.status_code != 200:
        msg = r.text[:300]
        try:
            err = r.json()
            if isinstance(err, dict) and "detail" in err:
                msg = err["detail"] if isinstance(err["detail"], str) else str(err["detail"])[:300]
        except Exception:
            pass
        raise ZImageError(f"HTTP {r.status_code}: {msg}")

    j = r.json()
    images = j.get("images") or []
    urls = [img.get("url") for img in images if isinstance(img, dict) and img.get("url")]
    if not urls:
        raise ZImageError(f"no image url in response: {str(j)[:200]}")

    return {
        "images": urls,
        "style": style,
        "prompt": full_prompt,
        "caption": caption,
        "provider": "z-image",
        "model": FAL_MODEL_PATH,
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
