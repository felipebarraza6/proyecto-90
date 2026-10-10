import { useEffect, useMemo, useState, type FormEvent } from "react";
import { PanelApiError, patchPanelConfig, probePanelConfigWritable } from "./api";
import {
  deepEqual,
  habitWeightsFormulaText,
  MACRO_KEYS,
  macroKeyLabel,
  PANEL_CONFIG_PATCH_ENDPOINT,
  POLICY_OPTIONS,
  type MacroKey,
} from "./panelConfig";
import type { HabitWeights, MacroRanges, PanelConfig, PanelConfigPatch } from "./types";

type Draft = {
  habit_weights: HabitWeights;
  partial_day_policy: string;
  missing_day_policy: string;
  macro_met_requires: MacroKey[];
  macro_ranges: MacroRanges;
  calories_min_enabled: boolean;
  calories_low_ratio: number;
  calories_low_alert_enabled: boolean;
  goal_resolution: string;
  summary_avg_mode: string;
  allow_student_rest: boolean;
  rest_day_counts: string;
  default_water_goal_ml: number;
  default_sessions_per_week: number;
  training_mode: string;
  thresholds: PanelConfig["thresholds"];
  percent_decimals: number;
  show_summary_cards: boolean;
  show_email_in_table: boolean;
  ai_summary_enabled: boolean;
};

type FieldErrors = Record<string, string>;

