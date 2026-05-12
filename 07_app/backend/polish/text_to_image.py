"""DashScope Wanxiang text-to-image — used to generate lesson reference
images for the Ghost Guide overlay.

Endpoint:  POST /api/v1/services/aigc/image-generation/generation
Model:     wanx2.1-t2i-turbo (fast) or wanx2.1-t2i-plus (higher quality)
Async:     yes — same task_id polling pattern as imageedit.
Size:      width/height within [512, 1440].

Docs:
  https://www.alibabacloud.com/help/en/model-studio/text-to-image-v2-api-reference
"""

from __future__ import annotations

import asyncio
import os

import httpx

CREATE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"
TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"

POLL_INTERVAL_S = 2.0
POLL_TIMEOUT_S = 180.0


class T2IError(RuntimeError):
    pass


async def generate_image(
    prompt: str,
    *,
    model: str = "wanx2.1-t2i-turbo",
    size: str = "1024*1024",
    n: int = 1,
    negative_prompt: str = "",
) -> list[str]:
    """Generate image(s) from text. Returns list of image URLs."""
    api_key = os.environ.get("DASHSCOPE_API_KEY")
    if not api_key:
        raise T2IError("missing DASHSCOPE_API_KEY env var")

    body = {
        "model": model,
        "input": {"prompt": prompt},
        "parameters": {"size": size, "n": max(1, min(n, 4))},
    }
    if negative_prompt:
        body["input"]["negative_prompt"] = negative_prompt
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        create = await client.post(CREATE_URL, headers=headers, json=body)
        if create.status_code != 200:
            raise T2IError(f"create failed: {create.status_code} {create.text[:300]}")
        task_id = (create.json().get("output") or {}).get("task_id")
        if not task_id:
            raise T2IError(f"no task_id: {create.json()}")

        deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT_S
        while asyncio.get_event_loop().time() < deadline:
            await asyncio.sleep(POLL_INTERVAL_S)
            r = await client.get(
                TASK_URL.format(task_id=task_id),
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if r.status_code != 200:
                raise T2IError(f"poll failed: {r.status_code} {r.text[:200]}")
            output = r.json().get("output") or {}
            status = output.get("task_status")
            if status == "SUCCEEDED":
                results = output.get("results") or []
                return [item["url"] for item in results if isinstance(item, dict) and item.get("url")]
            if status in ("FAILED", "UNKNOWN", "CANCELED"):
                msg = output.get("message") or output.get("code") or "unknown"
                raise T2IError(f"task {status}: {msg}")

        raise T2IError(f"task {task_id} timed out after {POLL_TIMEOUT_S}s")
