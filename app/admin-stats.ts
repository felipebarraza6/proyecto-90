import { finite } from "./participant-summary.ts";

type Row = Record<string, unknown>;

export type Average = { value: number | null; n: number };

/** Promedio simple. `null` cuando no hay valores (no inventa un cero). */
export function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numericValues(values: unknown[]): number[] {
  return values.map(finite).filter((value): value is number => value != null);
}

/**
 * Peso inicial y del día 30 sobre la misma población: alumnos con
 * `weight_day_30` numérico (medición real, no interpolada).
 * `delta` es el promedio de las diferencias individuales, no la resta
 * de los dos promedios.
 */
export function weightStats(people: Row[]): {
  initial: number | null;
  day30: number | null;
  delta: number | null;
  n: number;
} {
  const withDay30 = people.filter((person) => finite(person.weight_day_30) != null);
  const initial = averageOf(numericValues(withDay30.map((person) => person.weight)));
  const day30 = averageOf(numericValues(withDay30.map((person) => person.weight_day_30)));
  const delta = averageOf(
    withDay30
      .map((person) => {
        const start = finite(person.weight);
        const milestone = finite(person.weight_day_30);
        return start == null || milestone == null ? null : milestone - start;
      })
      .filter((value): value is number => value != null),
  );
  return { initial, day30, delta, n: withDay30.length };
}

function stageAverage(people: Row[], key: string): Average {
  const values = numericValues(people.map((person) => person[key]));
  return { value: averageOf(values), n: values.length };
}

/** Adherencia por tramo. Cada tramo usa su propio n y es null si nadie tiene el dato. */
export function stageStats(people: Row[]): {
  day30: Average;
  day60: Average;
  day90: Average;
  total: Average;
} {
  return {
    day30: stageAverage(people, "adherence_day_30"),
    day60: stageAverage(people, "adherence_day_60"),
    day90: stageAverage(people, "adherence_day_90"),
    total: stageAverage(people, "adherence"),
  };
}

/**
 * Suma de los deltas individuales (último peso medido − peso inicial).
 * Puede ser negativa si el grupo subió de peso. `null` cuando nadie
 * tiene ambos datos.
 */
export function kgLostTotal(people: Row[]): { value: number | null; n: number } {
  const deltas = people
    .map((person) => {
      const start = finite(person.weight);
      const later = numericValues([person.weight_day_30, person.weight_day_60, person.weight_day_90]);
      if (start == null || later.length === 0) return null;
      return later[later.length - 1] - start;
    })
    .filter((value): value is number => value != null);
  return {
    value: deltas.length === 0 ? null : deltas.reduce((sum, value) => sum + value, 0),
    n: deltas.length,
  };
}
