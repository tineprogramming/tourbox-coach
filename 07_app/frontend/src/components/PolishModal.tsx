import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { ErrorBlock } from "./ErrorBlock";
import { Lightbox } from "./Lightbox";
import { useT } from "../i18n/useT";
import { useCanvasStore } from "../state/store";
import type { StringKey } from "../i18n/strings";

interface PolishResult {
  images: string[];
  style: string;
  prompt: string;
  provider?: string;
  model?: string;
  task_id?: string;
  fallback_from?: string;
  caption?: string;
  elapsed?: number;
}

type PolishMode = "faithful" | "reimagine";
type PolishCategory = "cluster" | "chinese" | "international";

interface ProviderOption {
  id: string;
  label: string;
  vendor: string;
  estimate: string;
  mode: PolishMode;
  category: PolishCategory;
  hint?: string;
  flag: string;
  openSource: boolean;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: "cluster-faithful", label: "Cluster · Faithful",  vendor: "Thailand 4090",   estimate: "25-30s", mode: "faithful",  category: "cluster",       flag: "🇹🇭", openSource: true,  hint: "Flux dev + Canny ControlNet" },
  { id: "cluster",          label: "Cluster · Reimagine", vendor: "Thailand 4090",   estimate: "10-15s", mode: "reimagine", category: "cluster",       flag: "🇹🇭", openSource: true,  hint: "Vision-captioned Flux schnell" },
  { id: "wanxiang",         label: "Wanxiang 2.1",        vendor: "Alibaba",         estimate: "15-20s", mode: "faithful",  category: "chinese",       flag: "🇨🇳", openSource: false },
  { id: "seedream",         label: "Seedream 5.0",        vendor: "ByteDance",       estimate: "25-35s", mode: "faithful",  category: "chinese",       flag: "🇨🇳", openSource: false },
  { id: "z-image",          label: "Z-Image Turbo",       vendor: "Alibaba Tongyi",  estimate: "3-5s",   mode: "reimagine", category: "chinese",       flag: "🇨🇳", openSource: true,  hint: "0.6s inference" },
  { id: "bagel",            label: "Bagel",               vendor: "ByteDance-Seed",  estimate: "8-15s",  mode: "faithful",  category: "chinese",       flag: "🇨🇳", openSource: true,  hint: "autoregressive 7B" },
  { id: "flux-kontext",     label: "Flux Kontext Pro",    vendor: "Black Forest Labs", estimate: "30-40s", mode: "faithful", category: "international", flag: "🇩🇪", openSource: false },
  { id: "openai",           label: "OpenAI gpt-image-1",  vendor: "OpenAI",          estimate: "20-40s", mode: "faithful",  category: "international", flag: "🇺🇸", openSource: false, hint: "autoregressive" },
  { id: "nano-banana",      label: "Nano Banana 2",       vendor: "Google",          estimate: "10-15s", mode: "faithful",  category: "international", flag: "🇺🇸", openSource: false, hint: "Gemini image edit" },
];

const CATEGORY_LABEL_KEY: Record<PolishCategory, StringKey> = {
  cluster: "polish.providerCategory.cluster",
  chinese: "polish.providerCategory.chinese",
  international: "polish.providerCategory.international",
};

const CATEGORY_ICON: Record<PolishCategory, string> = {
  cluster: "🇹🇭",
  chinese: "🇨🇳",
  international: "🌎",
};

const STYLE_OPTIONS: { id: string; labelKey: StringKey }[] = [
  { id: "watercolor", labelKey: "style.watercolor" },
  { id: "anime", labelKey: "style.anime" },
  { id: "oil_painting", labelKey: "style.oilPainting" },
  { id: "pencil_sketch", labelKey: "style.pencilSketch" },
  { id: "concept_art", labelKey: "style.conceptArt" },
  { id: "ink_wash", labelKey: "style.inkWash" },
  { id: "realistic", labelKey: "style.realistic" },
];

type CellState =
  | { status: "loading"; startedAt: number }
  | { status: "done"; result: PolishResult; elapsed: number }
  | { status: "error"; error: string; elapsed: number };

interface Props {
  open: boolean;
  onClose: () => void;
  getCanvasDataUrl: () => string | null;
}

