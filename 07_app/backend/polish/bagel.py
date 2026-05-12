"""Polish via ByteDance-Seed's Bagel on fal.ai (open-weight sketch-to-image).

Bagel is ByteDance's 7B unified multimodal autoregressive model — same
spiritual lineage as Seedream + Nano Banana (autoregressive) but
Apache 2.0 open-weight. fal.ai hosts it at fal-ai/bagel/edit for image
editing with text instructions.

Why offer this alongside Seedream: shows ByteDance's open-research side
next to their closed production model — same vendor, two licensing
philosophies side by side. Demo value is the contrast.
"""

from __future__ import annotations

import os
import time

import httpx

from ..upstream_client import upstream_url, proxy_aware_client  # noqa: E402
from .wanxiang import STYLE_PROMPTS

DEFAULT_BASE_URL = "https://fal.run"
DEFAULT_MODEL_PATH = "fal-ai/bagel/edit"
TIMEOUT_S = 300.0  # Bagel cold-start can take 2-3 min on fal.ai


class BagelError(RuntimeError):
    pass


async def polish_sketch_bagel(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Bagel image edit: sketch + text instruction → polished image."""
    key = os.environ.get("FAL_KEY")
    if not key:
        raise BagelError("missing FAL_KEY env var")

    # Bagel (and most fal.ai models) timeout / 500 on very large images.
    # Cap at 1024px — Bagel is an edit model that doesn't need full resolution.

    base = os.environ.get("FAL_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    path = os.environ.get("BAGEL_MODEL", DEFAULT_MODEL_PATH).strip("/")
    style_suffix = STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]
    user_prompt = (custom_prompt or "").strip()
    prompt = (
        f"{user_prompt}, transform into {style_suffix}, preserving the composition"
        if user_prompt
        else f"Transform this sketch into {style_suffix}. Preserve the composition and subjects."
    )

    body = {
        "prompt": prompt,
        "image_url": base_image,
        "num_images": max(1, min(n, 4)),
    }
    headers = {
        "Authorization": f"Key {key}",
        "Content-Type": "application/json",
    }

    import httpx as _httpx
    started = time.time()
    try:
        async with proxy_aware_client(timeout=TIMEOUT_S) as client:
            r = await client.post(f"{base}/{path}", headers=headers, json=body)
    except _httpx.TimeoutException:
        elapsed = round(time.time() - started, 1)
        raise BagelError(
            f"Bagel timed out after {elapsed}s — fal.ai is cold-starting the model. "
            "Try again in 30s; subsequent calls will be faster."
        )
    except _httpx.HTTPError as e:
        raise BagelError(f"Request failed: {e}")

    if r.status_code != 200:
        msg = r.text[:400]
        try:
            err = r.json()
            if isinstance(err, dict) and "detail" in err:
                msg = err["detail"] if isinstance(err["detail"], str) else str(err["detail"])[:400]
        except Exception:
            pass
        raise BagelError(f"HTTP {r.status_code}: {msg}")

    j = r.json()
    images = j.get("images") or []
    urls = [img.get("url") for img in images if isinstance(img, dict) and img.get("url")]
    if not urls:
        raise BagelError(f"no image url in response: {str(j)[:200]}")

    return {
        "images": urls,
        "style": style,
        "prompt": prompt,
        "provider": "bagel",
        "model": path,
        "elapsed": round(time.time() - started, 2),
    }
