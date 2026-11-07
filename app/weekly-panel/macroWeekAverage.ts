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

/** Un decimal es-CL. 94,25 → 94,3. No rellena días vacíos. */
export function formatRecordedAverage(avg: number): string {
  const rounded = Math.round(avg * 10) / 10;
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: Number.isInteger(safe) ? 0 : 1,
  }).format(safe);
}

const MACRO_KEYS = ["calories", "protein", "carbs", "fats"] as const;
export type MacroAverageKey = (typeof MACRO_KEYS)[number];

/** Promedios vigentes de la tabla (misma regla que la columna Promedio). */
export function liveMacroAverages(
  rows: Array<{ key: string; cells: unknown[] }>,
): Partial<Record<MacroAverageKey, number>> {
  const out: Partial<Record<MacroAverageKey, number>> = {};
  for (const key of MACRO_KEYS) {
    const row = rows.find((item) => item.key === key);
    if (!row) continue;
    const avg = averageRecorded(row.cells.map((cell) => {
      const value = (cell as { value?: number | null }).value;
      return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
    }));
    if (avg != null) out[key] = avg;
  }
  return out;
}

/** La IA guarda el promedio del momento del análisis. La tabla es el vigente. */
export function averageDrift(
  evidenceAvg: unknown,
  live: number | null | undefined,
): { evidence: number; live: number } | null {
  if (live == null || !Number.isFinite(live)) return null;
  const evidence = typeof evidenceAvg === "number" ? evidenceAvg : Number(evidenceAvg);
  if (!Number.isFinite(evidence)) return null;
  if (Math.abs(evidence - live) < 0.05) return null;
  return { evidence, live };
}

export function metricKeyFromAlert(metric: unknown, title: string, code: string): MacroAverageKey | null {
  const blob = `${String(metric || "")} ${title} ${code}`.toLowerCase();
  if (blob.includes("fat") || blob.includes("grasa")) return "fats";
  if (blob.includes("protein") || blob.includes("prote")) return "protein";
  if (blob.includes("carb")) return "carbs";
  if (blob.includes("calor")) return "calories";
  return null;
}
