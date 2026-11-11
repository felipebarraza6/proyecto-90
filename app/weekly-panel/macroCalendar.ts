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

/** Redondea sin cruzar el umbral: 79,6 se muestra 79 % (rojo), no 80 %. */
export function macroCalendarLabel(pct: number): string {
  const rounded = Math.round(pct);
  const shown = pct < MACRO_CALENDAR_GREEN_MIN && rounded >= MACRO_CALENDAR_GREEN_MIN ? Math.floor(pct) : rounded;
  return `${shown}%`;
}
