/**
 * Ordena sesiones de la más reciente a la más antigua por `dateKey`
 * (por defecto `starts_at`). Devuelve una copia y nunca muta `rows`.
 *
 * - Compara timestamps reales, no strings, para tolerar formatos ISO distintos.
 * - Las fechas vacías o inválidas quedan al final, conservando su orden relativo.
 */
export function sortSessionsDesc<T extends Record<string, unknown>>(
  rows: T[],
  dateKey = "starts_at",
): T[] {
  const stampOf = (row: T): number | null => {
    const raw = row[dateKey];
    if (raw == null || raw === "") return null;
    const time = raw instanceof Date ? raw.getTime() : new Date(String(raw)).getTime();
    return Number.isFinite(time) ? time : null;
  };
  return rows
    .map((row, index) => ({ row, index, time: stampOf(row) }))
    .sort((a, b) => {
      if (a.time === null && b.time === null) return a.index - b.index;
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return b.time - a.time || a.index - b.index;
    })
    .map((item) => item.row);
}
