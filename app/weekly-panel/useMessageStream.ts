"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMessageStreamToken } from "./api";
import {
  SSE_EVENT_CONNECTED,
  SSE_EVENT_HEARTBEAT,
  SSE_EVENT_MESSAGE,
  SSE_EVENT_TIMEOUT,
  parseStreamMessageEvent,
} from "./messageStream";
import type { PanelMessage } from "./types";

const RECONNECT_BASE_MS = 1200;
const RECONNECT_MAX_MS = 10000;
const GIVE_UP_AFTER = 4;

/**
 * EventSource con stream_token corto (yggdra_infra #105).
 * Eventos: connected | message | heartbeat | timeout.
 * Tras timeout/error pide un token nuevo (el anterior expira a ~120 s) y reconecta.
 * Si el stream no está disponible, `live` queda false → poll de fallback.
 */
export function useMessageStream(opts: {
  enabled?: boolean;
  /** Filtra eventos `message` al hilo del alumno abierto (staff) o al propio (omitir). */
  clientId?: number | null;
  onMessages: (incoming: PanelMessage[]) => void;
}): { live: boolean } {
  const enabled = opts.enabled !== false;
  const clientId = opts.clientId ?? null;
  const onMessagesRef = useRef(opts.onMessages);
  const [live, setLive] = useState(false);

  useEffect(() => {
    onMessagesRef.current = opts.onMessages;
  }, [opts.onMessages]);

  useEffect(() => {
    if (!enabled) {
      setLive(false);
      return;
    }
    if (typeof EventSource === "undefined") {
      setLive(false);
      return;
    }

    let cancelled = false;
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let failCount = 0;

    const onConnected = () => {
      if (cancelled) return;
      failCount = 0;
      setLive(true);
    };

    const onMessage = (event: MessageEvent) => {
      if (cancelled) return;
      const msg = parseStreamMessageEvent(String(event.data || ""), clientId);
      if (!msg) return;
      onMessagesRef.current([msg]);
    };

    const onHeartbeat = () => {
      if (cancelled) return;
      failCount = 0;
      setLive(true);
    };

    const scheduleReconnect = (immediate = false) => {
      if (cancelled) return;
      failCount += 1;
      setLive(false);
      if (failCount >= GIVE_UP_AFTER) return;
      const delay = immediate
        ? 0
        : Math.min(RECONNECT_BASE_MS * 2 ** (failCount - 1), RECONNECT_MAX_MS);
      reconnectTimer = setTimeout(() => {
        void connect();
      }, delay);
    };

    const onTimeout = () => {
      if (cancelled) return;
      // Token ~120 s; el servidor cierra a ~300 s → pedir token nuevo y reconectar.
      cleanupSource();
      scheduleReconnect(true);
    };

    const onError = () => {
      if (cancelled) return;
      cleanupSource();
      scheduleReconnect(false);
    };

    function cleanupSource() {
      if (!source) return;
      source.removeEventListener(SSE_EVENT_CONNECTED, onConnected);
      source.removeEventListener(SSE_EVENT_MESSAGE, onMessage as EventListener);
      source.removeEventListener(SSE_EVENT_HEARTBEAT, onHeartbeat);
      source.removeEventListener(SSE_EVENT_TIMEOUT, onTimeout);
      source.onerror = null;
      source.close();
      source = null;
    }

    async function connect() {
      if (cancelled) return;
      // Siempre token nuevo: el stream_token expira (~120 s).
      const tokenInfo = await fetchMessageStreamToken();
      if (cancelled) return;
      if (!tokenInfo) {
        setLive(false);
        return;
      }

      cleanupSource();
      try {
        source = new EventSource(tokenInfo.url);
      } catch {
        setLive(false);
        return;
      }

      source.addEventListener(SSE_EVENT_CONNECTED, onConnected);
      source.addEventListener(SSE_EVENT_MESSAGE, onMessage as EventListener);
      source.addEventListener(SSE_EVENT_HEARTBEAT, onHeartbeat);
      source.addEventListener(SSE_EVENT_TIMEOUT, onTimeout);
      source.onerror = onError;
    }

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cleanupSource();
      setLive(false);
    };
  }, [enabled, clientId]);

  return { live };
}

/** Intervalo de poll cuando el SSE no está disponible (ms). */
export const MESSAGE_FETCH_FALLBACK_MS = 20_000;
