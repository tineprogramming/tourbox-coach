"""Real-time stroke metrics. Pure math, no ML.

Inputs are the StrokeEvent dicts emitted by the frontend recorder
(`07_app/frontend/src/canvas/useStrokeRecorder.ts`). Each event carries
x, y, pressure, tilt, speed, and time-since-stroke-start.

Metrics returned all live in [0, 1] except hesitations (count) and
avgSpeed (px/s) so a generic UI can render them with one rule.
"""

from __future__ import annotations

from typing import Any

import numpy as np


def analyze_stroke(events: list[dict[str, Any]]) -> dict[str, Any]:
    """Compute coaching metrics for a completed stroke."""
    n = len(events)
    if n < 3:
        return {
            "smoothness": 0.0,
            "pressureConsistency": 0.0,
            "avgSpeed": 0.0,
            "hesitations": 0,
            "confidence": 0.0,
            "sampleCount": n,
        }

    points = np.array([[float(e.get("x", 0)), float(e.get("y", 0))] for e in events])
    pressures = np.array([float(e.get("pressure", 0.0)) for e in events])
    speeds = np.array([float(e.get("speed", 0.0)) for e in events])

    # Smoothness: low second-derivative magnitude → smooth curve.
    # accel_mag std maps to (0, 1] via 1/(1+x/k); k=8 picked empirically so a
    # confident inked line scores ~0.7+ and a hesitant scribble scores ~0.3.
    deltas = np.diff(points, axis=0)
    accels = np.diff(deltas, axis=0)
    accel_mag = np.linalg.norm(accels, axis=1)
    smoothness = float(1.0 / (1.0 + (np.std(accel_mag) / 8.0)))

    # Pressure consistency: low std → consistent. Tight pressure = confident
    # inking; varying = "did the user ramp on/off cleanly". We accept ramps as
    # natural; punish chaos.
    pressure_consistency = float(1.0 / (1.0 + np.std(pressures) * 5.0))

    # Avg speed across moving samples (ignore zero-speed pen-down sample).
    moving = speeds[speeds > 0]
    avg_speed = float(np.mean(moving)) if moving.size else 0.0

    # Hesitations: runs of >=3 samples where speed drops below 20% of median
    # (or 30 px/s, whichever is higher — avoids false positives at low speeds).
    if speeds.size > 5:
        threshold = max(float(np.median(speeds)) * 0.2, 30.0)
        below = speeds < threshold
        runs = 0
        run_len = 0
        for b in below:
            if b:
                run_len += 1
                if run_len == 3:
                    runs += 1
            else:
                run_len = 0
        hesitations = runs
    else:
        hesitations = 0

    # Confidence: weighted combination. Hesitations bring it down sharply.
    confidence = float(
        0.4 * smoothness
        + 0.3 * pressure_consistency
        + 0.3 * (1.0 / (1.0 + hesitations))
    )

    return {
        "smoothness": round(smoothness, 3),
        "pressureConsistency": round(pressure_consistency, 3),
        "avgSpeed": round(avg_speed, 1),
        "hesitations": int(hesitations),
        "confidence": round(confidence, 3),
        "sampleCount": int(n),
    }
