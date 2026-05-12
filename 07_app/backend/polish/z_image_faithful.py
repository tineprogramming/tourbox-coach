"""Polish via Z-Image Turbo + ControlNet on fal.ai (Alibaba, sketch-faithful).

Same Z-Image Turbo backbone as the reimagine module, but uses the ControlNet
variant at fal-ai/z-image/turbo/controlnet which accepts the sketch as
`image_url` and preserves its lines. Strong open-weight competitor to
Flux dev + ControlNet but cloud-hosted (no cluster GPU needed).

Pricing: per-image at fal.ai. Speed: ~5-6s (much faster than Cluster ·
Faithful's 25s because the model is distilled to 4-step inference).
"""

from __future__ import annotations

import os
import time

import httpx

from ..upstream_client import upstream_url, proxy_aware_client  # noqa: E402
from .wanxiang import STYLE_PROMPTS

DEFAULT_BASE_URL = "https://fal.run"
DEFAULT_MODEL_PATH = "fal-ai/z-image/turbo/controlnet"
TIMEOUT_S = 120.0


class ZImageFaithfulError(RuntimeError):
    pass


async def polish_sketch_z_image_faithful(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Z-Image Turbo with ControlNet: preserves sketch composition."""
    key = os.environ.get("FAL_KEY")
    if not key:
        raise ZImageFaithfulError("missing FAL_KEY env var")

    base = os.environ.get("FAL_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    path = os.environ.get("Z_IMAGE_CONTROLNET_MODEL", DEFAULT_MODEL_PATH).strip("/")
    style_suffix = STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]
    user_prompt = (custom_prompt or "").strip()
    prompt = (
        f"{user_prompt}, {style_suffix}, masterpiece, high quality"
        if user_prompt
        else f"{style_suffix}, masterpiece, high quality"
    )

    body = {
        "prompt": prompt,
        "image_url": base_image,
        "num_images": max(1, min(n, 4)),
        "output_format": "png",
    }
    headers = {
        "Authorization": f"Key {key}",
        "Content-Type": "application/json",
    }

    started = time.time()
    async with proxy_aware_client(timeout=TIMEOUT_S) as client:
        r = await client.post(f"{base}/{path}", headers=headers, json=body)

    if r.status_code != 200:
        msg = r.text[:400]
        try:
            err = r.json()
            if isinstance(err, dict) and "detail" in err:
                msg = err["detail"] if isinstance(err["detail"], str) else str(err["detail"])[:400]
        except Exception:
            pass
        raise ZImageFaithfulError(f"HTTP {r.status_code}: {msg}")

    j = r.json()
    images = j.get("images") or []
    urls = [img.get("url") for img in images if isinstance(img, dict) and img.get("url")]
    if not urls:
        raise ZImageFaithfulError(f"no image url in response: {str(j)[:200]}")

    return {
        "images": urls,
        "style": style,
        "prompt": prompt,
        "provider": "z-image-faithful",
        "model": path,
        "elapsed": round(time.time() - started, 2),
    }
