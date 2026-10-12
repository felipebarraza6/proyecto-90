/**
 * Estatura siempre en centímetros en la UI.
 *
 * Regla de metros → cm:
 * - Si 0 < n < 3 → metros (1,70 → 170).
 * - Si 3 ≤ n < 10 → también metros (p. ej. 5 o 5,9 mal escritos como “medio metro”
 *   o decimales omitidos); 5 → 500 se rechaza por rango; 1,75 ya cubierto arriba.
 *   Valores típicos erróneos: alguien escribe “175” bien; “1.75” o “1,75” (<3);
 *   “5.9” (pies mal) o “5” no son cm válidos (< min) → se intenta como metros *100
 *   y si sigue fuera de rango, se muestra error claro.
 * - Si n ≥ 10 → centímetros.
 */

export type HeightRangeCm = { min: number; max: number };

export type HeightNormalizeResult = {
  /** Valor en cm listo para guardar/mostrar, o null si vacío/inválido. */
  cm: number | null;
  /** Mensaje en español para el usuario. */
  error?: string;
  /** True si el valor original venía en metros. */
  convertedFromMeters?: boolean;
};

/** True si el número parece metros (no cm). */
export function looksLikeMeters(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n < 10;
}

/** Interpreta un input como cm; convierte metros (< 10) a cm. */
export function normalizeHeightInputCm(
  raw: string | number | null | undefined,
  ranges: HeightRangeCm,
): HeightNormalizeResult {
  if (raw == null) return { cm: null };
  const trimmed = String(raw).trim().replace(",", ".");
  if (!trimmed) return { cm: null };

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    return {
      cm: null,
      error: "Ingresa la estatura en centímetros (por ejemplo 170).",
    };
  }

  let cm = n;
  let convertedFromMeters = false;
  if (looksLikeMeters(n)) {
    cm = Math.round(n * 100);
    convertedFromMeters = true;
  } else {
    cm = Math.round(n * 10) / 10;
  }

  if (cm < ranges.min || cm > ranges.max) {
    const hint = convertedFromMeters
      ? ` Si escribiste metros (por ejemplo 1,70), equivale a ${Math.round(n * 100)} cm.`
      : "";
    return {
      cm: null,
      error: `La estatura debe estar entre ${ranges.min} y ${ranges.max} cm.${hint}`,
      convertedFromMeters,
    };
  }

  return { cm, convertedFromMeters };
}

/**
 * Para mostrar: si el dato guardado parece metros (< 10), lo muestra en cm.
 */
export function heightCmForDisplay(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (looksLikeMeters(n)) return Math.round(n * 100);
  return n;
}

export function formatHeightCm(raw: unknown, empty = "—"): string {
  const cm = heightCmForDisplay(raw);
  if (cm == null) return empty;
  const text = Number.isInteger(cm) ? String(cm) : String(cm).replace(".", ",");
  return `${text} cm`;
}
