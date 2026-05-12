"""Polish via Google's Nano Banana 2 on fal.ai (international image edit).

Nano Banana 2 is Google's image-editing model (Gemini image gen lineage).
Hosted on fal.ai under fal-ai/nano-banana-2/edit. Takes an input image +
prompt, returns the edited image. Same fal.ai auth pattern as Flux Kontext.

Why offer this alongside Flux Kontext + OpenAI gpt-image-1: three different
international stacks for direct comparison — Google (Nano Banana), Black
Forest Labs (Flux), OpenAI (autoregressive). Aesthetic differences are
visible to users.

Docs: https://fal.ai/models/fal-ai/nano-banana-2/edit
"""

from __future__ import annotations

import os

import httpx

from ..upstream_client import upstream_url, proxy_aware_client  # noqa: E402
from .wanxiang import STYLE_PROMPTS

DEFAULT_BASE_URL = "https://fal.run"
DEFAULT_MODEL_PATH = "fal-ai/nano-banana-2/edit"

TIMEOUT_S = 120.0


class NanoBananaError(RuntimeError):
    pass


async def polish_sketch_nano_banana(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Edit a sketch via Google Nano Banana 2 on fal.ai.

    base_image: data URL OR public http URL.
    """
    key = os.environ.get("FAL_KEY")
    if not key:
        raise NanoBananaError("missing FAL_KEY env var")

    base = os.environ.get("FAL_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    path = os.environ.get("NANO_BANANA_MODEL", DEFAULT_MODEL_PATH).strip("/")
    style_suffix = STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]
    user_prompt = (custom_prompt or "").strip()
    prompt = (
        f"{user_prompt}, transformed into {style_suffix}, preserving the original composition"
        if user_prompt
        else f"Transform this sketch into {style_suffix}. Preserve the composition and subjects."
    )

    body = {
        "prompt": prompt,
        # Nano Banana 2 accepts an array of reference images.
        "image_urls": [base_image],
        "num_images": max(1, min(n, 4)),
        "output_format": "png",
    }
    headers = {
        "Authorization": f"Key {key}",
        "Content-Type": "application/json",
    }

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
        raise NanoBananaError(f"HTTP {r.status_code}: {msg}")

    j = r.json()
    images = j.get("images") or []
    urls = [img.get("url") for img in images if isinstance(img, dict) and img.get("url")]
    if not urls:
        raise NanoBananaError(f"no image url in response: {str(j)[:200]}")

    return {
        "images": urls,
        "style": style,
        "prompt": prompt,
        "provider": "nano-banana",
        "model": path,
    }
