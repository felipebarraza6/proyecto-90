/**
 * Helpers SSE de mensajería — contrato yggdra_infra #105.
 * EventSource no envía Authorization → token corto vía POST (ver api.fetchMessageStreamToken).
 */

import type { PanelMessage } from "./types";

export const MESSAGES_STREAM_PATH = "/api/p90/panel/messages/stream";
export const MESSAGES_STREAM_TOKEN_PATH = "/api/p90/panel/messages/stream-token";

/** Eventos SSE nombrados del backend. */
export const SSE_EVENT_CONNECTED = "connected";
export const SSE_EVENT_MESSAGE = "message";
export const SSE_EVENT_MESSAGE_DELETED = "message_deleted";
export const SSE_EVENT_HEARTBEAT = "heartbeat";
export const SSE_EVENT_TIMEOUT = "timeout";

export type MessageDeletedPayload = {
  messageIds: Array<string | number>;
  broadcastId: string | number | null;
  clientId: number | null;
};

export type StreamTokenResponse = {
  stream_token?: string;
  /** Ruta relativa con query, p. ej. /api/p90/panel/messages/stream?stream_token=… */
  stream_path?: string;
  expires_in?: number;
};

/** Nombre exacto del query param en GET …/messages/stream. */
export const STREAM_TOKEN_QUERY_PARAM = "stream_token";

/** Une un mensaje nuevo al hilo sin duplicar por id. */
export function mergeMessageThread(
  current: PanelMessage[],
  incoming: PanelMessage | PanelMessage[] | null | undefined,
): PanelMessage[] {
  const add = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
  if (!add.length) return current;
  const byId = new Map<string, PanelMessage>();
  for (const row of current) {
    if (row?.id != null) byId.set(String(row.id), row);
  }
  for (const row of add) {
    if (!row || row.id == null) continue;
    byId.set(String(row.id), { ...byId.get(String(row.id)), ...row });
  }
  return [...byId.values()].sort((a, b) =>
    String(a.created_at || a.created || "").localeCompare(String(b.created_at || b.created || "")),
  );
}

/** Quita del hilo mensajes por id y/o por broadcast_id (borrado lógico / SSE). */
export function removeMessagesFromThread(
  current: PanelMessage[],
  opts: {
    messageIds?: Array<string | number> | null;
    broadcastId?: string | number | null;
  },
): PanelMessage[] {
  const ids = new Set((opts.messageIds || []).map((id) => String(id)));
  const broadcastId =
    opts.broadcastId != null && String(opts.broadcastId) !== ""
      ? String(opts.broadcastId)
      : null;
  if (!ids.size && !broadcastId) return current;
  return current.filter((row) => {
    if (row?.id != null && ids.has(String(row.id))) return false;
    if (
      broadcastId &&
      row?.broadcast_id != null &&
      String(row.broadcast_id) === broadcastId
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Payload del evento SSE `message`:
 * { type:"message", thread_id, message, client_id, branch_id }
 * `message` tiene la misma forma que los items de GET …/messages.
 */
export function parseStreamMessageEvent(
  raw: string,
  filterClientId?: number | null,
): PanelMessage | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const rec = data as Record<string, unknown>;
    if (rec.type != null && String(rec.type) !== "message") return null;

    if (filterClientId != null && Number.isFinite(Number(filterClientId))) {
      if (rec.client_id != null && Number(rec.client_id) !== Number(filterClientId)) {
        return null;
      }
    }

    const nested = rec.message;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const msg = nested as PanelMessage;
      if (msg.id == null) return null;
      return msg;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Payload del evento SSE `message_deleted`:
 * { type:"message_deleted", message_ids?, broadcast_id?, client_id? }
 * Tolera camelCase y `ids` como alias de message_ids.
 */
export function parseStreamMessageDeletedEvent(
  raw: string,
  filterClientId?: number | null,
): MessageDeletedPayload | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  try {
    const data = JSON.parse(trimmed) as unknown;
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const rec = data as Record<string, unknown>;
    if (rec.type != null && String(rec.type) !== "message_deleted") return null;

    if (filterClientId != null && Number.isFinite(Number(filterClientId))) {
      if (rec.client_id != null && Number(rec.client_id) !== Number(filterClientId)) {
        return null;
      }
    }

    const rawIds =
      rec.message_ids ?? rec.messageIds ?? rec.ids ?? rec.message_id ?? rec.messageId;
    const messageIds: Array<string | number> = [];
    if (Array.isArray(rawIds)) {
      for (const id of rawIds) {
        if (id != null && String(id) !== "") messageIds.push(id as string | number);
      }
    } else if (rawIds != null && String(rawIds) !== "") {
      messageIds.push(rawIds as string | number);
    }

    const rawBroadcast = rec.broadcast_id ?? rec.broadcastId;
    const broadcastId =
      rawBroadcast != null && String(rawBroadcast) !== ""
        ? (rawBroadcast as string | number)
        : null;

    if (!messageIds.length && broadcastId == null) return null;

    const clientId =
      rec.client_id != null && Number.isFinite(Number(rec.client_id))
        ? Number(rec.client_id)
        : null;

    return { messageIds, broadcastId, clientId };
  } catch {
    return null;
  }
}

/** @deprecated Preferir parseStreamMessageEvent (contrato #105). */
export function parseStreamPayload(raw: string): PanelMessage[] {
  const msg = parseStreamMessageEvent(raw);
  if (msg) return [msg];
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "ping" || trimmed === ":") return [];
  try {
    const data = JSON.parse(trimmed) as unknown;
    if (!data || typeof data !== "object") return [];
    if (Array.isArray(data)) return data as PanelMessage[];
    const rec = data as Record<string, unknown>;
    if (rec.item && typeof rec.item === "object") return [rec.item as PanelMessage];
    if (Array.isArray(rec.messages)) return rec.messages as PanelMessage[];
    if (Array.isArray(rec.items)) return rec.items as PanelMessage[];
    if (rec.id != null && (rec.body != null || rec.text != null || rec.note != null)) {
      return [rec as unknown as PanelMessage];
    }
    return [];
  } catch {
    return [];
  }
}

/** Ruta relativa del stream: solo stream_token (nunca el token de sesión). */
export function buildStreamUrl(streamToken: string): string {
  return withStreamToken(MESSAGES_STREAM_PATH, streamToken);
}

/**
 * Asegura `stream_token` en la URL/path del stream.
 * Si stream_path viene sin query (causa 401 en EventSource), lo agrega;
 * si ya hay query usa `&`; si ya trae stream_token, lo reemplaza.
 */
export function withStreamToken(pathOrUrl: string, streamToken: string): string {
  const token = String(streamToken || "").trim();
  const base = String(pathOrUrl || "").trim() || MESSAGES_STREAM_PATH;
  if (!token) return base;
  const hashIdx = base.indexOf("#");
  const withoutHash = hashIdx >= 0 ? base.slice(0, hashIdx) : base;
  const hash = hashIdx >= 0 ? base.slice(hashIdx) : "";
  const qIdx = withoutHash.indexOf("?");
  const path = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const params = new URLSearchParams(qIdx >= 0 ? withoutHash.slice(qIdx + 1) : "");
  params.set(STREAM_TOKEN_QUERY_PARAM, token);
  return `${path}?${params}${hash}`;
}

/** El alumno puede abrir Mensajes aunque el cuestionario de 8 pasos no esté completo. */
export function participantCanOpenMessages(
  screen: string,
  profileCompleted: boolean,
): boolean {
  if (screen === "Mensajes" || screen === "Comentarios") return true;
  return profileCompleted;
}
