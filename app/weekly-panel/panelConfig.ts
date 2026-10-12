/**
 * Contrato PanelConfig (backend PR #80, migraciones 0009 + 0010).
 * Fuente: uploads/contrato-panel-config-pr80.md
 *
 * GET/PATCH /api/p90/panel/config — PATCH solo admin; sin can_comment ni
 * config_version. Si prod responde 405, la UI queda en solo lectura.
 */

import type {
  HabitWeights,
  MacroMetKey,
  MacroRange,
  MacroRanges,
  MilestoneWindows,
  PanelConfig,
} from "./types";

export type MacroKey = MacroMetKey;
export type { HabitWeights, MacroRange, MacroRanges, MilestoneWindows };

/** Defaults exactos del contrato backend. */
export const PANEL_CONFIG_DEFAULTS = {
  habit_weights: { training: 1, macros: 1, water: 1 } satisfies HabitWeights,
  adherence_equal_weights_as_40_40_20: true,
  partial_day_policy: "reported_only" as const,
  missing_day_policy: "exclude" as const,
  macro_met_requires: ["calories", "protein"] as MacroKey[],
  macro_ranges: {
    calories: { min: null, max: 1.1 },
    protein: { min: 0.9, max: null },
    carbs: { min: 0.9, max: 1.1 },
    fats: { min: 0.9, max: 1.1 },
  } satisfies MacroRanges,
  calories_min_enabled: false,
  calories_low_ratio: 0.8,
  calories_low_alert_enabled: false,
  goal_resolution: "per_day" as const,
  summary_avg_mode: "per_student" as const,
  allow_student_rest: false,
  rest_day_counts: "exclude" as const,
  default_water_goal_ml: 2000,
  default_sessions_per_week: 3,
  training_mode: "auto" as const,
  macros_source: "computed_then_manual" as const,
  thresholds: { green_gt: 80, yellow_gte: 70, risk: 70 },
  percent_decimals: 1,
  no_data_counts_as_risk: false,
  status_multi_badge: true,
  week_start_weekday: 0,
  timezone: "America/Santiago",
  report_grace_hours: 0,
  challenge_length_days: 90,
  show_after_challenge_end: false,
  block_length_days: 30,
  prorate_partial_weeks: true,
  training_alert_closed_weeks_only: true,
  min_days_for_analysis: 3,
  min_days_per_metric: 2,
  alert_min_affected_days: 2,
  missing_alert_min_days: 1,
  milestone_days: [30, 60, 90],
  milestone_windows: {
    "30": [0, 29],
    "60": [30, 59],
    "90": [60, 89],
  } satisfies MilestoneWindows,
  weight_min_kg: 30,
  weight_max_kg: 300,
  height_min_cm: 100,
  height_max_cm: 230,
  comment_delete_policy: "any_staff" as const,
  comment_visible_to_participant_default: true,
  notify_participant_on_comment: false,
  duplicate_window_seconds: 60,
  comment_max_length: 4000,
  professional_scope: "all" as const,
  reviewer_access: "read" as const,
  panel_enabled: false,
  show_summary_cards: true,
  show_email_in_table: true,
  ai_summary_enabled: false,
  ai_temperature: 0.3,
  ai_max_tokens: 400,
  ai_timeout_s: 15,
};

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asString<T extends string>(value: unknown, fallback: T): T {
  return typeof value === "string" && value ? (value as T) : fallback;
}

function normalizeRange(raw: unknown, fallback: MacroRange): MacroRange {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const rec = raw as Record<string, unknown>;
  const min =
    rec.min == null || rec.min === ""
      ? null
      : Number.isFinite(Number(rec.min))
        ? Number(rec.min)
        : fallback.min;
  const max =
    rec.max == null || rec.max === ""
      ? null
      : Number.isFinite(Number(rec.max))
        ? Number(rec.max)
        : fallback.max;
  return { min, max };
}

function normalizeWeights(raw: unknown): HabitWeights {
  const d = PANEL_CONFIG_DEFAULTS.habit_weights;
  if (!raw || typeof raw !== "object") return { ...d };
  const rec = raw as Record<string, unknown>;
  return {
    training: asNumber(rec.training, d.training),
    macros: asNumber(rec.macros, d.macros),
    water: asNumber(rec.water, d.water),
  };
}

