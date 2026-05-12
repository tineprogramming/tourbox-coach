"""Global proxy toggle — when enabled, all outbound API calls route through
amazonsg.tinestuff.com/proxy/<upstream-host>/<path> with X-Proxy-Token.

The toggle is set via POST /proxy/toggle from the frontend AIBox. Each
provider module reads via upstream_client helpers — no per-request param
plumbing required.
"""

from __future__ import annotations

import os
import threading
from urllib.parse import urlparse

_lock = threading.Lock()
_state = {"enabled": False}
_invalidators: list = []  # callbacks fired when toggle changes


def is_enabled() -> bool:
    with _lock:
        return _state["enabled"]


def set_enabled(value: bool) -> None:
    with _lock:
        was = _state["enabled"]
        _state["enabled"] = bool(value)
        changed = was != _state["enabled"]
    if changed:
        for fn in _invalidators:
            try: fn()
            except Exception as e: print(f"[proxy_state] invalidator error: {e}")


def register_invalidator(fn) -> None:
    """Register a function called whenever the proxy toggle flips.
    Used by provider modules to clear their cached SDK clients."""
    _invalidators.append(fn)


def proxy_wrap(url: str) -> tuple[str, dict[str, str]]:
    """If proxy is on AND PROXY_URL/PROXY_TOKEN env vars are set, rewrite
    `url` to route through amazonsg. Otherwise return url unchanged.

    Returns (possibly-proxied URL, extra headers to add).
    """
    if not is_enabled():
        return url, {}

    proxy_url = os.environ.get("PROXY_URL", "").rstrip("/")
    token = os.environ.get("PROXY_TOKEN", "")
    if not proxy_url or not token:
        # Misconfigured — fall back to direct
        return url, {}

    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.netloc:
        return url, {}

    # Avoid double-proxy: if url already points at our proxy, leave alone.
    if proxy_url.startswith(f"{p.scheme}://{p.netloc}"):
        return url, {}

    rest = p.path or "/"
    if p.query:
        rest = f"{rest}?{p.query}"

    proxied = f"{proxy_url}/{p.netloc}{rest}"
    return proxied, {"X-Proxy-Token": token}
