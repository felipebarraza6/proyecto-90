import {
  formatRangeHint,
  habitWeightsFormulaText,
  macroKeyLabel,
  policyLabel,
  type MacroKey,
} from "./panelConfig";
import type { PanelConfig } from "./types";

export function PanelLegend({
  greenGt,
  yellowGte,
  config,
}: {
  greenGt: number;
  yellowGte: number;
  config?: PanelConfig | null;
}) {
  const weightsText = habitWeightsFormulaText(
    config?.habit_weights,
    config?.adherence_equal_weights_as_40_40_20,
  );
  const restCounts = policyLabel(config?.rest_day_counts || "exclude");
  const requires = (config?.macro_met_requires || ["calories", "protein"])
    .map((k) => macroKeyLabel(k as MacroKey))
    .join(" y ");
  const ranges = config?.macro_ranges;
  const rangeHints = ranges
    ? (["calories", "protein", "carbs", "fats"] as MacroKey[])
        .map((k) => `${macroKeyLabel(k)} ${formatRangeHint(ranges[k])}`)
        .join(" · ")
    : "kcal ≤ 110 % · proteína ≥ 90 % · carbs/grasas 90–110 % (solo color)";

  return (
    <div className="wp-legend" aria-label="Leyenda">
      <p>
        <span className="wp-dot green" /> Semáforo: &gt; {greenGt} verde · {yellowGte}–
        {greenGt} inclusive amarillo · &lt; {yellowGte} rojo
      </p>
      <p>
        <span className="wp-dot" /> Estados: No iniciado · Día futuro · Hoy · Sin reportar ·
        Cumplió · No cumplió · Descanso (D
        {config?.rest_day_counts ? ` · ${restCounts.toLowerCase()}` : ""}) · No aplica
      </p>
      <p>
        <span className="wp-dot" /> Fórmula total: {weightsText}
      </p>
      <p>
        <span className="wp-dot" /> Macros ✓: {requires}. Rangos: {rangeHints}
      </p>
    </div>
  );
}
