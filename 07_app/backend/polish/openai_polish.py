"""OpenAI gpt-image-1 polish provider.

Uses OpenAI's images.edit endpoint — accepts the sketch as input image and a
text prompt; returns a new image guided by the sketch. This is OpenAI's
autoregressive image model (different architecture from the diffusion stack
in Wanxiang/Seedream/Flux), so the aesthetic is recognizably distinct —
which is exactly why we offer it for side-by-side comparison.

Latency: ~20-40s. Cost: per-image, billed against the OpenAI API key.
"""

from __future__ import annotations

import base64
import io
import os
import re
import time

from openai import AsyncOpenAI
from ..upstream_client import make_openai_client  # noqa: E402

STYLE_PROMPTS: dict[str, str] = {
    "watercolor": "watercolor painting, soft pastel washes, artistic, fine details",
    "anime": "anime style illustration, vibrant clean colors, crisp linework",
    "oil_painting": "oil painting, thick textured brush strokes, dramatic lighting",
    "pencil_sketch": "detailed pencil drawing, fine hatching, monochrome shading",
    "concept_art": "professional concept art, cinematic, painterly, atmospheric",
    "ink_wash": "Chinese ink wash painting, sumi-e, expressive minimal strokes",
    "realistic": "photorealistic, hyperdetailed, professional photography, natural lighting, sharp focus, 8k uhd",
}

DATA_URL_RE = re.compile(r"^data:image/([a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)


class OpenAIPolishError(RuntimeError):
    pass


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise OpenAIPolishError("missing OPENAI_API_KEY env var")
        _client = make_openai_client(api_key=key)
    return _client


def _decode_data_url(data_url: str) -> tuple[bytes, str]:
    m = DATA_URL_RE.match(data_url)
    if not m:
        raise OpenAIPolishError("image must be a base64 data URL")
    fmt = (m.group(1) or "png").lower()
    if fmt == "jpeg":
        fmt = "jpg"
    return base64.b64decode(m.group(2)), fmt


async def polish_sketch_openai(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """OpenAI gpt-image-1 image edit. The sketch is the structure reference;
    the model paints over it in the requested style."""
    started = time.time()
    client = _get_client()
    raw, ext = _decode_data_url(base_image)

    style_suffix = STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]
    prompt = (custom_prompt or "").strip()
    full_prompt = (
        f"{prompt}, transformed into {style_suffix}, preserving the original composition and layout, high quality"
        if prompt
        else f"Transform this sketch into {style_suffix}. Preserve the original composition, subjects, and layout. High quality, polished result."
    )

    # OpenAI SDK takes a file-like object for the image.
    image_file = io.BytesIO(raw)
    image_file.name = f"sketch.{ext if ext != 'jpg' else 'png'}"

    n = max(1, min(n, 4))
    try:
        resp = await client.images.edit(
            model="gpt-image-1",
            image=image_file,
            prompt=full_prompt,
            n=n,
            size="1024x1024",
        )
    except Exception as e:
        raise OpenAIPolishError(str(e)) from e

    image_urls: list[str] = []
    for item in resp.data or []:
        if item.b64_json:
            image_urls.append(f"data:image/png;base64,{item.b64_json}")
        elif item.url:
            image_urls.append(item.url)

    if not image_urls:
        raise OpenAIPolishError("OpenAI returned no images")

    return {
        "images": image_urls,
        "style": style,
        "prompt": full_prompt,
        "model": "gpt-image-1",
        "task_id": f"openai-{int(started)}",
        "elapsed": round(time.time() - started, 2),
    }


def _reset_client():
    global _client
    _client = None
from ..proxy_state import register_invalidator  # noqa: E402
register_invalidator(_reset_client)
