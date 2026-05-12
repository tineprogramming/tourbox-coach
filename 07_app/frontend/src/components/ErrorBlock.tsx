import { useState } from "react";
import { useT } from "../i18n/useT";

interface Props {
  error: string;
}

/** Selectable error block with a Copy button. The text below the header is
 * rendered in a <pre> so long JSON details from the FastAPI 502 detail
 * payload wrap and stay selectable. */
export function ErrorBlock({ error }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const el = document.getElementById("error-block-pre");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }

  return (
    <div className="error-block" role="alert">
      <div className="error-block-header">
        <span className="error-block-label">{t("err.label")}</span>
        <button
          type="button"
          className="error-block-copy"
          onClick={copy}
          title={t("err.copy")}
        >
          {copied ? t("err.copied") : t("err.copy")}
        </button>
      </div>
      <pre id="error-block-pre" className="error-block-text">{error}</pre>
    </div>
  );
}
