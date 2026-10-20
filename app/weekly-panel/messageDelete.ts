/**
 * Helpers de borrado de mensajes / avisos generales (contrato panel).
 * Sin deps de fetch para poder testear en node:test.
 */

export type ShowMessageDeleteRow = {
  can_delete?: boolean;
  author_id?: number | null;
  direction?: string;
  author_role?: string;
};

export type ShowMessageDeleteViewer = {
  isAdmin: boolean;
  isNutrition: boolean;
  /** Id del usuario viewer (para fallback si la API aún no manda can_delete). */
  viewerUserId?: number | string | null;
};

function isFromStudent(row: ShowMessageDeleteRow): boolean {
  return (
    String(row.direction || "") === "inbound" ||
    String(row.author_role || "").toLowerCase().includes("participant") ||
    String(row.author_role || "").toLowerCase() === "student"
  );
}

/**
 * ¿Mostrar «Eliminar» en un mensaje / aviso general?
 * Preferir `can_delete` del backend (viewer-aware: admin cualquier staff; nutri solo los suyos).
 * Si `can_delete` falta (API antigua): admin sí; nutri solo si `author_id === viewerUserId`.
 */
export function showMessageDelete(
  row: ShowMessageDeleteRow,
  viewer: ShowMessageDeleteViewer,
): boolean {
  if (isFromStudent(row)) return false;
  if (!(viewer.isAdmin || viewer.isNutrition)) return false;

  if (row.can_delete === true) return true;
  if (row.can_delete === false) return false;

  // can_delete undefined → fallback API antigua
  if (viewer.isAdmin) return true;
  if (viewer.isNutrition) {
    const viewerId = viewer.viewerUserId;
    if (viewerId == null || viewerId === "") return false;
    if (row.author_id == null) return false;
    return Number(row.author_id) === Number(viewerId);
  }
  return false;
}

/** Mensaje amable si el backend aún no expone el DELETE (404/405) u otro fallo. */
export function messageDeleteErrorMessage(err: unknown): string {
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status: unknown }).status)
      : NaN;
  if (Number.isFinite(status)) {
    if (status === 404 || status === 405) {
      return "El borrado de mensajes aún no está disponible. Intenta más tarde.";
    }
    if (status === 403) {
      // Preferir el mensaje del servidor (p. ej. «Solo puedes borrar tus propios mensajes»).
      if (err instanceof Error && err.message) return err.message;
      return "No tienes permiso para eliminar este mensaje.";
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "No fue posible eliminar el mensaje.";
}

/** Si hay broadcast_id → DELETE broadcast; si no → DELETE del mensaje 1:1. */
export function messageDeleteKind(
  row: { id?: number | string; broadcast_id?: number | string | null },
): "broadcast" | "message" {
  if (row.broadcast_id != null && String(row.broadcast_id) !== "") return "broadcast";
  return "message";
}
