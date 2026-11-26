export function participantDeleteMessage(name: string): string {
  const who = String(name || "").trim() || "este participante";
  return `¿Eliminar a ${who} y todos sus datos? Esta acción no se puede deshacer.`;
}
