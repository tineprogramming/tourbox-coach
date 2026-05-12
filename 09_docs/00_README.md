# TourBox Coach — Docs Index

Comprehensive documentation as of **2026-05-12**.

## Reading order

1. **[01_architecture.md](01_architecture.md)** — System overview, three-tier (client → Pi → cluster → clouds), data flow per feature, VRAM budgets per GPU
2. **[02_providers.md](02_providers.md)** — Full catalog of AI providers (Coach 5, Polish 10, Vision 3) with country flags, opensource status, endpoints, speed/quality matrix
3. **[03_setup_and_systemd.md](03_setup_and_systemd.md)** — All 8 systemd units, vLLM/ComfyUI config, cold-start sequence, smoke tests, model cache layout
4. **[04_ui_features.md](04_ui_features.md)** — UI structure, AI Box panel, Polish/Vision modal flows, animations, i18n, bug history
5. **[05_api_reference.md](05_api_reference.md)** — Backend REST + WS endpoints, request/response shapes, env vars

## Quick facts

| | |
|---|---|
| **Status** | Demo-ready as of 2026-05-12 |
| **Pi** | `tourbox@10.10.1.116` (frontend :5173, backend :8000, setup :80) |
| **Cluster** | `root@tinebritania.tinestuff.com:2225` (3× RTX 4090 24GB) |
| **Repo on Pi** | `~/tourbox-coach/{backend,frontend,scripts}` |
| **Repo local** | `/Users/tineprogramming/TineDrive/Private/Tine-coding/tourbox-coach/` |
| **Public HTTPS** | `https://tinebritania.tinestuff.com/tourbox/{coach,vision,polish}/` |
| **Total AI providers** | **18** (10 Polish + 5 Coach + 3 Vision) |
| **Open-source providers** | **9** with public weights (Apache 2.0 / MIT / non-commercial-open) |
| **Languages supported** | English + 简体中文 (auto-detect, AI replies match) |

## Pending / future

- ⏳ **Rotate exposed secrets** — many API keys leaked in chat history during dev (HF, fal.ai, BytePlus, DashScope, DeepSeek, OpenAI, cluster password). Rotate post-demo before any public release.
- 🟡 Optional future enhancements:
  - Self-host **HunyuanDiT** / **OmniGen v2** / **HiDream** on cluster (open-weight alternatives currently not on fal.ai)
  - Test ComfyUI cluster polish with **canny ControlNet** for advanced sketch fidelity
  - Add **Apple HEIC** / **WebP** import support for Polish
  - Better Vision OpenAI bbox accuracy (gpt-4o returns ~30% off — consider switching to Gemini 2.5 Pro vision)