function normalizeMacroRequires(raw: unknown): MacroKey[] {
  const allowed: MacroKey[] = ["calories", "protein", "carbs", "fats"];
  if (!Array.isArray(raw)) return [...PANEL_CONFIG_DEFAULTS.macro_met_requires];
  const picked = raw.filter((x): x is MacroKey => allowed.includes(x as MacroKey));
  return picked.length ? picked : [...PANEL_CONFIG_DEFAULTS.macro_met_requires];
}

function normalizeMacroRanges(raw: unknown): MacroRanges {
  const d = PANEL_CONFIG_DEFAULTS.macro_ranges;
  if (!raw || typeof raw !== "object") {
    return {
      calories: { ...d.calories },
      protein: { ...d.protein },
      carbs: { ...d.carbs },
      fats: { ...d.fats },
    };
  }
  const rec = raw as Record<string, unknown>;
  return {
    calories: normalizeRange(rec.calories, d.calories),
    protein: normalizeRange(rec.protein, d.protein),
    carbs: normalizeRange(rec.carbs, d.carbs),
    fats: normalizeRange(rec.fats, d.fats),
  };
}

function normalizeMilestoneDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...PANEL_CONFIG_DEFAULTS.milestone_days];
  const days = raw
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .map((n) => Math.round(n));
  return days.length ? days : [...PANEL_CONFIG_DEFAULTS.milestone_days];
}

function normalizeMilestoneWindows(raw: unknown): MilestoneWindows {
  const fallback = { ...PANEL_CONFIG_DEFAULTS.milestone_windows };
  if (!raw || typeof raw !== "object") return fallback;
  const out: MilestoneWindows = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value) || value.length < 2) continue;
    const a = Number(value[0]);
    const b = Number(value[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    out[key] = [a, b];
  }
  return Object.keys(out).length ? out : fallback;
}

