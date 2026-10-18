/**
 * Quién puede editar metas de macros (calorías/P/C/G) en la ficha del panel.
 * Nutri + admin: sí. Coach: no (no lo necesita).
 */
export function canEditMacroTargets(role: string, specialty?: string): boolean {
  return role === "admin" || (role === "professional" && specialty === "nutrition");
}
