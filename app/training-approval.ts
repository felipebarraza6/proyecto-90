/** La asignación principal deja la ficha en el estado que devuelve `program.assign`. */
export function approvalAfterAssign(
  current: unknown,
  response: { kind?: unknown; trainingApprovalStatus?: unknown },
): string {
  const previous = String(current || "");
  if (String(response.kind || "primary") === "emergency") return previous;
  const next = response.trainingApprovalStatus;
  if (typeof next === "string" && next) return next;
  return previous;
}
