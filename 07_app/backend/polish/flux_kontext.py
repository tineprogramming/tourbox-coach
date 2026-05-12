"""Polish via Flux.1 Kontext Pro on fal.ai (international sketch-to-image).

Flux Kontext is Black Forest Labs' image-editing model — takes an input
image + instruction, transforms while preserving structure. Perfect for
"polished version of this sketch in style X".

Pricing: ~$0.04/image. Speed: ~5-10s. Quality: industry-leading 2026.

Auth pattern is fal.ai-specific: `Authorization: Key <uuid>:<secret>` (not
the OpenAI `Bearer` pattern). Endpoint is sync (returns the image URL in
the response, no polling).

Docs: https://fal.ai/models/fal-ai/flux-pro/kontext
"""

from __future__ import annotations

import os

import httpx

from ..upstream_client import upstream_url, proxy_aware_client  # noqa: E402
from .wanxiang import STYLE_PROMPTS

DEFAULT_BASE_URL = "https://fal.run"
DEFAULT_MODEL_PATH = "fal-ai/flux-pro/kontext"

TIMEOUT_S = 90.0


class FluxKontextError(RuntimeError):
    pass


async def polish_sketch_flux_kontext(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Generate a polished image from a sketch via Flux Kontext Pro.

    base_image: data URL ("data:image/png;base64,...") OR public http URL.
    """
    key = os.environ.get("FAL_KEY")
    if not key:
        raise FluxKontextError("missing FAL_KEY env var")

    base = os.environ.get("FAL_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    path = os.environ.get("FLUX_KONTEXT_MODEL", DEFAULT_MODEL_PATH).strip("/")
    prompt = (custom_prompt or STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]).strip()

    body = {
        "prompt": prompt,
        "image_url": base_image,
        "num_images": max(1, min(n, 4)),
        "safety_tolerance": "5",
        "output_format": "png",
    }
    headers = {
        "Authorization": f"Key {key}",
        "Content-Type": "application/json",
    }

    async with proxy_aware_client(timeout=TIMEOUT_S) as client:
        r = await client.post(f"{base}/{path}", headers=headers, json=body)

    if r.status_code != 200:
        msg = r.text[:300]
        try:
            err = r.json()
            if isinstance(err, dict) and "detail" in err:
                msg = err["detail"] if isinstance(err["detail"], str) else str(err["detail"])[:300]
        except Exception:
            pass
        raise FluxKontextError(f"HTTP {r.status_code}: {msg}")

    j = r.json()
    images = j.get("images") or []
    urls = [img.get("url") for img in images if isinstance(img, dict) and img.get("url")]
    if not urls:
        raise FluxKontextError(f"no image url in response: {str(j)[:200]}")

    return {
        "images": urls,
        "style": style,
        "prompt": prompt,
        "provider": "flux-kontext",
        "model": path,
    }
