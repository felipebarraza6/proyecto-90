export const PANEL_SCREEN = "Adherencia y seguimiento";
export const MOBILE_BP = 768;
export const PANEL_SESSION_KEY = "p90_panel_week";

export type PanelFilter = "all" | "risk" | "missing";
export type SemaforoColor = "green" | "yellow" | "red" | "neutral";
export type DayState =
  | "not_started"
  | "out_of_challenge"
  | "future"
  | "today"
  | "due";
export type HabitStatus =
  | "met"
  | "missed"
  | "missing"
  | "rest"
  | "not_required"
  | "not_reported"
  | "not_applicable"
  | "not_started"
  | "future"
  | "out_of_challenge"
  | "today"
  | "due";
export type StudentStatus = "missing_report" | "at_risk" | "no_due_days";

export type HabitWeights = {
  training: number;
  macros: number;
  water: number;
};

/** Pesos relativos (o %) de cada macro dentro del día de macros. Default 40/40/10/10. */
export type MacroWeights = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type MacroRange = {
  min: number | null;
  max: number | null;
};

export type MacroRanges = {
  calories: MacroRange;
  protein: MacroRange;
  carbs: MacroRange;
  fats: MacroRange;
};

export type MacroMetKey = keyof MacroRanges;

/** Ventanas de hitos: día → [offsetInicio, offsetFin] desde el día 1. */
export type MilestoneWindows = Record<string, [number, number]>;

/**
 * Config del panel. Tras `normalizePanelConfig` todos los campos están
 * presentes (defaults del contrato PR #80 / migraciones 0009+0010).
 */
export type PanelConfig = {
  panel_enabled: boolean;
  thresholds: { green_gt: number; yellow_gte: number; risk: number };
  percent_decimals: number;
  show_summary_cards: boolean;
  show_email_in_table: boolean;
  ai_summary_enabled: boolean;
  can_comment: boolean;
  comment_delete_policy: string;
  /** Versión optimista del backend; no se envía en PATCH. */
  config_version?: number;
  /**
   * Si el GET /config lo envía, define si se pueden editar Reglas.
   * Si falta, el front usa el rol admin (P90_ADMIN).
   */
  can_edit?: boolean;

  habit_weights: HabitWeights;
  adherence_equal_weights_as_40_40_20: boolean;
  /** Peso de cada macro en el % del día. Ausente en API antigua → default 40/40/10/10. */
  macro_weights: MacroWeights;
  partial_day_policy: string;
  missing_day_policy: string;
  macro_met_requires: MacroMetKey[];
  macro_ranges: MacroRanges;
  calories_min_enabled: boolean;
  calories_low_ratio: number;
  calories_low_alert_enabled: boolean;
  goal_resolution: string;
  summary_avg_mode: string;
  allow_student_rest: boolean;
  rest_day_counts: string;
  /**
   * Si el coach participa en la mensajería alumno↔equipo.
   * Ausente o false → el coach no ve ni responde mensajes.
   */
  messaging_coach_enabled: boolean;
  default_water_goal_ml: number;
  default_sessions_per_week: number;
  training_mode: string;
  macros_source: string;

  no_data_counts_as_risk: boolean;
  status_multi_badge: boolean;
  week_start_weekday: number;
  timezone: string;
  report_grace_hours: number;
  challenge_length_days: number;
  show_after_challenge_end: boolean;
  block_length_days: number;
  prorate_partial_weeks: boolean;
  training_alert_closed_weeks_only: boolean;
  min_days_for_analysis: number;
  min_days_per_metric: number;
  alert_min_affected_days: number;
  missing_alert_min_days: number;
  milestone_days: number[];
  milestone_windows: MilestoneWindows;
  weight_min_kg: number;
  weight_max_kg: number;
  height_min_cm: number;
  height_max_cm: number;
  comment_visible_to_participant_default: boolean;
  notify_participant_on_comment: boolean;
  duplicate_window_seconds: number;
  comment_max_length: number;
  professional_scope: string;
  reviewer_access: string;

  /** IA no secreta (sin proveedor / modelo / clave). */
  ai_temperature: number;
  ai_max_tokens: number;
  ai_timeout_s: number;
};

/**
 * Body parcial de PATCH /api/p90/panel/config.
 * Sin can_comment, config_version ni panel_enabled (el front no edita ni envía ese flag).
 */
export type PanelConfigPatch = Partial<
  Omit<PanelConfig, "can_comment" | "config_version" | "panel_enabled" | "can_edit">
>;

export type WeekOption = { start: string; end: string; label: string };

export type WeeksResponse = {
  current: string;
  weeks: WeekOption[];
};

export type DayChip = {
  date: string;
  state: DayState | string;
  pct: number | null;
  color: SemaforoColor | string;
  label: string;
};

export type PanelRow = {
  client_id: number;
  name: string;
  email: string;
  days: DayChip[];
  weekly: { pct: number | null; color: SemaforoColor | string };
  status: StudentStatus[] | string[];
};

export type WeekResponse = {
  week: {
    start: string;
    end: string;
    label: string;
    is_current: boolean;
    is_closed?: boolean;
  };
  generated_at: string;
  summary: {
    participants: number;
    weekly_avg: number | null;
    at_risk: number;
    missing_report: number;
  };
  rows: PanelRow[];
  empty_reason: null | "no_participants" | "no_match_filter" | string;
};

export type WeightPoint = {
  kg: number | null;
  date: string | null;
  source: string | null;
  type?: "initial" | "checkpoint" | "control" | string;
  label?: string;
} | null;

export type WeightMilestone = {
  day: 30 | 60 | 90 | number;
  kg: number | null;
  date: string | null;
  expected_date: string | null;
  source: "checkpoint" | "measurement" | string | null;
  label: string;
};

