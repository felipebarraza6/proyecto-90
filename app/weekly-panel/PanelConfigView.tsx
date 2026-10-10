import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PanelApiError, patchPanelConfig, probePanelConfigWritable } from "./api";
import {
  deepEqual,
  habitWeightsFormulaText,
  MACRO_KEYS,
  macroKeyLabel,
  milestoneWindowsHint,
  POLICY_OPTIONS,
  type MacroKey,
} from "./panelConfig";
import type {
  HabitWeights,
  MilestoneWindows,
  PanelConfig,
  PanelConfigPatch,
} from "./types";

/** Draft editable: todos los campos PATCH (sin can_comment ni config_version). */
type Draft = Omit<PanelConfig, "can_comment" | "config_version">;

type FieldErrors = Record<string, string>;

function toDraft(config: PanelConfig): Draft {
  return {
    panel_enabled: config["panel_enabled"],
    thresholds: { ...config.thresholds },
    percent_decimals: config.percent_decimals,
    show_summary_cards: config.show_summary_cards,
    show_email_in_table: config.show_email_in_table,
    ai_summary_enabled: config.ai_summary_enabled,
    comment_delete_policy: config.comment_delete_policy,
    habit_weights: { ...config.habit_weights },
    adherence_equal_weights_as_40_40_20: config.adherence_equal_weights_as_40_40_20,
    partial_day_policy: config.partial_day_policy,
    missing_day_policy: config.missing_day_policy,
    macro_met_requires: [...config.macro_met_requires],
    macro_ranges: {
      calories: { ...config.macro_ranges.calories },
      protein: { ...config.macro_ranges.protein },
      carbs: { ...config.macro_ranges.carbs },
      fats: { ...config.macro_ranges.fats },
    },
    calories_min_enabled: config.calories_min_enabled,
    calories_low_ratio: config.calories_low_ratio,
    calories_low_alert_enabled: config.calories_low_alert_enabled,
    goal_resolution: config.goal_resolution,
    summary_avg_mode: config.summary_avg_mode,
    allow_student_rest: config.allow_student_rest,
    rest_day_counts: config.rest_day_counts,
    default_water_goal_ml: config.default_water_goal_ml,
    default_sessions_per_week: config.default_sessions_per_week,
    training_mode: config.training_mode,
    macros_source: config.macros_source,
    no_data_counts_as_risk: config.no_data_counts_as_risk,
    status_multi_badge: config.status_multi_badge,
    week_start_weekday: config.week_start_weekday,
    timezone: config.timezone,
    report_grace_hours: config.report_grace_hours,
    challenge_length_days: config.challenge_length_days,
    show_after_challenge_end: config.show_after_challenge_end,
    block_length_days: config.block_length_days,
    prorate_partial_weeks: config.prorate_partial_weeks,
    training_alert_closed_weeks_only: config.training_alert_closed_weeks_only,
    min_days_for_analysis: config.min_days_for_analysis,
    min_days_per_metric: config.min_days_per_metric,
    alert_min_affected_days: config.alert_min_affected_days,
    missing_alert_min_days: config.missing_alert_min_days,
    milestone_days: [...config.milestone_days],
    milestone_windows: { ...config.milestone_windows },
    weight_min_kg: config.weight_min_kg,
    weight_max_kg: config.weight_max_kg,
    height_min_cm: config.height_min_cm,
    height_max_cm: config.height_max_cm,
    comment_visible_to_participant_default: config.comment_visible_to_participant_default,
    notify_participant_on_comment: config.notify_participant_on_comment,
    duplicate_window_seconds: config.duplicate_window_seconds,
    comment_max_length: config.comment_max_length,
    professional_scope: config.professional_scope,
    reviewer_access: config.reviewer_access,
    ai_temperature: config.ai_temperature,
    ai_max_tokens: config.ai_max_tokens,
    ai_timeout_s: config.ai_timeout_s,
  };
}

function ratioToPct(ratio: number | null): string {
  if (ratio == null || Number.isNaN(Number(ratio))) return "";
  return String(Math.round(Number(ratio) * 1000) / 10);
}

function pctToRatio(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  return n / 100;
}

function milestoneDaysToText(days: number[]): string {
  return days.join(", ");
}

function parseMilestoneDays(raw: string): number[] | null {
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const days: number[] = [];
  for (const part of parts) {
    const n = Number(part.replace(",", "."));
    if (!Number.isFinite(n) || n < 1) return null;
    days.push(Math.round(n));
  }
  return days.length ? days : null;
}

function syncWindowsToDays(days: number[], windows: MilestoneWindows): MilestoneWindows {
  const out: MilestoneWindows = {};
  const sorted = [...days].sort((a, b) => a - b);
  let prev = 0;
  for (const day of sorted) {
    const key = String(day);
    if (windows[key] && windows[key].length >= 2) {
      out[key] = [windows[key][0], windows[key][1]];
    } else {
      out[key] = [prev, Math.max(prev, day - 1)];
    }
    prev = day;
  }
  return out;
}

function buildPatch(baseline: Draft, draft: Draft): PanelConfigPatch {
  const patch: PanelConfigPatch = {};
  (Object.keys(draft) as (keyof Draft)[]).forEach((key) => {
    if (!deepEqual(baseline[key], draft[key])) {
      (patch as Record<string, unknown>)[key] = draft[key];
    }
  });
  return patch;
}

