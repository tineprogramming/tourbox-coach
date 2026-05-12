"""Polish My Drawing via DashScope Wanxiang 2.1 imageedit (sketch-to-image).

We use `function: doodle` which is exactly sketch-to-stylized-image. The
endpoint accepts the input image as a data URL (base64), which is what
canvas.toDataURL() produces — no separate upload step.

The API is async-only: POST creates a task, then we poll /tasks/{task_id}
until SUCCEEDED. Typical wall time is 5–15s.

Docs:
  https://www.alibabacloud.com/help/en/model-studio/wanx-image-edit-api-reference
"""

from __future__ import annotations

import asyncio
import os

import httpx
from ..upstream_client import upstream_url, proxy_aware_client

CREATE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis"
TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
MODEL = "wanx2.1-imageedit"

# Style presets — each maps to a prompt that biases Wanxiang towards a
# particular finished look. Kept short and concrete; the model responds
# better to noun phrases than to instructions.
STYLE_PROMPTS: dict[str, str] = {
    "watercolor": "watercolor painting, soft pastel washes, artistic, fine details",
    "anime": "anime style illustration, vibrant clean colors, crisp linework",
    "oil_painting": "oil painting, thick textured brush strokes, dramatic lighting",
    "pencil_sketch": "detailed pencil drawing, fine hatching, monochrome shading",
    "concept_art": "professional concept art, cinematic, painterly, atmospheric",
    "ink_wash": "Chinese ink wash painting, sumi-e, expressive minimal strokes",
    "realistic": "photorealistic, hyperdetailed, professional photography, natural lighting, sharp focus, 8k uhd",
}

POLL_INTERVAL_S = 1.5
POLL_TIMEOUT_S = 120.0


class PolishError(RuntimeError):
    pass


async def polish_sketch(
    base_image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    """Run Wanxiang doodle on the given base64 data URL.

    Returns: {"images": [url, ...], "style": style, "prompt": prompt, "task_id": str}
    Raises PolishError on failure.
    """
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise PolishError("missing DASHSCOPE_API_KEY env var")

    prompt = (custom_prompt or STYLE_PROMPTS.get(style) or STYLE_PROMPTS["watercolor"]).strip()
    body = {
        "model": MODEL,
        "input": {
            "function": "doodle",
            "prompt": prompt,
            "base_image_url": base_image,
        },
        "parameters": {"n": max(1, min(n, 4))},
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }

    async with proxy_aware_client(timeout=60.0) as client:
        # 1) Create task.
        create = await client.post(CREATE_URL, headers=headers, json=body)
        if create.status_code != 200:
            raise PolishError(f"create task failed: {create.status_code} {create.text[:300]}")
        created = create.json()
        task_id = (created.get("output") or {}).get("task_id")
        if not task_id:
            raise PolishError(f"no task_id in response: {created}")

        # 2) Poll.
        deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT_S
        last_status = None
        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(POLL_INTERVAL_S)
            r = await client.get(
                TASK_URL.format(task_id=task_id),
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if r.status_code != 200:
                raise PolishError(f"poll failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            output = data.get("output") or {}
            status = output.get("task_status")
            last_status = status

            if status == "SUCCEEDED":
                results = output.get("results") or []
                urls = [item["url"] for item in results if isinstance(item, dict) and item.get("url")]
                return {
                    "images": urls,
                    "style": style,
                    "prompt": prompt,
                    "task_id": task_id,
                }
            if status in ("FAILED", "UNKNOWN", "CANCELED"):
                msg = output.get("message") or output.get("code") or "unknown failure"
                raise PolishError(f"task {task_id} {status}: {msg}")
            # else still RUNNING / PENDING → keep polling.

        raise PolishError(f"task {task_id} timed out after {POLL_TIMEOUT_S}s (last_status={last_status})")
