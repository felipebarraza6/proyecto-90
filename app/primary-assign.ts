/** Estado del control "Asignar principal" (ficha admin y expediente del coach). */
export function primaryAssignControl(
  choice: string,
  currentProgramId: string,
  approvalStatus: string,
): { disabled: boolean; label: string } {
  const selected = String(choice || "");
  const current = String(currentProgramId || "");
  const sameApproved = selected !== "" && selected === current && approvalStatus === "approved";
  const changing = selected !== "" && current !== "" && selected !== current;
  return {
    disabled: selected === "" || sameApproved,
    label: changing ? "Cambiar principal" : "Asignar principal",
  };
}

/** Tras #406 la asignación principal vuelve `approved`. El mensaje lo refleja si el POST lo dice. */
export function primaryAssignMessage(approvalStatus: unknown, programName: string): string {
  const name = String(programName || "").trim();
  const approved = String(approvalStatus || "") === "approved";
  if (approved) return name ? `${name} quedó asignada y aprobada.` : "Rutina principal asignada y aprobada.";
  return name ? `${name} quedó asignada.` : "Rutina principal asignada.";
}
