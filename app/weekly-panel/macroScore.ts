/**
 * Cumplimiento ponderado de macros (spec Marce oct-2026).
 * El backend es la fuente de verdad; este módulo sirve para mostrar % en el
 * front cuando el API aún no manda `pct`, y para tests de las reglas.
 */

import type { MacroRange, MacroRanges, MacroWeights } from "./types";

export type { MacroWeights };

/** Misma cifra que PANEL_CONFIG_DEFAULTS.macro_weights (evitar import circular Node ESM). */
export const DEFAULT_MACRO_WEIGHTS: MacroWeights = {
  calories: 40,
  protein: 40,
  carbs: 10,
  fats: 10,
};

function ensureWeights(weights?: MacroWeights | null): MacroWeights {
  if (!weights) return { ...DEFAULT_MACRO_WEIGHTS };
  return {
    calories: Number(weights.calories) >= 0 ? Number(weights.calories) : DEFAULT_MACRO_WEIGHTS.calories,
    protein: Number(weights.protein) >= 0 ? Number(weights.protein) : DEFAULT_MACRO_WEIGHTS.protein,
    carbs: Number(weights.carbs) >= 0 ? Number(weights.carbs) : DEFAULT_MACRO_WEIGHTS.carbs,
    fats: Number(weights.fats) >= 0 ? Number(weights.fats) : DEFAULT_MACRO_WEIGHTS.fats,
  };
}

export type MacroValues = Partial<Record<keyof MacroWeights, number | null | undefined>>;
export type MacroTargets = Partial<Record<keyof MacroWeights, number | null | undefined>>;

const KEYS: (keyof MacroWeights)[] = ["calories", "protein", "carbs", "fats"];

/** % de cumplimiento de calorías: dentro del rango → 100 − |desviación|; fuera → 0. */
export function calorieCompliancePct(
  actual: number,
  target: number,
  range: MacroRange,
): number {
  if (!target || !Number.isFinite(actual) || !Number.isFinite(target)) return 0;
  const ratio = actual / target;
  const min = range.min;
  const max = range.max;
  if (min != null && ratio < min) return 0;
  if (max != null && ratio > max) return 0;
  const deviationPct = (Math.abs(actual - target) / target) * 100;
  return Math.max(0, 100 - deviationPct);
}

/**
 * Proteína: bajo el mínimo → 0; entre mínimo y meta → % alcanzado;
 * en o sobre la meta → 100.
 */
export function proteinCompliancePct(
  actual: number,
  target: number,
  range: MacroRange,
): number {
  if (!target || !Number.isFinite(actual) || !Number.isFinite(target)) return 0;
  const ratio = actual / target;
  const min = range.min;
  if (min != null && ratio < min) return 0;
  if (ratio >= 1) return 100;
  return Math.max(0, ratio * 100);
}

/** Carbs/grasas: descuento simétrico por desviación; piso 0; sin corte duro. */
export function symmetricCompliancePct(actual: number, target: number): number {
  if (!target || !Number.isFinite(actual) || !Number.isFinite(target)) return 0;
  const deviationPct = (Math.abs(actual - target) / target) * 100;
  return Math.max(0, 100 - deviationPct);
}

export function singleMacroCompliancePct(
  key: keyof MacroWeights,
  actual: number,
  target: number,
  ranges: MacroRanges,
): number {
  if (key === "calories") return calorieCompliancePct(actual, target, ranges.calories);
  if (key === "protein") return proteinCompliancePct(actual, target, ranges.protein);
  return symmetricCompliancePct(actual, target);
}

export function macroWeightsTotal(weights: MacroWeights): number {
  return KEYS.reduce((sum, key) => sum + Number(weights[key] || 0), 0);
}

/**
 * % ponderado del día de macros (0–100). Devuelve null si falta algún valor
 * o meta de las macros con peso &gt; 0.
 */
export function macroDayPct(
  values: MacroValues,
  targets: MacroTargets,
  ranges: MacroRanges,
  weights: MacroWeights = DEFAULT_MACRO_WEIGHTS,
): number | null {
  const w = ensureWeights(weights);
  let weighted = 0;
  let totalW = 0;
  for (const key of KEYS) {
    const weight = Number(w[key] || 0);
    if (weight <= 0) continue;
    const target = Number(targets[key] || 0);
    const raw = values[key];
    if (!target || raw == null) return null;
    const actual = Number(raw);
    if (!Number.isFinite(actual)) return null;
    weighted += singleMacroCompliancePct(key, actual, target, ranges) * weight;
    totalW += weight;
  }
  if (totalW <= 0) return null;
  return weighted / totalW;
}

/** Redondeo solo para mostrar (spec: no redondear en el cálculo interno). */
export function formatMacroDayPct(pct: number | null | undefined, decimals = 0): string {
  if (pct == null || !Number.isFinite(Number(pct))) return "";
  const places = Math.max(0, Math.min(2, Math.round(Number(decimals) || 0)));
  const factor = 10 ** places;
  const n = Math.round(Number(pct) * factor) / factor;
  return `${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: places,
    minimumFractionDigits: 0,
  }).format(n)} %`;
}

/** Texto corto de cómo se puntúa cada macro (Reglas). */
export const MACRO_SCORE_HINTS: Record<keyof MacroWeights, string> = {
  calories:
    "Dentro del rango: 100 menos la desviación % respecto de la meta. Fuera del rango: 0 %.",
  protein: "Bajo el mínimo configurado: 0 %. Desde el mínimo hasta la meta: el % alcanzado. En o sobre la meta: 100 %.",
  carbs: "Pasarse o quedarse corto descuenta lo mismo (p. ej. 10 % arriba o abajo = 90 %). Piso 0 %.",
  fats: "Pasarse o quedarse corto descuenta lo mismo (p. ej. 10 % arriba o abajo = 90 %). Piso 0 %.",
};

