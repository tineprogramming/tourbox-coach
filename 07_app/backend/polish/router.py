"""Polish-provider router. Seedream primary, Wanxiang fallback.

Why: Seedream is synchronous (5x faster wall-clock than Wanxiang's async
polling), and ByteDance's flagship model often produces sharper results
than Wanxiang for unfamiliar subjects. But if BytePlus is down or the key
hits its quota, we still ship a Polish — Wanxiang fills in.

The frontend learns which provider actually served the request via the
`provider` field in the response, plus an optional `fallback_from` when
Seedream failed.
"""

from __future__ import annotations

from .seedream import SeedreamError, polish_sketch_seedream
from .wanxiang import PolishError, polish_sketch as polish_sketch_wanxiang


async def polish_with_fallback(
    image: str,
    style: str = "watercolor",
    custom_prompt: str = "",
    n: int = 1,
) -> dict:
    try:
        return await polish_sketch_seedream(image, style=style, custom_prompt=custom_prompt, n=n)
    except SeedreamError as primary_err:
        print(f"[polish] seedream failed: {primary_err} → falling back to wanxiang")
        try:
            result = await polish_sketch_wanxiang(image, style=style, custom_prompt=custom_prompt, n=n)
            result["provider"] = "wanxiang"
            result["fallback_from"] = "seedream"
            result["fallback_reason"] = str(primary_err)[:200]
            return result
        except PolishError as fallback_err:
            raise PolishError(
                f"both providers failed — seedream: {primary_err}; wanxiang: {fallback_err}"
            )
