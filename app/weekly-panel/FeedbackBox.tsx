import { useEffect, useRef, useState } from "react";
import { postComment } from "./api";
import { draftStorageKey } from "./format";
import type { CommentItem } from "./types";

function newRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `p90-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeDraft(key: string, text: string): void {
  try {
    if (!text) localStorage.removeItem(key);
    else localStorage.setItem(key, text);
  } catch {
    /* ignore */
  }
}

export function FeedbackBox({
  clientId,
  weekStart,
  staffUserId,
  onPosted,
}: {
  clientId: number;
  weekStart: string;
  staffUserId: string;
  onPosted: (item: CommentItem) => void;
}) {
  const storageKey = draftStorageKey(staffUserId, clientId);
  const requestId = useRef(newRequestId());
  const sendingLock = useRef(false);
  const mounted = useRef(true);
  const [text, setText] = useState(() => readDraft(storageKey));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    mounted.current = true;
    requestId.current = newRequestId();
    setText(readDraft(storageKey));
    setError("");
    setOk(false);
    return () => {
      mounted.current = false;
    };
  }, [storageKey, clientId]);

  function onChange(value: string) {
    setText(value);
    setOk(false);
    writeDraft(storageKey, value);
  }

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sendingLock.current) return;
    sendingLock.current = true;
    setSending(true);
    setError("");
    setOk(false);
    try {
      const res = await postComment(clientId, {
        text: trimmed,
        week_start: weekStart,
        client_request_id: requestId.current,
      });
      writeDraft(storageKey, "");
      if (!mounted.current) return;
      setText("");
      requestId.current = newRequestId();
      setOk(true);
      onPosted(res.item);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : "No fue posible enviar el comentario");
    } finally {
      sendingLock.current = false;
      if (mounted.current) setSending(false);
    }
  }

  return (
    <section className="wp-feedback" aria-labelledby="wp-feedback-title">
      <h2 id="wp-feedback-title">Feedback de la semana</h2>
      <label>
        <span className="wp-sr">Comentario para el alumno</span>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Escribe una observación para este alumno…"
        />
      </label>
      <div className="wp-feedback-actions">
        <button
          type="button"
          className="primary"
          disabled={!text.trim() || sending}
          onClick={submit}
        >
          {sending ? "Enviando…" : "Enviar"}
        </button>
        {ok ? <span className="wp-sent">Comentario enviado</span> : null}
        {error ? (
          <span className="wp-feedback-error" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
