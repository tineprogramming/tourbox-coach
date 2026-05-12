"""Local coach via Ollama. Streams tokens.

Model picked from $LOCAL_MODEL (default: qwen3:4b).
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

from ollama import AsyncClient

from .prompt import SYSTEM_PROMPT, build_user_prompt

_client: AsyncClient | None = None


def _get_client() -> AsyncClient:
    global _client
    if _client is None:
        _client = AsyncClient()
    return _client


def model_name() -> str:
    return os.environ.get("LOCAL_MODEL", "qwen3:4b")


async def stream_coaching(tool: str, metrics: dict) -> AsyncIterator[str]:
    """Yield content chunks as Ollama streams them."""
    stream = await _get_client().chat(
        model=model_name(),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(tool, metrics)},
        ],
        options={"num_predict": 60, "temperature": 0.7, "stop": ["\n\n"]},
        stream=True,
    )
    async for part in stream:
        # Ollama AsyncClient yields ChatResponse pydantic objects (not dicts).
        # Be defensive in case the lib switches representation.
        if isinstance(part, dict):
            msg = part.get("message") or {}
            content = msg.get("content") or ""
        else:
            msg = getattr(part, "message", None)
            content = getattr(msg, "content", "") if msg else ""
        if content:
            yield content
