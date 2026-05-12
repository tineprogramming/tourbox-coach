# Vendored third-party brush engine assets

This directory contains pre-built artefacts vendored from external
open-source projects. None of the source code in those projects has been
modified; only their pre-built outputs are shipped here, with the only
transformation being a rename of `.myb` brush definition files to
`.json` (their contents are valid JSON and unchanged).

## Brush engine: `brushlib.js`, `brushlib.wasm`

- **Source**: [eliot-akira/brushlib-wasm](https://github.com/eliot-akira/brushlib-wasm) — a WebAssembly port of [libmypaint](https://github.com/mypaint/libmypaint) v1.3.0, built with Emscripten 3.1.26.
- **License**: ISC.
- **Copyright**: see the upstream `libmypaint` repository for the full author list. Permissive use, modification and redistribution permitted.

### Local patches to `brushlib.js` (2026-05-10)

The vendored `brushlib.js` includes three small fixes layered on top of the upstream release. They're marked with `DrawCopilotLab patch` comments in the file. Summary:

1. **`getColorProxy` signature** changed from `'ifffiiii'` (returns int) to `'vfffiiii'` (returns void). libmypaint's `MyPaintSurfaceGetColorFunction` returns `void`; the `'i'` triggered `RuntimeError: function signature mismatch` inside the wasm whenever a brush actually invoked the callback (any brush with `smudge > 0`, plus brushes whose smudge mapping ramps with speed/pressure — wash, smudge, pastel, charcoal).
2. **Direct `HEAPF32` writes** replace `Module.setValue(...)`. The current Emscripten output doesn't export `setValue` by default; writing through `Module.HEAPF32[ptr >> 2]` is equivalent and avoids depending on extra runtime exports.
3. **`willReadFrequently: true`** when acquiring the painter's 2D context. Smudge / palette-knife brushes call `getImageData` once per dab; the flag opts into Chrome's readback-optimized 2D backend and silences the perf warning.
4. **`getColor` fixed to return real floats** instead of dividing into a `Uint8ClampedArray` (which clamped the result back to integers, destroying color information). Previously smudge always pulled near-black or near-white regardless of underlying canvas color.

These patches are local to this file and do not affect the upstream wasm binary.

## Brushes under `brushes/`

All thirteen brushes here come from the official [mypaint/mypaint-brushes](https://github.com/mypaint/mypaint-brushes) collection and are released under **CC0-1.0** (Creative Commons Public Domain Dedication) per the project's `Licenses.dep5` file.

| Local file | Upstream path | Author |
|---|---|---|
| `pencil.json` | `brushes/tanda/pencil-8b.myb` | Marcelo "Tanda" Cerviño |
| `studio_pen.json` | `brushes/deevad/pen.myb` | David Revoy |
| `wash.json` | `brushes/deevad/watercolor_glazing.myb` | David Revoy |
| `soft_airbrush.json` | `brushes/deevad/airbrush.myb` | David Revoy |
| `hard_round.json` | `brushes/deevad/basic_digital_brush.myb` | David Revoy |
| `marker.json` | `brushes/tanda/marker-05.myb` | Marcelo "Tanda" Cerviño |
| `smudge.json` | `brushes/deevad/basic_digital_brush_smudging.myb` | David Revoy |
| `eraser.json` | `brushes/deevad/large_hard_eraser.myb` | David Revoy |
| `charcoal.json` | `brushes/tanda/charcoal-03.myb` | Marcelo "Tanda" Cerviño |
| `pastel.json` | `brushes/ramon/Pastel_1.myb` | Ramón Miranda |
| `ballpen.json` | `brushes/deevad/ballpen.myb` | David Revoy |
| `calligraphy.json` | `brushes/classic/calligraphy.myb` | MyPaint contributors (`brushes/*` default) |
| `knife.json` | `brushes/deevad/basic_digital_knife.myb` | David Revoy |

CC0 means no attribution is legally required, but we credit the artists
above as a courtesy and to enable downstream users to find the originals.

## Why these are checked in

The `Lab_App` is intended to run fully offline on a single workstation
(per the Initial OS Development Lab mission). Fetching these artefacts
on demand at runtime would defeat that. They are also small (~190 KB
combined) and pinned to known-good versions, so vendoring them keeps
the build hermetic and the upgrade story explicit.
