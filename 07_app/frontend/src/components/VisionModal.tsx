import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { ErrorBlock } from "./ErrorBlock";
import { Lightbox } from "./Lightbox";
import { useT } from "../i18n/useT";
import { useCanvasStore } from "../state/store";
import type { StringKey } from "../i18n/strings";

interface Region {
  label: string;
  bbox: [number, number, number, number];
}

interface VisionResult {
  reply: string;
  regions: Region[];
  image_width: number | null;
  image_height: number | null;
  model: string;
  prompt: string;
  elapsed: number;
}

const SUGGESTED_KEYS = [
  "vision.suggest.see",
  "vision.suggest.proportions",
  "vision.suggest.style",
  "vision.suggest.practice",
] as const;

const REGION_HUES = [200, 340, 60, 280, 130, 20, 240, 100];

type VisionCategory = "cluster" | "chinese" | "international";

interface VisionProviderOption {
  id: string;
  label: string;
  vendor: string;
  category: VisionCategory;
  estimate: string;
  hint?: string;
  flag: string;
  openSource: boolean;
}

const VISION_PROVIDERS: VisionProviderOption[] = [
  { id: "cluster",   label: "Qwen3-VL-30B-A3B-AWQ", vendor: "Thailand 4090", category: "cluster",       estimate: "1-3s", flag: "🇹🇭", openSource: true,  hint: "accurate bboxes" },
  { id: "dashscope", label: "Qwen-VL-Max",          vendor: "Alibaba",       category: "chinese",       estimate: "2-5s", flag: "🇨🇳", openSource: false, hint: "accurate bboxes" },
  { id: "openai",    label: "OpenAI GPT-4o",        vendor: "OpenAI",        category: "international", estimate: "4-9s", flag: "🇺🇸", openSource: false, hint: "great prose, bboxes approximate" },
];

const VISION_CATEGORY_ICON: Record<VisionCategory, string> = {
  cluster: "🇹🇭",
  chinese: "🇨🇳",
  international: "🌎",
};

type VisionCellState =
  | { status: "loading"; startedAt: number }
  | { status: "done"; result: VisionResult; elapsed: number }
  | { status: "error"; error: string; elapsed: number };

interface Props {
  open: boolean;
  onClose: () => void;
  getCanvasDataUrl: () => string | null;
}

