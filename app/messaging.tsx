"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  fetchMyMessages,
  fetchParticipantMessages,
  postBroadcastMessage,
  postMyMessage,
  postParticipantMessage,
} from "./weekly-panel/api";
import type { PanelMessage } from "./weekly-panel/types";

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

function MessageList({ items }: { items: PanelMessage[] }) {
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
        const fromStudent =
          String(row.direction || "") === "inbound" ||
          String(row.author_role || "").toLowerCase().includes("participant") ||
          String(row.author_role || "").toLowerCase() === "student";
        const broadcast = Boolean(row.broadcast || row.is_broadcast || row.reply_to_all);
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
          </li>
        );
      })}
    </ul>
  );
}

/** Alumno: GET/POST /api/p90/panel/messages/me */
export function ParticipantMessaging() {
  const [recipient, setRecipient] = useState<MessageRecipient>("nutrition");
  const [text, setText] = useState("");
  const [thread, setThread] = useState<PanelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError("");
    fetchMyMessages(ac.signal)
      .then((items) => setThread(sortMessages(items)))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar tus mensajes");
        setThread([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [reload]);

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
      {loading ? <p className="wp-habit-hint">Cargando mensajes…</p> : <MessageList items={thread} />}
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
 * Nutri/admin (y coach si messaging_coach_enabled):
 * GET/POST /participants/{id}/messages (reply_to_all) + POST /messages/broadcast
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
  const coachBlocked = isCoach && !messagingCoachEnabled;

  const [selectedId, setSelectedId] = useState(() => String(people[0]?.id || ""));
  const [text, setText] = useState("");
  const [broadcast, setBroadcast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [thread, setThread] = useState<PanelMessage[]>([]);
  const [reload, setReload] = useState(0);

  const selected = people.find((p) => String(p.id) === selectedId) || people[0];
  const clientId = selected ? Number(selected.id) : NaN;

  useEffect(() => {
    if (coachBlocked || !Number.isFinite(clientId)) {
      setThread([]);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError("");
    fetchParticipantMessages(clientId, ac.signal)
      .then((items) => setThread(sortMessages(items)))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar el hilo");
        setThread([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [clientId, reload, coachBlocked]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || !Number.isFinite(clientId)) return;
    setSaving(true);
    setError("");
    try {
      // Hilo del alumno. Si marca aviso general: reply_to_all + /messages/broadcast.
      await postParticipantMessage(clientId, {
        body,
        reply_to_all: Boolean(broadcast && canBroadcast),
      });
      if (broadcast && canBroadcast) {
        await postBroadcastMessage({ body });
      }
      setText("");
      setBroadcast(false);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No fue posible enviar la respuesta.");
    } finally {
      setSaving(false);
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
      {loading ? <p className="wp-habit-hint">Cargando hilo…</p> : <MessageList items={thread} />}
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