export const REST_DAY_WEIGHT_HINT =
  "En un día de descanso el entreno no cuenta: macros 40/60 y agua 20/60 (proporción exacta; se redondea solo al mostrar).";

export type MacroPeriodKey = "1-30" | "31-60" | "61-90";

export type MacroPeriodTargets = {
  period: MacroPeriodKey;
  label: string;
  dayFrom: number;
  dayTo: number;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  effective_from: string | null;
};

export const MACRO_PERIODS: { period: MacroPeriodKey; label: string; dayFrom: number; dayTo: number }[] = [
  { period: "1-30", label: "Días 1–30", dayFrom: 1, dayTo: 30 },
  { period: "31-60", label: "Días 31–60", dayFrom: 31, dayTo: 60 },
  { period: "61-90", label: "Días 61–90", dayFrom: 61, dayTo: 90 },
];

/** Día del desafío → tramo de metas (día ≤0 o desconocido → 1–30). */
export function periodForChallengeDay(day: number): MacroPeriodKey {
  const d = Number(day);
  if (!Number.isFinite(d) || d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  return "61-90";
}

export type MacroTargetDraftInput = {
  period: MacroPeriodKey;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  effective_from: string | null;
  note: string | null;
};

export type MacroTargetSaveBodyLike = {
  period: MacroPeriodKey;
  calories: number;
  protein: number;
  carbs?: number | null;
  fats?: number | null;
  effective_from?: string | null;
  note?: string | null;
};

/**
 * Qué tramos POST-ear a …/macro-targets. Vacío arrastra el anterior;
 * sin calorías+proteína efectivas no hay body (evita “éxito” sin request).
 */
export function buildMacroTargetSaveBodies(
  drafts: MacroTargetDraftInput[],
): MacroTargetSaveBodyLike[] {
  const carried = carryForwardMacroPeriods(
    drafts.map((row) => ({
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fats: row.fats,
      effective_from: row.effective_from,
    })),
  );
  const bodies: MacroTargetSaveBodyLike[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const effective = carried[i];
    const calories = effective?.calories;
    const protein = effective?.protein;
    if (calories == null || protein == null) continue;
    bodies.push({
      period: draft.period,
      calories,
      protein,
      carbs: effective?.carbs ?? null,
      fats: effective?.fats ?? null,
      effective_from: draft.effective_from?.trim() || effective?.effective_from || null,
      note: draft.note?.trim() || null,
    });
  }
  return bodies;
}

/** Sincronizar «Guardar plan» con el tramo vigente del alumno. */
export function buildPlanSyncMacroTargetBody(input: {
  day: number;
  calories: number;
  protein: number;
  carbs?: number | null;
  fats?: number | null;
  effective_from?: string | null;
}): MacroTargetSaveBodyLike {
  return {
    period: periodForChallengeDay(input.day),
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs ?? null,
    fats: input.fats ?? null,
    effective_from: input.effective_from || null,
    note: null,
  };
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Lee periodos del alumno (backend opcional) o parte del plan actual. */
export function readMacroPeriods(person: Record<string, unknown>): MacroPeriodTargets[] {
  const raw = person.macro_periods ?? person.macroPeriods ?? person.nutrition_periods;
  const byPeriod = new Map<MacroPeriodKey, Partial<MacroPeriodTargets>>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const period = String(rec.period || "") as MacroPeriodKey;
      if (!MACRO_PERIODS.some((p) => p.period === period)) continue;
      byPeriod.set(period, {
        calories: numOrNull(rec.calories),
        protein: numOrNull(rec.protein),
        carbs: numOrNull(rec.carbs),
        fats: numOrNull(rec.fats),
        effective_from: rec.effective_from == null ? null : String(rec.effective_from).slice(0, 10),
      });
    }
  }
  return MACRO_PERIODS.map((meta, index) => {
    const saved = byPeriod.get(meta.period);
    const fallback =
      index === 0
        ? {
            calories: numOrNull(person.calories),
            protein: numOrNull(person.protein),
            carbs: numOrNull(person.carbs),
            fats: numOrNull(person.fats),
            effective_from:
              person.effective_from == null ? null : String(person.effective_from).slice(0, 10),
          }
        : {};
    return {
      ...meta,
      calories: saved?.calories ?? fallback.calories ?? null,
      protein: saved?.protein ?? fallback.protein ?? null,
      carbs: saved?.carbs ?? fallback.carbs ?? null,
      fats: saved?.fats ?? fallback.fats ?? null,
      effective_from: saved?.effective_from ?? fallback.effective_from ?? null,
    };
  });
}

/**
 * Vacío = arrastra el tramo anterior. Devuelve la fila efectiva para guardar /
 * mostrar, sin mutar el borrador vacío del usuario.
 */
export function carryForwardMacroPeriods(
  rows: Pick<MacroPeriodTargets, "calories" | "protein" | "carbs" | "fats" | "effective_from">[],
): typeof rows {
  type PeriodRow = (typeof rows)[number];
  const out: PeriodRow[] = [];
  let prev: PeriodRow | null = null;
  for (const row of rows) {
    const next: PeriodRow = {
      calories: row.calories ?? prev?.calories ?? null,
      protein: row.protein ?? prev?.protein ?? null,
      carbs: row.carbs ?? prev?.carbs ?? null,
      fats: row.fats ?? prev?.fats ?? null,
      effective_from: row.effective_from ?? prev?.effective_from ?? null,
    };
    out.push(next);
    prev = next;
  }
  return out;
}
