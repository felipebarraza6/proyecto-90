/** Student macro targets from GET /api/app. */
export type MacroPlan = Record<string, unknown>;

const MACRO_KEYS = ["calories", "protein", "carbs", "fats"] as const;

/**
 * Prefer `effective_macro_targets` when the backend sends a non-null object.
 * If the field is missing or null, keep `nutrition.*` (backward compatible).
 */
export function resolveStudentMacroPlan(
  nutrition: MacroPlan | null | undefined,
  effectiveMacroTargets: MacroPlan | null | undefined,
): MacroPlan | null {
  const base = nutrition ?? null;
  if (effectiveMacroTargets == null) return base;
  const next: MacroPlan = { ...(base || {}) };
  for (const key of MACRO_KEYS) {
    if (key in effectiveMacroTargets) next[key] = effectiveMacroTargets[key];
  }
  return next;
}