function toDraft(config: PanelConfig): Draft {
  return {
    habit_weights: { ...config.habit_weights },
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
    thresholds: { ...config.thresholds },
    percent_decimals: config.percent_decimals,
    show_summary_cards: config.show_summary_cards,
    show_email_in_table: config.show_email_in_table,
    ai_summary_enabled: config.ai_summary_enabled,
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
  const sum = w.training + w.macros + w.water;
  if (w.training < 0 || w.macros < 0 || w.water < 0) {
    errors.habit_weights = "Los pesos no pueden ser negativos.";
  } else if (Math.abs(sum - 1) > 0.021) {
    errors.habit_weights = `Los pesos deben sumar 100 % (ahora ${Math.round(sum * 1000) / 10} %).`;
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
  if (draft.calories_low_ratio < 0 || draft.calories_low_ratio > 1.5) {
    errors.calories_low_ratio = "El piso de calorías debe estar entre 0 % y 150 %.";
  }
  if (draft.default_water_goal_ml < 500 || draft.default_water_goal_ml > 6000) {
    errors.default_water_goal_ml = "La meta de agua debe estar entre 0,5 L y 6 L.";
  }
  if (draft.default_sessions_per_week < 1 || draft.default_sessions_per_week > 7) {
    errors.default_sessions_per_week = "Las sesiones por semana van de 1 a 7.";
  }
  const t = draft.thresholds;
  if (!(t.green_gt >= t.yellow_gte && t.yellow_gte >= 0 && t.risk >= 0 && t.green_gt <= 100)) {
    errors.thresholds = "Revisa el semáforo: verde > amarillo ≥ 0, y todos ≤ 100.";
  }
  if (draft.percent_decimals < 0 || draft.percent_decimals > 2) {
    errors.percent_decimals = "Los decimales del % van de 0 a 2.";
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

function ReadOnlyRows({ config }: { config: PanelConfig }) {
  const draft = toDraft(config);
  return (
    <ul className="wp-config-list">
      <li>
        <div>
          <h3>Pesos de la adherencia total</h3>
          <p>Cuánto pesa cada hábito en el % total.</p>
        </div>
        <strong>{habitWeightsFormulaText(draft.habit_weights)}</strong>
      </li>
      <li>
        <div>
          <h3>Macros que definen el cumplimiento</h3>
        </div>
        <strong>{draft.macro_met_requires.map(macroKeyLabel).join(", ")}</strong>
      </li>
      <li>
        <div>
          <h3>Alumno puede marcar Descanso</h3>
        </div>
        <strong>{draft.allow_student_rest ? "Sí" : "No"}</strong>
      </li>
    </ul>
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

  function setWeight(key: keyof HabitWeights, pctRaw: string) {
    const ratio = pctToRatio(pctRaw);
    setDraft((prev) => ({
      ...prev,
      habit_weights: {
        ...prev.habit_weights,
        [key]: Number.isFinite(ratio as number) ? (ratio as number) : prev.habit_weights[key],
      },
    }));
    setOk(false);
  }

  function setRange(key: MacroKey, side: "min" | "max", pctRaw: string) {
    const ratio = pctToRatio(pctRaw);
    setDraft((prev) => ({
      ...prev,
      macro_ranges: {
        ...prev.macro_ranges,
        [key]: {
          ...prev.macro_ranges[key],
          [side]: pctRaw.trim() === "" ? null : Number.isFinite(ratio as number) ? ratio : prev.macro_ranges[key][side],
        },
      },
    }));
    setOk(false);
  }

  function toggleMacroRequire(key: MacroKey) {
    setDraft((prev) => {
      const has = prev.macro_met_requires.includes(key);
      return {
        ...prev,
        macro_met_requires: has
          ? prev.macro_met_requires.filter((k) => k !== key)
          : [...prev.macro_met_requires, key],
      };
    });
    setOk(false);
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
          setFormError("El backend aún no admite guardar reglas (405). Queda en solo lectura.");
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

  return (
    <section className="wp-config" aria-labelledby="wp-config-title">
      <header className="wp-config-head">
        <div>
          <span className="eyebrow">SOLO ADMINISTRADOR</span>
          <h2 id="wp-config-title">Reglas de adherencia del panel</h2>
          <p>
            Ajustes que usa el backend para calcular % y alertas. Un cambio aquí recalcula la
            adherencia de todos los alumnos.
          </p>
          {config.config_version != null ? (
            <p className="wp-config-version">Versión de config: {config.config_version}</p>
          ) : null}
        </div>
      </header>

      {writable === null ? <p className="wp-habit-hint">Comprobando si se pueden guardar…</p> : null}

      {readOnly ? (
        <div className="wp-config-readonly" role="status">
          <b>Solo lectura</b>
          <p>
            El servidor aún no admite <code>{PANEL_CONFIG_PATCH_ENDPOINT}</code> (405 / sin PATCH en
            Allow). Cuando el PR #80 del backend esté desplegado, podrás editar desde aquí.
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
          <fieldset className="wp-config-block" disabled={saving}>
            <legend>Pesos de la adherencia total</legend>
            <p className="wp-config-help">
              Deben sumar 100 %. Vista previa: {habitWeightsFormulaText(draft.habit_weights)}
            </p>
            <div className="wp-config-grid three">
              {(["training", "macros", "water"] as const).map((key) => (
                <label key={key}>
                  {key === "training" ? "Entreno %" : key === "macros" ? "Macros %" : "Agua %"}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={ratioToPct(draft.habit_weights[key])}
                    onChange={(e) => setWeight(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <FieldError id="habit_weights" errors={errors} />
          </fieldset>

          <fieldset className="wp-config-block" disabled={saving}>
            <legend>Días parciales y sin reporte</legend>
            <div className="wp-config-grid two">
              <label>
                Día parcial (semana en curso)
                <select
                  value={draft.partial_day_policy}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, partial_day_policy: e.target.value }));
                    setOk(false);
                  }}
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
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, missing_day_policy: e.target.value }));
                    setOk(false);
                  }}
                >
                  {POLICY_OPTIONS.missing_day_policy.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="wp-config-block" disabled={saving}>
            <legend>Macros · cumplimiento y rangos</legend>
            <p className="wp-config-help">
              Solo las macros marcadas deciden el ✓ / ✗ del día. Los rangos se expresan como % de la
              meta (vacío = sin umbral).
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
            <legend>Calorías mínimas y alertas</legend>
            <div className="wp-config-grid two">
              <div className="wp-config-switch-row">
                <span>Exigir mínimo de calorías</span>
                <Switch
                  label="Exigir mínimo de calorías"
                  checked={draft.calories_min_enabled}
                  onChange={(v) => {
                    setDraft((p) => ({ ...p, calories_min_enabled: v }));
                    setOk(false);
                  }}
                />
              </div>
              <label>
                Piso de calorías (% de la meta)
                <input
                  type="number"
                  min={0}
                  max={150}
                  step={1}
                  value={ratioToPct(draft.calories_low_ratio)}
                  onChange={(e) => {
                    const ratio = pctToRatio(e.target.value);
                    if (Number.isFinite(ratio as number) && ratio != null) {
                      setDraft((p) => ({ ...p, calories_low_ratio: ratio }));
                      setOk(false);
                    }
                  }}
                />
              </label>
              <div className="wp-config-switch-row">
                <span>Alerta por calorías bajas</span>
                <Switch
                  label="Alerta por calorías bajas"
                  checked={draft.calories_low_alert_enabled}
                  onChange={(v) => {
                    setDraft((p) => ({ ...p, calories_low_alert_enabled: v }));
                    setOk(false);
                  }}
                />
              </div>
            </div>
            <FieldError id="calories_low_ratio" errors={errors} />
          </fieldset>

          <fieldset className="wp-config-block" disabled={saving}>
            <legend>Metas, promedio y descanso</legend>
            <div className="wp-config-grid two">
              <label>
                Resolución de la meta nutricional
                <select
                  value={draft.goal_resolution}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, goal_resolution: e.target.value }));
                    setOk(false);
                  }}
                >
                  {POLICY_OPTIONS.goal_resolution.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Promedio semanal
                <select
                  value={draft.summary_avg_mode}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, summary_avg_mode: e.target.value }));
                    setOk(false);
                  }}
                >
                  {POLICY_OPTIONS.summary_avg_mode.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="wp-config-switch-row">
                <span>El alumno puede marcar Descanso (D)</span>
                <Switch
                  label="El alumno puede marcar Descanso"
                  checked={draft.allow_student_rest}
                  onChange={(v) => {
                    setDraft((p) => ({ ...p, allow_student_rest: v }));
                    setOk(false);
                  }}
                />
              </div>
              <label>
                Cómo cuenta un día de descanso
                <select
                  value={draft.rest_day_counts}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, rest_day_counts: e.target.value }));
                    setOk(false);
                  }}
                >
                  {POLICY_OPTIONS.rest_day_counts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="wp-config-block" disabled={saving}>
            <legend>Defaults de hábitos y entrenamiento</legend>
            <div className="wp-config-grid three">
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
                      setDraft((p) => ({
                        ...p,
                        default_water_goal_ml: Math.round(liters * 1000),
                      }));
                      setOk(false);
                    }
                  }}
                />
              </label>
              <label>
                Sesiones por semana (default)
                <input
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={draft.default_sessions_per_week}
                  onChange={(e) => {
                    setDraft((p) => ({
                      ...p,
                      default_sessions_per_week: Number(e.target.value) || p.default_sessions_per_week,
                    }));
                    setOk(false);
                  }}
                />
              </label>
              <label>
                Modo de entrenamiento
                <select
                  value={draft.training_mode}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, training_mode: e.target.value }));
                    setOk(false);
                  }}
                >
                  {POLICY_OPTIONS.training_mode.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <FieldError id="default_water_goal_ml" errors={errors} />
            <FieldError id="default_sessions_per_week" errors={errors} />
          </fieldset>

          <fieldset className="wp-config-block" disabled={saving}>
            <legend>Semáforo y vista del panel</legend>
            <div className="wp-config-grid three">
              <label>
                Verde si &gt;
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={draft.thresholds.green_gt}
                  onChange={(e) => {
                    setDraft((p) => ({
                      ...p,
                      thresholds: { ...p.thresholds, green_gt: Number(e.target.value) },
                    }));
                    setOk(false);
                  }}
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
                  onChange={(e) => {
                    setDraft((p) => ({
                      ...p,
                      thresholds: { ...p.thresholds, yellow_gte: Number(e.target.value) },
                    }));
                    setOk(false);
                  }}
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
                  onChange={(e) => {
                    setDraft((p) => ({
                      ...p,
                      thresholds: { ...p.thresholds, risk: Number(e.target.value) },
                    }));
                    setOk(false);
                  }}
                />
              </label>
              <label>
                Decimales del %
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={1}
                  value={draft.percent_decimals}
                  onChange={(e) => {
                    setDraft((p) => ({ ...p, percent_decimals: Number(e.target.value) }));
                    setOk(false);
                  }}
                />
              </label>
            </div>
            <FieldError id="thresholds" errors={errors} />
            <FieldError id="percent_decimals" errors={errors} />
            <div className="wp-config-switch-row">
              <span>Mostrar tarjetas de resumen</span>
              <Switch
                label="Mostrar tarjetas de resumen"
                checked={draft.show_summary_cards}
                onChange={(v) => {
                  setDraft((p) => ({ ...p, show_summary_cards: v }));
                  setOk(false);
                }}
              />
            </div>
            <div className="wp-config-switch-row">
              <span>Mostrar correo en la tabla</span>
              <Switch
                label="Mostrar correo en la tabla"
                checked={draft.show_email_in_table}
                onChange={(v) => {
                  setDraft((p) => ({ ...p, show_email_in_table: v }));
                  setOk(false);
                }}
              />
            </div>
            <div className="wp-config-switch-row">
              <span>Resumen con IA</span>
              <Switch
                label="Resumen con IA"
                checked={draft.ai_summary_enabled}
                onChange={(v) => {
                  setDraft((p) => ({ ...p, ai_summary_enabled: v }));
                  setOk(false);
                }}
              />
            </div>
          </fieldset>

          {formError ? (
            <p className="wp-feedback-error" role="alert">
              {formError}
            </p>
          ) : null}
          {ok ? <p className="wp-sent">Guardado. Se recargó la config y el panel.</p> : null}

          <div className="wp-config-actions">
            <button
              type="button"
              className="secondary"
              disabled={saving || !dirty}
              onClick={() => {
                setDraft(baseline);
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
