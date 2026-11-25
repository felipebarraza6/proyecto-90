/**
 * Tipo de programa del participante (contrato yggdra_arq#509).
 *
 * - `90_days`: programa estándar de 90 días; la duración es fija.
 * - `custom`: programa personalizado, con duración explícita entre 7 y 365 días.
 * - `other`: otro programa; usa una etiqueta libre y la duración de la sucursal.
 *
 * El backend puede devolver `program_type` vacío en filas antiguas: se asume
 * `90_days` para no dejar fuera a los participantes que ya existían.
 * El módulo es puro para reutilizarlo en la tabla, el editor y los tests.
 */
export const PROGRAM_TYPES = [
  { value: "90_days", label: "90 días" },
  { value: "custom", label: "Personalizado" },
  { value: "other", label: "Otro" },
] as const;

export type ProgramType = (typeof PROGRAM_TYPES)[number]["value"];
export type ProgramTypeFilter = "all" | ProgramType;

export const PROGRAM_TYPE_VALUES: ProgramType[] = PROGRAM_TYPES.map((item) => item.value);

/** Normaliza el valor recibido; sin dato se asume el programa de 90 días. */
export function normalizeProgramType(value: unknown): string {
  const raw = value == null ? "" : String(value).trim();
  return raw || "90_days";
}

/** Etiqueta legible del tipo de programa; un valor desconocido se muestra crudo. */
export function programTypeLabel(row: Record<string, unknown>): string {
  const type = normalizeProgramType(row.program_type);
  if (type === "other") {
    const custom = String(row.program_type_label ?? "").trim();
    if (custom) return custom;
  }
  const known = PROGRAM_TYPES.find((item) => item.value === type);
  return known ? known.label : String(type);
}

/** Duración visible: «90 días», «120 días» o «—» cuando no aplica. */
export function programDurationLabel(row: Record<string, unknown>): string {
  const type = normalizeProgramType(row.program_type);
  if (type === "90_days") return "90 días";
  const days = Number(row.program_duration_days);
  return Number.isFinite(days) && days > 0 ? `${Math.trunc(days)} días` : "—";
}

/** Filtra participantes por tipo de programa. */
export function filterPeopleByProgramType<T extends Record<string, unknown>>(
  rows: T[],
  filter: ProgramTypeFilter = "all",
): T[] {
  if (filter === "all") return [...rows];
  return rows.filter((row) => normalizeProgramType(row.program_type) === filter);
}

export type ProgramTypeValidation = {
  ok: boolean;
  error?: string;
  /** Duración que debe enviarse al backend: null cuando la define la sucursal. */
  durationDays?: number | null;
  /** Etiqueta libre normalizada (solo aplica a `other`). */
  programTypeLabel?: string;
};

/**
 * Valida y normaliza el tipo de programa antes de guardarlo.
 * `90_days` limpia la duración; `custom` exige 7–365 días; `other` exige etiqueta.
 */
export function validateProgramType(input: {
  type?: unknown;
  durationDays?: unknown;
  label?: unknown;
}): ProgramTypeValidation {
  const type = normalizeProgramType(input.type);
  const label = String(input.label ?? "").trim();
  const rawDuration = input.durationDays;
  const hasDuration =
    rawDuration !== undefined && rawDuration !== null && String(rawDuration).trim() !== "";
  const duration = hasDuration ? Number(rawDuration) : Number.NaN;

  if (type === "90_days") {
    return { ok: true, durationDays: null, programTypeLabel: "" };
  }

  if (type === "custom") {
    if (!hasDuration || !Number.isFinite(duration)) {
      return { ok: false, error: "Ingresa la duración en días del programa personalizado." };
    }
    if (duration < 7 || duration > 365) {
      return { ok: false, error: "La duración del programa personalizado debe estar entre 7 y 365 días." };
    }
    return { ok: true, durationDays: Math.trunc(duration), programTypeLabel: "" };
  }

  if (type === "other") {
    if (!label) {
      return { ok: false, error: "Escribe una etiqueta para el tipo de programa." };
    }
    return { ok: true, durationDays: null, programTypeLabel: label };
  }

  return { ok: false, error: "Selecciona un tipo de programa válido." };
}
