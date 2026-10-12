import type { WeekResponse, WeeksResponse } from "./weekly-panel/types";

export type PanelWeekPctIndex = {
  weekStart: string;
  weekLabel: string;
  /** client_id → weekly.pct del panel (null si el alumno no tiene %). */
  byClientId: Map<string, number | null>;
};

export type WeekAdherenceChoice = {
  pct: number | null;
  label: string;
  isWeeklyPanel: boolean;
};

/** Orden: semana actual primero, luego el resto (sin duplicar). */
export function orderedWeekStarts(weeksRes: WeeksResponse): string[] {
  const starts = (weeksRes.weeks || []).map((w) => w.start).filter(Boolean);
  const current = weeksRes.current;
  if (!current) return starts;
  return [current, ...starts.filter((s) => s !== current)];
}

export function weekHasPctData(week: WeekResponse): boolean {
  return (week.rows || []).some(
    (row) => row.weekly?.pct != null && Number.isFinite(Number(row.weekly.pct)),
  );
}

export function buildPanelWeekPctIndex(week: WeekResponse): PanelWeekPctIndex {
  const byClientId = new Map<string, number | null>();
  for (const row of week.rows || []) {
    const pct = row.weekly?.pct;
    byClientId.set(
      String(row.client_id),
      pct == null || !Number.isFinite(Number(pct)) ? null : Number(pct),
    );
  }
  return {
    weekStart: week.week?.start || "",
    weekLabel: week.week?.label || week.week?.start || "",
    byClientId,
  };
}

/** id de alumno en Participantes ↔ client_id del panel. */
export function personClientId(person: Record<string, unknown>): string {
  const raw = person.client_id ?? person.id;
  return raw == null ? "" : String(raw);
}

/**
 * Elige % + etiqueta: panel gana; histórico solo si `panelWeek` es null (falló).
 */
export function chooseWeekAdherence(
  panelWeek: { pct: number | null; weekLabel: string } | null,
  historicalAdherence: unknown,
): WeekAdherenceChoice {
  if (panelWeek) {
    return {
      pct: panelWeek.pct,
      label: panelWeek.weekLabel
        ? `Semana ${panelWeek.weekLabel}`
        : "Adherencia semanal (panel)",
      isWeeklyPanel: true,
    };
  }
  const n =
    historicalAdherence == null || historicalAdherence === ""
      ? null
      : Number(historicalAdherence);
  return {
    pct: Number.isFinite(n as number) ? (n as number) : null,
    label: "Adherencia global (histórica)",
    isWeeklyPanel: false,
  };
}

/** ¿GET /config.can_edit o rol admin (P90_ADMIN) permiten editar Reglas? */
export function panelConfigCanEdit(
  role: string,
  config?: { can_edit?: boolean | null } | null,
): boolean {
  if (config?.can_edit != null) return Boolean(config.can_edit);
  return role === "admin";
}

/**
 * Carga la semana actual del panel; si no trae %, prueba semanas anteriores.
 * null = el panel falló (usar histórico). Fetchers inyectados (tests sin API).
 */
export async function loadPanelWeekAdherence(
  fetchWeeks: (signal?: AbortSignal) => Promise<WeeksResponse>,
  fetchWeek: (
    weekStart: string,
    filter: "all",
    signal?: AbortSignal,
  ) => Promise<WeekResponse>,
  signal?: AbortSignal,
): Promise<PanelWeekPctIndex | null> {
  try {
    const weeksRes = await fetchWeeks(signal);
    const starts = orderedWeekStarts(weeksRes);
    if (!starts.length) return null;

    let fallback: PanelWeekPctIndex | null = null;
    for (const start of starts) {
      const week = await fetchWeek(start, "all", signal);
      const index = buildPanelWeekPctIndex(week);
      if (!fallback) fallback = index;
      if (weekHasPctData(week)) return index;
    }
    return fallback;
  } catch {
    return null;
  }
}
