/**
 * Estados de participante y su etiqueta en es-CL.
 *
 * Replica el mapa que ya usa `Status` en `app/functional-app.tsx`
 * (invited → «Invitado», onboarding → «Primer ingreso», review → «En revisión»,
 * configuration → «En configuración», active → «Activo», finished → «Finalizado»).
 * Se mantiene en un módulo puro para usarlo desde la tabla de Participantes y los tests.
 */
export const STATUS_LABELS: Record<string, string> = {
  invited: "Invitado",
  onboarding: "Primer ingreso",
  review: "En revisión",
  configuration: "En configuración",
  active: "Activo",
  finished: "Finalizado",
};

export type StatusFilter = "all" | "active" | "finished" | "other";

/** Etiqueta visible; un estado desconocido conserva su valor crudo. */
export function statusLabel(value: unknown): string {
  const raw = value == null ? "" : String(value);
  return STATUS_LABELS[raw.trim().toLowerCase()] ?? raw;
}

/** Filtra participantes por estado. «other» = cualquier estado distinto de active/finished. */
export function filterPeopleByStatus<T extends Record<string, unknown>>(
  rows: T[],
  filter: StatusFilter = "active",
): T[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => {
    const status = String(row.status ?? "").trim().toLowerCase();
    if (filter === "active") return status === "active";
    if (filter === "finished") return status === "finished";
    return status !== "active" && status !== "finished";
  });
}
