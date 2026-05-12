// Tilt → azimuth/altitude conversion, and small geometry helpers.
// Reference: https://www.w3.org/TR/pointerevents3/#dom-pointerevent-tiltx

/**
 * Convert PointerEvent tiltX, tiltY (degrees from vertical, range -90..90)
 * into an azimuth (0..360, clockwise from "up" on screen) and altitude
 * (0..90, where 90 = pen vertical).
 *
 * This matches the convention Apple Pencil and most digital-art apps use
 * when they say "the pen is tilted east at 30 degrees".
 */
export function tiltToAzimuthAltitude(
  tiltX: number,
  tiltY: number,
): { azimuth: number; altitude: number } {
  const tiltXrad = (tiltX * Math.PI) / 180;
  const tiltYrad = (tiltY * Math.PI) / 180;

  // No tilt → altitude 90, azimuth undefined; we return 0.
  if (tiltX === 0 && tiltY === 0) {
    return { azimuth: 0, altitude: 90 };
  }

  // Direction the *tip* projects onto the screen plane (note: tiltY positive
  // is towards the user, but on screen "down" is +Y, so we negate).
  const azimuthRad = Math.atan2(Math.sin(tiltXrad), -Math.sin(tiltYrad));
  let azimuth = (azimuthRad * 180) / Math.PI;
  if (azimuth < 0) azimuth += 360;

  // Altitude: angle of the pen above the screen plane.
  const cosAlt =
    Math.sqrt(Math.sin(tiltXrad) ** 2 + Math.sin(tiltYrad) ** 2) /
    Math.sqrt(
      Math.sin(tiltXrad) ** 2 +
        Math.sin(tiltYrad) ** 2 +
        Math.cos(tiltXrad) ** 2 * Math.cos(tiltYrad) ** 2,
    );
  const altitude = 90 - (Math.acos(Math.max(-1, Math.min(1, cosAlt))) * 180) / Math.PI;

  return { azimuth, altitude };
}

/**
 * Convert a list of perfect-freehand outline points into an SVG path "d" string.
 * Lifted-and-simplified from the perfect-freehand README (MIT licensed).
 */
export function outlinePointsToSvgPath(points: number[][]): string {
  if (!points.length) return "";
  const d: (string | number)[] = ["M", points[0][0], points[0][1], "Q"];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  d.push("Z");
  return d.join(" ");
}
