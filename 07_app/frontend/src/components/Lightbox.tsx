import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  src: string;
  alt?: string;
  onClose: () => void;
  /** Optional overlay content (e.g. SVG bbox regions) rendered on top of the image. */
  overlay?: ReactNode;
  /** Optional metadata panel shown to the right on wide screens. */
  aside?: ReactNode;
}

export function Lightbox({ src, alt = "", onClose, overlay, aside }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="lb-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        className="lb-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <div
        className={`lb-content${aside ? " lb-with-aside" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lb-img-wrap">
          <img src={src} alt={alt} className="lb-img" />
          {overlay && (
            <div className="lb-img-overlay">{overlay}</div>
          )}
        </div>
        {aside && (
          <aside className="lb-aside">{aside}</aside>
        )}
      </div>
      <div className="lb-hint">Click outside or press Esc to close</div>
    </div>,
    document.body,
  );
}
