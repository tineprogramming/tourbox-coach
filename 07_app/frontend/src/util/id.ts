// Cryptographically-strong-ish IDs that are short enough to fit in JSON exports.
// Browser-only; uses crypto.randomUUID() when available.

export function newId(prefix = ""): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${uuid.slice(0, 12)}` : uuid;
}