function validateDraft(draft: Draft): FieldErrors {
  const errors: FieldErrors = {};
  const w = draft.habit_weights;
  if (w.training < 0 || w.macros < 0 || w.water < 0) {
    errors.habit_weights = "Los pesos no pueden ser negativos.";
  }
  if (!draft.macro_met_requires.length) {
    errors.macro_met_requires = "Elige al menos una macro que defina el cumplimiento.";
  }
  for (const key of MACRO_KEYS) {
    const range = draft.macro_ranges[key];
    if (range.min != null && (range.min < 0 || range.min > 3)) {
      errors[`macro_ranges.${key}`] = `${macroKeyLabel(key)}: el mínimo debe estar entre 0 % y 300 %.`;
    }
    if (range.max != null && (range.max < 0 || range.max > 3)) {
      errors[`macro_ranges.${key}`] = `${macroKeyLabel(key)}: el máximo debe estar entre 0 % y 300 %.`;
    }
    if (range.min != null && range.max != null && range.min > range.max) {
      errors[`macro_ranges.${key}`] = `${macroKeyLabel(key)}: el mínimo no puede ser mayor que el máximo.`;
    }
  }
  if (draft.calories_low_ratio < 0.01 || draft.calories_low_ratio > 1) {
    errors.calories_low_ratio = "El piso de calorías debe estar entre 1 % y 100 % de la meta.";
  }
  if (draft.default_water_goal_ml < 500 || draft.default_water_goal_ml > 6000) {
    errors.default_water_goal_ml = "La meta de agua debe estar entre 0,5 L y 6 L.";
  }
  if (draft.default_sessions_per_week < 1 || draft.default_sessions_per_week > 7) {
    errors.default_sessions_per_week = "Las sesiones por semana van de 1 a 7.";
  }
  const t = draft.thresholds;
  if (
    !(
      t.green_gt >= t.yellow_gte &&
      t.yellow_gte >= 0 &&
      t.risk >= 0 &&
      t.green_gt <= 100 &&
      t.yellow_gte <= 100 &&
      t.risk <= 100
    )
  ) {
    errors.thresholds = "Revisa el semáforo: verde ≥ amarillo ≥ 0, y todos ≤ 100.";
  }
  if (draft.percent_decimals < 0 || draft.percent_decimals > 2) {
    errors.percent_decimals = "Los decimales del % van de 0 a 2.";
  }
  if (draft.week_start_weekday < 0 || draft.week_start_weekday > 6) {
    errors.week_start_weekday = "El inicio de semana debe ser un día válido (0–6).";
  }
  if (!draft.timezone.trim()) {
    errors.timezone = "Indica una zona horaria (ej. America/Santiago).";
  }
  if (draft.report_grace_hours < 0 || draft.report_grace_hours > 72) {
    errors.report_grace_hours = "Las horas de gracia van de 0 a 72.";
  }
  if (draft.challenge_length_days < 7 || draft.challenge_length_days > 365) {
    errors.challenge_length_days = "La duración del desafío va de 7 a 365 días.";
  }
  if (draft.block_length_days < 1 || draft.block_length_days > 365) {
    errors.block_length_days = "El bloque de rutina va de 1 a 365 días.";
  }
  if (draft.min_days_for_analysis < 0 || draft.min_days_for_analysis > 7) {
    errors.min_days_for_analysis = "Mínimo de días para análisis: 0–7.";
  }
  if (draft.min_days_per_metric < 0 || draft.min_days_per_metric > 7) {
    errors.min_days_per_metric = "Mínimo de muestras por métrica: 0–7.";
  }
  if (draft.alert_min_affected_days < 0 || draft.alert_min_affected_days > 7) {
    errors.alert_min_affected_days = "Días afectados para alertar: 0–7.";
  }
  if (draft.missing_alert_min_days < 0 || draft.missing_alert_min_days > 7) {
    errors.missing_alert_min_days = "Días sin reporte para alertar: 0–7.";
  }
  if (!draft.milestone_days.length || draft.milestone_days.some((d) => d < 1)) {
    errors.milestone_days = "Indica al menos un hito (entero ≥ 1), separados por comas.";
  }
  for (const day of draft.milestone_days) {
    const win = draft.milestone_windows[String(day)];
    if (!win || win.length < 2 || !Number.isFinite(win[0]) || !Number.isFinite(win[1])) {
      errors.milestone_windows = `Completa la ventana del día ${day} (desde / hasta).`;
      break;
    }
    if (win[0] > win[1]) {
      errors.milestone_windows = `En el día ${day}, «desde» no puede ser mayor que «hasta».`;
      break;
    }
  }
  if (draft.weight_min_kg < 20 || draft.weight_min_kg > 500) {
    errors.weight_min_kg = "Peso mínimo: 20–500 kg.";
  }
  if (draft.weight_max_kg < 20 || draft.weight_max_kg > 500) {
    errors.weight_max_kg = "Peso máximo: 20–500 kg.";
  }
  if (draft.weight_min_kg > draft.weight_max_kg) {
    errors.weight_min_kg = "El peso mínimo no puede ser mayor que el máximo.";
  }
  if (draft.height_min_cm < 50 || draft.height_min_cm > 300) {
    errors.height_min_cm = "Estatura mínima: 50–300 cm.";
  }
  if (draft.height_max_cm < 50 || draft.height_max_cm > 300) {
    errors.height_max_cm = "Estatura máxima: 50–300 cm.";
  }
  if (draft.height_min_cm > draft.height_max_cm) {
    errors.height_min_cm = "La estatura mínima no puede ser mayor que la máxima.";
  }
  if (draft.duplicate_window_seconds < 0 || draft.duplicate_window_seconds > 3600) {
    errors.duplicate_window_seconds = "Ventana anti-duplicado: 0–3600 s.";
  }
  if (draft.comment_max_length < 100 || draft.comment_max_length > 20000) {
    errors.comment_max_length = "Largo máximo del comentario: 100–20000.";
  }
  if (draft.ai_temperature < 0 || draft.ai_temperature > 2) {
    errors.ai_temperature = "Creatividad del texto: entre 0 y 2.";
  }
  if (draft.ai_max_tokens < 50 || draft.ai_max_tokens > 4000) {
    errors.ai_max_tokens = "Largo máximo del resumen: entre 50 y 4000.";
  }
  if (draft.ai_timeout_s < 1 || draft.ai_timeout_s > 120) {
    errors.ai_timeout_s = "Tiempo máximo de espera: entre 1 y 120 segundos.";
  }
  return errors;
}

