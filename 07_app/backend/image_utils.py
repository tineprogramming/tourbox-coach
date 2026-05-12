"""Utilities shared between vision + polish.cluster.

Qwen3-VL tokenizes images as 14×14 patches + a 2×2 merge, so a 1024×1024
image becomes ~1330 vision tokens. Above ~1568px the count explodes past
the cluster's max_model_len of 8192. We pre-downscale on the Pi to cap
input cost, both for /vision and for the caption step of /polish.
"""

from __future__ import annotations

import base64
import io
import re

from PIL import Image

DATA_URL_RE = re.compile(r"^data:image/([a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)
MAX_LONGEST_EDGE = 1024
JPEG_QUALITY = 90


def downscale_data_url(image: str, max_edge: int = MAX_LONGEST_EDGE) -> str:
    """If `image` is a base64 data URL whose longest edge exceeds `max_edge`,
    decode → resize (preserving aspect ratio) → re-encode and return a new
    data URL. Otherwise return `image` unchanged.

    Public http URLs and already-small images pass through.
    """
    m = DATA_URL_RE.match(image)
    if not m:
        return image  # http URL or unrecognized format
    try:
        raw = base64.b64decode(m.group(2))
        img = Image.open(io.BytesIO(raw))
        w, h = img.size
        longest = max(w, h)
        if longest <= max_edge:
            return image
        scale = max_edge / longest
        new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
        # PNG with alpha → flatten on white so JPEG works; otherwise keep PNG.
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        resized = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        resized.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception as e:
        print(f"[image_utils] downscale failed ({type(e).__name__}: {e}); passing through")
        return image
