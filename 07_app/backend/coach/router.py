"""AI coach router. Picks Local, Cluster, or Cloud per request.

Frontend includes a `provider` field in stroke_complete. Valid values:
- "local"                              (default-fallback — Ollama on Pi)
- "cluster"                            (our own 4090 cluster, Qwen3-32B-AWQ)
- "deepseek" | "qwen-plus" | "openai"  (OpenAI-compat cloud)

Falls back to local with a warning when a non-local provider is requested
but unreachable (missing env key, or just no internet).
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

from .cloud import ALL_CLOUD_PROVIDERS, OPENAI_COMPAT, stream_openai_compat
from .cluster import stream_cluster_coaching
from .local import model_name, stream_coaching as stream_local


def list_providers() -> dict:
    return {
        "local": {"id": "local", "label": f"Local · {model_name()}"},
        "cluster": {"id": "cluster", "label": "Cluster · Qwen3-32B-AWQ"},
        "cloud": ALL_CLOUD_PROVIDERS,
    }


def _cloud_ready(provider_id: str) -> bool:
    if provider_id in OPENAI_COMPAT:
        return bool(os.environ.get(OPENAI_COMPAT[provider_id].key_env))
    return False


async def stream_coaching(
    provider: str, tool: str, metrics: dict
) -> AsyncIterator[tuple[str, str]]:
    """Yield (source, token) tuples — source reflects the *actual* provider used."""
    chosen = provider
    if provider not in ("local", "cluster") and not _cloud_ready(provider):
        print(f"[coach] cloud '{provider}' unavailable (missing key) → falling back to local")
        chosen = "local"

    if chosen == "local":
        async for token in stream_local(tool, metrics):
            yield ("local", token)
    elif chosen == "cluster":
        try:
            async for token in stream_cluster_coaching(tool, metrics):
                yield ("cluster", token)
        except Exception as e:
            print(f"[coach] cluster unreachable ({e}) → falling back to local")
            async for token in stream_local(tool, metrics):
                yield ("local", token)
    elif chosen in OPENAI_COMPAT:
        async for token in stream_openai_compat(chosen, tool, metrics):
            yield (chosen, token)
    else:
        print(f"[coach] unknown provider '{provider}' → falling back to local")
        async for token in stream_local(tool, metrics):
            yield ("local", token)
