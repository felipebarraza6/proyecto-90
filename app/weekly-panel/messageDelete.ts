/**
 * Helpers de borrado de mensajes / avisos generales (contrato panel).
 * Sin deps de fetch para poder testear en node:test.
 */

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
