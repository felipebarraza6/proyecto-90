"use client";

import { FormEvent, useState } from "react";

type Row = Record<string, unknown>;

function formatWhen(raw: unknown) {
  const value = String(raw || "");
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-CL");
}

function roleLabel(role: unknown) {
  const value = String(role || "").toLowerCase();
  if (value.includes("nutri")) return "Nutrición";
  if (value.includes("coach") || value === "professional") return "Coach";
  if (value.includes("admin") || value.includes("owner")) return "Admin";
  return value ? String(role) : "Equipo";
}

export function StaffNotesPanel({ notes, userId, act, canDelete = false }: { notes: Row[]; userId: string; act: (payload: Row) => Promise<unknown>; canDelete?: boolean }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const own = notes.filter(row => String(row.user_id) === String(userId)).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  async function submit(event: FormEvent) {
    event.preventDefault();
    const note = text.trim();
    if (!note) return;
    setSaving(true);
    try {
      await act({ action: "note.create", userId, note });
      setText("");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="professional-file-section staff-notes-panel">
      <div className="professional-file-heading">
        <div>
          <span className="eyebrow">COMENTARIOS AL ALUMNO</span>
          <h3>Deja un comentario (solo lectura para el alumno)</h3>
          <p>No es un chat: el alumno verá estos mensajes en su sección Comentarios.</p>
        </div>
      </div>
      <form className="staff-note-form" onSubmit={submit}>
        <label>
          Comentario
          <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Escribe una observación clara y concreta…" rows={3} required />
        </label>
        <button className="primary" disabled={saving || !text.trim()}>{saving ? "Enviando…" : "Publicar comentario"}</button>
      </form>
      {own.length === 0 ? (
        <div className="professional-file-empty"><b>Sin comentarios aún</b><p>Cuando dejes uno, aparecerá aquí y en la app del alumno.</p></div>
      ) : (
        <ul className="notes-list">
          {own.map(row => (
            <li key={String(row.id)}>
              <header>
                <b>{String(row.author_name || roleLabel(row.author_role))}</b>
                <span>{roleLabel(row.author_role)} · {formatWhen(row.created_at)}</span>
              </header>
              <p>{String(row.note || "")}</p>
              {canDelete && <button type="button" className="danger-link" onClick={() => confirm("¿Eliminar este comentario?") && act({ action: "note.delete", id: row.id })}>Eliminar</button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ParticipantNotesList({ notes }: { notes: Row[] }) {
  const rows = [...notes].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  if (rows.length === 0) {
    return <article className="empty-state compact"><h3>Sin comentarios</h3><p>Cuando coach o nutrición te dejen un mensaje en Proyecto 90 Días, aparecerá aquí.</p></article>;
  }
  return (
    <ul className="notes-list participant-notes">
      {rows.map(row => (
        <li key={String(row.id)}>
          <header>
            <b>{String(row.author_name || roleLabel(row.author_role))}</b>
            <span>{roleLabel(row.author_role)} · {formatWhen(row.created_at)}</span>
          </header>
          <p>{String(row.note || "")}</p>
        </li>
      ))}
    </ul>
  );
}

export function NoticesPanel({ notices, act, compact = false }: { notices: Row[]; act?: (payload: Row) => Promise<unknown>; compact?: boolean }) {
  const rows = [...notices].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  if (rows.length === 0) return null;
  return (
    <section className={`notices-panel ${compact ? "compact" : ""}`}>
      <header>
        <div>
          <span className="eyebrow">AVISOS</span>
          <h2>Novedades de Proyecto 90 Días</h2>
        </div>
        <span>{rows.filter(row => !row.read).length} sin leer</span>
      </header>
      <ul>
        {rows.map(row => (
          <li key={String(row.id)} className={row.read ? "read" : "unread"}>
            <div>
              <b>{String(row.title || "Aviso")}</b>
              <p>{String(row.body || "")}</p>
              <small>{formatWhen(row.created_at)}</small>
            </div>
            {!row.read && act && (
              <button type="button" className="secondary" onClick={() => act({ action: "notice.read", id: row.id })}>Marcar leído</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
