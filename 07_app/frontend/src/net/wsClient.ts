// Singleton WebSocket client to TourBox Coach backend (Pi).
// Auto-reconnect with backoff, message queue while disconnected.

import { useWsStore } from "../state/wsStore";

// Default to a relative URL — Vite's `/ws` proxy (dev) or nginx/FastAPI
// (prod) forwards to the FastAPI backend on the same host. Override via
// VITE_BACKEND_WS for cross-host dev (Mac frontend → Pi backend).
function defaultUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:5173/ws";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}
const URL = (import.meta.env.VITE_BACKEND_WS as string | undefined) ?? defaultUrl();

const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 4000, 8000, 15000];
const MAX_QUEUE = 500;

class WsClient {
  private ws: WebSocket | null = null;
  private queue: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  connect() {
    this.intentionallyClosed = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    useWsStore.getState().setStatus("connecting");
    try {
      this.ws = new WebSocket(URL);
    } catch (err) {
      console.error("[ws] construct failed", err);
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      useWsStore.getState().setStatus("connected");
      // Flush queued messages.
      const queued = this.queue.splice(0);
      for (const msg of queued) this.ws?.send(msg);
    });

    this.ws.addEventListener("message", (e) => {
      try {
        const msg = JSON.parse(e.data);
        useWsStore.getState().recordMessage(msg);
      } catch {
        console.warn("[ws] non-JSON message:", e.data);
      }
    });

    this.ws.addEventListener("close", () => {
      useWsStore.getState().setStatus(this.intentionallyClosed ? "disconnected" : "reconnecting");
      this.ws = null;
      if (!this.intentionallyClosed) this.scheduleReconnect();
    });

    this.ws.addEventListener("error", (e) => {
      console.warn("[ws] error", e);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = RECONNECT_BACKOFF_MS[Math.min(this.reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  send(payload: unknown) {
    const msg = JSON.stringify(payload);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      if (this.queue.length >= MAX_QUEUE) this.queue.shift();
      this.queue.push(msg);
    }
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  get url(): string {
    return URL;
  }
}

export const wsClient = new WsClient();
