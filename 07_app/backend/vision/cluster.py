"""Vision-as-a-coach: ask Qwen3-VL on our cluster to look at the canvas
and answer a free-form question about it.

The vision endpoint takes a base64 data URL (or http URL) plus a question.
It returns the model's response — no streaming for now since vision answers
are short (1-3 sentences) and the round-trip via cluster is fast (~2s).

For per-stroke coaching we still use the coach module (text-only, faster,
streamed). Vision is the 'look at my whole drawing' tool.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import time

from openai import AsyncOpenAI

from ..upstream_client import make_openai_client  # noqa: E402
from PIL import Image


CLUSTER_BASE = os.environ.get("CLUSTER_BASE_URL", "https://tinebritania.tinestuff.com/tourbox")
VISION_URL = f"{CLUSTER_BASE}/vision/v1"

DEFAULT_PROMPT = (
    "Look at this beginner's drawing. In 1–2 sentences: what do you see, and "
    "what's one concrete tip to make it better? Be warm and specific."
)

# Two-part prompt: first ask for a coach-style reply, then for grounded
# regions so the frontend can highlight each element on the sketch on hover.
# Qwen3-VL responds with pixel coordinates in the SAME coordinate space as
# the image we send — so we capture the image dims after downscale.
GROUNDED_PROMPT = """First, look at this beginner's drawing. In 1 short sentence, what do you see and one concrete tip to improve?

Then, identify the distinct visual elements you mentioned. Return them as a JSON array between <regions> and </regions> tags, like:
<regions>
[
  {"label": "short name", "bbox": [x1, y1, x2, y2]}
]
</regions>
Coordinates are pixels with origin at top-left. Reply with the sentence first, then the <regions> block — nothing else."""

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = make_openai_client(api_key="cluster", base_url=VISION_URL)
    return _client


class VisionError(RuntimeError):
    pass


_REGIONS_RE = re.compile(r"<regions>\s*(\[.*?\])\s*</regions>", re.DOTALL)


def _measure_image(data_url_or_http: str) -> tuple[int, int] | None:
    """Best-effort: decode a data URL to read its dims so the frontend can
    scale bboxes if it renders at a different size. Returns None for http URLs."""
    if not data_url_or_http.startswith("data:image/"):
        return None
    try:
        _, b64 = data_url_or_http.split(",", 1)
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        return img.width, img.height
    except Exception:
        return None


def _parse_grounded_reply(raw: str) -> tuple[str, list[dict]]:
    """Pull the <regions>[…]</regions> JSON block out of the reply.

    Returns (clean_reply_without_regions_block, regions_list). Missing or
    malformed JSON → empty regions, raw reply preserved.
    """
    m = _REGIONS_RE.search(raw)
    if not m:
        return raw.strip(), []
    json_text = m.group(1)
    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError:
        return raw.strip(), []
    regions: list[dict] = []
    for entry in parsed if isinstance(parsed, list) else []:
        if not isinstance(entry, dict):
            continue
        label = str(entry.get("label", "")).strip()
        bbox = entry.get("bbox")
        if not label or not isinstance(bbox, list) or len(bbox) != 4:
            continue
        try:
            x1, y1, x2, y2 = (int(round(float(v))) for v in bbox)
        except (TypeError, ValueError):
            continue
        # Normalize so x1 < x2 and y1 < y2.
        regions.append({
            "label": label,
            "bbox": [min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2)],
        })
    cleaned = (raw[: m.start()] + raw[m.end() :]).strip()
    return cleaned, regions


LANG_LABEL = {"en": "English", "zh-CN": "Simplified Chinese (简体中文)"}


def _lang_directive(lang: str) -> str:
    return f"Reply in {LANG_LABEL.get(lang, 'English')}."


async def ask_vision(image_data_url: str, prompt: str = "", lang: str = "en") -> dict:
    """Send image + question to Qwen3-VL-30B-A3B on the cluster.

    Returns {"reply": str, "model": str, "elapsed": float, "prompt": str}.
    """
    client = _get_client()
    started = time.time()
    base = (prompt or "").strip() or DEFAULT_PROMPT
    question = f"{base}\n\n{_lang_directive(lang)}"
    # Cap image at 1024px longest edge so vision tokens stay under cluster's
    # max_model_len. Pass-through for http URLs.
    try:
        resp = await client.chat.completions.create(
            model="tourbox-vision",
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
        raise VisionError(str(e)) from e
    reply = (resp.choices[0].message.content or "").strip()
    return {
        "reply": reply,
        "model": "Qwen3-VL-30B-A3B-AWQ",
        "prompt": question,
        "elapsed": round(time.time() - started, 2),
    }


async def ask_vision_grounded(image_data_url: str, prompt: str = "", lang: str = "en") -> dict:
    """Like ask_vision, but also asks the model to ground each described
    element to a bbox so the frontend can highlight it.

    Returns {
      "reply": str,
      "regions": [{"label": str, "bbox": [x1,y1,x2,y2]}],
      "image_width": int|None,
      "image_height": int|None,
      "model": str, "prompt": str, "elapsed": float
    }
    """
    client = _get_client()
    started = time.time()
    user_prefix = (prompt or "").strip()
    # Language directive goes AFTER the GROUNDED_PROMPT structural spec so it
    # is the last thing the model reads — and we say it twice (sentence +
    # labels) since the structural prompt examples are in English.
    label_dir = LANG_LABEL.get(lang, "English")
    lang_block = (
        f"\n\nReply in {label_dir}. The region 'label' values must also be in {label_dir}."
    )
    if user_prefix:
        question = f"{user_prefix}\n\n{GROUNDED_PROMPT}{lang_block}"
    else:
        question = f"{GROUNDED_PROMPT}{lang_block}"

    dims = _measure_image(image_data_url)
    try:
        resp = await client.chat.completions.create(
            model="tourbox-vision",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                        {"type": "text", "text": question},
                    ],
                }
            ],
            max_tokens=400,
            temperature=0.3,
        )
    except Exception as e:
        raise VisionError(str(e)) from e

    raw = (resp.choices[0].message.content or "").strip()
    clean_reply, regions = _parse_grounded_reply(raw)
    return {
        "reply": clean_reply,
        "regions": regions,
        "image_width": dims[0] if dims else None,
        "image_height": dims[1] if dims else None,
        "model": "Qwen3-VL-30B-A3B-AWQ",
        "prompt": question,
        "elapsed": round(time.time() - started, 2),
    }


def _reset_client():
    global _client
    _client = None
from ..proxy_state import register_invalidator  # noqa: E402
register_invalidator(_reset_client)
