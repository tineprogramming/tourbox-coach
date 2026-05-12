"""OpenAI GPT-4o vision provider for /vision and /vision/grounded.

Uses the chat.completions API with image_url content blocks — same shape as
the cluster Qwen3-VL, so the JSON-bbox grounding prompt works out of the box.

The model is multimodal-native and very good at structured output, so the
<regions>JSON</regions> parser from vision/cluster.py is reused unchanged.
"""

from __future__ import annotations

import base64
import io
import os
import time

from openai import AsyncOpenAI

from ..upstream_client import make_openai_client  # noqa: E402
from PIL import Image


# Reuse the same parser + structural prompt from the cluster module to keep
# grounded responses consistent across providers.
from .cluster import DEFAULT_PROMPT, GROUNDED_PROMPT, LANG_LABEL, _parse_grounded_reply

DEFAULT_MODEL = "gpt-4o"


class VisionOpenAIError(RuntimeError):
    pass


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise VisionOpenAIError("missing OPENAI_API_KEY env var")
        _client = make_openai_client(api_key=key)
    return _client


def _measure(data_url_or_http: str) -> tuple[int, int] | None:
    if not data_url_or_http.startswith("data:image/"):
        return None
    try:
        _, b64 = data_url_or_http.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        return img.width, img.height
    except Exception:
        return None


async def ask_vision_openai(image_data_url: str, prompt: str = "", lang: str = "en") -> dict:
    client = _get_client()
    started = time.time()
    base = (prompt or "").strip() or DEFAULT_PROMPT
    question = f"{base}\n\nReply in {LANG_LABEL.get(lang, 'English')}."
    try:
        resp = await client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                        {"type": "text", "text": question},
                    ],
                }
            ],
            max_tokens=200,
            temperature=0.5,
        )
    except Exception as e:
        raise VisionOpenAIError(str(e)) from e
    return {
        "reply": (resp.choices[0].message.content or "").strip(),
        "model": f"OpenAI {DEFAULT_MODEL}",
        "prompt": question,
        "elapsed": round(time.time() - started, 2),
    }


async def ask_vision_openai_grounded(image_data_url: str, prompt: str = "", lang: str = "en") -> dict:
    client = _get_client()
    started = time.time()
    user_prefix = (prompt or "").strip()
    label_dir = LANG_LABEL.get(lang, "English")
    lang_block = (
        f"\n\nReply in {label_dir}. The region 'label' values must also be in {label_dir}."
    )
    if user_prefix:
        question = f"{user_prefix}\n\n{GROUNDED_PROMPT}{lang_block}"
    else:
        question = f"{GROUNDED_PROMPT}{lang_block}"

    dims = _measure(image_data_url)
    try:
        resp = await client.chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                        {"type": "text", "text": question},
                    ],
                }
            ],
            max_tokens=500,
            temperature=0.3,
        )
    except Exception as e:
        raise VisionOpenAIError(str(e)) from e

    raw = (resp.choices[0].message.content or "").strip()
    clean_reply, regions = _parse_grounded_reply(raw)
    return {
        "reply": clean_reply,
        "regions": regions,
        "image_width": dims[0] if dims else None,
        "image_height": dims[1] if dims else None,
        "model": f"OpenAI {DEFAULT_MODEL}",
        "prompt": question,
        "elapsed": round(time.time() - started, 2),
    }


def _reset_client():
    global _client
    _client = None
from ..proxy_state import register_invalidator  # noqa: E402
register_invalidator(_reset_client)
