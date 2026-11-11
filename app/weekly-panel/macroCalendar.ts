/** Color del calendario «Cumplimiento macros» (Marcelo): ≥80 verde, <80 rojo. Sin amarillo. */
export const MACRO_CALENDAR_GREEN_MIN = 80;

export type MacroCalendarTone = "tone-high" | "tone-low";

/**
 * null = día sin % (futuro, sin cierre o API vieja). No se pinta como 0 %.
 * El umbral se aplica al valor de la API, sin redondear antes.
 */
export function macroCalendarTone(pct: number | null | undefined): MacroCalendarTone | null {
  if (pct == null || typeof pct !== "number" || !Number.isFinite(pct)) return null;
  return pct >= MACRO_CALENDAR_GREEN_MIN ? "tone-high" : "tone-low";
}

export function macroCalendarLabel(pct: number): string {
  return `${Math.round(pct)}%`;
}
