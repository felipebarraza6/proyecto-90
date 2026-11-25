/**
 * % diario de macros reutilizable fuera de React (panel de staff y vista del alumno).
 * Delega el cálculo en macroScore.ts y resuelve rangos/pesos desde la configuración del panel.
 */

import type { Row } from "../adherence-alerts.ts";
import { PANEL_CONFIG_DEFAULTS, type MacroKey } from "./panelConfig.ts";
import { DEFAULT_MACRO_WEIGHTS, macroDayPct } from "./macroScore.ts";
import type { PanelConfig } from "./types";

export type MacroValues = {
  calories?: unknown;
  protein?: unknown;
  carbs?: unknown;
  fats?: unknown;
};

/** % del día (0..∞, sin redondear) o null si el día no tiene registro. */
export function macroPctForDay(
  values: MacroValues | null | undefined,
  targets: Partial<Record<MacroKey, number>>,
  panelConfig?: PanelConfig | null,
): number | null {
  if (values == null) return null;
  return macroDayPct(
    {
      calories: Number(values.calories || 0),
      protein: Number(values.protein || 0),
      carbs: Number(values.carbs || 0),
      fats: Number(values.fats || 0),
    },
    targets,
    panelConfig?.macro_ranges || PANEL_CONFIG_DEFAULTS.macro_ranges,
    panelConfig?.macro_weights || DEFAULT_MACRO_WEIGHTS,
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mapa `user_id:fecha` → % diario. Solo incluye días con registro y targets
 * suficientes para calcular; los días sin registro no aparecen.
 */
export function macroPctMap(
  records: Row[],
  targetsForUser: (userId: string) => Partial<Record<MacroKey, number>>,
  panelConfig?: PanelConfig | null,
): Map<string, number> {
  const byUserDay = new Map<string, number>();
  for (const row of records) {
    const date = String(row.log_date ?? "").slice(0, 10);
    if (!ISO_DATE.test(date)) continue;
    const userId = String(row.user_id ?? "").trim();
    if (!userId) continue;
    const pct = macroPctForDay(
      {
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fats: row.fats,
      },
      targetsForUser(userId),
      panelConfig,
    );
    if (pct == null) continue;
    byUserDay.set(`${userId}:${date}`, pct);
  }
  return byUserDay;
}
