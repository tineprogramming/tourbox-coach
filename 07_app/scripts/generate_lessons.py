"""Generate Ghost Guide lesson reference images via DashScope Wanxiang t2i.

Runs once on Pi. Downloads each generated image to
~/tourbox-coach/frontend/public/lessons/<id>.png so Vite serves it as a
static asset at /lessons/<id>.png.

Re-runnable — skips lessons whose PNG already exists. Pass --force to
regenerate everything.

Usage (on Pi):
  cd ~/tourbox-coach && source venv/bin/activate
  python scripts/generate_lessons.py            # only generate missing
  python scripts/generate_lessons.py --force    # regenerate all
  python scripts/generate_lessons.py --only face,leaf
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Allow this script to be run from anywhere; reach backend package.
HERE = Path(__file__).resolve()
ROOT = HERE.parent.parent  # 07_app/
sys.path.insert(0, str(ROOT))

load_dotenv(Path.home() / "tourbox-coach" / ".env")

from backend.polish.text_to_image import generate_image  # noqa: E402


# Curated lesson set. Prompts tuned for "clean reference an absolute beginner
# can trace": minimal background, clean lines, slight artistic finish so the
# image doesn't feel like a coloring book.
LESSONS: list[dict[str, str]] = [
    {
        "id": "face",
        "label": "Friendly face",
        "prompt": "simple clean pencil drawing of a friendly young face, three-quarter view, soft shading, beginner-friendly art reference, white background, minimal detail",
    },
    {
        "id": "hand",
        "label": "Open hand",
        "prompt": "loose pencil sketch of a relaxed open hand from the side, anatomy reference for beginners, clean linework, soft tone, white background",
    },
    {
        "id": "leaf",
        "label": "Botanical leaf",
        "prompt": "single botanical leaf with visible veins, soft watercolor wash, naturalist illustration style, white background, beginner drawing reference",
    },
    {
        "id": "eye",
        "label": "Eye study",
        "prompt": "expressive eye study, soft pencil shading, classical art reference, white background, beginner anatomy",
    },
    {
        "id": "cat",
        "label": "Sitting cat",
        "prompt": "stylized cat sitting in profile, minimal line drawing with light watercolor wash, friendly cartoon style, white background, beginner reference",
    },
    {
        "id": "flower",
        "label": "Tulip",
        "prompt": "single tulip flower with leaves, soft watercolor reference, botanical style, white background, beginner art reference",
    },
]


async def download(url: str, dest: Path) -> None:
    async with httpx.AsyncClient(timeout=60.0) as c:
        r = await c.get(url)
        r.raise_for_status()
        dest.write_bytes(r.content)


async def main(only: set[str] | None, force: bool) -> None:
    out_dir = ROOT / "frontend" / "public" / "lessons"
    out_dir.mkdir(parents=True, exist_ok=True)

    queue = [L for L in LESSONS if (not only or L["id"] in only)]
    print(f"generating {len(queue)} lesson(s) → {out_dir}")

    for lesson in queue:
        dest = out_dir / f"{lesson['id']}.png"
        if dest.exists() and not force:
            print(f"  skip {lesson['id']} (exists)")
            continue

        print(f"  → {lesson['id']:8s}  prompt: {lesson['prompt'][:80]}...")
        try:
            urls = await generate_image(lesson["prompt"], size="1024*1024", n=1)
        except Exception as e:
            print(f"     FAILED: {e}")
            continue
        if not urls:
            print("     FAILED: no URLs returned")
            continue
        await download(urls[0], dest)
        print(f"     saved {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)")

    print()
    print("manifest entry suggestion (paste into LessonPicker.tsx):")
    for L in queue:
        print(f"  {{ id: \"{L['id']}\", label: \"{L['label']}\", src: \"/lessons/{L['id']}.png\" }},")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only", help="comma-separated ids")
    args = ap.parse_args()
    only = set(args.only.split(",")) if args.only else None
    asyncio.run(main(only=only, force=args.force))
