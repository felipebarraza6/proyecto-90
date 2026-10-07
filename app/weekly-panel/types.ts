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

export type PanelConfig = {
  panel_enabled: boolean;
  thresholds: { green_gt: number; yellow_gte: number; risk: number };
  percent_decimals: number;
  show_summary_cards: boolean;
  show_email_in_table: boolean;
  ai_summary_enabled: boolean;
  can_comment: boolean;
  comment_delete_policy: string;
};

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
  week: { start: string; end: string; label: string; is_current: boolean };
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
  defaults: { water_goal_ml: number };
};

export type HabitPlanSaveBody = {
  rest_weekdays: number[];
  water_goal_ml: number | null;
  effective_from: string | null;
  note?: string;
};

export type HabitPlanSaveResponse = {
  plan: HabitPlanRecord;
  habit_plan: HabitPlan;
};

export type HabitCell = { status: HabitStatus | string; label: string };
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
      approved_by: string | null;
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