function parseServerFieldErrors(payload: unknown): FieldErrors {
  const out: FieldErrors = {};
  if (!payload || typeof payload !== "object") return out;
  const rec = payload as Record<string, unknown>;
  for (const [key, value] of Object.entries(rec)) {
    if (key === "detail" || key === "error" || key === "non_field_errors") continue;
    if (typeof value === "string") out[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string") out[key] = value[0];
    else if (value && typeof value === "object") {
      for (const [sub, subVal] of Object.entries(value as Record<string, unknown>)) {
        const msg = Array.isArray(subVal) ? String(subVal[0] || "") : String(subVal || "");
        if (msg) out[`${key}.${sub}`] = msg;
      }
    }
  }
  return out;
}

function FieldError({ id, errors }: { id: string; errors: FieldErrors }) {
  const msg = errors[id];
  if (!msg) return null;
  return (
    <p className="wp-config-field-error" role="alert">
      {msg}
    </p>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`wp-config-switch ${checked ? "on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <i aria-hidden="true" />
      <span>{checked ? "Sí" : "No"}</span>
    </button>
  );
}

function ConfigSection({
  id,
  title,
  help,
  children,
}: {
  id: string;
  title: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <section className="wp-config-section" aria-labelledby={id}>
      <header className="wp-config-section-head">
        <h3 id={id}>{title}</h3>
        {help ? <p>{help}</p> : null}
      </header>
      <div className="wp-config-section-body">{children}</div>
    </section>
  );
}

function policyOptLabel(
  options: readonly { value: string | number; label: string }[],
  value: string | number,
): string {
  return options.find((o) => o.value === value)?.label ?? String(value);
}

function ReadOnlyRows({ config }: { config: PanelConfig }) {
  const draft = toDraft(config);
  return (
    <div className="wp-config-readonly-sections">
      <ConfigSection id="ro-formula" title="Fórmula y semáforo">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Pesos de la adherencia total</h3>
              <p>Cuánto pesa cada hábito en el % total.</p>
            </div>
            <strong>
              {habitWeightsFormulaText(draft.habit_weights, draft.adherence_equal_weights_as_40_40_20)}
            </strong>
          </li>
          <li>
            <div>
              <h3>Semáforo</h3>
            </div>
            <strong>
              Verde &gt; {draft.thresholds.green_gt} · Amarillo ≥ {draft.thresholds.yellow_gte} ·
              Riesgo &lt; {draft.thresholds.risk}
            </strong>
          </li>
          <li>
            <div>
              <h3>Vista del panel</h3>
            </div>
            <strong>
              Tarjetas {draft.show_summary_cards ? "sí" : "no"} · Correo{" "}
              {draft.show_email_in_table ? "sí" : "no"} · Panel{" "}
              {draft["panel_enabled"] ? "activo" : "inactivo"}
            </strong>
          </li>
          <li>
            <div>
              <h3>Comentarios y alcance</h3>
            </div>
            <strong>
              {policyOptLabel(POLICY_OPTIONS.comment_delete_policy, draft.comment_delete_policy)} ·{" "}
              {policyOptLabel(POLICY_OPTIONS.professional_scope, draft.professional_scope)} ·{" "}
              {policyOptLabel(POLICY_OPTIONS.reviewer_access, draft.reviewer_access)}
            </strong>
          </li>
        </ul>
      </ConfigSection>
      <ConfigSection id="ro-macros" title="Macros">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Macros que definen el cumplimiento</h3>
            </div>
            <strong>{draft.macro_met_requires.map(macroKeyLabel).join(", ")}</strong>
          </li>
          <li>
            <div>
              <h3>Origen de macros</h3>
            </div>
            <strong>{policyOptLabel(POLICY_OPTIONS.macros_source, draft.macros_source)}</strong>
          </li>
        </ul>
      </ConfigSection>
      <ConfigSection id="ro-entreno" title="Entreno y descansos">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Alumno puede marcar Descanso</h3>
            </div>
            <strong>{draft.allow_student_rest ? "Sí" : "No"}</strong>
          </li>
          <li>
            <div>
              <h3>Sesiones por semana (default)</h3>
            </div>
            <strong>{draft.default_sessions_per_week}</strong>
          </li>
          <li>
            <div>
              <h3>Modo de entrenamiento</h3>
            </div>
            <strong>{policyOptLabel(POLICY_OPTIONS.training_mode, draft.training_mode)}</strong>
          </li>
        </ul>
      </ConfigSection>
      <ConfigSection id="ro-agua" title="Agua">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Meta de agua por defecto</h3>
            </div>
            <strong>{draft.default_water_goal_ml / 1000} L/día</strong>
          </li>
        </ul>
      </ConfigSection>
      <ConfigSection id="ro-calendario" title="Calendario">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Inicio de semana</h3>
            </div>
            <strong>
              {policyOptLabel(POLICY_OPTIONS.week_start_weekday, draft.week_start_weekday)}
            </strong>
          </li>
          <li>
            <div>
              <h3>Zona horaria</h3>
            </div>
            <strong>{draft.timezone}</strong>
          </li>
          <li>
            <div>
              <h3>Duración del desafío</h3>
            </div>
            <strong>{draft.challenge_length_days} días</strong>
          </li>
        </ul>
      </ConfigSection>
      <ConfigSection id="ro-alertas" title="Alertas">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Alerta por calorías bajas</h3>
            </div>
            <strong>{draft.calories_low_alert_enabled ? "Sí" : "No"}</strong>
          </li>
          <li>
            <div>
              <h3>Umbrales de análisis</h3>
            </div>
            <strong>
              Análisis ≥ {draft.min_days_for_analysis} d · Métrica ≥ {draft.min_days_per_metric} ·
              Afectados ≥ {draft.alert_min_affected_days} · Sin reporte ≥{" "}
              {draft.missing_alert_min_days}
            </strong>
          </li>
        </ul>
      </ConfigSection>
      <ConfigSection id="ro-hitos" title="Hitos">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Días de hito</h3>
            </div>
            <strong>{draft.milestone_days.join(" / ")}</strong>
          </li>
          <li>
            <div>
              <h3>Ventanas</h3>
            </div>
            <strong>{milestoneWindowsHint(draft.milestone_windows) || "—"}</strong>
          </li>
        </ul>
      </ConfigSection>
      <ConfigSection id="ro-ia" title="Análisis IA">
        <ul className="wp-config-list">
          <li>
            <div>
              <h3>Resumen con IA</h3>
            </div>
            <strong>{draft.ai_summary_enabled ? "Sí" : "No"}</strong>
          </li>
          <li>
            <div>
              <h3>Parámetros</h3>
            </div>
            <strong>
              creatividad {draft.ai_temperature} · largo máx. {draft.ai_max_tokens} · espera{" "}
              {draft.ai_timeout_s}s
            </strong>
          </li>
        </ul>
      </ConfigSection>
    </div>
  );
}

export function PanelConfigView({
  config,
  onSaved,
}: {
  config: PanelConfig;
  onSaved: (next: PanelConfig) => void;
}) {
  const [baseline, setBaseline] = useState(() => toDraft(config));
  const [draft, setDraft] = useState(() => toDraft(config));
  const [milestoneDaysText, setMilestoneDaysText] = useState(() =>
    milestoneDaysToText(config.milestone_days),
  );
  const [writable, setWritable] = useState<boolean | null>(null);
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = toDraft(config);
    setBaseline(next);
    setDraft(next);
    setMilestoneDaysText(milestoneDaysToText(config.milestone_days));
    setLocalErrors({});
    setServerErrors({});
    setOk(false);
  }, [config]);

  useEffect(() => {
    const ac = new AbortController();
    probePanelConfigWritable(ac.signal)
      .then(setWritable)
      .catch(() => setWritable(false));
    return () => ac.abort();
  }, []);

  const patch = useMemo(() => buildPatch(baseline, draft), [baseline, draft]);
  const dirty = Object.keys(patch).length > 0;
  const errors = { ...localErrors, ...serverErrors };
  const readOnly = writable === false;

  function touch(updater: (prev: Draft) => Draft) {
    setDraft(updater);
    setOk(false);
  }

  function setWeight(key: keyof HabitWeights, raw: string) {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    touch((prev) => ({
      ...prev,
      habit_weights: { ...prev.habit_weights, [key]: n },
    }));
  }

  function setRange(key: MacroKey, side: "min" | "max", pctRaw: string) {
    const ratio = pctToRatio(pctRaw);
    touch((prev) => ({
      ...prev,
      macro_ranges: {
        ...prev.macro_ranges,
        [key]: {
          ...prev.macro_ranges[key],
          [side]:
            pctRaw.trim() === ""
              ? null
              : Number.isFinite(ratio as number)
                ? (ratio as number)
                : prev.macro_ranges[key][side],
        },
      },
    }));
  }

  function toggleMacroRequire(key: MacroKey) {
    touch((prev) => {
      const has = prev.macro_met_requires.includes(key);
      return {
        ...prev,
        macro_met_requires: has
          ? prev.macro_met_requires.filter((k) => k !== key)
          : [...prev.macro_met_requires, key],
      };
    });
  }

  function onMilestoneDaysChange(raw: string) {
    setMilestoneDaysText(raw);
    const parsed = parseMilestoneDays(raw);
    if (!parsed) return;
    touch((prev) => ({
      ...prev,
      milestone_days: parsed,
      milestone_windows: syncWindowsToDays(parsed, prev.milestone_windows),
    }));
  }

  function setWindowSide(day: number, side: 0 | 1, raw: string) {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    const key = String(day);
    touch((prev) => {
      const current = prev.milestone_windows[key] || [0, Math.max(0, day - 1)];
      const next: [number, number] = [current[0], current[1]];
      next[side] = Math.round(n);
      return {
        ...prev,
        milestone_windows: { ...prev.milestone_windows, [key]: next },
      };
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (readOnly || saving || !dirty) return;
    const nextErrors = validateDraft(draft);
    setLocalErrors(nextErrors);
    setServerErrors({});
    setFormError("");
    if (Object.keys(nextErrors).length) return;
    const confirmed = window.confirm(
      "¿Guardar estas reglas? El cambio afecta los cálculos de adherencia de todos los alumnos.",
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      const saved = await patchPanelConfig(patch);
      setOk(true);
      onSaved(saved);
    } catch (err: unknown) {
      if (err instanceof PanelApiError) {
        if (err.status === 405) {
          setWritable(false);
          setFormError("Todavía no se pueden guardar reglas desde aquí. Queda en solo lectura.");
        } else if (err.status === 403) {
          setFormError("Solo un administrador puede cambiar estas reglas.");
        } else if (err.status === 400) {
          const fields = parseServerFieldErrors(err.payload);
          setServerErrors(fields);
          setFormError(err.message || "Revisa los campos marcados.");
        } else {
          setFormError(err.message || `Error ${err.status}`);
        }
      } else {
        setFormError(err instanceof Error ? err.message : "No fue posible guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  const formulaPreview = habitWeightsFormulaText(
    draft.habit_weights,
    draft.adherence_equal_weights_as_40_40_20,
  );

  return (
    <section className="wp-config" aria-labelledby="wp-config-title">
      <header className="wp-config-head">
        <div>
          <span className="eyebrow">SOLO ADMINISTRADOR</span>
          <h2 id="wp-config-title">Reglas de adherencia del panel</h2>
          <p>
            Aquí defines cómo se calculan los porcentajes, colores y alertas del panel. Si
            guardas un cambio, se aplica a todos los alumnos.
          </p>
          {config.config_version != null ? (
            <p className="wp-config-version">Versión de las reglas: {config.config_version}</p>
          ) : null}
        </div>
      </header>

      {writable === null ? <p className="wp-habit-hint">Comprobando si se pueden guardar…</p> : null}

      {readOnly ? (
        <div className="wp-config-readonly" role="status">
          <b>Solo lectura</b>
          <p>
            Por ahora solo puedes ver las reglas. Cuando el equipo active el guardado, podrás
            editarlas desde esta pantalla.
          </p>
        </div>
      ) : (
        <div className="wp-config-warn" role="note">
          <b>Impacto global</b>
          <p>
            Al guardar, los nuevos criterios aplican a todos los alumnos del panel (porcentajes,
            colores, descansos y alertas).
          </p>
        </div>
      )}

      {readOnly ? (
        <ReadOnlyRows config={config} />
      ) : (
        <form className="wp-config-form" onSubmit={onSubmit} noValidate>
          <ConfigSection
            id="sec-formula"
            title="Fórmula y semáforo"
            help="Pesos del % total, políticas de promedio, semáforo, vista, comentarios y alcance."
          >
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Pesos de la adherencia total</legend>
              <p className="wp-config-help">
                Pesos relativos (≥ 0). No hace falta que sumen 100. Vista previa: {formulaPreview}
              </p>
              <div className="wp-config-grid three">
                {(["training", "macros", "water"] as const).map((key) => (
                  <label key={key}>
                    {key === "training" ? "Entreno" : key === "macros" ? "Macros" : "Agua"}
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={draft.habit_weights[key]}
                      onChange={(e) => setWeight(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <div className="wp-config-switch-row">
                <span>Si los pesos son iguales, mostrar 40 % / 40 % / 20 %</span>
                <Switch
                  label="Pesos iguales como 40/40/20"
                  checked={draft.adherence_equal_weights_as_40_40_20}
                  onChange={(v) => touch((p) => ({ ...p, adherence_equal_weights_as_40_40_20: v }))}
                />
              </div>
              <FieldError id="habit_weights" errors={errors} />
            </fieldset>

            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Días parciales, sin reporte y promedio</legend>
              <div className="wp-config-grid two">
                <label>
                  Día parcial (semana en curso)
                  <select
                    value={draft.partial_day_policy}
                    onChange={(e) => touch((p) => ({ ...p, partial_day_policy: e.target.value }))}
                  >
                    {POLICY_OPTIONS.partial_day_policy.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Día sin reporte
                  <select
                    value={draft.missing_day_policy}
                    onChange={(e) => touch((p) => ({ ...p, missing_day_policy: e.target.value }))}
                  >
                    {POLICY_OPTIONS.missing_day_policy.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Promedio en tarjetas de resumen
                  <select
                    value={draft.summary_avg_mode}
                    onChange={(e) => touch((p) => ({ ...p, summary_avg_mode: e.target.value }))}
                  >
                    {POLICY_OPTIONS.summary_avg_mode.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Decimales del %
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={1}
                    value={draft.percent_decimals}
                    onChange={(e) =>
                      touch((p) => ({ ...p, percent_decimals: Number(e.target.value) }))
                    }
                  />
                </label>
              </div>
              <FieldError id="percent_decimals" errors={errors} />
            </fieldset>

            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Semáforo</legend>
              <div className="wp-config-grid three">
                <label>
                  Verde si &gt;
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={draft.thresholds.green_gt}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        thresholds: { ...p.thresholds, green_gt: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
                <label>
                  Amarillo si ≥
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={draft.thresholds.yellow_gte}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        thresholds: { ...p.thresholds, yellow_gte: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
                <label>
                  Riesgo si &lt;
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={draft.thresholds.risk}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        thresholds: { ...p.thresholds, risk: Number(e.target.value) },
                      }))
                    }
                  />
                </label>
              </div>
              <FieldError id="thresholds" errors={errors} />
              <div className="wp-config-switch-row">
                <span>Sin dato cuenta como riesgo</span>
                <Switch
                  label="Sin dato cuenta como riesgo"
                  checked={draft.no_data_counts_as_risk}
                  onChange={(v) => touch((p) => ({ ...p, no_data_counts_as_risk: v }))}
                />
              </div>
              <div className="wp-config-switch-row">
                <span>Permitir varios badges de estado</span>
                <Switch
                  label="Varios badges de estado"
                  checked={draft.status_multi_badge}
                  onChange={(v) => touch((p) => ({ ...p, status_multi_badge: v }))}
                />
              </div>
            </fieldset>

            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Vista del panel</legend>
              <div className="wp-config-switch-row">
                <span>
                  Marca interna del panel (se guarda, pero no oculta esta pantalla)
                </span>
                <Switch
                  label="Panel habilitado"
                  checked={draft["panel_enabled"]}
                  onChange={(v) => touch((p) => ({ ...p, panel_enabled: v }))}
                />
              </div>
              <div className="wp-config-switch-row">
                <span>Mostrar tarjetas de resumen</span>
                <Switch
                  label="Mostrar tarjetas de resumen"
                  checked={draft.show_summary_cards}
                  onChange={(v) => touch((p) => ({ ...p, show_summary_cards: v }))}
                />
              </div>
              <div className="wp-config-switch-row">
                <span>Mostrar correo en la tabla</span>
                <Switch
                  label="Mostrar correo en la tabla"
                  checked={draft.show_email_in_table}
                  onChange={(v) => touch((p) => ({ ...p, show_email_in_table: v }))}
                />
              </div>
            </fieldset>

            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Comentarios</legend>
              <div className="wp-config-grid two">
                <label>
                  Quién puede borrar comentarios
                  <select
                    value={draft.comment_delete_policy}
                    onChange={(e) =>
                      touch((p) => ({ ...p, comment_delete_policy: e.target.value }))
                    }
                  >
                    {POLICY_OPTIONS.comment_delete_policy.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Largo máximo del comentario
                  <input
                    type="number"
                    min={100}
                    max={20000}
                    step={1}
                    value={draft.comment_max_length}
                    onChange={(e) =>
                      touch((p) => ({ ...p, comment_max_length: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Ventana anti-duplicado (segundos)
                  <input
                    type="number"
                    min={0}
                    max={3600}
                    step={1}
                    value={draft.duplicate_window_seconds}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        duplicate_window_seconds: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <div className="wp-config-switch-row">
                <span>Visible al alumno por defecto</span>
                <Switch
                  label="Comentario visible al alumno por defecto"
                  checked={draft.comment_visible_to_participant_default}
                  onChange={(v) =>
                    touch((p) => ({ ...p, comment_visible_to_participant_default: v }))
                  }
                />
              </div>
              <div className="wp-config-switch-row">
                <span>Notificar al alumno al comentar</span>
                <Switch
                  label="Notificar al alumno al comentar"
                  checked={draft.notify_participant_on_comment}
                  onChange={(v) =>
                    touch((p) => ({ ...p, notify_participant_on_comment: v }))
                  }
                />
              </div>
              <FieldError id="comment_max_length" errors={errors} />
              <FieldError id="duplicate_window_seconds" errors={errors} />
            </fieldset>

            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Alcance y validación corporal</legend>
              <div className="wp-config-grid two">
                <label>
                  Alcance del profesional
                  <select
                    value={draft.professional_scope}
                    onChange={(e) =>
                      touch((p) => ({ ...p, professional_scope: e.target.value }))
                    }
                  >
                    {POLICY_OPTIONS.professional_scope.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Acceso del reviewer
                  <select
                    value={draft.reviewer_access}
                    onChange={(e) => touch((p) => ({ ...p, reviewer_access: e.target.value }))}
                  >
                    {POLICY_OPTIONS.reviewer_access.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Peso mínimo (kg)
                  <input
                    type="number"
                    min={20}
                    max={500}
                    step={1}
                    value={draft.weight_min_kg}
                    onChange={(e) =>
                      touch((p) => ({ ...p, weight_min_kg: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Peso máximo (kg)
                  <input
                    type="number"
                    min={20}
                    max={500}
                    step={1}
                    value={draft.weight_max_kg}
                    onChange={(e) =>
                      touch((p) => ({ ...p, weight_max_kg: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Estatura mínima (cm)
                  <input
                    type="number"
                    min={50}
                    max={300}
                    step={1}
                    value={draft.height_min_cm}
                    onChange={(e) =>
                      touch((p) => ({ ...p, height_min_cm: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Estatura máxima (cm)
                  <input
                    type="number"
                    min={50}
                    max={300}
                    step={1}
                    value={draft.height_max_cm}
                    onChange={(e) =>
                      touch((p) => ({ ...p, height_max_cm: Number(e.target.value) }))
                    }
                  />
                </label>
              </div>
              <FieldError id="weight_min_kg" errors={errors} />
              <FieldError id="weight_max_kg" errors={errors} />
              <FieldError id="height_min_cm" errors={errors} />
              <FieldError id="height_max_cm" errors={errors} />
            </fieldset>
          </ConfigSection>

          <ConfigSection
            id="sec-macros"
            title="Macros"
            help="Qué macros definen el ✓ del día, rangos % de la meta y origen de los datos."
          >
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Cumplimiento y rangos</legend>
              <p className="wp-config-help">
                Solo las macros marcadas deciden el ✓ / ✗ del día. Los rangos se expresan como % de
                la meta (vacío = sin umbral).
              </p>
              <div className="wp-config-checks">
                {MACRO_KEYS.map((key) => (
                  <label key={key} className="wp-config-check">
                    <input
                      type="checkbox"
                      checked={draft.macro_met_requires.includes(key)}
                      onChange={() => toggleMacroRequire(key)}
                    />
                    {macroKeyLabel(key)} decide el cumplimiento
                  </label>
                ))}
              </div>
              <FieldError id="macro_met_requires" errors={errors} />
              <div className="wp-config-ranges">
                {MACRO_KEYS.map((key) => (
                  <div key={key} className="wp-config-range-row">
                    <b>{macroKeyLabel(key)}</b>
                    <label>
                      Mín %
                      <input
                        type="number"
                        min={0}
                        max={300}
                        step={1}
                        placeholder="—"
                        value={ratioToPct(draft.macro_ranges[key].min)}
                        onChange={(e) => setRange(key, "min", e.target.value)}
                      />
                    </label>
                    <label>
                      Máx %
                      <input
                        type="number"
                        min={0}
                        max={300}
                        step={1}
                        placeholder="—"
                        value={ratioToPct(draft.macro_ranges[key].max)}
                        onChange={(e) => setRange(key, "max", e.target.value)}
                      />
                    </label>
                    <FieldError id={`macro_ranges.${key}`} errors={errors} />
                  </div>
                ))}
              </div>
              <FieldError id="macro_ranges" errors={errors} />
            </fieldset>

            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Calorías mínimas, meta y origen</legend>
              <div className="wp-config-grid two">
                <div className="wp-config-switch-row">
                  <span>Exigir mínimo de calorías</span>
                  <Switch
                    label="Exigir mínimo de calorías"
                    checked={draft.calories_min_enabled}
                    onChange={(v) => touch((p) => ({ ...p, calories_min_enabled: v }))}
                  />
                </div>
                <label>
                  Piso de calorías (% de la meta)
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={ratioToPct(draft.calories_low_ratio)}
                    onChange={(e) => {
                      const ratio = pctToRatio(e.target.value);
                      if (Number.isFinite(ratio as number) && ratio != null) {
                        touch((p) => ({ ...p, calories_low_ratio: ratio }));
                      }
                    }}
                  />
                </label>
                <label>
                  Resolución de la meta nutricional
                  <select
                    value={draft.goal_resolution}
                    onChange={(e) => touch((p) => ({ ...p, goal_resolution: e.target.value }))}
                  >
                    {POLICY_OPTIONS.goal_resolution.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Origen de las macros
                  <select
                    value={draft.macros_source}
                    onChange={(e) => touch((p) => ({ ...p, macros_source: e.target.value }))}
                  >
                    {POLICY_OPTIONS.macros_source.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <FieldError id="calories_low_ratio" errors={errors} />
            </fieldset>
          </ConfigSection>

          <ConfigSection
            id="sec-entreno"
            title="Entreno y descansos"
            help="Plan por defecto del alumno, cómo cuenta un descanso y prorrateo."
          >
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Plan y descanso</legend>
              <div className="wp-config-grid two">
                <div className="wp-config-switch-row">
                  <span>El alumno puede marcar Descanso (D)</span>
                  <Switch
                    label="El alumno puede marcar Descanso"
                    checked={draft.allow_student_rest}
                    onChange={(v) => touch((p) => ({ ...p, allow_student_rest: v }))}
                  />
                </div>
                <label>
                  Cómo cuenta un día de descanso
                  <select
                    value={draft.rest_day_counts}
                    onChange={(e) => touch((p) => ({ ...p, rest_day_counts: e.target.value }))}
                  >
                    {POLICY_OPTIONS.rest_day_counts.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sesiones por semana (default)
                  <input
                    type="number"
                    min={1}
                    max={7}
                    step={1}
                    value={draft.default_sessions_per_week}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        default_sessions_per_week:
                          Number(e.target.value) || p.default_sessions_per_week,
                      }))
                    }
                  />
                </label>
                <label>
                  Modo de entrenamiento
                  <select
                    value={draft.training_mode}
                    onChange={(e) => touch((p) => ({ ...p, training_mode: e.target.value }))}
                  >
                    {POLICY_OPTIONS.training_mode.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="wp-config-switch-row">
                <span>Prorratear sesiones en semanas parciales</span>
                <Switch
                  label="Prorratear semanas parciales"
                  checked={draft.prorate_partial_weeks}
                  onChange={(v) => touch((p) => ({ ...p, prorate_partial_weeks: v }))}
                />
              </div>
              <FieldError id="default_sessions_per_week" errors={errors} />
            </fieldset>
          </ConfigSection>

          <ConfigSection id="sec-agua" title="Agua" help="Meta por defecto al crear el plan de hábitos.">
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Meta de agua</legend>
              <div className="wp-config-grid two">
                <label>
                  Meta de agua por defecto (L/día)
                  <input
                    type="number"
                    min={0.5}
                    max={6}
                    step={0.25}
                    value={draft.default_water_goal_ml / 1000}
                    onChange={(e) => {
                      const liters = Number(e.target.value.replace(",", "."));
                      if (Number.isFinite(liters)) {
                        touch((p) => ({
                          ...p,
                          default_water_goal_ml: Math.round(liters * 1000),
                        }));
                      }
                    }}
                  />
                </label>
              </div>
              <FieldError id="default_water_goal_ml" errors={errors} />
            </fieldset>
          </ConfigSection>

          <ConfigSection
            id="sec-calendario"
            title="Calendario"
            help="Inicio de semana, zona horaria, gracia para reportar y duración del desafío."
          >
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Semana, reloj y desafío</legend>
              <div className="wp-config-grid two">
                <label>
                  Inicio de semana
                  <select
                    value={draft.week_start_weekday}
                    onChange={(e) =>
                      touch((p) => ({ ...p, week_start_weekday: Number(e.target.value) }))
                    }
                  >
                    {POLICY_OPTIONS.week_start_weekday.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Zona horaria
                  <input
                    type="text"
                    placeholder="America/Santiago"
                    value={draft.timezone}
                    onChange={(e) => touch((p) => ({ ...p, timezone: e.target.value }))}
                  />
                </label>
                <label>
                  Horas de gracia para reportar
                  <input
                    type="number"
                    min={0}
                    max={72}
                    step={1}
                    value={draft.report_grace_hours}
                    onChange={(e) =>
                      touch((p) => ({ ...p, report_grace_hours: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Duración del desafío (días)
                  <input
                    type="number"
                    min={7}
                    max={365}
                    step={1}
                    value={draft.challenge_length_days}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        challenge_length_days: Number(e.target.value) || p.challenge_length_days,
                      }))
                    }
                  />
                </label>
                <label>
                  Largo del bloque de rutina (días)
                  <input
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={draft.block_length_days}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        block_length_days: Number(e.target.value) || p.block_length_days,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="wp-config-switch-row">
                <span>Mostrar semanas después del fin del desafío</span>
                <Switch
                  label="Mostrar después del fin del desafío"
                  checked={draft.show_after_challenge_end}
                  onChange={(v) => touch((p) => ({ ...p, show_after_challenge_end: v }))}
                />
              </div>
              <FieldError id="week_start_weekday" errors={errors} />
              <FieldError id="timezone" errors={errors} />
              <FieldError id="report_grace_hours" errors={errors} />
              <FieldError id="challenge_length_days" errors={errors} />
              <FieldError id="block_length_days" errors={errors} />
            </fieldset>
          </ConfigSection>

          <ConfigSection
            id="sec-alertas"
            title="Alertas"
            help="Umbrales del análisis y alerta de calorías bajas."
          >
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Calorías bajas y cobertura</legend>
              <div className="wp-config-switch-row">
                <span>Alerta por calorías bajas</span>
                <Switch
                  label="Alerta por calorías bajas"
                  checked={draft.calories_low_alert_enabled}
                  onChange={(v) => touch((p) => ({ ...p, calories_low_alert_enabled: v }))}
                />
              </div>
              <div className="wp-config-switch-row">
                <span>Alerta de entreno solo en semanas cerradas</span>
                <Switch
                  label="Alerta de entreno solo semanas cerradas"
                  checked={draft.training_alert_closed_weeks_only}
                  onChange={(v) =>
                    touch((p) => ({ ...p, training_alert_closed_weeks_only: v }))
                  }
                />
              </div>
              <div className="wp-config-grid two">
                <label>
                  Mín. días con dato para el análisis
                  <input
                    type="number"
                    min={0}
                    max={7}
                    step={1}
                    value={draft.min_days_for_analysis}
                    onChange={(e) =>
                      touch((p) => ({ ...p, min_days_for_analysis: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Mín. muestras por métrica
                  <input
                    type="number"
                    min={0}
                    max={7}
                    step={1}
                    value={draft.min_days_per_metric}
                    onChange={(e) =>
                      touch((p) => ({ ...p, min_days_per_metric: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Días afectados para alertar
                  <input
                    type="number"
                    min={0}
                    max={7}
                    step={1}
                    value={draft.alert_min_affected_days}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        alert_min_affected_days: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  Días sin reporte para alertar
                  <input
                    type="number"
                    min={0}
                    max={7}
                    step={1}
                    value={draft.missing_alert_min_days}
                    onChange={(e) =>
                      touch((p) => ({
                        ...p,
                        missing_alert_min_days: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
              <FieldError id="min_days_for_analysis" errors={errors} />
              <FieldError id="min_days_per_metric" errors={errors} />
              <FieldError id="alert_min_affected_days" errors={errors} />
              <FieldError id="missing_alert_min_days" errors={errors} />
            </fieldset>
          </ConfigSection>

          <ConfigSection
            id="sec-hitos"
            title="Hitos"
            help="Checkpoints de peso y ventanas de adherencia por tramo."
          >
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Días y ventanas</legend>
              <p className="wp-config-help">
                {milestoneWindowsHint(draft.milestone_windows) ||
                  "Define los días de hito y el tramo de días que cubre cada uno (desde el día 1)."}
              </p>
              <label>
                Días de hito (separados por comas)
                <input
                  type="text"
                  placeholder="30, 60, 90"
                  value={milestoneDaysText}
                  onChange={(e) => onMilestoneDaysChange(e.target.value)}
                />
              </label>
              <FieldError id="milestone_days" errors={errors} />
              <div className="wp-config-ranges">
                {draft.milestone_days.map((day) => {
                  const win = draft.milestone_windows[String(day)] || [0, Math.max(0, day - 1)];
                  return (
                    <div key={day} className="wp-config-range-row">
                      <b>Día {day}</b>
                      <label>
                        Desde (día relativo)
                        <input
                          type="number"
                          step={1}
                          value={win[0]}
                          onChange={(e) => setWindowSide(day, 0, e.target.value)}
                        />
                      </label>
                      <label>
                        Hasta (día relativo)
                        <input
                          type="number"
                          step={1}
                          value={win[1]}
                          onChange={(e) => setWindowSide(day, 1, e.target.value)}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
              <FieldError id="milestone_windows" errors={errors} />
            </fieldset>
          </ConfigSection>

          <ConfigSection
            id="sec-ia"
            title="Análisis IA"
            help="Resumen automático en la ficha del alumno."
          >
            <fieldset className="wp-config-block" disabled={saving}>
              <legend>Resumen automático</legend>
              <div className="wp-config-switch-row">
                <span>Resumen con IA</span>
                <Switch
                  label="Resumen con IA"
                  checked={draft.ai_summary_enabled}
                  onChange={(v) => touch((p) => ({ ...p, ai_summary_enabled: v }))}
                />
              </div>
              <div className="wp-config-grid three">
                <label>
                  Creatividad del texto
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={draft.ai_temperature}
                    onChange={(e) =>
                      touch((p) => ({ ...p, ai_temperature: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Largo máximo del resumen
                  <input
                    type="number"
                    min={50}
                    max={4000}
                    step={1}
                    value={draft.ai_max_tokens}
                    onChange={(e) =>
                      touch((p) => ({ ...p, ai_max_tokens: Number(e.target.value) }))
                    }
                  />
                </label>
                <label>
                  Tiempo máximo de espera (s)
                  <input
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={draft.ai_timeout_s}
                    onChange={(e) =>
                      touch((p) => ({ ...p, ai_timeout_s: Number(e.target.value) }))
                    }
                  />
                </label>
              </div>
              <FieldError id="ai_temperature" errors={errors} />
              <FieldError id="ai_max_tokens" errors={errors} />
              <FieldError id="ai_timeout_s" errors={errors} />
            </fieldset>
          </ConfigSection>

          {formError ? (
            <p className="wp-feedback-error" role="alert">
              {formError}
            </p>
          ) : null}
          {ok ? <p className="wp-sent">Guardado. Se actualizaron las reglas y el panel.</p> : null}

          <div className="wp-config-actions">
            <button
              type="button"
              className="secondary"
              disabled={saving || !dirty}
              onClick={() => {
                setDraft(baseline);
                setMilestoneDaysText(milestoneDaysToText(baseline.milestone_days));
                setLocalErrors({});
                setServerErrors({});
                setFormError("");
                setOk(false);
              }}
            >
              Descartar cambios
            </button>
            <button type="submit" className="primary" disabled={saving || !dirty}>
              {saving ? "Guardando…" : "Guardar reglas"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