/** Fusiona la respuesta de GET /config con defaults del contrato. */
export function normalizePanelConfig(raw: Partial<PanelConfig> | null | undefined): PanelConfig {
  const base = raw || {};
  const d = PANEL_CONFIG_DEFAULTS;
  const thresholds = base.thresholds || d.thresholds;
  return {
    panel_enabled: asBool(base["panel_enabled"], d["panel_enabled"]),
    thresholds: {
      green_gt: asNumber(thresholds.green_gt, d.thresholds.green_gt),
      yellow_gte: asNumber(thresholds.yellow_gte, d.thresholds.yellow_gte),
      risk: asNumber(thresholds.risk, d.thresholds.risk),
    },
    percent_decimals: asNumber(base.percent_decimals, d.percent_decimals),
    show_summary_cards: asBool(base.show_summary_cards, d.show_summary_cards),
    show_email_in_table: asBool(base.show_email_in_table, d.show_email_in_table),
    ai_summary_enabled: asBool(base.ai_summary_enabled, d.ai_summary_enabled),
    can_comment: asBool(base.can_comment, true),
    comment_delete_policy: asString(base.comment_delete_policy, d.comment_delete_policy),
    habit_weights: normalizeWeights(base.habit_weights),
    adherence_equal_weights_as_40_40_20: asBool(
      base.adherence_equal_weights_as_40_40_20,
      d.adherence_equal_weights_as_40_40_20,
    ),
    partial_day_policy: asString(base.partial_day_policy, d.partial_day_policy),
    missing_day_policy: asString(base.missing_day_policy, d.missing_day_policy),
    macro_met_requires: normalizeMacroRequires(base.macro_met_requires),
    macro_ranges: normalizeMacroRanges(base.macro_ranges),
    calories_min_enabled: asBool(base.calories_min_enabled, d.calories_min_enabled),
    calories_low_ratio: asNumber(base.calories_low_ratio, d.calories_low_ratio),
    calories_low_alert_enabled: asBool(base.calories_low_alert_enabled, d.calories_low_alert_enabled),
    goal_resolution: asString(base.goal_resolution, d.goal_resolution),
    summary_avg_mode: asString(base.summary_avg_mode, d.summary_avg_mode),
    allow_student_rest: asBool(base.allow_student_rest, d.allow_student_rest),
    rest_day_counts: asString(base.rest_day_counts, d.rest_day_counts),
    default_water_goal_ml: asNumber(base.default_water_goal_ml, d.default_water_goal_ml),
    default_sessions_per_week: asNumber(base.default_sessions_per_week, d.default_sessions_per_week),
    training_mode: asString(base.training_mode, d.training_mode),
    macros_source: asString(base.macros_source, d.macros_source),
    no_data_counts_as_risk: asBool(base.no_data_counts_as_risk, d.no_data_counts_as_risk),
    status_multi_badge: asBool(base.status_multi_badge, d.status_multi_badge),
    week_start_weekday: asNumber(base.week_start_weekday, d.week_start_weekday),
    timezone: asString(base.timezone, d.timezone),
    report_grace_hours: asNumber(base.report_grace_hours, d.report_grace_hours),
    challenge_length_days: asNumber(base.challenge_length_days, d.challenge_length_days),
    show_after_challenge_end: asBool(base.show_after_challenge_end, d.show_after_challenge_end),
    block_length_days: asNumber(base.block_length_days, d.block_length_days),
    prorate_partial_weeks: asBool(base.prorate_partial_weeks, d.prorate_partial_weeks),
    training_alert_closed_weeks_only: asBool(
      base.training_alert_closed_weeks_only,
      d.training_alert_closed_weeks_only,
    ),
    min_days_for_analysis: asNumber(base.min_days_for_analysis, d.min_days_for_analysis),
    min_days_per_metric: asNumber(base.min_days_per_metric, d.min_days_per_metric),
    alert_min_affected_days: asNumber(base.alert_min_affected_days, d.alert_min_affected_days),
    missing_alert_min_days: asNumber(base.missing_alert_min_days, d.missing_alert_min_days),
    milestone_days: normalizeMilestoneDays(base.milestone_days),
    milestone_windows: normalizeMilestoneWindows(base.milestone_windows),
    weight_min_kg: asNumber(base.weight_min_kg, d.weight_min_kg),
    weight_max_kg: asNumber(base.weight_max_kg, d.weight_max_kg),
    height_min_cm: asNumber(base.height_min_cm, d.height_min_cm),
    height_max_cm: asNumber(base.height_max_cm, d.height_max_cm),
    comment_visible_to_participant_default: asBool(
      base.comment_visible_to_participant_default,
      d.comment_visible_to_participant_default,
    ),
    notify_participant_on_comment: asBool(
      base.notify_participant_on_comment,
      d.notify_participant_on_comment,
    ),
    duplicate_window_seconds: asNumber(base.duplicate_window_seconds, d.duplicate_window_seconds),
    comment_max_length: asNumber(base.comment_max_length, d.comment_max_length),
    professional_scope: asString(base.professional_scope, d.professional_scope),
    reviewer_access: asString(base.reviewer_access, d.reviewer_access),
    ai_temperature: asNumber(base.ai_temperature, d.ai_temperature),
    ai_max_tokens: asNumber(base.ai_max_tokens, d.ai_max_tokens),
    ai_timeout_s: asNumber(base.ai_timeout_s, d.ai_timeout_s),
    config_version: base.config_version == null ? undefined : asNumber(base.config_version, 0),
    ...(base.can_edit != null ? { can_edit: asBool(base.can_edit, false) } : {}),
  };
}

export function pctLabel(weight: number): string {
  const pct = Math.round(Number(weight) * 1000) / 10;
  const formatted = Number.isInteger(pct) ? String(pct) : String(pct).replace(".", ",");
  return `${formatted}%`;
}

/**
 * Texto de la fórmula ponderada. Si los pesos son iguales y
 * adherence_equal_weights_as_40_40_20, muestra 40/40/20.
 */
