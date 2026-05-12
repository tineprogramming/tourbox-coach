import type { Session } from "../types";

// Serialize a Session as line-delimited JSON. Easy to feed into PyTorch / TF
// later — each line is a self-describing record.
export function sessionToJsonl(session: Session): string {
  const lines: string[] = [];

  lines.push(
    JSON.stringify({
      kind: "meta",
      ...session.meta,
    }),
  );

  for (const stroke of session.strokes) {
    lines.push(
      JSON.stringify({
        kind: "stroke_start",
        strokeId: stroke.id,
        startedAt: stroke.startedAt,
        ...stroke.tags,
      }),
    );
    for (const e of stroke.events) {
      lines.push(
        JSON.stringify({
          kind: "event",
          strokeId: stroke.id,
          ...e,
        }),
      );
    }
    lines.push(
      JSON.stringify({
        kind: "stroke_end",
        strokeId: stroke.id,
        endedAt: stroke.endedAt,
        events: stroke.events.length,
      }),
    );
  }

  return lines.join("\n");
}

export function downloadString(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function exportSessionAsJsonl(session: Session) {
  const filename = `session_${session.meta.id}.jsonl`;
  downloadString(filename, sessionToJsonl(session), "application/x-ndjson");
}

export function exportSessionAsJson(session: Session) {
  const filename = `session_${session.meta.id}.json`;
  downloadString(filename, JSON.stringify(session, null, 2), "application/json");
}
