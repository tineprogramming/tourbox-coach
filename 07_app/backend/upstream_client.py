"""Helpers that respect the global proxy toggle:

- `make_openai_client()` — drop-in for `AsyncOpenAI()`
- `proxy_aware_client()` — drop-in for `httpx.AsyncClient()` (async context manager)

When `proxy_state.is_enabled()` flips on, every outbound request is rewritten
from `https://api.openai.com/v1/chat/completions` to
`https://amazonsg.tinestuff.com/proxy/api.openai.com/v1/chat/completions`
with `X-Proxy-Token` header added. Off = pass-through, no overhead.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

import httpx
from openai import AsyncOpenAI

from .proxy_state import proxy_wrap, is_enabled


def make_openai_client(
    api_key: str,
    base_url: str = "https://api.openai.com/v1",
    extra_headers: dict[str, str] | None = None,
) -> AsyncOpenAI:
    """OpenAI-compat client, optionally routed through the proxy at construction.

    Note: the AsyncOpenAI client caches base_url at construction time, so the
    decision is frozen at this moment. To re-evaluate the toggle, recreate
    the client per-request (providers already do this via cache miss).
    """
    proxied, proxy_headers = proxy_wrap(base_url)
    headers = {**(extra_headers or {}), **proxy_headers}
    return AsyncOpenAI(
        api_key=api_key,
        base_url=proxied,
        default_headers=headers or None,
    )


def upstream_url(url: str) -> tuple[str, dict[str, str]]:
    """For raw httpx — returns (possibly-proxied URL, headers to add)."""
    return proxy_wrap(url)


class _ProxyAwareClient(httpx.AsyncClient):
    """httpx.AsyncClient subclass that intercepts requests and routes them
    through the global proxy when toggle is on. Otherwise behaves identically.
    """

    async def send(self, request: httpx.Request, **kwargs):
        if is_enabled():
            proxy_url = os.environ.get("PROXY_URL", "").rstrip("/")
            token = os.environ.get("PROXY_TOKEN", "")
            host = request.url.host
            if proxy_url and token and host:
                # Don't double-proxy: skip if URL already points at our proxy.
                proxy_host = httpx.URL(proxy_url).host
                if host != proxy_host:
                    path = request.url.raw_path.decode()
                    new_url = f"{proxy_url}/{host}{path}"
                    request.url = httpx.URL(new_url)
                    request.headers["x-proxy-token"] = token
                    request.headers["host"] = httpx.URL(new_url).host
                    # Host header gets reset by httpx based on URL.
        return await super().send(request, **kwargs)


@asynccontextmanager
async def proxy_aware_client(**kwargs):
    """Drop-in for `async with httpx.AsyncClient() as client:` — proxies if on."""
    async with _ProxyAwareClient(**kwargs) as client:
        yield client