export function habitWeightsFormulaText(
  weights?: HabitWeights | null,
  equalAs404020 = PANEL_CONFIG_DEFAULTS.adherence_equal_weights_as_40_40_20,
): string {
  const w = weights || PANEL_CONFIG_DEFAULTS.habit_weights;
  const equal =
    Number(w.training) === Number(w.macros) && Number(w.macros) === Number(w.water);
  if (equalAs404020 && equal) {
    return "40% entreno · 40% macros · 20% agua";
  }
  const sum = Number(w.training) + Number(w.macros) + Number(w.water);
  if (sum > 0) {
    return `${pctLabel(w.training / sum)} entreno · ${pctLabel(w.macros / sum)} macros · ${pctLabel(w.water / sum)} agua`;
  }
  return `${pctLabel(w.training)} entreno · ${pctLabel(w.macros)} macros · ${pctLabel(w.water)} agua`;
}

/** Semanas del desafío (ceil de challenge_length_days / 7). */
export function challengeWeeks(config?: Pick<PanelConfig, "challenge_length_days"> | null): number {
  const days = config?.challenge_length_days ?? PANEL_CONFIG_DEFAULTS.challenge_length_days;
  return Math.max(1, Math.ceil(Number(days) / 7));
}

export function rangeInBounds(ratio: number, range: MacroRange): boolean {
  if (range.min != null && ratio < range.min) return false;
  if (range.max != null && ratio > range.max) return false;
  return true;
}

export function formatRangeHint(range: MacroRange): string {
  const parts: string[] = [];
  if (range.min != null) parts.push(`≥ ${Math.round(range.min * 100)}%`);
  if (range.max != null) parts.push(`≤ ${Math.round(range.max * 100)}%`);
  return parts.length ? parts.join(" y ") : "sin umbral";
}

export function macroTone(
  value: string | number | null | undefined,
  target: number,
  range: MacroRange,
): "" | "green" | "yellow" | "red" {
  if (value === "" || value == null || !target) return "";
  const actual = Number(value);
  if (!Number.isFinite(actual)) return "";
  const ratio = actual / target;
  if (rangeInBounds(ratio, range)) return "green";
  const lo = range.min ?? 0;
  const hi = range.max ?? Number.POSITIVE_INFINITY;
  if (ratio < lo) {
    const slack = lo > 0 ? (lo - ratio) / lo : 1;
    return slack <= 0.1 ? "yellow" : "red";
  }
  if (Number.isFinite(hi) && ratio > hi) {
    const slack = hi > 0 ? (ratio - hi) / hi : 1;
    return slack <= 0.1 ? "yellow" : "red";
  }
  return "red";
}

export function macrosDayStatus(
  values: Partial<Record<MacroKey, number | string | null | undefined>>,
  targets: Partial<Record<MacroKey, number | null | undefined>>,
  config: Pick<
    PanelConfig,
    "macro_met_requires" | "macro_ranges" | "calories_min_enabled" | "calories_low_ratio"
  >,
): "met" | "missed" | "empty" {
  const requires = config.macro_met_requires?.length
    ? config.macro_met_requires
    : PANEL_CONFIG_DEFAULTS.macro_met_requires;
  const ranges = config.macro_ranges || PANEL_CONFIG_DEFAULTS.macro_ranges;

  for (const key of requires) {
    const target = Number(targets[key] || 0);
    const raw = values[key];
    if (!target || raw == null || raw === "") return "empty";
    const actual = Number(raw);
    if (!Number.isFinite(actual)) return "empty";
    if (!rangeInBounds(actual / target, ranges[key])) return "missed";
  }

  if (config.calories_min_enabled) {
    const target = Number(targets.calories || 0);
    const raw = values.calories;
    if (!target || raw == null || raw === "") return "empty";
    const actual = Number(raw);
    const ratio = config.calories_low_ratio ?? PANEL_CONFIG_DEFAULTS.calories_low_ratio;
    if (!Number.isFinite(actual) || actual < target * ratio) return "missed";
  }

  return "met";
}

