/**
 * Contrato de PanelConfig ampliado (backend PR #80) + defaults compatibles
 * con producción actual (mismas reglas documentadas en gaps-marce-0710).
 *
 * Escritura: PATCH /api/p90/panel/config (solo admin). Body parcial de los
 * mismos campos del GET salvo can_comment y config_version. Si prod aún
 * responde 405 / Allow sin PATCH, la UI queda en solo lectura.
 */

import type {
  HabitWeights,
  MacroMetKey,
  MacroRange,
  MacroRanges,
  PanelConfig,
} from "./types";

export type MacroKey = MacroMetKey;
export type { HabitWeights, MacroRange, MacroRanges };

/** Defaults alineados a las reglas actuales del código / gaps. */
export const PANEL_CONFIG_DEFAULTS = {
  habit_weights: { training: 0.4, macros: 0.4, water: 0.2 } satisfies HabitWeights,
  partial_day_policy: "exclude" as const,
  missing_day_policy: "exclude" as const,
  macro_met_requires: ["calories", "protein"] as MacroKey[],
  macro_ranges: {
    calories: { min: null, max: 1.1 },
    protein: { min: 0.9, max: null },
    carbs: { min: 0.9, max: 1.1 },
    fats: { min: 0.9, max: 1.1 },
  } satisfies MacroRanges,
  calories_min_enabled: false,
  calories_low_ratio: 0.9,
  calories_low_alert_enabled: true,
  goal_resolution: "daily" as const,
  summary_avg_mode: "days_with_pct" as const,
  allow_student_rest: false,
  rest_day_counts: "exclude" as const,
  default_water_goal_ml: 2000,
  default_sessions_per_week: 3,
  training_mode: "sessions_per_week" as const,
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

/** Fusiona la respuesta de GET /config con defaults (prod aún sin campos nuevos). */
export function normalizePanelConfig(raw: Partial<PanelConfig> | null | undefined): PanelConfig {
  const base = raw || {};
  const thresholds = base.thresholds || { green_gt: 80, yellow_gte: 70, risk: 70 };
  return {
    // Bracket access: el gate del build prohíbe el acceso con punto a este flag.
    panel_enabled: asBool(base["panel_enabled"], false),
    thresholds: {
      green_gt: asNumber(thresholds.green_gt, 80),
      yellow_gte: asNumber(thresholds.yellow_gte, 70),
      risk: asNumber(thresholds.risk, 70),
    },
    percent_decimals: asNumber(base.percent_decimals, 1),
    show_summary_cards: asBool(base.show_summary_cards, true),
    show_email_in_table: asBool(base.show_email_in_table, true),
    ai_summary_enabled: asBool(base.ai_summary_enabled, false),
    can_comment: asBool(base.can_comment, true),
    comment_delete_policy: asString(base.comment_delete_policy, "author_or_admin"),
    habit_weights: normalizeWeights(base.habit_weights),
    partial_day_policy: asString(base.partial_day_policy, PANEL_CONFIG_DEFAULTS.partial_day_policy),
    missing_day_policy: asString(base.missing_day_policy, PANEL_CONFIG_DEFAULTS.missing_day_policy),
    macro_met_requires: normalizeMacroRequires(base.macro_met_requires),
    macro_ranges: normalizeMacroRanges(base.macro_ranges),
    calories_min_enabled: asBool(base.calories_min_enabled, PANEL_CONFIG_DEFAULTS.calories_min_enabled),
    calories_low_ratio: asNumber(base.calories_low_ratio, PANEL_CONFIG_DEFAULTS.calories_low_ratio),
    calories_low_alert_enabled: asBool(
      base.calories_low_alert_enabled,
      PANEL_CONFIG_DEFAULTS.calories_low_alert_enabled,
    ),
    goal_resolution: asString(base.goal_resolution, PANEL_CONFIG_DEFAULTS.goal_resolution),
    summary_avg_mode: asString(base.summary_avg_mode, PANEL_CONFIG_DEFAULTS.summary_avg_mode),
    allow_student_rest: asBool(base.allow_student_rest, PANEL_CONFIG_DEFAULTS.allow_student_rest),
    rest_day_counts: asString(base.rest_day_counts, PANEL_CONFIG_DEFAULTS.rest_day_counts),
    default_water_goal_ml: asNumber(
      base.default_water_goal_ml,
      PANEL_CONFIG_DEFAULTS.default_water_goal_ml,
    ),
    default_sessions_per_week: asNumber(
      base.default_sessions_per_week,
      PANEL_CONFIG_DEFAULTS.default_sessions_per_week,
    ),
    training_mode: asString(base.training_mode, PANEL_CONFIG_DEFAULTS.training_mode),
    config_version:
      base.config_version == null ? undefined : asNumber(base.config_version, 0),
  };
}

export function pctLabel(weight: number): string {
  const pct = Math.round(Number(weight) * 1000) / 10;
  const formatted = Number.isInteger(pct) ? String(pct) : String(pct).replace(".", ",");
  return `${formatted}%`;
}

/** Texto corto de la fórmula ponderada, p. ej. «40% entreno · 40% macros · 20% agua». */
export function habitWeightsFormulaText(weights?: HabitWeights | null): string {
  const w = weights || PANEL_CONFIG_DEFAULTS.habit_weights;
  return `${pctLabel(w.training)} entreno · ${pctLabel(w.macros)} macros · ${pctLabel(w.water)} agua`;
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
  // Fuera de rango: banda amarilla si se desvía ≤ 20% del borde más cercano
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
    daily: "Meta vigente cada día",
    latest: "Última meta aprobada",
    week_end: "Meta al cierre de la semana",
    days_with_pct: "Promedio de días con %",
    all_due_days: "Promedio de todos los días exigibles",
    sessions_per_week: "Sesiones por semana",
    rest_weekdays: "Días fijos de descanso",
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

/** Opciones de enums con copy claro para el coach. */
export const POLICY_OPTIONS = {
  partial_day_policy: [
    { value: "exclude", label: "Se excluye (no cuenta en el promedio)" },
    { value: "zero", label: "Cuenta como 0 %" },
    { value: "partial", label: "Cuenta como parcial" },
  ],
  missing_day_policy: [
    { value: "exclude", label: "Se excluye (no cuenta en el promedio)" },
    { value: "zero", label: "Cuenta como 0 %" },
  ],
  rest_day_counts: [
    { value: "exclude", label: "Se excluye (no cuenta)" },
    { value: "met", label: "Cuenta como cumplido (✓)" },
    { value: "zero", label: "Cuenta como 0 %" },
  ],
  goal_resolution: [
    { value: "daily", label: "Meta vigente cada día" },
    { value: "latest", label: "Última meta aprobada" },
    { value: "week_end", label: "Meta al cierre de la semana" },
  ],
  summary_avg_mode: [
    { value: "days_with_pct", label: "Promedio de días con %" },
    { value: "all_due_days", label: "Promedio de todos los días exigibles" },
  ],
  training_mode: [
    { value: "sessions_per_week", label: "Sesiones por semana" },
    { value: "rest_weekdays", label: "Días fijos de descanso" },
  ],
} as const;

export const MACRO_KEYS: MacroKey[] = ["calories", "protein", "carbs", "fats"];

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
