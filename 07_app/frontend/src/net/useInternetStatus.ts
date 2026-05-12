// Polls /api/pi/internet so the UI can disable cloud-only features when the
// Pi can't reach the internet (e.g. unknown hotel WiFi, captive portal).

import { useEffect, useState } from "react";

export interface InternetStatus {
  online: boolean;
  via: string | null;
  checked_at: number | null;
  loading: boolean;
}

const POLL_MS = 25_000; // backend caches 20s; we poll just past that.

export function useInternetStatus(): InternetStatus {
  const [state, setState] = useState<InternetStatus>({
    online: true,           // optimistic — avoid flash of "offline" on cold load.
    via: null,
    checked_at: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick(force = false) {
      try {
        const r = await fetch(`/api/pi/internet${force ? "?force=true" : ""}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (cancelled) return;
        setState({
          online: !!json.online,
          via: json.via ?? null,
          checked_at: json.checked_at ?? null,
          loading: false,
        });
      } catch {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false }));
      } finally {
        if (!cancelled) timer = setTimeout(() => tick(false), POLL_MS);
      }
    }

    tick(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return state;
}