export function policyLabel(code: string): string {
  const map: Record<string, string> = {
    exclude: "Se excluye (no cuenta)",
    zero: "Cuenta como 0 %",
    met: "Cuenta como cumplido (✓)",
    miss: "Cuenta como no cumplido",
    missed: "Cuenta como no cumplido",
    partial: "Cuenta como parcial",
    include: "Se incluye en el promedio",
    reported_only: "Solo días con reporte",
    missing_as_missed: "Sin reporte = no cumplió",
    per_day: "Meta / promedio por día",
    daily: "Meta vigente cada día",
    latest: "Última meta aprobada",
    week_end: "Meta al cierre de la semana",
    days_with_pct: "Promedio de días con %",
    all_due_days: "Promedio de todos los días exigibles",
    per_student: "Promedio por alumno",
    sessions_per_week: "Sesiones por semana",
    rest_weekdays: "Días fijos de descanso",
    auto: "Automático",
    schedule: "Por calendario de descansos",
    quota: "Por cupo de sesiones",
    computed_then_manual: "Calculado y luego manual",
    computed: "Solo calculado",
    manual: "Solo manual",
    any_staff: "Cualquier miembro del equipo",
    own_or_admin: "Autor o administrador",
    author_or_admin: "Autor o administrador",
    all: "Todos los alumnos",
    assigned: "Solo asignados",
    read: "Solo lectura",
    none: "Sin acceso",
  };
  return map[code] || code;
}

export function macroKeyLabel(key: MacroKey): string {
  const map: Record<MacroKey, string> = {
    calories: "Calorías",
    protein: "Proteínas",
    carbs: "Carbohidratos",
    fats: "Grasas",
  };
  return map[key];
}

export const PANEL_CONFIG_PATCH_ENDPOINT = "PATCH /api/p90/panel/config";

/** Opciones de enums con copy claro para el coach (contrato #80). */
export const POLICY_OPTIONS = {
  partial_day_policy: [
    { value: "reported_only", label: "Solo días con reporte" },
    { value: "missing_as_missed", label: "Sin reporte = no cumplió" },
  ],
  missing_day_policy: [
    { value: "exclude", label: "Se excluye (no cuenta en el promedio)" },
    { value: "zero", label: "Cuenta como 0 %" },
  ],
  rest_day_counts: [
    { value: "exclude", label: "Se excluye (no cuenta)" },
    { value: "met", label: "Cuenta como cumplido (✓)" },
  ],
  goal_resolution: [
    { value: "per_day", label: "Meta vigente cada día" },
    { value: "latest", label: "Última meta aprobada" },
  ],
  summary_avg_mode: [
    { value: "per_student", label: "Promedio por alumno" },
    { value: "per_day", label: "Promedio por día" },
  ],
  training_mode: [
    { value: "auto", label: "Automático" },
    { value: "schedule", label: "Por calendario de descansos" },
    { value: "quota", label: "Por cupo de sesiones" },
  ],
  macros_source: [
    { value: "computed_then_manual", label: "Calculado y luego ajustable a mano" },
    { value: "computed", label: "Solo calculado" },
    { value: "manual", label: "Solo manual" },
  ],
  comment_delete_policy: [
    { value: "any_staff", label: "Cualquier miembro del equipo" },
    { value: "own_or_admin", label: "Solo el autor o un administrador" },
  ],
  professional_scope: [
    { value: "all", label: "Todos los alumnos" },
    { value: "assigned", label: "Solo alumnos asignados" },
  ],
  reviewer_access: [
    { value: "read", label: "Solo lectura" },
    { value: "none", label: "Sin acceso" },
  ],
  week_start_weekday: [
    { value: 0, label: "Lunes" },
    { value: 1, label: "Martes" },
    { value: 2, label: "Miércoles" },
    { value: 3, label: "Jueves" },
    { value: 4, label: "Viernes" },
    { value: 5, label: "Sábado" },
    { value: 6, label: "Domingo" },
  ],
} as const;

export const MACRO_KEYS: MacroKey[] = ["calories", "protein", "carbs", "fats"];

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Texto de ventanas de hitos a partir de milestone_windows. */
export function milestoneWindowsHint(windows?: MilestoneWindows | null): string {
  const w: MilestoneWindows = { ...(windows || PANEL_CONFIG_DEFAULTS.milestone_windows) };
  const parts = Object.keys(w)
    .sort((a, b) => Number(a) - Number(b))
    .map((day) => {
      const pair = w[day];
      if (!pair) return "";
      const [lo, hi] = pair;
      return `${lo + 1}–${hi + 1}`;
    })
    .filter(Boolean);
  return parts.length ? `Adherencia por tramos ${parts.join(" / ")} · días con registro` : "";
}
