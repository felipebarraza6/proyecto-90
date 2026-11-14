import { AppActionError } from "./api-error.ts";

export type AssignedStudent = { id?: unknown; name?: unknown; email?: unknown; kind?: unknown };

export function assignedStudentLabel(student: AssignedStudent): string {
  const name = String(student.name || "").trim();
  const email = String(student.email || "").trim();
  const who = name || email || "Alumno";
  const kind = String(student.kind || "");
  if (kind === "emergency") return `${who} (emergencia)`;
  if (kind === "primary") return `${who} (principal)`;
  return who;
}

export function deleteAssignedConfirmMessage(students: AssignedStudent[]): string {
  const lines = (students.length ? students : [{}]).map((student) => `• ${assignedStudentLabel(student)}`);
  return `Esta rutina tiene alumnos asignados. Confirma para desactivar sus inscripciones:\n\n${lines.join("\n")}\n\n¿Eliminar la rutina de todas formas?`;
}

export function isAssignedDeleteConflict(error: unknown): error is AppActionError {
  return error instanceof AppActionError && error.status === 409 && error.body?.needsConfirmation === true;
}
