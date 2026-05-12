import { useWsStore } from "../state/wsStore";
import { useT } from "../i18n/useT";
import type { StringKey } from "../i18n/strings";

const STATUS_KEY: Record<string, StringKey> = {
  connecting: "conn.connecting",
  connected: "conn.connected",
  reconnecting: "conn.reconnecting",
  disconnected: "conn.disconnected",
};

const STATUS_COLOR: Record<string, string> = {
  idle: "#888",
  connecting: "#d4a017",
  connected: "#2c7d2e",
  reconnecting: "#d4a017",
  disconnected: "#a82323",
};

export function ConnectionStatus() {
  const status = useWsStore((s) => s.status);
  const sid = useWsStore((s) => s.serverSessionId);
  const t = useT();
  const label = STATUS_KEY[status] ? t(STATUS_KEY[status]) : status;
  return (
    <div className="conn-status" title={`WebSocket: ${status}${sid ? ` · session ${sid}` : ""}`}>
      <span
        className="conn-dot"
        style={{ background: STATUS_COLOR[status] ?? "#888" }}
        aria-hidden
      />
      <span className="conn-label">Pi · {label}</span>
      {sid && <span className="conn-sid">{sid.slice(0, 6)}</span>}
    </div>
  );
}
