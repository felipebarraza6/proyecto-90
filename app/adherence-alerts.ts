import {
  macrosDayStatus,
  PANEL_CONFIG_DEFAULTS,
  type MacroKey,
} from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

export type Row = Record<string, unknown>;
export type AlertHabit = "training" | "macros";

const alertLabels: Record<AlertHabit, string> = {
  training: "Entrenamiento",
  macros: "Macros",
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export const chileToday = (timezone = PANEL_CONFIG_DEFAULTS.timezone) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || PANEL_CONFIG_DEFAULTS.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Inicio de semana según week_start_weekday (0=lun … 6=dom). */
export const mondayOf = (date: Date, weekStartWeekday = PANEL_CONFIG_DEFAULTS.week_start_weekday) => {
  const copy = new Date(`${iso(date)}T12:00:00Z`);
  const utcDay = copy.getUTCDay(); // 0=dom … 6=sáb
  const asMon0 = utcDay === 0 ? 6 : utcDay - 1; // 0=lun … 6=dom
  const start = ((weekStartWeekday % 7) + 7) % 7;
  const delta = (asMon0 - start + 7) % 7;
  return addDays(copy, -delta);
};

const personStart = (row: Row) =>
  String(row.challenge_start || row.assigned_at || row.created_at || "").slice(0, 10);

/**
 * Riesgo local: racha de incumplimientos consecutivos.
 * El backend no expone rachas; se usa alert_min_affected_days (default 2)
 * como umbral de días afectados consecutivos en rojo.
 */
function hasConsecutiveMisses(
  lookup: Map<string, string>,
  userId: string,
  habit: AlertHabit,
  days: Date[],
  start: string,
  streakNeeded: number,
) {
  let streak = 0;
  const need = Math.max(1, streakNeeded);
  for (const day of days) {
    const date = iso(day);
    if (start && date < start) continue;
    streak = lookup.get(`${userId}:${habit}:${date}`) === "missed" ? streak + 1 : 0;
    if (streak >= need) return true;
  }
  return false;
}

export function buildEffectiveRecords(
  people: Row[],
  records: Row[],
  nutritionRecords: Row[],
  panelConfig?: PanelConfig | null,
) {
  const macroCfg = {
    macro_met_requires: panelConfig?.macro_met_requires || PANEL_CONFIG_DEFAULTS.macro_met_requires,
    macro_ranges: panelConfig?.macro_ranges || PANEL_CONFIG_DEFAULTS.macro_ranges,
    calories_min_enabled:
      panelConfig?.calories_min_enabled ?? PANEL_CONFIG_DEFAULTS.calories_min_enabled,
    calories_low_ratio: panelConfig?.calories_low_ratio ?? PANEL_CONFIG_DEFAULTS.calories_low_ratio,
  };
  const calculated = nutritionRecords.flatMap((row) => {
    const person = people.find((item) => String(item.id) === String(row.user_id));
    const targets: Partial<Record<MacroKey, number>> = {
      calories: Number(person?.calories || 0),
      protein: Number(person?.protein || 0),
      carbs: Number(person?.carbs || 0),
      fats: Number(person?.fats || 0),
    };
    const values: Partial<Record<MacroKey, number>> = {
      calories: Number(row.calories || 0),
      protein: Number(row.protein || 0),
      carbs: Number(row.carbs || 0),
      fats: Number(row.fats || 0),
    };
    const status = macrosDayStatus(values, targets, macroCfg);
    if (status === "empty") return [];
    return [
      {
        user_id: row.user_id,
        habit: "macros",
        habit_date: row.log_date,
        status,
      },
    ];
  });
  return [...records.filter((row) => row.habit !== "macros"), ...calculated];
}

function missingCutoffDays(panelConfig?: PanelConfig | null): number {
  const missingMin =
    panelConfig?.missing_alert_min_days ?? PANEL_CONFIG_DEFAULTS.missing_alert_min_days;
  const graceH = panelConfig?.report_grace_hours ?? PANEL_CONFIG_DEFAULTS.report_grace_hours;
  if (graceH > 0) return Math.max(missingMin, Math.ceil(graceH / 24));
  return Math.max(1, missingMin);
}

export function computeAdherenceAlerts(
  people: Row[],
  records: Row[],
  nutritionRecords: Row[],
  habits: AlertHabit[] = ["training", "macros"],
  panelConfig?: PanelConfig | null,
) {
  const tz = panelConfig?.timezone || PANEL_CONFIG_DEFAULTS.timezone;
  const today = chileToday(tz);
  const weekStart = panelConfig?.week_start_weekday ?? PANEL_CONFIG_DEFAULTS.week_start_weekday;
  const currentMonday = mondayOf(new Date(`${today}T12:00:00Z`), weekStart);
  const days = Array.from({ length: 7 }, (_, index) => addDays(currentMonday, index));
  const closedDays = days.filter((day) => iso(day) < today);
  const backDays = missingCutoffDays(panelConfig);
  const cutoff = iso(addDays(new Date(`${today}T12:00:00Z`), -backDays));
  const overdueDays = days.filter((day) => iso(day) <= cutoff);
  const streakNeeded =
    panelConfig?.alert_min_affected_days ?? PANEL_CONFIG_DEFAULTS.alert_min_affected_days;
  const effective = buildEffectiveRecords(people, records, nutritionRecords, panelConfig);
  const lookup = new Map(
    effective.map((row) => [`${row.user_id}:${row.habit}:${row.habit_date}`, String(row.status)]),
  );

  const riskReasons = new Map(
    people
      .map((person) => {
        const id = String(person.id);
        const start = personStart(person);
        const reasons = habits
          .filter((key) =>
            hasConsecutiveMisses(lookup, id, key, closedDays, start, streakNeeded),
          )
          .map((key) => alertLabels[key]);
        return [id, reasons] as const;
      })
      .filter(([, reasons]) => reasons.length),
  );

  const missingReasons = new Map(
    people
      .map((person) => {
        const id = String(person.id);
        const start = personStart(person);
        const eligible = overdueDays.filter((day) => !start || iso(day) >= start);
        const reasons = habits
          .filter((key) => eligible.some((day) => !lookup.has(`${id}:${key}:${iso(day)}`)))
          .map((key) => alertLabels[key]);
        return [id, reasons] as const;
      })
      .filter(([, reasons]) => reasons.length),
  );

  return {
    today,
    currentMonday,
    riskReasons,
    missingReasons,
    riskCount: riskReasons.size,
    missingCount: missingReasons.size,
    total: riskReasons.size + missingReasons.size,
    streakNeeded,
    missingCutoffDays: backDays,
  };
}
