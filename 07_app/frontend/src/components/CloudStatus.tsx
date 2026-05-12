import { useInternetStatus } from "../net/useInternetStatus";
import { useT } from "../i18n/useT";

export function CloudStatus() {
  const { online, via, loading } = useInternetStatus();
  const t = useT();
  const label = loading
    ? t("cloud.checking")
    : online
      ? t("cloud.online").replace(/^Cloud · |^云端 · /, "")
      : t("cloud.offline").replace(/^Cloud · |^云端 · /, "");
  const color = loading ? "#888" : online ? "#2c7d2e" : "#a82323";
  const tooltip = loading
    ? t("cloud.checking")
    : online
      ? `Internet reachable via ${via ?? "upstream"}`
      : t("cloud.offline");
  return (
    <div className="conn-status" title={tooltip}>
      <span className="conn-dot" style={{ background: color }} aria-hidden />
      <span className="conn-label">Cloud · {label}</span>
    </div>
  );
}
