/** Fallback alineado a PANEL_CONFIG_DEFAULTS.timezone (sin import circular para tests). */
const FALLBACK_TZ = "America/Santiago";
const FALLBACK_WEEKDAY = 0;

/** Hoy (AAAA-MM-DD) en la zona horaria de las reglas del panel. */
export function todayIsoInTimezone(timezone?: string | null): string {
  const tz = (timezone && String(timezone).trim()) || FALLBACK_TZ;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: FALLBACK_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}

const WEEKDAY_NAMES = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const;

/** Nombre del día de inicio de semana (0 = lunes … 6 = domingo). */
export function weekStartWeekdayLabel(weekday?: number | null): string {
  const n = Number(weekday);
  if (!Number.isFinite(n)) return WEEKDAY_NAMES[FALLBACK_WEEKDAY];
  const idx = ((Math.round(n) % 7) + 7) % 7;
  return WEEKDAY_NAMES[idx];
}

export function resolveTimezone(timezone?: string | null): string {
  const tz = (timezone && String(timezone).trim()) || "";
  return tz || FALLBACK_TZ;
}
