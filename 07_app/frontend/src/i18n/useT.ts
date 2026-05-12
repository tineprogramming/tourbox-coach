import { useCanvasStore } from "../state/store";
import { translate, type StringKey } from "./strings";

/** Hook: returns a t(key) function bound to the current store locale.
 * Component re-renders whenever the user changes language. */
export function useT() {
  const locale = useCanvasStore((s) => s.locale);
  return (key: StringKey) => translate(key, locale);
}
