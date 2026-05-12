import { useEffect, useState } from "react";
import { useCanvasStore, COACH_PROVIDERS, COACH_CATEGORY_META, type CoachCategory, type CoachProviderId } from "../state/store";
import { useInternetStatus } from "../net/useInternetStatus";
import { useT } from "../i18n/useT";
import { PolishModal } from "./PolishModal";
import { VisionModal } from "./VisionModal";
import { BenchmarkModal } from "./BenchmarkModal";
import { getCanvasSnapshot } from "../util/canvasSnapshot";

const CATEGORY_ORDER: CoachCategory[] = ["cluster", "local", "chinese", "international"];

export function AIBox() {
  const provider = useCanvasStore((s) => s.coachProvider);
  const setProvider = useCanvasStore((s) => s.setCoachProvider);
  const locale = useCanvasStore((s) => s.locale);
  const { online, loading } = useInternetStatus();
  const t = useT();
  const [polishOpen, setPolishOpen] = useState(false);
  const [visionOpen, setVisionOpen] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  const [proxyOn, setProxyOn] = useState(false);
  const [proxyBusy, setProxyBusy] = useState(false);

  const isInternational = COACH_PROVIDERS.find((p) => p.id === provider)?.category === "international";

  // Fetch initial proxy state on mount.
  useEffect(() => {
    fetch("/api/proxy/status")
      .then((r) => r.json())
      .then((d) => setProxyOn(Boolean(d.enabled)))
      .catch(() => {});
  }, []);

  // Auto-fall back to cluster (if online) or local if offline + on a cloud provider.
  useEffect(() => {
    if (loading) return;
    const meta = COACH_PROVIDERS.find((p) => p.id === provider);
    if (meta?.needsInternet && !online) {
      setProvider("local");
    }
  }, [online, loading, provider, setProvider]);

  const toggleProxy = async () => {
    setProxyBusy(true);
    try {
      const r = await fetch("/api/proxy/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !proxyOn }),
      });
      const d = await r.json();
      setProxyOn(Boolean(d.enabled));
    } catch {
      // ignore
    } finally {
      setProxyBusy(false);
    }
  };

  return (
    <>
      <section className="ai-box" aria-label="AI features">
        <header className="ai-box-header">
          <span className="ai-box-badge">🤖 AI</span>
          <span className="ai-box-sub">{t("ai.sub")}</span>
          <button
            type="button"
            className="ai-bench-btn"
            onClick={() => setBenchOpen(true)}
            title="Compare API latency direct vs via Singapore proxy"
          >
            🔬 Benchmark
          </button>
          <button
            type="button"
            className={`ai-proxy-toggle${proxyOn ? " is-on" : ""}`}
            onClick={toggleProxy}
            disabled={proxyBusy}
            title={
              proxyOn
                ? "All API calls route through amazonsg (Singapore). Click to disable."
                : "Click to route all API calls via the amazonsg proxy (helps bypass GFW)."
            }
          >
            <span className="ai-proxy-dot" />
            🌏 SG proxy {proxyOn ? "ON" : "OFF"}
          </button>
        </header>

        <div className="ai-box-row">
          <label className="ai-coach-field">
            <span className="ai-coach-label">{t("coach.label")}</span>
            <select
              className="ai-coach-select"
              value={provider}
              onChange={(e) => setProvider(e.target.value as CoachProviderId)}
            >
              {CATEGORY_ORDER.map((cat) => {
                const inCat = COACH_PROVIDERS.filter((p) => p.category === cat);
                if (!inCat.length) return null;
                const meta = COACH_CATEGORY_META[cat];
                const groupLabel = `${meta.icon} ${locale === "zh-CN" ? meta.labelZh : meta.labelEn}`;
                return (
                  <optgroup key={cat} label={groupLabel}>
                    {inCat.map((p) => (
                      <option key={p.id} value={p.id} disabled={p.needsInternet && !online}>
                        {p.flag} {p.label}{p.openSource ? " (opensource)" : ""} · {p.hint}
                        {p.needsInternet && !online ? t("coachProv.offlineSuffix") : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>

          <div className="ai-actions">
            <button
              type="button"
              className="ai-action-btn ai-action-polish"
              onClick={() => setPolishOpen(true)}
              title={t("act.polish")}
            >
              <span className="ai-action-icon">🎨</span>
              <span className="ai-action-text">{t("act.polish")}</span>
            </button>
            <button
              type="button"
              className="ai-action-btn ai-action-vision"
              onClick={() => setVisionOpen(true)}
              title={t("act.askVision")}
            >
              <span className="ai-action-icon">👁</span>
              <span className="ai-action-text">{t("act.askVision")}</span>
            </button>
          </div>
        </div>

        {isInternational && (
          <div className="ai-box-note">ⓘ {t("ai.intlNote")}</div>
        )}
      </section>

      <BenchmarkModal open={benchOpen} onClose={() => setBenchOpen(false)} />
      <PolishModal open={polishOpen} onClose={() => setPolishOpen(false)} getCanvasDataUrl={getCanvasSnapshot} />
      <VisionModal open={visionOpen} onClose={() => setVisionOpen(false)} getCanvasDataUrl={getCanvasSnapshot} />
    </>
  );
}
