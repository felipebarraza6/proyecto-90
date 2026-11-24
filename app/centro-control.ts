import type { Row } from "./adherence-alerts";

/** Plan nutricional pendiente: sin plan o con estado distinto de aprobado. */
export function countPendingNutrition(people: Row[]): number {
  return people.filter(
    (person) =>
      !person.nutrition_id || String(person.nutrition_status || "approved") !== "approved",
  ).length;
}

/**
 * La semana actual ya tiene días cerrados (lunes a ayer) para calcular riesgo.
 * Con la semana recién abierta no hay datos suficientes y el 0 no debe leerse
 * como "nadie en riesgo".
 */
export function weekHasClosedDays(alerts: { today: string; currentMonday: Date }): boolean {
  return alerts.currentMonday.toISOString().slice(0, 10) < alerts.today;
}
