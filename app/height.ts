/**
 * Estatura siempre en centímetros en la UI.
 * Si el usuario escribe metros (valor > 0 y < 3), se convierte a cm.
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

/** Interpreta un input como cm; convierte metros (< 3) a cm. */
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
  if (n > 0 && n < 3) {
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
 * Para mostrar: si el dato guardado parece metros (< 3), lo muestra en cm.
 * Así la ficha no muestra "1,7 cm" por un ingreso erróneo antiguo.
 */
export function heightCmForDisplay(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 0 && n < 3) return Math.round(n * 100);
  return n;
}

export function formatHeightCm(raw: unknown, empty = "—"): string {
  const cm = heightCmForDisplay(raw);
  if (cm == null) return empty;
  const text = Number.isInteger(cm) ? String(cm) : String(cm).replace(".", ",");
  return `${text} cm`;
}
