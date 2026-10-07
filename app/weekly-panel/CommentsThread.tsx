import { useCallback, useEffect, useState } from "react";
import { deleteComment, fetchComments } from "./api";
import { formatDateTime } from "./format";
import { EmptyNote, RetryError, SkeletonTable } from "./ui";
import type { CommentItem } from "./types";

export function CommentsThread({
  clientId,
  extraItems,
  onDeleted,
}: {
  clientId: number;
  extraItems: CommentItem[];
  onDeleted?: (id: number) => void;
}) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const ac = new AbortController();
    setItems([]);
    setCursor(null);
    setLoading(true);
    setError("");
    fetchComments(clientId, { limit: 50 }, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        setItems(res.items);
        setCursor(res.next_cursor);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar comentarios");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [clientId, reloadToken]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await fetchComments(clientId, { limit: 50, before: cursor });
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...res.items.filter((item) => !seen.has(item.id))];
      });
      setCursor(res.next_cursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible cargar comentarios");
    } finally {
      setLoadingMore(false);
    }
  }, [clientId, cursor]);

  const shown = [...extraItems, ...items].filter((item, idx, arr) => {
    return arr.findIndex((x) => x.id === item.id) === idx;
  });

  async function onDelete(item: CommentItem) {
    if (!item.can_delete) return;
    if (!confirm("¿Borrar este comentario? Dejará de verse en el panel y para el alumno.")) return;
    setDeleting(item.id);
    try {
      await deleteComment(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      onDeleted?.(item.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No fue posible borrar");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="wp-comments" aria-labelledby="wp-comments-title">
      <h2 id="wp-comments-title">Historial de comentarios</h2>
      {loading ? <SkeletonTable rows={3} /> : null}
      {error ? (
        <RetryError message={error} onRetry={() => setReloadToken((n) => n + 1)} />
      ) : null}
      {!loading && !error && shown.length === 0 ? (
        <EmptyNote
          title="Aún no hay comentarios"
          copy="El feedback de esta ficha queda en el hilo del alumno."
        />
      ) : null}
      <ol className="wp-comment-list">
        {shown.map((item) => (
          <li key={item.id}>
            <header>
              <b>{item.author_name}</b>
              <span>{item.role_label}</span>
              <time dateTime={item.created}>{formatDateTime(item.created)}</time>
            </header>
            <p>{item.text}</p>
            {item.week_label ? <small>Semana revisada: {item.week_label}</small> : null}
            {item.can_delete ? (
              <button
                type="button"
                className="danger-link"
                disabled={deleting === item.id}
                onClick={() => void onDelete(item)}
              >
                {deleting === item.id ? "Borrando…" : "Borrar"}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      {cursor ? (
        <button
          type="button"
          className="secondary"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Cargando…" : "Ver más"}
        </button>
      ) : null}
    </section>
  );
}
