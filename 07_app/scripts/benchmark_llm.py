"""Benchmark Qwen 2:1.5b on Pi 5 CPU.

Verifies Jeff Geerling's claim of ~12 tok/s. Uses Ollama's own
eval_count + eval_duration (preferred over wall-clock counting).
"""

from __future__ import annotations

import time

import ollama

MODEL = "qwen2:1.5b"
PROMPT = "Explain photosynthesis in 50 words for a curious child."


def main() -> None:
    print(f"[warmup] loading {MODEL} into RAM...")
    ollama.chat(model=MODEL, messages=[{"role": "user", "content": "hi"}])

    print(f"[bench]  prompt: {PROMPT!r}\n")
    started = time.time()
    response = ollama.chat(
        model=MODEL,
        messages=[{"role": "user", "content": PROMPT}],
    )
    wall = time.time() - started

    eval_count = response.get("eval_count") or 0
    eval_seconds = (response.get("eval_duration") or 0) / 1e9
    rate = (eval_count / eval_seconds) if eval_seconds else 0.0

    print("response:")
    print(response["message"]["content"])
    print()
    print(f"wall:        {wall:6.2f} s")
    print(f"eval tokens: {eval_count:6d}")
    print(f"eval time:   {eval_seconds:6.2f} s")
    print(f"throughput:  {rate:6.2f} tok/s")
    print(f"target:      ~12 tok/s on Pi 5 CPU (Jeff Geerling Jan 2026)")


if __name__ == "__main__":
    main()
