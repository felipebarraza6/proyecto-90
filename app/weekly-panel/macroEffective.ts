/**
 * Etiquetas y orden del historial de metas de macros por fecha.
 *
 * Una meta puede venir con tramo (atajo 1–30 / 31–60 / 61–90) o solo con
 * `effective_from`. En el segundo caso se muestra «Desde <fecha>» para no
 * inventar un tramo que el backend no guardó.
 */

import type { MacroPeriodKey, MacroTargetRecord } from "./types";

const PERIOD_LABELS: Record<MacroPeriodKey, string> = {
  "1-30": "Días 1–30",
  "31-60": "Días 31–60",
  "61-90": "Días 61–90",
};

/** Día 1-based del desafío en que empieza cada tramo. */
const PERIOD_FIRST_DAY: Record<MacroPeriodKey, number> = {
  "1-30": 1,
  "31-60": 31,
  "61-90": 61,
};

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

type IsoDate = { year: number; month: number; day: number };

/** Parsea YYYY-MM-DD (o un ISO con hora) sin depender de la zona horaria. */
function parseIsoDate(value: unknown): IsoDate | null {
  const raw = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function isoOf(date: IsoDate): string {
  const y = String(date.year).padStart(4, "0");
  const m = String(date.month).padStart(2, "0");
  const d = String(date.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(value: string, days: number): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return "";
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days, 12));
  return isoOf({
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  });
}

/** «12 nov 2026»; fecha ausente o inválida → «Sin fecha». */
export function effectiveDateLabel(value: unknown): string {
  const parsed = parseIsoDate(value);
  if (!parsed) return "Sin fecha";
  return `${parsed.day} ${MONTHS_SHORT[parsed.month - 1]} ${parsed.year}`;
}

/**
 * «Días 1–30» si la meta tiene tramo; «Desde 12 nov 2026» si solo tiene
 * fecha; «Sin fecha» si no hay ni tramo ni fecha válida.
 */
export function goalPeriodLabel(
  row: Pick<MacroTargetRecord, "period" | "effective_from"> | null | undefined,
): string {
  const period = String(row?.period ?? "").trim();
  if (period in PERIOD_LABELS) return PERIOD_LABELS[period as MacroPeriodKey];
  const date = effectiveDateLabel(row?.effective_from);
  return date === "Sin fecha" ? date : `Desde ${date}`;
}

/**
 * Fecha de inicio del tramo a partir del día 1 del desafío. Si falta el
 * inicio o el tramo, devuelve "" (el usuario escribe la fecha a mano).
 */
export function periodStartFromChallenge(
  challengeStart: unknown,
  period: unknown,
): string {
  const start = String(challengeStart ?? "").trim().slice(0, 10);
  if (!parseIsoDate(start)) return "";
  const firstDay = PERIOD_FIRST_DAY[String(period ?? "") as MacroPeriodKey];
  if (!firstDay) return "";
  return addDays(start, firstDay - 1);
}

/** Historial de más reciente a más antiguo; las filas sin fecha válida al final. */
export function sortMacroTargetHistory(
  items: MacroTargetRecord[] | null | undefined,
): MacroTargetRecord[] {
  return [...(items || [])].sort((a, b) => {
    const dateA = parseIsoDate(a?.effective_from);
    const dateB = parseIsoDate(b?.effective_from);
    if (dateA && dateB) {
      const diff = isoOf(dateB).localeCompare(isoOf(dateA));
      if (diff !== 0) return diff;
      return Number(b?.id ?? 0) - Number(a?.id ?? 0);
    }
    if (dateA) return -1;
    if (dateB) return 1;
    return Number(b?.id ?? 0) - Number(a?.id ?? 0);
  });
}
