"use client";

import { useEffect, useRef, useState } from "react";
import { fetchMessageStreamToken } from "./api";
import {
  SSE_EVENT_CONNECTED,
  SSE_EVENT_HEARTBEAT,
  SSE_EVENT_MESSAGE,
  SSE_EVENT_MESSAGE_DELETED,
  SSE_EVENT_TIMEOUT,
  parseStreamMessageDeletedEvent,
  parseStreamMessageEvent,
  type MessageDeletedPayload,
} from "./messageStream";
import type { PanelMessage } from "./types";

const RECONNECT_BASE_MS = 1200;
const RECONNECT_MAX_MS = 10000;
const GIVE_UP_AFTER = 4;

/**
 * EventSource con stream_token corto (yggdra_infra #105).
 * Eventos: connected | message | message_deleted | heartbeat | timeout.
 * `onopen` marca live de inmediato (no esperar al primer heartbeat ~15 s).
 * Tras timeout/error pide un token nuevo y reconecta.
 */
export function useMessageStream(opts: {
  enabled?: boolean;
  /** Filtra eventos `message` al hilo del alumno abierto (staff) o al propio (omitir). */
  clientId?: number | null;
  onMessages: (incoming: PanelMessage[]) => void;
  onMessagesDeleted?: (payload: MessageDeletedPayload) => void;
}): { live: boolean } {
  const enabled = opts.enabled !== false;
  const clientId = opts.clientId ?? null;
  const onMessagesRef = useRef(opts.onMessages);
  const onMessagesDeletedRef = useRef(opts.onMessagesDeleted);
  const [live, setLive] = useState(false);

  useEffect(() => {
    onMessagesRef.current = opts.onMessages;
  }, [opts.onMessages]);

  useEffect(() => {
    onMessagesDeletedRef.current = opts.onMessagesDeleted;
  }, [opts.onMessagesDeleted]);

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

    const markLive = () => {
      if (cancelled) return;
      failCount = 0;
      setLive(true);
    };

    const handlePayload = (raw: string) => {
      if (cancelled) return;
      const deleted = parseStreamMessageDeletedEvent(raw, clientId);
      if (deleted) {
        markLive();
        onMessagesDeletedRef.current?.(deleted);
        return;
      }
      const msg = parseStreamMessageEvent(raw, clientId);
      if (!msg) return;
      markLive();
      onMessagesRef.current([msg]);
    };

    const onConnected = () => markLive();
    const onNamedMessage = (event: Event) => {
      handlePayload(String((event as MessageEvent).data || ""));
    };
    const onNamedDeleted = (event: Event) => {
      if (cancelled) return;
      const deleted = parseStreamMessageDeletedEvent(
        String((event as MessageEvent).data || ""),
        clientId,
      );
      if (!deleted) return;
      markLive();
      onMessagesDeletedRef.current?.(deleted);
    };
    const onDefaultMessage = (event: MessageEvent) => {
      handlePayload(String(event.data || ""));
    };
    const onHeartbeat = () => markLive();

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
      source.removeEventListener(SSE_EVENT_MESSAGE, onNamedMessage);
      source.removeEventListener(SSE_EVENT_MESSAGE_DELETED, onNamedDeleted);
      source.removeEventListener(SSE_EVENT_HEARTBEAT, onHeartbeat);
      source.removeEventListener(SSE_EVENT_TIMEOUT, onTimeout);
      source.onmessage = null;
      source.onopen = null;
      source.onerror = null;
      source.close();
      source = null;
    }

    async function connect() {
      if (cancelled) return;
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

      // Conexión abierta → live ya (antes el UI esperaba el heartbeat ~15 s).
      source.onopen = markLive;
      source.addEventListener(SSE_EVENT_CONNECTED, onConnected);
      source.addEventListener(SSE_EVENT_MESSAGE, onNamedMessage);
      source.addEventListener(SSE_EVENT_MESSAGE_DELETED, onNamedDeleted);
      source.addEventListener(SSE_EVENT_HEARTBEAT, onHeartbeat);
      source.addEventListener(SSE_EVENT_TIMEOUT, onTimeout);
      // Respaldo si el servidor omite `event:` (tipo default = message).
      source.onmessage = onDefaultMessage;
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