export function VisionModal({ open, onClose, getCanvasDataUrl }: Props) {
  const t = useT();
  const locale = useCanvasStore((s) => s.locale);

  const [prompt, setPrompt] = useState(() => t("vision.default"));
  const [selected, setSelected] = useState<Set<string>>(new Set(["cluster"]));
  const [results, setResults] = useState<Record<string, VisionCellState>>({});
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  // activeRegion is per-provider so hovering inside one cell doesn't
  // light up another cell's regions (different providers find different
  // regions even on the same sketch).
  const [activeRegion, setActiveRegion] = useState<Record<string, number | null>>({});
  const [lightbox, setLightbox] = useState<{ src: string; providerId: string } | null>(null);
  const [lbActive, setLbActive] = useState<number | null>(null);

  useEffect(() => {
    setPrompt((p) => {
      const allDefaults = ["Look at my drawing", "看看我的画"];
      if (allDefaults.some((d) => p.startsWith(d))) return t("vision.default");
      return p;
    });
  }, [locale, t]);

  useEffect(() => {
    if (open) {
      setResults({});
      setTopError(null);
      setSourcePreview(null);
      setActiveRegion({});
    }
  }, [open]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(VISION_PROVIDERS.map((p) => p.id)));
  }, []);

  const selectClusterOnly = useCallback(() => {
    setSelected(new Set(["cluster"]));
  }, []);

  const busy = Object.values(results).some((r) => r.status === "loading");

  const askOne = useCallback((provider: string, dataUrl: string) => {
    const startedAt = Date.now();
    setResults((prev) => ({ ...prev, [provider]: { status: "loading", startedAt } }));
    fetch("/api/vision/grounded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, prompt, lang: locale, provider }),
    })
      .then(async (resp) => {
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`);
        }
        return (await resp.json()) as VisionResult;
      })
      .then((result) => {
        setResults((prev) => ({
          ...prev,
          [provider]: { status: "done", result, elapsed: (Date.now() - startedAt) / 1000 },
        }));
      })
      .catch((err: unknown) => {
        setResults((prev) => ({
          ...prev,
          [provider]: {
            status: "error",
            error: err instanceof Error ? err.message : String(err),
            elapsed: (Date.now() - startedAt) / 1000,
          },
        }));
      });
  }, [prompt, locale]);

  const ask = useCallback(async (e?: ReactMouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (selected.size === 0) return;
    const dataUrl = getCanvasDataUrl();
    if (!dataUrl) {
      setTopError("could not capture canvas");
      return;
    }
    setSourcePreview(dataUrl);
    setTopError(null);
    setActiveRegion({});
    for (const provider of selected) askOne(provider, dataUrl);
  }, [selected, getCanvasDataUrl, askOne]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="polish-overlay" role="dialog" aria-modal="true" aria-labelledby="vision-title">
      <div className="polish-modal polish-modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="polish-header">
          <h2 id="vision-title">{t("vision.title")}</h2>
          <button
            type="button"
            className="polish-close"
            onClick={onClose}
            disabled={busy}
            aria-label={t("err.close")}
          >
            ×
          </button>
        </header>

        <div className="polish-body">
          {/* QUESTION + ASK */}
          <div className="polish-controls">
            <label className="polish-field" style={{ flex: 1 }}>
              <span>{t("vision.question")}</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={busy}
                rows={2}
                style={{ width: "100%", resize: "vertical" }}
              />
            </label>
            <button
              type="button"
              className="polish-generate"
              onClick={ask}
              disabled={busy || !prompt.trim() || selected.size === 0}
            >
              {busy
                ? `${t("vision.looking")} (${selected.size})`
                : selected.size > 1
                  ? t("polish.compareN").replace("{n}", String(selected.size))
                  : t("vision.ask")}
            </button>
          </div>

          <div className="vision-suggestions">
            {SUGGESTED_KEYS.map((k) => {
              const text = t(k);
              return (
                <button
                  key={k}
                  type="button"
                  className="vision-suggest"
                  onClick={() => setPrompt(text)}
                  disabled={busy}
                >
                  {text}
                </button>
              );
            })}
          </div>

          {/* MODELS — multi-select chip grid */}
          <div className="polish-multi">
            <div className="polish-multi-header">
              <span className="polish-multi-title">{t("polish.modelsCompare")}</span>
              <div className="polish-multi-toolbar">
                <button type="button" className="polish-multi-quick" onClick={selectClusterOnly} disabled={busy}>
                  {t("polish.justCluster")}
                </button>
                <button type="button" className="polish-multi-quick" onClick={selectAll} disabled={busy}>
                  {t("polish.selectAll")} ({VISION_PROVIDERS.length})
                </button>
              </div>
            </div>
            <div className="polish-multi-grid">
              {(["cluster", "chinese", "international"] as VisionCategory[]).map((cat) => {
                const inCat = VISION_PROVIDERS.filter((p) => p.category === cat);
                if (!inCat.length) return null;
                const catKey = `vision.providerCategory.${cat}` as StringKey;
                return (
                  <div key={cat} className="polish-multi-cat">
                    <div className="polish-multi-cat-label">
                      {VISION_CATEGORY_ICON[cat]} {t(catKey)}
                    </div>
                    <div className="polish-multi-chips">
                      {inCat.map((p) => {
                        const on = selected.has(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`polish-chip${on ? " is-active" : ""}`}
                            onClick={() => toggle(p.id)}
                            disabled={busy}
                          >
                            <span className="polish-chip-check">{on ? "✓" : ""}</span>
                            <span className="polish-chip-body">
                              <span className="polish-chip-label">
                                {p.flag} {p.label}
                                {p.openSource && <span className="oss-tag"> (opensource)</span>}
                              </span>
                              <span className="polish-chip-meta">{p.vendor} · ~{p.estimate}</span>
                              {p.hint && <span className="polish-chip-hint">{p.hint}</span>}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {topError && <ErrorBlock error={topError} />}

          {/* RESULTS — one cell per provider, each with own sketch+bbox overlay + reply */}
          {(sourcePreview || Object.keys(results).length > 0) && (
            <div className="polish-results-compare">
              {sourcePreview && (
                <figure className="polish-compare-cell polish-compare-cell-source">
                  <div className="polish-compare-cell-head">
                    <span className="polish-compare-cell-label">
                      📝 {t("polish.yourSketch")}
                    </span>
                    <span className="polish-compare-cell-vendor">input</span>
                  </div>
                  <img
                    src={sourcePreview}
                    alt="your sketch"
                    className="polish-compare-cell-img lb-trigger"
                    onClick={() => setLightbox({ src: sourcePreview, providerId: "_source" })}
                    title="Click to expand"
                  />
                  <figcaption className="polish-compare-cell-foot">
                    {t("polish.yourSketch")}
                  </figcaption>
                </figure>
              )}
              {Object.entries(results).map(([providerId, cell]) => {
                const meta = VISION_PROVIDERS.find((p) => p.id === providerId);
                const label = meta?.label ?? providerId;
                return (
                  <figure key={providerId} className="polish-compare-cell vision-compare-cell">
                    <div className="polish-compare-cell-head">
                      <span className="polish-compare-cell-label">
                        {meta?.flag ?? "🌎"} {label}
                        {meta?.openSource && <span className="oss-tag"> (opensource)</span>}
                      </span>
                      {meta?.vendor && (
                        <span className="polish-compare-cell-vendor">{meta.vendor}</span>
                      )}
                    </div>
                    {cell.status === "loading" && (
                      <div className="polish-compare-cell-loading">
                        <div className="polish-compare-cell-shimmer" />
                        <div className="polish-compare-cell-loading-text">
                          <span>{t("vision.thinking")}</span>
                          <small>~{meta?.estimate ?? "?"} estimated</small>
                        </div>
                      </div>
                    )}
                    {cell.status === "done" && (
                      <VisionResultCell
                        providerId={providerId}
                        sourcePreview={sourcePreview}
                        result={cell.result}
                        elapsed={cell.elapsed}
                        activeRegion={activeRegion[providerId] ?? null}
                        setActive={(idx) =>
                          setActiveRegion((prev) => ({ ...prev, [providerId]: idx }))
                        }
                        onExpand={() => setLightbox({ src: sourcePreview!, providerId })}
                      />
                    )}
                    {cell.status === "error" && (
                      <div className="polish-compare-cell-error">
                        <ErrorBlock error={cell.error} />
                        <button
                          type="button"
                          className="retry-btn"
                          onClick={() => sourcePreview && askOne(providerId, sourcePreview)}
                        >
                          ↻ Retry
                        </button>
                      </div>
                    )}
                    {(cell.status !== "done") && (
                      <figcaption className="polish-compare-cell-foot">
                        {cell.status === "loading"
                          ? t("vision.thinking")
                          : `${t("err.label")} · ${cell.elapsed.toFixed(1)}s`}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );

  // Build the lightbox with optional bbox overlay + details aside
  const lbResult = lightbox?.providerId !== "_source"
    ? Object.entries(results).find(([id]) => id === lightbox?.providerId)?.[1]
    : null;
  const lbRegions = lbResult?.status === "done" ? (lbResult.result.regions ?? []) : [];
  const lbImgW = lbResult?.status === "done" ? (lbResult.result.image_width ?? 1024) : 1024;
  const lbImgH = lbResult?.status === "done" ? (lbResult.result.image_height ?? 1024) : 1024;

  const lbOverlay = lbRegions.length > 0 ? (
    <svg viewBox={`0 0 ${lbImgW} ${lbImgH}`} preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {lbRegions.map((r, i) => {
        const [x1, y1, x2, y2] = r.bbox;
        const hue = [200, 340, 60, 280, 130, 20, 240, 100][i % 8];
        const on = lbActive === i;
        return (
          <g key={i} style={{ pointerEvents: "auto" }}>
            <rect x={x1} y={y1} width={Math.max(1, x2-x1)} height={Math.max(1, y2-y1)}
              fill={`hsla(${hue},80%,55%,${on ? 0.35 : 0.12})`}
              stroke={`hsl(${hue},75%,50%)`} strokeWidth={on ? 5 : 2}
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => setLbActive(i)} onMouseLeave={() => setLbActive(null)}
              style={{ cursor: "pointer" }} />
            {on && (
              <text x={x1 + 8} y={Math.max(y1 + 26, 26)}
                fontSize={Math.max(16, lbImgW / 35)} fontWeight={700}
                fill={`hsl(${hue},80%,30%)`} paintOrder="stroke" stroke="white" strokeWidth={4}>
                {r.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  ) : undefined;

  const lbAside = lbResult?.status === "done" ? (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>
        {VISION_PROVIDERS.find(p => p.id === lightbox?.providerId)?.flag ?? "👁"}
        {" "}{VISION_PROVIDERS.find(p => p.id === lightbox?.providerId)?.label ?? lightbox?.providerId}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", margin: "0 0 12px" }}>
        {lbResult.result.reply}
      </p>
      {lbRegions.length > 0 && (
        <>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
            {lbRegions.length} region{lbRegions.length !== 1 ? "s" : ""} — hover to highlight
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {lbRegions.map((r, i) => {
              const hue = [200, 340, 60, 280, 130, 20, 240, 100][i % 8];
              const on = lbActive === i;
              return (
                <button key={i} type="button"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px 4px 8px", borderRadius: 999,
                    border: `1px solid hsl(${hue},60%,60%)`,
                    background: on ? `hsla(${hue},70%,55%,0.25)` : `hsla(${hue},70%,55%,0.10)`,
                    color: `hsl(${hue},80%,80%)`, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  }}
                  onMouseEnter={() => setLbActive(i)} onMouseLeave={() => setLbActive(null)}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: `hsl(${hue},75%,55%)`, display: "inline-block" }} />
                  {r.label}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
        {lbResult.result.model} · {lbResult.elapsed.toFixed(1)}s
      </div>
    </div>
  ) : undefined;

  return (
    <>
      {modal}
      {lightbox && (
        <Lightbox
          src={lightbox.src}
          onClose={() => { setLightbox(null); setLbActive(null); }}
          overlay={lbOverlay}
          aside={lbAside}
        />
      )}
    </>
  );
}

/** One result cell — sketch thumbnail with the provider's bboxes overlaid,
 * reply text, region chips, elapsed footer. */
function VisionResultCell({
  providerId,
  sourcePreview,
  result,
  elapsed,
  activeRegion,
  setActive,
  onExpand,
}: {
  providerId: string;
  sourcePreview: string | null;
  result: VisionResult;
  elapsed: number;
  activeRegion: number | null;
  setActive: (idx: number | null) => void;
  onExpand?: () => void;
}) {
  const regions = result.regions ?? [];
  const imgW = result.image_width ?? 1024;
  const imgH = result.image_height ?? 1024;

  return (
    <div className="vision-cell-inner">
      {sourcePreview && (
        <div
          className="vision-cell-sketch-frame lb-trigger"
          onClick={onExpand}
          title="Click to expand"
          style={{ cursor: onExpand ? "zoom-in" : undefined }}
        >
          <img src={sourcePreview} alt="sketch" className="vision-cell-sketch" />
          {regions.length > 0 && (
            <svg
              className="vision-cell-overlay"
              viewBox={`0 0 ${imgW} ${imgH}`}
              preserveAspectRatio="none"
            >
              {regions.map((r, i) => {
                const [x1, y1, x2, y2] = r.bbox;
                const hue = REGION_HUES[i % REGION_HUES.length];
                const isActive = activeRegion === i;
                return (
                  <g key={`${providerId}-${i}`}>
                    <rect
                      x={x1}
                      y={y1}
                      width={Math.max(1, x2 - x1)}
                      height={Math.max(1, y2 - y1)}
                      fill={`hsla(${hue}, 80%, 55%, ${isActive ? 0.28 : 0.08})`}
                      stroke={`hsl(${hue}, 75%, 50%)`}
                      strokeWidth={isActive ? 4 : 2}
                      vectorEffect="non-scaling-stroke"
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      style={{ cursor: "pointer", transition: "all 120ms ease" }}
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      )}
      <div className="vision-cell-reply">
        <p>{result.reply}</p>
      </div>
      {regions.length > 0 && (
        <div className="vision-cell-chips">
          {regions.map((r, i) => {
            const hue = REGION_HUES[i % REGION_HUES.length];
            const isActive = activeRegion === i;
            return (
              <button
                key={i}
                type="button"
                className={`vision-region-chip${isActive ? " is-active" : ""}`}
                style={{
                  borderColor: `hsl(${hue}, 70%, 50%)`,
                  background: isActive
                    ? `hsla(${hue}, 80%, 55%, 0.18)`
                    : `hsla(${hue}, 80%, 55%, 0.06)`,
                }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span
                  className="vision-region-dot"
                  style={{ background: `hsl(${hue}, 75%, 50%)` }}
                />
                {r.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="polish-compare-cell-foot">
        {result.model} · {elapsed.toFixed(1)}s · {regions.length} regions
      </div>
    </div>
  );
}
