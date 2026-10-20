"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  deleteBroadcastMessage,
  deleteParticipantMessage,
  fetchMyMessages,
  fetchParticipantMessages,
  fetchMessagesInbox,
  type InboxItem,
  postMyMessage,
  postParticipantMessage,
} from "./weekly-panel/api";
import { messageDeleteErrorMessage, messageDeleteKind } from "./weekly-panel/messageDelete";
import {
  mergeMessageThread,
  removeMessagesFromThread,
  type MessageDeletedPayload,
} from "./weekly-panel/messageStream";
import type { PanelMessage } from "./weekly-panel/types";
import {
  MESSAGE_FETCH_FALLBACK_MS,
  useMessageStream,
} from "./weekly-panel/useMessageStream";

type Row = Record<string, unknown>;

export type MessageRecipient = "nutrition" | "admin";

function formatWhen(raw: unknown) {
  const value = String(raw || "");
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-CL");
}

function roleLabel(role: unknown) {
  const value = String(role || "").toLowerCase();
  if (value.includes("nutri") || value === "nutrition") return "Nutrición";
  if (value.includes("coach") || value === "professional") return "Coach";
  if (value.includes("admin") || value.includes("owner")) return "Administración";
  if (value.includes("participant") || value === "student") return "Alumno";
  return value ? String(role) : "Equipo";
}

function recipientLabel(value: MessageRecipient) {
  return value === "nutrition" ? "Nutricionista" : "Administración";
}

function messageBody(row: PanelMessage): string {
  return String(row.body || row.text || row.note || "");
}

function sortMessages(items: PanelMessage[]): PanelMessage[] {
  return [...items].sort((a, b) =>
    String(a.created_at || a.created || "").localeCompare(String(b.created_at || b.created || "")),
  );
}

function isFromStudent(row: PanelMessage): boolean {
  return (
    String(row.direction || "") === "inbound" ||
    String(row.author_role || "").toLowerCase().includes("participant") ||
    String(row.author_role || "").toLowerCase() === "student"
  );
}

function isBroadcastMessage(row: PanelMessage): boolean {
  if (row.broadcast_id != null && String(row.broadcast_id) !== "") return true;
  return Boolean(row.broadcast || row.is_broadcast || row.reply_to_all);
}

/** Solo mensajes del staff / avisos generales (no los del alumno). */
function canDeleteStaffMessage(row: PanelMessage): boolean {
  return !isFromStudent(row);
}

function confirmDeleteMessage(row: PanelMessage): boolean {
  if (isBroadcastMessage(row)) {
    return confirm("Se eliminará para todos los alumnos");
  }
  return confirm("¿Eliminar este mensaje? No se puede deshacer");
}

function applyMessageDeleted(
  current: PanelMessage[],
  payload: MessageDeletedPayload,
): PanelMessage[] {
  return removeMessagesFromThread(current, {
    messageIds: payload.messageIds,
    broadcastId: payload.broadcastId,
  });
}

