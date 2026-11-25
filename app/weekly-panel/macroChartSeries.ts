import type { StudentWeekResponse } from "./types.ts";

export type MacroSeries = {
  days: { date: string }[];
  values: (number | null)[];
};

export type NutritionLogRow = Record<string, unknown>;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Días `YYYY-MM-DD` de un mes `YYYY-MM`, en orden. Mes inválido → []. */
export function monthDates(month: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const [year, mon] = month.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(mon) || mon < 1 || mon > 12) return [];
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = 1; day <= last; day += 1) {
    dates.push(`${year}-${pad(mon)}-${pad(day)}`);
  }
  return dates;
}

function numericOrNull(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Serie diaria del mes desde los registros de nutrición del alumno. */
export function seriesFromNutritionLogs(
  month: string,
  macro: string,
  logs: NutritionLogRow[],
): MacroSeries {
  const dates = monthDates(month);
  const byDate = new Map<string, NutritionLogRow>();
  for (const row of logs || []) {
    const date = String(row?.log_date ?? "").slice(0, 10);
    if (!date) continue;
    byDate.set(date, row);
  }
  const values = dates.map((date) => {
    const row = byDate.get(date);
    if (!row) return null;
    return numericOrNull(row[macro]);
  });
  return { days: dates.map((date) => ({ date })), values };
}

/** Serie diaria del mes a partir de las semanas de la ficha, con su target. */
export function seriesFromWeeks(
  month: string,
  macro: string,
  weeks: Map<string, StudentWeekResponse>,
): { series: MacroSeries; target: number | null } {
  const dates = monthDates(month);
  const sortedWeeks = [...(weeks?.entries() || [])].sort(([a], [b]) => a.localeCompare(b));
  const cellByDate = new Map<string, { week: StudentWeekResponse; index: number }>();
  for (const [, week] of sortedWeeks) {
    week.table.days.forEach((day, index) => {
      if (!cellByDate.has(day.date)) cellByDate.set(day.date, { week, index });
    });
  }
  let target: number | null = null;
  const values = dates.map((date) => {
    const found = cellByDate.get(date);
    if (!found) return null;
    const row = found.week.table.rows.find((item) => item.key === macro) as
      | { target?: number | null; cells: { value?: number | null }[] }
      | undefined;
    if (!row) return null;
    const rowTarget = numericOrNull(row.target);
    if (rowTarget != null) target = rowTarget;
    const cell = row.cells?.[found.index];
    if (!cell) return null;
    return numericOrNull(cell.value);
  });
  return { series: { days: dates.map((date) => ({ date })), values }, target };
}

/** ¿Hay al menos un valor numérico finito en la serie? */
export function hasSeriesData(series: MacroSeries): boolean {
  return series.values.some((value) => value != null && Number.isFinite(value));
}
