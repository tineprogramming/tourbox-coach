"""Cloud coach providers — all OpenAI-compatible so they share one
AsyncOpenAI client per base_url.

DeepSeek + Qwen-Plus (via DashScope) are China-friendly. OpenAI is the
international comparison.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from dataclasses import dataclass

from openai import AsyncOpenAI

from ..upstream_client import make_openai_client  # noqa: E402

from .prompt import SYSTEM_PROMPT, build_user_prompt


@dataclass(frozen=True)
class OpenAICompatProvider:
    id: str
    label: str
    base_url: str
    model: str
    key_env: str


OPENAI_COMPAT: dict[str, OpenAICompatProvider] = {
    "deepseek": OpenAICompatProvider(
        id="deepseek",
        label="DeepSeek",
        base_url="https://api.deepseek.com",
        model="deepseek-chat",
        key_env="DEEPSEEK_API_KEY",
    ),
    "qwen-plus": OpenAICompatProvider(
        id="qwen-plus",
        label="Qwen-Plus (Alibaba)",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        model="qwen-plus",
        key_env="DASHSCOPE_API_KEY",
    ),
    "openai": OpenAICompatProvider(
        id="openai",
        label="OpenAI GPT-4o-mini",
        base_url="https://api.openai.com/v1",
        model="gpt-4o-mini",
        key_env="OPENAI_API_KEY",
    ),
}


_clients: dict[str, AsyncOpenAI] = {}


def _get_client(provider: OpenAICompatProvider) -> AsyncOpenAI:
    if provider.id not in _clients:
        key = os.environ.get(provider.key_env)
        if not key:
            raise RuntimeError(f"missing env {provider.key_env} for {provider.id}")
        _clients[provider.id] = make_openai_client(api_key=key, base_url=provider.base_url)
    return _clients[provider.id]


async def stream_openai_compat(
    provider_id: str, tool: str, metrics: dict
) -> AsyncIterator[str]:
    """Stream content chunks from any OpenAI-compatible provider."""
    if provider_id not in OPENAI_COMPAT:
        raise ValueError(f"unknown OpenAI-compat provider: {provider_id}")
    provider = OPENAI_COMPAT[provider_id]
    client = _get_client(provider)

    stream = await client.chat.completions.create(
        model=provider.model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(tool, metrics)},
        ],
        max_tokens=80,
        temperature=0.7,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content


# Catalog exposed to the router / frontend.
ALL_CLOUD_PROVIDERS: list[dict] = [
    {"id": "deepseek", "label": "DeepSeek"},
    {"id": "qwen-plus", "label": "Qwen-Plus"},
    {"id": "openai", "label": "OpenAI GPT-4o-mini"},
]


def _reset_clients():
    _clients.clear()
from ..proxy_state import register_invalidator  # noqa: E402
register_invalidator(_reset_clients)
