import { formatPct } from "./weekly-panel/format";
import { PANEL_CONFIG_DEFAULTS } from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

/**
 * % a mostrar en Participantes / directorio.
 * Preferencia: panel_week_pct | weekly_pct | panel_adherence | adherence_week
 * Si no viene, `adherence` histórica con etiqueta clara.
 */
export type AdherenceDisplay = {
  text: string;
  label: string;
  isWeeklyPanel: boolean;
};

function firstNumber(row: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = row[key];
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function participantAdherenceDisplay(
  person: Record<string, unknown>,
  panelConfig?: PanelConfig | null,
): AdherenceDisplay {
  const decimals = panelConfig?.percent_decimals ?? PANEL_CONFIG_DEFAULTS.percent_decimals;
  const weekly = firstNumber(person, [
    "panel_week_pct",
    "weekly_pct",
    "panel_adherence",
    "adherence_week",
  ]);
  if (weekly != null) {
    return {
      text: formatPct(weekly, decimals),
      label: "Adherencia semanal",
      isWeeklyPanel: true,
    };
  }
  const historical = firstNumber(person, ["adherence"]);
  return {
    text: formatPct(historical, decimals),
    label: "Adherencia global (histórica)",
    isWeeklyPanel: false,
  };
}
