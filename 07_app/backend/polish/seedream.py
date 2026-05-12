"""Polish via ByteDance Seedream 5.0 (sketch-to-image).

Synchronous unlike Wanxiang: response carries the generated image URL
directly, no task_id polling. ~3-6s wall time for a 2K image.

Docs region used: BytePlus Ap-Southeast (international). Endpoint and key
both live in the Pi `.env` so we can swap regions without code changes.
"""

from __future__ import annotations

import os

import httpx
from ..upstream_client import upstream_url, proxy_aware_client

from .wanxiang import STYLE_PROMPTS

DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3"
DEFAULT_MODEL = "seedream-5-0-260128"
PATH = "/images/generations"

TIMEOUT_S = 90.0


class SeedreamError(RuntimeError):
    pass


async def polish_sketch_seedream(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Generate one polished image from a sketch using Seedream 5.0.

    base_image: data URL ("data:image/png;base64,...") OR public http URL.
    """
    key = os.environ.get("BYTEPLUS_API_KEY")
    if not key:
        raise SeedreamError("missing BYTEPLUS_API_KEY env var")

    base = os.environ.get("BYTEPLUS_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    model = os.environ.get("SEEDREAM_MODEL", DEFAULT_MODEL)
    prompt = (custom_prompt or STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]).strip()

    body = {
        "model": model,
        "prompt": prompt,
        "image": base_image,
        "sequential_image_generation": "disabled",
        "response_format": "url",
        "size": "2k",
        "stream": False,
        "watermark": False,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    async with proxy_aware_client(timeout=TIMEOUT_S) as client:
        r = await client.post(f"{base}{PATH}", headers=headers, json=body)

    if r.status_code != 200:
        msg = r.text[:300]
        try:
            err = r.json().get("error") or {}
            if isinstance(err, dict) and err.get("message"):
                msg = err["message"]
        except Exception:
            pass
        raise SeedreamError(f"HTTP {r.status_code}: {msg}")

    data = (r.json().get("data") or [])
    images = [d.get("url") for d in data if isinstance(d, dict) and d.get("url")]
    if not images:
        raise SeedreamError(f"no image url in response: {str(r.json())[:200]}")

    return {
        "images": images,
        "style": style,
        "prompt": prompt,
        "provider": "seedream",
        "model": model,
    }
