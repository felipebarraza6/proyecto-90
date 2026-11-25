const COPY_SUFFIX = "(copia)";

/** Nombre sugerido para una copia: recorta espacios y no duplica el sufijo. */
export function copiedRoutineName(name: unknown): string {
  const base = String(name ?? "").trim() || "Rutina";
  if (base.toLowerCase().endsWith(COPY_SUFFIX)) return base;
  return `${base} ${COPY_SUFFIX}`;
}