export type WeightBlock = {
  initial: WeightPoint;
  milestones: WeightMilestone[];
  latest: WeightPoint;
};

export type HabitPlan = {
  sessions_per_week: number | null;
  rest_weekdays: number[];
  water_goal_ml: number | null;
  mode: string;
};

export type HabitPlanRecord = {
  id: number;
  effective_from: string | null;
  rest_weekdays: number[];
  water_goal_ml: number | null;
  sessions_per_week: number | null;
  set_by: string | null;
  created: string | null;
  note?: string;
};

export type HabitPlanResponse = {
  current: HabitPlanRecord | null;
  history: HabitPlanRecord[];
  can_edit: boolean;
  defaults: { water_goal_ml: number; sessions_per_week?: number };
};

export type HabitPlanSaveBody = {
  rest_weekdays: number[];
  water_goal_ml: number | null;
  sessions_per_week?: number | null;
  effective_from: string | null;
  note?: string;
};

export type HabitPlanSaveResponse = {
  plan: HabitPlanRecord;
  habit_plan: HabitPlan;
};

export type MacroPeriodKey = "1-30" | "31-60" | "61-90";

export type MacroTargetRecord = {
  id?: number;
  period: MacroPeriodKey | string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  effective_from: string | null;
  note?: string | null;
};

export type MacroTargetsResponse = {
  items?: MacroTargetRecord[];
  targets?: MacroTargetRecord[];
  can_edit?: boolean;
};

export type MacroTargetSaveBody = {
  period: MacroPeriodKey;
  effective_from?: string | null;
  calories: number;
  protein: number;
  carbs?: number | null;
  fats?: number | null;
  note?: string | null;
};

export type PanelMessage = {
  id: number | string;
  body?: string;
  text?: string;
  note?: string;
  author_name?: string;
  author_role?: string;
  role_label?: string;
  created_at?: string;
  created?: string;
  recipient_role?: string;
  reply_to_all?: boolean;
  is_broadcast?: boolean;
  broadcast?: boolean;
  client_id?: number;
  user_id?: number | string;
  direction?: string;
};

export type PanelMessagesResponse = {
  items?: PanelMessage[];
  messages?: PanelMessage[];
};

export type HabitCell = {
  status: HabitStatus | string;
  label: string;
  /** % del día de macros (cuando el backend lo envía; si falta, el front muestra ✓/✗). */
  pct?: number | null;
};
export type MacroCell = {
  value: number | null;
  pct: number | null;
  in_range: boolean | null;
  status: HabitStatus | string;
};
export type TotalCell = {
  pct: number | null;
  color: SemaforoColor | string;
  state: DayState | string;
  label: string;
};

export type TableRow =
  | { key: "daily_total"; cells: TotalCell[] }
  | { key: "training"; cells: HabitCell[] }
  | { key: "water"; goal_ml?: number | null; cells: HabitCell[] }
  | { key: "macros"; cells: HabitCell[] }
  | {
      key: "calories" | "protein" | "carbs" | "fats";
      target?: number | null;
      cells: MacroCell[];
    };

export type StudentWeekResponse = {
  profile: {
    name: string;
    email: string;
    weight: WeightBlock;
    height_cm: number | null;
    goal: string;
    /** Fallback si el backend aún no mapea objective → goal. */
    objective?: string | null;
    challenge_start: string | null;
    challenge_day: number | null;
    challenge_week: number | null;
    routine: {
      program: string | null;
      level: string | null;
      location: string | null;
      block: number | null;
    };
    nutrition_targets: {
      calories: number | null;
      protein: number | null;
      carbs: number | null;
      fats: number | null;
      effective_from: string | null;
      /** Obsoleto (PR #80): el front ya no lo muestra. */
      approved_by?: string | null;
      changed_in_week: string[];
    };
    habit_plan: HabitPlan;
  };
  weekly: {
    pct: number | null;
    color: SemaforoColor | string;
    status: string[];
  };
  table: {
    days: { date: string; weekday: number; state: string }[];
    rows: TableRow[];
  };
  training_progress: {
    done: number;
    planned: number | null;
    partial: boolean;
  };
};

export type AlertItem = {
  code: string;
  severity: "high" | "medium" | "info" | string;
  title: string;
  evidence: {
    metric?: string;
    values?: unknown[];
    target?: unknown;
    unit?: string;
    avg?: unknown;
  };
  affected_days: string[];
  affected_count: number;
  base_count: number;
  observation?: string;
};

export type AnalysisResponse = {
  status: "ok" | "insufficient" | "error" | string;
  engine?: string;
  data_version?: string;
  coverage?: {
    days_with_data?: number;
    due_days?: number;
    by_habit?: Record<string, { reported?: number; due?: number }>;
  };
  alerts?: AlertItem[];
  summary_text?: string;
  summary_engine?: "template" | "llm" | string;
  partial?: boolean;
  /** Semana cerrada (PR #80): no mostrar «Parcial · semana en curso». */
  week_closed?: boolean;
  advice?: string[];
  overview?: Record<string, unknown> | null;
  disclaimer?: string;
  generated_at?: string | null;
  last_ok_generated_at?: string | null;
  error_message?: string;
};

export type CommentItem = {
  id: number;
  text: string;
  author_name: string;
  author_role: string;
  role_label: string;
  created: string;
  week_start: string | null;
  week_label: string | null;
  can_delete: boolean;
};

export type CommentsResponse = {
  items: CommentItem[];
  next_cursor: string | null;
};

export type PanelWeekState = {
  weekStart: string | null;
  filter: PanelFilter;
  selectedClientId: number | null;
};
