import { useCanvasStore } from "../state/store";
import { LOCALE_OPTIONS, type Locale } from "../i18n/strings";
import { useT } from "../i18n/useT";

export function LanguagePicker() {
  const t = useT();
  const locale = useCanvasStore((s) => s.locale);
  const setLocale = useCanvasStore((s) => s.setLocale);

  return (
    <label className="provider-toggle" title={t("lang.label")}>
      <span className="provider-label">🌐</span>
      <select
        className="provider-select"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {LOCALE_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.flag} {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
