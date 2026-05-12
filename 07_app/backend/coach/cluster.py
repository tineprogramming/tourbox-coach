"""Local 4090 cluster coach provider.

Talks to our own vLLM serving Qwen3-32B-AWQ via the public HTTPS proxy at
tinebritania.tinestuff.com/tourbox/coach/. OpenAI-compatible so we reuse
AsyncOpenAI — no API key needed (cluster is behind nginx Basic Auth on /tourbox/
paths, but the coach endpoint is open for the Pi to reach).

Why this exists alongside cloud.py: cloud providers are third-party (DeepSeek,
Alibaba, Moonshot, MiniMax) — they bill us per token and see user data. The
cluster is *our* hardware, free per request, private. Strictly between cloud
and Pi-local in tier.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from ..upstream_client import make_openai_client  # noqa: E402

from .prompt import SYSTEM_PROMPT, build_user_prompt

CLUSTER_BASE_URL = os.environ.get(
    "CLUSTER_COACH_URL",
    "https://tinebritania.tinestuff.com/tourbox/coach/v1",
)
CLUSTER_MODEL = "tourbox-coach"

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        # vLLM ignores the API key on open paths, but the SDK requires a non-empty string.
        _client = make_openai_client(api_key="cluster", base_url=CLUSTER_BASE_URL)
    return _client


async def stream_cluster_coaching(tool: str, metrics: dict) -> AsyncIterator[str]:
    """Stream Qwen3-32B-AWQ tokens from our 4090 cluster.

    /no_think is appended so Qwen3 skips the thinking-mode preamble — coach
    feedback should be ~1-2 sentences, not chain-of-thought.
    """
    client = _get_client()
    user_msg = build_user_prompt(tool, metrics) + "\n\n/no_think"

    stream = await client.chat.completions.create(
        model=CLUSTER_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=120,
        temperature=0.7,
        stream=True,
    )
    skip_think = True  # drop the empty <think></think> Qwen3 emits before the answer
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        token = delta.content if delta else None
        if not token:
            continue
        if skip_think:
            # Strip leading thinking-mode tags + whitespace until first real char.
            stripped = token.lstrip().replace("<think>", "").replace("</think>", "")
            if not stripped.strip():
                continue
            skip_think = False
            yield stripped
        else:
            yield token


def _reset_client():
    global _client
    _client = None
from ..proxy_state import register_invalidator  # noqa: E402
register_invalidator(_reset_client)