function MessageList({
  items,
  canDelete = false,
  deletingId = null,
  onDelete,
}: {
  items: PanelMessage[];
  canDelete?: boolean;
  deletingId?: string | number | null;
  onDelete?: (row: PanelMessage) => void;
}) {
  if (!items.length) {
    return (
      <div className="professional-file-empty">
        <b>Sin mensajes aún</b>
        <p>Cuando escribas o te respondan, el hilo aparecerá aquí.</p>
      </div>
    );
  }
  return (
    <ul className="notes-list messaging-thread">
      {items.map((row) => {
        const fromStudent = isFromStudent(row);
        const broadcast = isBroadcastMessage(row);
        const showDelete = canDelete && canDeleteStaffMessage(row) && onDelete;
        const busy = deletingId != null && String(deletingId) === String(row.id);
        return (
          <li key={String(row.id)} className={fromStudent ? "from-student" : "from-staff"}>
            <header>
              <b>{String(row.author_name || row.role_label || roleLabel(row.author_role))}</b>
              <span>
                {row.role_label || roleLabel(row.author_role)}
                {broadcast ? " · aviso general" : ""} · {formatWhen(row.created_at || row.created)}
              </span>
            </header>
            <p>{messageBody(row)}</p>
            {showDelete ? (
              <button
                type="button"
                className="danger-link"
                disabled={busy}
                onClick={() => onDelete(row)}
              >
                {busy ? "Eliminando…" : "Eliminar"}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Alumno: GET/POST /api/p90/panel/messages/me + SSE con fallback a fetch. */
export function ParticipantMessaging() {
  const [recipient, setRecipient] = useState<MessageRecipient>("nutrition");
  const [text, setText] = useState("");
  const [thread, setThread] = useState<PanelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const { live } = useMessageStream({
    onMessages: (incoming) => setThread((cur) => mergeMessageThread(cur, incoming)),
    onMessagesDeleted: (payload) => setThread((cur) => applyMessageDeleted(cur, payload)),
  });

  useEffect(() => {
    const ac = new AbortController();
    // Solo spinner en la primera carga; el poll no debe ocultar mensajes SSE ya mostrados.
    if (reload === 0) setLoading(true);
    setError("");
    fetchMyMessages(ac.signal)
      .then((items) => setThread((cur) => mergeMessageThread(cur, sortMessages(items))))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar tus mensajes");
        if (reload === 0) setThread([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [reload]);

  useEffect(() => {
    if (live) return;
    const timer = setInterval(() => setReload((n) => n + 1), MESSAGE_FETCH_FALLBACK_MS);
    return () => clearInterval(timer);
  }, [live]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSaving(true);
    setError("");
    try {
      await postMyMessage({ body, recipient_role: recipient });
      setText("");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No fue posible enviar el mensaje.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="messaging-panel participant-messaging">
      <header className="messaging-panel-head">
        <div>
          <span className="eyebrow">MENSAJES</span>
          <h2>Habla con tu equipo</h2>
          <p>Elige nutricionista o administración. Las respuestas quedan en este hilo.</p>
        </div>
      </header>
      {loading && !thread.length ? (
        <p className="wp-habit-hint">Cargando mensajes…</p>
      ) : (
        <MessageList items={thread} />
      )}
      <form className="staff-note-form messaging-compose" onSubmit={submit}>
        <label>
          Destinatario
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value as MessageRecipient)}
            aria-label="Destinatario del mensaje"
          >
            <option value="nutrition">{recipientLabel("nutrition")}</option>
            <option value="admin">{recipientLabel("admin")}</option>
          </select>
        </label>
        <label>
          Mensaje
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe tu mensaje…"
            rows={3}
            required
          />
        </label>
        {error ? (
          <p className="upload-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary" disabled={saving || !text.trim()}>
          {saving ? "Enviando…" : "Enviar mensaje"}
        </button>
      </form>
    </section>
  );
}

/**
 * Hilo de un alumno en la Ficha (GET/POST /participants/{id}/messages).
 * Nutricionista siempre; coach solo si messaging_coach_enabled.
 */
export function StaffParticipantThread({
  clientId,
  participantName,
  viewerRole,
  messagingCoachEnabled = false,
  canBroadcast = false,
  compact = false,
}: {
  clientId: number;
  participantName?: string;
  viewerRole?: string;
  messagingCoachEnabled?: boolean;
  canBroadcast?: boolean;
  compact?: boolean;
}) {
  const specialty = String(viewerRole || "").toLowerCase();
  const isCoach = specialty === "coach" || specialty.includes("coach");
  const isNutrition = specialty === "nutrition" || specialty.includes("nutri");
  const isAdmin = specialty === "admin" || specialty.includes("admin") || specialty.includes("owner");
  const coachBlocked = isCoach && !messagingCoachEnabled && !isNutrition && !isAdmin;
  const canDeleteMessages = isNutrition || isAdmin;

  const [text, setText] = useState("");
  const [broadcast, setBroadcast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [thread, setThread] = useState<PanelMessage[]>([]);
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const { live } = useMessageStream({
    enabled: !coachBlocked && Number.isFinite(clientId),
    clientId,
    onMessages: (incoming) => setThread((cur) => mergeMessageThread(cur, incoming)),
    onMessagesDeleted: (payload) => setThread((cur) => applyMessageDeleted(cur, payload)),
  });

  useEffect(() => {
    setThread([]);
    setReload(0);
    setLoading(true);
  }, [clientId]);

  useEffect(() => {
    if (coachBlocked || !Number.isFinite(clientId)) {
      setThread([]);
      return;
    }
    const ac = new AbortController();
    if (reload === 0) setLoading(true);
    setError("");
    fetchParticipantMessages(clientId, ac.signal)
      .then((items) => setThread((cur) => mergeMessageThread(cur, sortMessages(items))))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar el hilo");
        if (reload === 0) setThread([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [clientId, reload, coachBlocked]);

  useEffect(() => {
    if (live || coachBlocked) return;
    const timer = setInterval(() => setReload((n) => n + 1), MESSAGE_FETCH_FALLBACK_MS);
    return () => clearInterval(timer);
  }, [live, coachBlocked]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !Number.isFinite(clientId)) return;
    setSaving(true);
    setError("");
    try {
      // Un solo POST: reply_to_all basta para el aviso general (sin /messages/broadcast).
      await postParticipantMessage(clientId, {
        body,
        reply_to_all: Boolean(broadcast && canBroadcast),
      });
      setText("");
      setBroadcast(false);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No fue posible enviar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: PanelMessage) {
    if (!canDeleteMessages || !canDeleteStaffMessage(row) || !Number.isFinite(clientId)) return;
    if (!confirmDeleteMessage(row)) return;
    setDeletingId(row.id);
    setError("");
    try {
      if (messageDeleteKind(row) === "broadcast") {
        await deleteBroadcastMessage(row.broadcast_id as string | number);
        setThread((cur) =>
          removeMessagesFromThread(cur, { broadcastId: row.broadcast_id, messageIds: [row.id] }),
        );
      } else {
        await deleteParticipantMessage(clientId, row.id);
        setThread((cur) => removeMessagesFromThread(cur, { messageIds: [row.id] }));
      }
    } catch (err) {
      setError(messageDeleteErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (coachBlocked) {
    return null;
  }

  const name = participantName || "alumno";

  return (
    <section className={`messaging-panel staff-participant-thread${compact ? " compact" : ""}`}>
      <header className="messaging-panel-head">
        <div>
          <span className="eyebrow">MENSAJES</span>
          <h2>Hilo con {name}</h2>
          <p>Por defecto la respuesta va solo a este alumno.</p>
        </div>
      </header>
      {loading && !thread.length ? (
        <p className="wp-habit-hint">Cargando hilo…</p>
      ) : (
        <MessageList
          items={thread}
          canDelete={canDeleteMessages}
          deletingId={deletingId}
          onDelete={onDelete}
        />
      )}
      <form className="staff-note-form messaging-compose" onSubmit={submit}>
        <label>
          Respuesta a {name}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe la respuesta…"
            rows={3}
            required
          />
        </label>
        {canBroadcast ? (
          <label className="messaging-broadcast-check">
            <input
              type="checkbox"
              checked={broadcast}
              onChange={(e) => setBroadcast(e.target.checked)}
            />
            Enviar también como aviso general a todos los alumnos
          </label>
        ) : null}
        {error ? (
          <p className="upload-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary" disabled={saving || !text.trim()}>
          {saving ? "Enviando…" : "Responder"}
        </button>
      </form>
    </section>
  );
}

/**
 * Nutri/admin (y coach si messaging_coach_enabled):
 * GET/POST /participants/{id}/messages (reply_to_all opcional; sin broadcast extra).
 */
export function StaffMessagingInbox({
  people,
  canBroadcast = true,
  viewerRole,
  messagingCoachEnabled = false,
}: {
  people: Row[];
  canBroadcast?: boolean;
  viewerRole?: string;
  messagingCoachEnabled?: boolean;
}) {
  const specialty = String(viewerRole || "").toLowerCase();
  const isCoach = specialty === "coach" || specialty.includes("coach");
  const isNutrition = specialty === "nutrition" || specialty.includes("nutri");
  const isAdmin = specialty === "admin" || specialty.includes("admin") || specialty.includes("owner");
  const coachBlocked = isCoach && !messagingCoachEnabled;
  const canDeleteMessages = isNutrition || isAdmin;

  const [selectedId, setSelectedId] = useState(() => String(people[0]?.id || ""));
  const [text, setText] = useState("");
  const [broadcast, setBroadcast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [thread, setThread] = useState<PanelMessage[]>([]);
  const [reload, setReload] = useState(0);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);

  const [inbox, setInbox] = useState<InboxItem[] | null>(null);
  const [onlyActive, setOnlyActive] = useState(true);

  const selected = people.find((p) => String(p.id) === selectedId) || people[0];
  const clientId = selected ? Number(selected.id) : NaN;

  useEffect(() => {
    if (coachBlocked) return;
    const ac = new AbortController();
    fetchMessagesInbox(ac.signal)
      .then(setInbox)
      .catch(() => undefined);
    return () => ac.abort();
  }, [reload, coachBlocked, thread.length]);

  const inboxRows = (inbox || []).filter((item) => !onlyActive || item.in_challenge);

  const { live } = useMessageStream({
    enabled: !coachBlocked && Number.isFinite(clientId),
    clientId: Number.isFinite(clientId) ? clientId : null,
    onMessages: (incoming) => setThread((cur) => mergeMessageThread(cur, incoming)),
    onMessagesDeleted: (payload) => setThread((cur) => applyMessageDeleted(cur, payload)),
  });

  useEffect(() => {
    setThread([]);
    setReload(0);
    setLoading(true);
  }, [clientId]);

  useEffect(() => {
    if (coachBlocked || !Number.isFinite(clientId)) {
      setThread([]);
      return;
    }
    const ac = new AbortController();
    if (reload === 0) setLoading(true);
    setError("");
    fetchParticipantMessages(clientId, ac.signal)
      .then((items) => setThread((cur) => mergeMessageThread(cur, sortMessages(items))))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar el hilo");
        if (reload === 0) setThread([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [clientId, reload, coachBlocked]);

  useEffect(() => {
    if (live || coachBlocked) return;
    const timer = setInterval(() => setReload((n) => n + 1), MESSAGE_FETCH_FALLBACK_MS);
    return () => clearInterval(timer);
  }, [live, coachBlocked]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !Number.isFinite(clientId)) return;
    setSaving(true);
    setError("");
    try {
      // Un solo POST: reply_to_all basta para el aviso general (sin /messages/broadcast).
      await postParticipantMessage(clientId, {
        body,
        reply_to_all: Boolean(broadcast && canBroadcast),
      });
      setText("");
      setBroadcast(false);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No fue posible enviar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: PanelMessage) {
    if (!canDeleteMessages || !canDeleteStaffMessage(row) || !Number.isFinite(clientId)) return;
    if (!confirmDeleteMessage(row)) return;
    setDeletingId(row.id);
    setError("");
    try {
      if (messageDeleteKind(row) === "broadcast") {
        await deleteBroadcastMessage(row.broadcast_id as string | number);
        setThread((cur) =>
          removeMessagesFromThread(cur, { broadcastId: row.broadcast_id, messageIds: [row.id] }),
        );
      } else {
        await deleteParticipantMessage(clientId, row.id);
        setThread((cur) => removeMessagesFromThread(cur, { messageIds: [row.id] }));
      }
    } catch (err) {
      setError(messageDeleteErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (coachBlocked) {
    return (
      <article className="empty-state compact">
        <h3>Mensajería del coach desactivada</h3>
        <p>
          Cuando administración active «El coach participa en la mensajería» en Reglas, podrás ver y
          responder los hilos de los alumnos aquí.
        </p>
      </article>
    );
  }

  if (!people.length) {
    return (
      <article className="empty-state compact">
        <h3>Sin alumnos</h3>
        <p>Cuando haya participantes, verás aquí su bandeja de mensajes.</p>
      </article>
    );
  }

  return (
    <section className="messaging-panel staff-messaging">
      <header className="messaging-panel-head">
        <div>
          <span className="eyebrow">BANDEJA</span>
          <h2>Mensajes por alumno</h2>
          <p>
            Por defecto la respuesta va solo a este alumno. Si marcas el aviso general, se publica un
            mensaje aparte sin el hilo privado ni los datos del alumno.
          </p>
        </div>
        <label>
          Alumno
          <select
            value={String(selected?.id || "")}
            onChange={(e) => {
              setSelectedId(e.target.value);
              setText("");
              setBroadcast(false);
              setError("");
            }}
          >
            {people.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {`${p.first_name || ""} ${p.last_name || ""}`.trim() || String(p.email)}
              </option>
            ))}
          </select>
        </label>
      </header>
      {inbox ? (
        <div className="messaging-inbox">
          <div className="messaging-inbox-head">
            <b>Todos los mensajes</b>
            <label className="messaging-broadcast-check">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
              />
              Solo alumnos dentro de sus 90 días
            </label>
          </div>
          {inboxRows.length ? (
            <ul>
              {inboxRows.map((item) => (
                <li key={item.client_id}>
                  <button
                    type="button"
                    className={String(item.client_id) === String(selected?.id) ? "active" : ""}
                    onClick={() => {
                      setSelectedId(String(item.client_id));
                      setText("");
                      setBroadcast(false);
                      setError("");
                    }}
                  >
                    <span className="messaging-inbox-top">
                      <b>{item.client_name}</b>
                      <small>{formatWhen(item.last_message?.created)}</small>
                    </span>
                    <span className="messaging-inbox-body">
                      {roleLabel(item.last_message?.author_role)}: {messageBody(item.last_message)}
                    </span>
                    <span className={`messaging-tag ${item.replied ? "replied" : "pending"}`}>
                      {item.replied ? "Respondido" : "Sin responder"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wp-habit-hint">No hay mensajes con este filtro.</p>
          )}
        </div>
      ) : null}
      {loading && !thread.length ? (
        <p className="wp-habit-hint">Cargando hilo…</p>
      ) : (
        <MessageList
          items={thread}
          canDelete={canDeleteMessages}
          deletingId={deletingId}
          onDelete={onDelete}
        />
      )}
      <form className="staff-note-form messaging-compose" onSubmit={submit}>
        <label>
          Respuesta a{" "}
          {`${selected?.first_name || ""} ${selected?.last_name || ""}`.trim() || "alumno"}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe la respuesta…"
            rows={3}
            required
          />
        </label>
        {canBroadcast ? (
          <label className="messaging-broadcast-check">
            <input
              type="checkbox"
              checked={broadcast}
              onChange={(e) => setBroadcast(e.target.checked)}
            />
            Enviar también como aviso general a todos los alumnos
          </label>
        ) : null}
        {error ? (
          <p className="upload-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary" disabled={saving || !text.trim()}>
          {saving ? "Enviando…" : "Responder"}
        </button>
      </form>
    </section>
  );
}
