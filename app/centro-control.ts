import type { Row } from "./adherence-alerts";

/** Plan nutricional pendiente: sin plan o con estado distinto de aprobado. */
export function isNutritionPending(person: Row): boolean {
  return !person.nutrition_id || String(person.nutrition_status || "approved") !== "approved";
}

export function countPendingNutrition(people: Row[]): number {
  return people.filter(isNutritionPending).length;
}

const NUTRITION_FILTER_KEY = "p90_nutrition_filter";

/** Intención de un solo uso para abrir Nutrición filtrada a pendientes. */
export function setNutritionFilterIntent(filter: "pending" | null): void {
  try {
    if (filter) sessionStorage.setItem(NUTRITION_FILTER_KEY, filter);
    else sessionStorage.removeItem(NUTRITION_FILTER_KEY);
  } catch {
    /* quota / private mode */
  }
}

export function readNutritionFilterIntent(): "pending" | null {
  try {
    return sessionStorage.getItem(NUTRITION_FILTER_KEY) === "pending" ? "pending" : null;
  } catch {
    return null;
  }
}

export function clearNutritionFilterIntent(): void {
  try {
    sessionStorage.removeItem(NUTRITION_FILTER_KEY);
  } catch {
    /* quota / private mode */
  }
}

/**
 * La semana actual ya tiene días cerrados (lunes a ayer) para calcular riesgo.
 * Con la semana recién abierta no hay datos suficientes y el 0 no debe leerse
 * como "nadie en riesgo".
 */
export function weekHasClosedDays(alerts: { today: string; currentMonday: Date }): boolean {
  return alerts.currentMonday.toISOString().slice(0, 10) < alerts.today;
}
