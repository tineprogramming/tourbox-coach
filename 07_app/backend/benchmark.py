"""Latency benchmark — fires a tiny ping at each provider once with proxy
OFF, then once with proxy ON. Returns a table comparing the two paths.

Polish providers are too expensive to benchmark (each call burns image-gen
credits + takes 10-30s). We benchmark only Coach (small chat) + Vision
(small image) which are <2s each and cost fractions of a cent.
"""

from __future__ import annotations

import asyncio
import os
import time

import httpx
from openai import AsyncOpenAI

from . import proxy_state
from .upstream_client import make_openai_client, proxy_aware_client

# Tiny ping image (1x1 pixel red PNG, ~70 bytes after base64)
TINY_PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGklEQVR42mP8//8/AymAiYFEMKphVMPQ0QAAVW0DHfeH1GIAAAAASUVORK5CYII="
)

# ─────────── Provider ping functions ───────────


async def _ping_openai_compat(api_key_env: str, base_url: str, model: str) -> None:
    key = os.environ.get(api_key_env)
    if not key:
        raise RuntimeError(f"missing {api_key_env}")
    client = make_openai_client(api_key=key, base_url=base_url)
    await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=5,
        temperature=0,
    )


async def _ping_openai_vision(api_key_env: str, base_url: str, model: str) -> None:
    key = os.environ.get(api_key_env)
    if not key:
        raise RuntimeError(f"missing {api_key_env}")
    client = make_openai_client(api_key=key, base_url=base_url)
    await client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": TINY_PNG_DATA_URL}},
                    {"type": "text", "text": "hi"},
                ],
            }
        ],
        max_tokens=5,
        temperature=0,
    )


async def _ping_cluster_coach() -> None:
    await _ping_openai_compat(
        "PROXY_TOKEN",  # placeholder; cluster doesn't need a real key
        "https://tinebritania.tinestuff.com/tourbox/coach/v1",
        "tourbox-coach",
    )


async def _ping_cluster_coach_real() -> None:
    # Cluster vLLM accepts any non-empty api_key; use literal
    client = make_openai_client(
        api_key="cluster",
        base_url="https://tinebritania.tinestuff.com/tourbox/coach/v1",
    )
    await client.chat.completions.create(
        model="tourbox-coach",
        messages=[{"role": "user", "content": "hi /no_think"}],
        max_tokens=5,
        temperature=0,
    )


async def _ping_cluster_vision_real() -> None:
    client = make_openai_client(
        api_key="cluster",
        base_url="https://tinebritania.tinestuff.com/tourbox/vision/v1",
    )
    await client.chat.completions.create(
        model="tourbox-vision",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": TINY_PNG_DATA_URL}},
                    {"type": "text", "text": "hi"},
                ],
            }
        ],
        max_tokens=5,
        temperature=0,
    )


# ─────────── fal.ai ping (HEAD on its API) ───────────


async def _ping_fal() -> None:
    """Cheapest fal.ai request — a GET on a known model info page.
    Doesn't actually invoke a model (no billing)."""
    async with proxy_aware_client(timeout=15.0) as client:
        r = await client.get(
            "https://fal.run/fal-ai/z-image/turbo",
            headers={"Authorization": f"Key {os.environ.get('FAL_KEY', '')}"},
        )
        # 405 (Method Not Allowed on GET) or 404 still proves we reached the host.
        if r.status_code >= 500:
            r.raise_for_status()


# ─────────── Registry ───────────

BENCHMARK_TARGETS: list[tuple[str, str, str, callable]] = [
    # (id, label, category, ping_fn)
    ("cluster-coach", "🇹🇭 Cluster · Qwen3-32B (coach)", "coach", _ping_cluster_coach_real),
    ("cluster-vision", "🇹🇭 Cluster · Qwen3-VL (vision)", "vision", _ping_cluster_vision_real),
    (
        "deepseek",
        "🇨🇳 DeepSeek (coach)",
        "coach",
        lambda: _ping_openai_compat(
            "DEEPSEEK_API_KEY", "https://api.deepseek.com", "deepseek-chat"
        ),
    ),
    (
        "qwen-plus",
        "🇨🇳 Qwen-Plus DashScope (coach)",
        "coach",
        lambda: _ping_openai_compat(
            "DASHSCOPE_API_KEY",
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "qwen-plus",
        ),
    ),
    (
        "dashscope-vision",
        "🇨🇳 Qwen-VL-Max DashScope (vision)",
        "vision",
        lambda: _ping_openai_vision(
            "DASHSCOPE_API_KEY",
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "qwen-vl-max",
        ),
    ),
    (
        "openai-coach",
        "🇺🇸 OpenAI GPT-4o-mini (coach)",
        "coach",
        lambda: _ping_openai_compat(
            "OPENAI_API_KEY", "https://api.openai.com/v1", "gpt-4o-mini"
        ),
    ),
    (
        "openai-vision",
        "🇺🇸 OpenAI GPT-4o (vision)",
        "vision",
        lambda: _ping_openai_vision(
            "OPENAI_API_KEY", "https://api.openai.com/v1", "gpt-4o"
        ),
    ),
    ("fal", "🌎 fal.ai (Polish gateway)", "polish", _ping_fal),
]


# ─────────── Run benchmark ───────────


async def _time_one(fn) -> tuple[float | None, str | None]:
    """Returns (elapsed_seconds, error_msg). One of the two is None."""
    started = time.time()
    try:
        await fn()
        return (time.time() - started, None)
    except Exception as e:
        return (None, f"{type(e).__name__}: {str(e)[:200]}")


async def run_benchmark() -> dict:
    """Run all targets twice — once direct, once proxied. Returns a results table."""
    original = proxy_state.is_enabled()

    # Round 1: direct
    proxy_state.set_enabled(False)
    await asyncio.sleep(0.05)  # let invalidators fire
    direct_results = await asyncio.gather(
        *[_time_one(fn) for _, _, _, fn in BENCHMARK_TARGETS]
    )

    # Round 2: proxied
    proxy_state.set_enabled(True)
    await asyncio.sleep(0.05)
    proxied_results = await asyncio.gather(
        *[_time_one(fn) for _, _, _, fn in BENCHMARK_TARGETS]
    )

    # Restore
    proxy_state.set_enabled(original)

    rows = []
    for (pid, label, cat, _fn), (d_t, d_err), (p_t, p_err) in zip(
        BENCHMARK_TARGETS, direct_results, proxied_results
    ):
        rows.append({
            "id": pid,
            "label": label,
            "category": cat,
            "direct_s": round(d_t, 3) if d_t is not None else None,
            "direct_error": d_err,
            "proxied_s": round(p_t, 3) if p_t is not None else None,
            "proxied_error": p_err,
            "delta_s": (
                round(p_t - d_t, 3)
                if d_t is not None and p_t is not None
                else None
            ),
        })

    return {
        "ran_at": time.time(),
        "restored_proxy_enabled": original,
        "rows": rows,
    }
