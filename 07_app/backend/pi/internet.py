"""Cached internet reachability check.

We probe a known reliable endpoint (Alibaba CDN — works in China + globally)
with a short timeout. Result is cached for 20 seconds so the frontend can
poll without DoSing anything.
"""

from __future__ import annotations

import asyncio
import time

import httpx

# Anchor endpoints to known-good infra. First hit is the primary; on failure
# we try the secondary before declaring "offline" — guards against transient
# DNS hiccups.
PROBE_URLS = [
    "https://dashscope.aliyuncs.com/",
    "https://1.1.1.1/",
]
TIMEOUT_S = 4.0
CACHE_TTL_S = 20.0

_cache: dict[str, float | bool | str | None] = {
    "checked_at": 0.0,
    "online": False,
    "via": None,
    "error": None,
}
_lock = asyncio.Lock()


async def _probe_one(url: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as c:
            r = await c.head(url, follow_redirects=False)
            return r.status_code < 500
    except Exception:
        return False


async def check_internet(force: bool = False) -> dict:
    """Return {"online": bool, "via": str|None, "checked_at": ts, "cached": bool}."""
    now = time.time()
    if not force and now - float(_cache["checked_at"]) < CACHE_TTL_S:
        return {
            "online": bool(_cache["online"]),
            "via": _cache["via"],
            "checked_at": _cache["checked_at"],
            "cached": True,
        }

    async with _lock:
        # Re-check under lock to avoid duplicate work if multiple callers raced
        # the cache.
        now = time.time()
        if not force and now - float(_cache["checked_at"]) < CACHE_TTL_S:
            return {
                "online": bool(_cache["online"]),
                "via": _cache["via"],
                "checked_at": _cache["checked_at"],
                "cached": True,
            }

        via = None
        for url in PROBE_URLS:
            if await _probe_one(url):
                via = url
                break

        _cache["checked_at"] = now
        _cache["online"] = bool(via)
        _cache["via"] = via
        _cache["error"] = None
        return {
            "online": bool(via),
            "via": via,
            "checked_at": now,
            "cached": False,
        }