export function PolishModal({ open, onClose, getCanvasDataUrl }: Props) {
  const t = useT();
  const locale = useCanvasStore((s) => s.locale);

  const [mode, setMode] = useState<PolishMode>("faithful");
  const [style, setStyle] = useState("watercolor");
  const [selected, setSelected] = useState<Set<string>>(new Set(["cluster-faithful"]));
  const [results, setResults] = useState<Record<string, CellState>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);

  const filteredProviders = useMemo(
    () => PROVIDER_OPTIONS.filter((p) => p.mode === mode),
    [mode],
  );

  // When mode flips, reset to cluster-only and clear stale results.
  useEffect(() => {
    const def = filteredProviders.find((p) => p.category === "cluster") ?? filteredProviders[0];
    setSelected(def ? new Set([def.id]) : new Set());
    setResults({});
  }, [mode, filteredProviders]);

  useEffect(() => {
    if (open) {
      setResults({});
      setTopError(null);
      setSourcePreview(null);
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
    setSelected(new Set(filteredProviders.map((p) => p.id)));
  }, [filteredProviders]);

  const selectClusterOnly = useCallback(() => {
    const cluster = filteredProviders.find((p) => p.category === "cluster");
    setSelected(cluster ? new Set([cluster.id]) : new Set());
  }, [filteredProviders]);

  const busy = Object.values(results).some((r) => r.status === "loading");

  /** Fire one provider and update its cell independently. Used by both
   * bulk Generate and per-cell Retry. */
  const generateOne = useCallback((provider: string, dataUrl: string) => {
    const startedAt = Date.now();
    setResults((prev) => ({ ...prev, [provider]: { status: "loading", startedAt } }));
    fetch("/api/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, style, provider, n: 1, lang: locale }),
    })
      .then(async (resp) => {
        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`);
        }
        return (await resp.json()) as PolishResult;
      })
      .then((result) => {
        setResults((prev) => ({
          ...prev,
          [provider]: { status: "done", result, elapsed: (Date.now() - startedAt) / 1000 },
        }));
      })
      .catch((e: unknown) => {
        setResults((prev) => ({
          ...prev,
          [provider]: {
            status: "error",
            error: e instanceof Error ? e.message : String(e),
            elapsed: (Date.now() - startedAt) / 1000,
          },
        }));
      });
  }, [style, locale]);

  const generate = useCallback(async (e?: ReactMouseEvent) => {
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
    for (const provider of selected) generateOne(provider, dataUrl);
  }, [selected, getCanvasDataUrl, generateOne]);

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

  // Render at document.body so the modal is isolated from any potential
  // ancestor <form>, transform, or stacking context. Belt-and-suspenders
  // for the "page seems to refresh on Compare" bug — the modal had no
  // form parent, but rendering as a portal removes any chance of
  // accidental form submission via event bubbling.
  const modal = createPortal(
    <div className="polish-overlay" role="dialog" aria-modal="true" aria-labelledby="polish-title">
      <div className="polish-modal polish-modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="polish-header">
          <h2 id="polish-title">{t("polish.title")}</h2>
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
          {/* MODE PICKER */}
          <div className="polish-mode-picker">
            <span className="polish-mode-picker-label">{t("polish.modeHeader")}</span>
            <div className="polish-mode-options">
              <button
                type="button"
                className={`polish-mode-card${mode === "faithful" ? " is-active" : ""}`}
                onClick={() => setMode("faithful")}
                disabled={busy}
              >
                <strong>{t("polish.modeFaithful")}</strong>
                <small>{t("polish.modeFaithfulSub")}</small>
              </button>
              <button
                type="button"
                className={`polish-mode-card${mode === "reimagine" ? " is-active" : ""}`}
                onClick={() => setMode("reimagine")}
                disabled={busy}
              >
                <strong>{t("polish.modeReimagine")}</strong>
                <small>{t("polish.modeReimagineSub")}</small>
              </button>
            </div>
          </div>

          {/* STYLE + GENERATE */}
          <div className="polish-controls">
            <label className="polish-field">
              <span>{t("polish.style")}</span>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                disabled={busy}
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t(s.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="polish-generate"
              onClick={generate}
              disabled={busy || selected.size === 0}
            >
              {busy
                ? `${t("polish.generating")} (${selected.size})`
                : selected.size > 1
                  ? t("polish.compareN").replace("{n}", String(selected.size))
                  : t("polish.generate")}
            </button>
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
                  {t("polish.selectAll")} ({filteredProviders.length})
                </button>
              </div>
            </div>
            <div className="polish-multi-grid">
              {(["cluster", "chinese", "international"] as PolishCategory[]).map((cat) => {
                const inCat = filteredProviders.filter((p) => p.category === cat);
                if (!inCat.length) return null;
                return (
                  <div key={cat} className="polish-multi-cat">
                    <div className="polish-multi-cat-label">
                      {CATEGORY_ICON[cat]} {t(CATEGORY_LABEL_KEY[cat])}
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

          {/* RESULTS GRID — source sketch as first cell, then one cell per provider */}
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
                    onClick={() => setLightbox(sourcePreview)}
                    title="Click to expand"
                  />
                  <figcaption className="polish-compare-cell-foot">
                    {t("polish.yourSketch")}
                  </figcaption>
                </figure>
              )}
              {Object.entries(results).map(([providerId, cell]) => {
                const meta = PROVIDER_OPTIONS.find((p) => p.id === providerId);
                const label = meta?.label ?? providerId;
                const styleText = t(
                  STYLE_OPTIONS.find((s) => s.id === style)?.labelKey ?? "style.watercolor",
                );
                return (
                  <figure key={providerId} className="polish-compare-cell">
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
                          <span>{styleText}</span>
                          <small>~{meta?.estimate ?? "?"} estimated</small>
                        </div>
                      </div>
                    )}
                    {cell.status === "done" && cell.result.images[0] && (
                      <img
                        src={cell.result.images[0]}
                        alt={`polished by ${label}`}
                        className="polish-compare-cell-img lb-trigger"
                        onClick={() => setLightbox(cell.result.images[0])}
                        title="Click to expand"
                      />
                    )}
                    {cell.status === "error" && (
                      <div className="polish-compare-cell-error">
                        <ErrorBlock error={cell.error} />
                        <button
                          type="button"
                          className="retry-btn"
                          onClick={() => sourcePreview && generateOne(providerId, sourcePreview)}
                        >
                          ↻ Retry
                        </button>
                      </div>
                    )}
                    <figcaption className="polish-compare-cell-foot">
                      {cell.status === "loading"
                        ? t("polish.developing")
                        : cell.status === "done"
                          ? `${styleText} · ${cell.elapsed.toFixed(1)}s`
                          : `${t("err.label")} · ${cell.elapsed.toFixed(1)}s`}
                    </figcaption>
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
  return (
    <>
      {modal}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}
