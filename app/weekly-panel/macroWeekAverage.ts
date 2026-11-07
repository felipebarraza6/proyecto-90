/** Promedio de una fila semanal. Null (sin registro) no entra. Un 0 registrado sí. */
export function averageRecorded(values: Array<number | null | undefined>): number | null {
  const recorded: number[] = [];
  for (const value of values) {
    if (value == null || !Number.isFinite(value)) continue;
    recorded.push(value);
  }
  if (!recorded.length) return null;
  return recorded.reduce((sum, value) => sum + value, 0) / recorded.length;
}
