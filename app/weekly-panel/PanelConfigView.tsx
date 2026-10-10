import {
  formatRangeHint,
  habitWeightsFormulaText,
  macroKeyLabel,
  PANEL_CONFIG_WRITE_ENDPOINT_MISSING,
  pctLabel,
  policyLabel,
  type MacroKey,
} from "./panelConfig";
import type { PanelConfig } from "./types";

type ConfigRow = {
  id: string;
  label: string;
  help: string;
  value: string;
};

function rowsFrom(config: PanelConfig): ConfigRow[] {
  const w = config.habit_weights;
  const requires = config.macro_met_requires.map(macroKeyLabel).join(", ");
  const rangeLine = (key: MacroKey) =>
    `${macroKeyLabel(key)}: ${formatRangeHint(config.macro_ranges[key])}`;

  return [
    {
      id: "habit_weights",
      label: "Pesos de la adherencia total",
      help: "Cuánto pesa cada hábito en el % total (entreno, macros y agua). Debe coincidir en panel, participantes, resumen e hitos.",
      value: habitWeightsFormulaText(w),
    },
    {
      id: "habit_weights_detail",
      label: "Detalle de pesos",
      help: "Valores numéricos (0–1) que usa el backend.",
      value: `Entreno ${pctLabel(w.training)} · Macros ${pctLabel(w.macros)} · Agua ${pctLabel(w.water)}`,
    },
    {
      id: "partial_day_policy",
      label: "Día parcial (semana en curso)",
      help: "Cómo se trata un día de la semana actual que todavía no terminó.",
      value: policyLabel(config.partial_day_policy),
    },
    {
      id: "missing_day_policy",
      label: "Día sin reporte",
      help: "Si el alumno no registró el día: ¿se excluye del promedio o cuenta como 0 %?",
      value: policyLabel(config.missing_day_policy),
    },
    {
      id: "macro_met_requires",
      label: "Qué macros definen el cumplimiento",
      help: "Solo estas macros deciden si el día de macros es ✓ o ✗. Las demás pueden colorear y alertar sin decidir el ✓.",
      value: requires || "—",
    },
    {
      id: "macro_ranges",
      label: "Rangos de macros (respecto a la meta)",
      help: "Umbrales mínimo/máximo por macro. Ej.: proteína ≥ 90 %, calorías ≤ 110 %.",
      value: (["calories", "protein", "carbs", "fats"] as MacroKey[])
        .map(rangeLine)
        .join(" · "),
    },
    {
      id: "calories_min_enabled",
      label: "Mínimo de calorías activo",
      help: "Si está activo, además del tope superior se exige un piso de calorías para marcar macros como cumplidas.",
      value: config.calories_min_enabled ? "Sí" : "No",
    },
    {
      id: "calories_low_ratio",
      label: "Piso de calorías (% de la meta)",
      help: "Solo aplica si el mínimo de calorías está activo.",
      value: `${Math.round(config.calories_low_ratio * 100)} %`,
    },
    {
      id: "calories_low_alert_enabled",
      label: "Alerta por calorías bajas",
      help: "Si el análisis debe avisar cuando las calorías quedan bajo el piso configurado.",
      value: config.calories_low_alert_enabled ? "Sí" : "No",
    },
    {
      id: "goal_resolution",
      label: "Resolución de la meta nutricional",
      help: "Si cada día usa la meta vigente ese día, o se fija otra regla (p. ej. última meta).",
      value: policyLabel(config.goal_resolution),
    },
    {
      id: "summary_avg_mode",
      label: "Promedio semanal",
      help: "Cómo se promedian los % diarios para el total de la semana.",
      value: policyLabel(config.summary_avg_mode),
    },
    {
      id: "allow_student_rest",
      label: "El alumno puede marcar Descanso",
      help: "Si está activo, el alumno ve la opción «D» en entreno. Si no, solo el coach define descansos en el plan.",
      value: config.allow_student_rest ? "Sí" : "No",
    },
    {
      id: "rest_day_counts",
      label: "Cómo cuenta un día de descanso",
      help: "Si el «D» se excluye del % o cuenta como cumplido.",
      value: policyLabel(config.rest_day_counts),
    },
    {
      id: "default_water_goal_ml",
      label: "Meta de agua por defecto",
      help: "Se usa cuando el alumno aún no tiene plan de hábitos propio.",
      value: `${(config.default_water_goal_ml / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} L / día`,
    },
    {
      id: "default_sessions_per_week",
      label: "Sesiones de entreno por semana (default)",
      help: "Fallback si el plan del alumno no fija sesiones (además de profile.training_days).",
      value: String(config.default_sessions_per_week),
    },
    {
      id: "training_mode",
      label: "Modo de entrenamiento",
      help: "Cómo se planifican las sesiones (p. ej. sesiones por semana vs. días fijos).",
      value: policyLabel(config.training_mode),
    },
    {
      id: "thresholds",
      label: "Semáforo del panel",
      help: "Umbrales de color del % semanal y diario.",
      value: `Verde > ${config.thresholds.green_gt} · Amarillo ≥ ${config.thresholds.yellow_gte} · Rojo < ${config.thresholds.yellow_gte} · Riesgo < ${config.thresholds.risk}`,
    },
  ];
}

export function PanelConfigView({ config }: { config: PanelConfig }) {
  const rows = rowsFrom(config);

  return (
    <section className="wp-config" aria-labelledby="wp-config-title">
      <header className="wp-config-head">
        <div>
          <span className="eyebrow">SOLO ADMINISTRADOR</span>
          <h2 id="wp-config-title">Reglas de adherencia del panel</h2>
          <p>
            Valores actuales que usa el backend para calcular % y alertas. Marce aún no cerró
            varias de estas reglas: aquí las ves claras. La edición desde la app llegará cuando
            el backend exponga escritura.
          </p>
        </div>
      </header>
      <div className="wp-config-readonly" role="status">
        <b>Solo lectura</b>
        <p>
          Falta el endpoint de escritura: <code>{PANEL_CONFIG_WRITE_ENDPOINT_MISSING}</code>.
          Hasta entonces los cambios se hacen en el backend (PanelConfig / PR #80).
        </p>
      </div>
      <ul className="wp-config-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div>
              <h3>{row.label}</h3>
              <p>{row.help}</p>
            </div>
            <strong>{row.value}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
